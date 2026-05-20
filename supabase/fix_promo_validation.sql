-- ============================================================
-- P0-4: Server-side promo code validation
-- Creates a promotions table and seeds existing codes.
-- The create_order RPC (in fix_server_price_validation.sql)
-- looks up promo codes here instead of trusting the client.
-- ============================================================

-- 1. Drop and recreate to ensure schema is correct (safe for fresh or re-run)
DROP TABLE IF EXISTS promotions CASCADE;

CREATE TABLE promotions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code           TEXT NOT NULL UNIQUE,
  discount_type  TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed', 'free')),
  discount_value NUMERIC(8,2) NOT NULL DEFAULT 0,
  active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;

-- 3. Anyone can read active promotions (needed by the RPC and client UI)
CREATE POLICY "Anyone can read active promotions"
  ON promotions FOR SELECT
  USING (active = TRUE);

-- 4. Only admins can manage promotions
CREATE POLICY "Admins can manage promotions"
  ON promotions FOR ALL
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- 5. Seed the existing hardcoded promo codes
INSERT INTO promotions (code, discount_type, discount_value, active) VALUES
  ('SAVE10', 'percentage', 10, TRUE),
  ('FREE5',  'fixed',      5, TRUE)
ON CONFLICT (code) DO NOTHING;
