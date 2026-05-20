-- ============================================================
-- P0-3: Order idempotency
-- Adds idempotency_key column with UNIQUE constraint to orders.
-- On duplicate key, the create_order RPC returns the existing
-- order ID instead of throwing.
-- ============================================================

-- 1. Add the column (nullable so existing rows are unaffected)
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS idempotency_key UUID;

-- 2. Add UNIQUE constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_idempotency_key_unique'
  ) THEN
    ALTER TABLE orders
      ADD CONSTRAINT orders_idempotency_key_unique UNIQUE (idempotency_key);
  END IF;
END $$;
