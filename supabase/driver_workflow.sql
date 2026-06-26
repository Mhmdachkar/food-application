-- ============================================================
-- driver_workflow.sql
-- Adds PICKED_UP to the orders status constraint and creates
-- the driver_accept_order RPC used by the driver app.
-- Apply AFTER 001_initial_schema.sql and seed.sql.
-- ============================================================

-- 1. Drop old constraint, add PICKED_UP
-- -------------------------------------------------------
ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE orders
  ADD CONSTRAINT orders_status_check
  CHECK (status IN (
    'PLACED',
    'ACCEPTED',
    'PREPARING',
    'READY',
    'PICKED_UP',
    'OUT_FOR_DELIVERY',
    'DELIVERED',
    'CANCELED'
  ));

-- Do the same for order_status_events (it mirrors order status values)
ALTER TABLE order_status_events
  DROP CONSTRAINT IF EXISTS order_status_events_status_check;

ALTER TABLE order_status_events
  ADD CONSTRAINT order_status_events_status_check
  CHECK (status IN (
    'PLACED',
    'ACCEPTED',
    'PREPARING',
    'READY',
    'PICKED_UP',
    'OUT_FOR_DELIVERY',
    'DELIVERED',
    'CANCELED'
  ));


-- 2. driver_accept_order RPC
-- -------------------------------------------------------
-- A driver claims an unassigned READY order.
-- Returns the order ID on success, NULL if the order was
-- already claimed by another driver (optimistic locking).
DROP FUNCTION IF EXISTS driver_accept_order(UUID, UUID);

CREATE OR REPLACE FUNCTION driver_accept_order(
  p_order_id   UUID,
  p_driver_id  UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_driver_name  TEXT;
  v_driver_phone TEXT;
BEGIN
  -- Fetch driver info
  SELECT full_name, phone
    INTO v_driver_name, v_driver_phone
    FROM profiles
   WHERE id = p_driver_id;

  -- Atomically claim the order (only if still READY and unassigned)
  UPDATE orders
     SET assigned_driver_id = p_driver_id,
         driver_name        = v_driver_name,
         driver_phone       = v_driver_phone,
         updated_at         = now()
   WHERE id                  = p_order_id
     AND status              = 'READY'
     AND assigned_driver_id IS NULL;

  IF NOT FOUND THEN
    RETURN NULL;   -- already claimed by someone else
  END IF;

  -- Record status event
  INSERT INTO order_status_events (order_id, status, changed_by, note)
  VALUES (p_order_id, 'READY', p_driver_id, 'Driver accepted order');

  -- Update driver's current_order_id
  INSERT INTO driver_status (driver_id, is_online, current_order_id, last_seen)
  VALUES (p_driver_id, TRUE, p_order_id, now())
  ON CONFLICT (driver_id) DO UPDATE
     SET current_order_id = p_order_id,
         last_seen        = now();

  RETURN p_order_id;
END;
$$;

GRANT EXECUTE ON FUNCTION driver_accept_order(UUID, UUID) TO authenticated;


-- 3. update_order_status RPC (idempotent re-create)
-- -------------------------------------------------------
-- Creates or replaces the status-advance RPC used by drivers
-- and kitchen staff.  Clears current_order_id when DELIVERED/CANCELED.
DROP FUNCTION IF EXISTS update_order_status(UUID, TEXT, UUID, TEXT);

CREATE OR REPLACE FUNCTION update_order_status(
  p_order_id    UUID,
  p_new_status  TEXT,
  p_changed_by  UUID,
  p_note        TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE orders
     SET status     = p_new_status,
         updated_at = now()
   WHERE id = p_order_id;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  INSERT INTO order_status_events (order_id, status, changed_by, note)
  VALUES (p_order_id, p_new_status, p_changed_by, p_note);

  -- Free up driver slot when order ends
  IF p_new_status IN ('DELIVERED', 'CANCELED') THEN
    UPDATE driver_status
       SET current_order_id = NULL,
           last_seen        = now()
     WHERE current_order_id = p_order_id;
  END IF;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION update_order_status(UUID, TEXT, UUID, TEXT) TO authenticated;


-- 4. Seed a READY + unassigned demo order so the driver
--    can immediately see and accept something.
-- -------------------------------------------------------
DO $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM orders WHERE id = '00000007-0000-0000-0000-000000000000'
  ) INTO v_exists;

  IF NOT v_exists THEN
    INSERT INTO orders (
      id, customer_id, customer_name, status,
      subtotal, tax, delivery_fee, tip, total,
      items_snapshot, address_snapshot, delivery_notes,
      promo_code, payment_method, delivery_method,
      idempotency_key
    ) VALUES (
      '00000007-0000-0000-0000-000000000000',
      '11111111-1111-1111-1111-111111111111',   -- Sarah
      'Sarah Johnson',
      'READY',
      24.97, 2.12, 3.99, 0.00, 31.08,
      '[{"item_id":"item-001","name":"Classic Burger","qty":2,"notes":null,"modifiers":null,"image_url":null},{"item_id":"item-010","name":"Truffle Fries","qty":1,"notes":null,"modifiers":null,"image_url":null}]',
      '{"street":"742 Evergreen Terrace","city":"Springfield","state":"IL","zip":"62701","notes":"Ring the bell"}',
      'Ring the bell',
      NULL, 'card', 'delivery',
      'demo-ready-order-001'
    );

    INSERT INTO order_status_events (order_id, status, changed_by, note)
    VALUES
      ('00000007-0000-0000-0000-000000000000', 'PLACED',    '11111111-1111-1111-1111-111111111111', 'Order placed by customer'),
      ('00000007-0000-0000-0000-000000000000', 'ACCEPTED',  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',  'Admin accepted'),
      ('00000007-0000-0000-0000-000000000000', 'PREPARING', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',  'Kitchen preparing'),
      ('00000007-0000-0000-0000-000000000000', 'READY',     'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',  'Ready for pickup');
  END IF;
END $$;
