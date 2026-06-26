-- ============================================================
-- admin_assign_driver.sql
-- Creates the assign_driver RPC used by the admin dispatch
-- screen to push-assign a driver to any order.
-- Apply AFTER driver_workflow.sql.
-- ============================================================

DROP FUNCTION IF EXISTS assign_driver(UUID, UUID, UUID);

CREATE OR REPLACE FUNCTION assign_driver(
  p_order_id    UUID,
  p_driver_id   UUID,
  p_assigned_by UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_driver_name  TEXT;
  v_driver_phone TEXT;
BEGIN
  -- Resolve driver name / phone
  SELECT full_name, phone
    INTO v_driver_name, v_driver_phone
    FROM profiles
   WHERE id = p_driver_id;

  -- Assign driver (admin can assign to any non-delivered/canceled order)
  UPDATE orders
     SET assigned_driver_id = p_driver_id,
         driver_name        = v_driver_name,
         driver_phone       = v_driver_phone,
         updated_at         = now()
   WHERE id     = p_order_id
     AND status NOT IN ('DELIVERED', 'CANCELED');

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Record as a status event (informational, same status value)
  INSERT INTO order_status_events (order_id, status, changed_by, note)
  SELECT p_order_id, status, p_assigned_by, 'Driver assigned by admin'
    FROM orders WHERE id = p_order_id;

  -- Update driver_status.current_order_id
  INSERT INTO driver_status (driver_id, is_online, current_order_id, last_seen)
  VALUES (p_driver_id, TRUE, p_order_id, now())
  ON CONFLICT (driver_id) DO UPDATE
     SET current_order_id = p_order_id,
         last_seen        = now();

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION assign_driver(UUID, UUID, UUID) TO authenticated;
