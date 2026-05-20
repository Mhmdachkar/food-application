-- ============================================================
-- P0-1 + P0-3 + P0-4: Server-side price/promo validation with idempotency
-- Creates the create_order RPC that calculates all monetary
-- values from menu_items.price instead of trusting the client.
-- Validates promo codes against the promotions table.
-- Requires: fix_order_idempotency.sql and fix_promo_validation.sql
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_order(
  p_user_id          UUID,
  p_customer_name    TEXT,
  p_items            JSONB,
  p_address_snapshot JSONB,
  p_notes            TEXT DEFAULT '',
  p_promo_code       TEXT DEFAULT NULL,
  p_tip              NUMERIC(8,2) DEFAULT 0,
  p_payment_method   TEXT DEFAULT 'card',
  p_delivery_method  TEXT DEFAULT 'delivery',
  p_idempotency_key  UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order_id       UUID;
  v_existing_id    UUID;
  v_item           JSONB;
  v_item_id        UUID;
  v_unit_price     NUMERIC(8,2);
  v_qty            INT;
  v_subtotal       NUMERIC(8,2) := 0;
  v_tax            NUMERIC(8,2);
  v_delivery_fee   NUMERIC(8,2);
  v_discount       NUMERIC(8,2) := 0;
  v_total          NUMERIC(8,2);
  v_promo_type     TEXT;
  v_promo_value    NUMERIC(8,2);
  v_tax_rate       NUMERIC(6,4) := 0.0875;
  v_free_del_min   NUMERIC(8,2) := 35.00;
  v_del_fee_amount NUMERIC(8,2) := 3.99;
BEGIN
  -- 0. Idempotency check: if this key was already used, return the existing order
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing_id
    FROM orders
    WHERE idempotency_key = p_idempotency_key;

    IF v_existing_id IS NOT NULL THEN
      RETURN v_existing_id;
    END IF;
  END IF;

  -- 1. Create the order row with placeholder totals
  INSERT INTO orders (
    user_id, customer_name, delivery_method, status,
    payment_method, address_snapshot, notes, promo_code, tip,
    idempotency_key
  ) VALUES (
    p_user_id, p_customer_name, p_delivery_method, 'PLACED',
    p_payment_method, p_address_snapshot, p_notes, p_promo_code, p_tip,
    p_idempotency_key
  )
  RETURNING id INTO v_order_id;

  -- 2. Insert order_lines and accumulate subtotal from menu_items.price
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_item_id := (v_item ->> 'item_id')::UUID;
    v_qty     := COALESCE((v_item ->> 'qty')::INT, 1);

    -- Look up the authoritative price from the menu_items table
    SELECT price INTO v_unit_price
    FROM menu_items
    WHERE id = v_item_id AND is_available = TRUE;

    IF v_unit_price IS NULL THEN
      RAISE EXCEPTION 'Menu item % is not available or does not exist', v_item_id;
    END IF;

    INSERT INTO order_lines (order_id, item_id, name_snapshot, image_url_snapshot, qty, unit_price, notes)
    VALUES (
      v_order_id,
      v_item_id,
      COALESCE(v_item ->> 'name', ''),
      v_item ->> 'image_url',
      v_qty,
      v_unit_price,
      v_item ->> 'notes'
    );

    v_subtotal := v_subtotal + (v_unit_price * v_qty);
  END LOOP;

  -- 3. Validate promo code against the promotions table
  IF p_promo_code IS NOT NULL AND p_promo_code <> '' THEN
    SELECT discount_type, discount_value
    INTO v_promo_type, v_promo_value
    FROM promotions
    WHERE UPPER(code) = UPPER(p_promo_code) AND active = TRUE;

    IF v_promo_type IS NOT NULL THEN
      CASE v_promo_type
        WHEN 'percentage' THEN
          v_discount := ROUND(v_subtotal * (v_promo_value / 100.0), 2);
        WHEN 'fixed' THEN
          v_discount := LEAST(v_promo_value, v_subtotal);
        WHEN 'free' THEN
          v_discount := v_subtotal;
      END CASE;
    END IF;
    -- Invalid or inactive codes silently result in $0 discount
  END IF;

  -- 4. Calculate tax, delivery fee, and total server-side
  v_tax := ROUND(v_subtotal * v_tax_rate, 2);

  IF p_delivery_method = 'pickup' THEN
    v_delivery_fee := 0;
  ELSIF v_subtotal >= v_free_del_min THEN
    v_delivery_fee := 0;
  ELSE
    v_delivery_fee := v_del_fee_amount;
  END IF;

  v_total := v_subtotal + v_tax + v_delivery_fee + p_tip - v_discount;
  IF v_total < 0 THEN v_total := 0; END IF;

  -- 5. Update the order with server-calculated totals
  UPDATE orders
  SET subtotal     = v_subtotal,
      tax          = v_tax,
      delivery_fee = v_delivery_fee,
      discount     = v_discount,
      total        = v_total
  WHERE id = v_order_id;

  -- 6. Create the initial PLACED status event
  INSERT INTO order_status_events (order_id, status, changed_by, changed_by_role)
  VALUES (v_order_id, 'PLACED', p_user_id, 'customer');

  RETURN v_order_id;
END;
$$;
