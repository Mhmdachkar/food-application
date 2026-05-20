-- ============================================================
-- P1-4: Fix RLS to check profiles.role instead of JWT metadata
--
-- PROBLEM: All role-based RLS policies use:
--   (auth.jwt() -> 'user_metadata' ->> 'role')
-- Any authenticated user can call:
--   supabase.auth.updateUser({ data: { role: 'admin' } })
-- and immediately gain admin-level access.
--
-- FIX: Create a SECURITY DEFINER function that reads the
-- server-managed profiles.role column (which users cannot
-- modify via the client SDK), then rewrite every policy.
--
-- Run this in Supabase SQL Editor AFTER seed.sql and
-- fix_all_rls.sql / new_features_schema.sql / fix_promo_validation.sql.
-- This script is idempotent — safe to re-run.
-- ============================================================

-- ─── Step 1: Create the helper function ─────────────────────
-- SECURITY DEFINER bypasses RLS on the profiles table,
-- avoiding the infinite recursion that originally forced the
-- move to JWT metadata.

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$;

-- Grant execute to authenticated users (required for RLS evaluation)
GRANT EXECUTE ON FUNCTION public.get_user_role() TO authenticated;

-- ─── Step 2: Drop ALL existing role-based policies ──────────
-- We drop every policy that references JWT metadata role checks.
-- Policies that only use auth.uid() (e.g. profiles, addresses,
-- driver_status owner checks) are left untouched.

-- orders
DROP POLICY IF EXISTS "Customers see own orders" ON orders;
DROP POLICY IF EXISTS "Admins and drivers can update orders" ON orders;

-- order_lines
DROP POLICY IF EXISTS "Order lines follow order access" ON order_lines;

-- order_status_events
DROP POLICY IF EXISTS "Status events viewable by relevant users" ON order_status_events;
DROP POLICY IF EXISTS "Status events insertable by admin/driver" ON order_status_events;

-- order_feedback (from new_features_schema.sql)
DROP POLICY IF EXISTS "Users can view own feedback" ON order_feedback;

-- order_incidents (from new_features_schema.sql)
DROP POLICY IF EXISTS "Users can view own incidents" ON order_incidents;
DROP POLICY IF EXISTS "Admins can update incidents" ON order_incidents;

-- kitchen_queue (from new_features_schema.sql)
DROP POLICY IF EXISTS "Kitchen queue visible to all authenticated" ON kitchen_queue;
DROP POLICY IF EXISTS "Admin/driver can manage kitchen queue" ON kitchen_queue;

-- promotions (from fix_promo_validation.sql)
DROP POLICY IF EXISTS "Admins can manage promotions" ON promotions;

-- ─── Step 3: Recreate all policies using get_user_role() ────

-- orders ──────────────────────────────────────────────────────
CREATE POLICY "Customers see own orders"
  ON orders FOR SELECT USING (
    auth.uid() = user_id
    OR public.get_user_role() IN ('admin', 'driver')
  );

CREATE POLICY "Admins and drivers can update orders"
  ON orders FOR UPDATE USING (
    public.get_user_role() IN ('admin', 'driver')
    OR auth.uid() = user_id
  );

-- order_lines ─────────────────────────────────────────────────
CREATE POLICY "Order lines follow order access"
  ON order_lines FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_lines.order_id
        AND (orders.user_id = auth.uid()
             OR public.get_user_role() IN ('admin', 'driver'))
    )
  );

-- order_status_events ─────────────────────────────────────────
CREATE POLICY "Status events viewable by relevant users"
  ON order_status_events FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_status_events.order_id
        AND (orders.user_id = auth.uid()
             OR public.get_user_role() IN ('admin', 'driver'))
    )
  );

CREATE POLICY "Status events insertable by admin/driver"
  ON order_status_events FOR INSERT WITH CHECK (
    public.get_user_role() IN ('admin', 'driver')
    OR EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_status_events.order_id
        AND orders.user_id = auth.uid()
    )
  );

-- order_feedback ──────────────────────────────────────────────
CREATE POLICY "Users can view own feedback"
  ON order_feedback FOR SELECT USING (
    auth.uid() = user_id
    OR public.get_user_role() = 'admin'
  );

-- order_incidents ─────────────────────────────────────────────
CREATE POLICY "Users can view own incidents"
  ON order_incidents FOR SELECT USING (
    auth.uid() = user_id
    OR public.get_user_role() = 'admin'
  );

CREATE POLICY "Admins can update incidents"
  ON order_incidents FOR UPDATE USING (
    public.get_user_role() = 'admin'
  );

-- kitchen_queue ───────────────────────────────────────────────
CREATE POLICY "Kitchen queue visible to all authenticated"
  ON kitchen_queue FOR SELECT USING (
    auth.uid() IS NOT NULL
  );

CREATE POLICY "Admin/driver can manage kitchen queue"
  ON kitchen_queue FOR ALL USING (
    public.get_user_role() IN ('admin', 'driver')
  );

-- promotions ──────────────────────────────────────────────────
CREATE POLICY "Admins can manage promotions"
  ON promotions FOR ALL USING (
    public.get_user_role() = 'admin'
  );

-- ─── Step 4: Verify ─────────────────────────────────────────
-- Quick sanity check: this should return without error.
SELECT public.get_user_role();
