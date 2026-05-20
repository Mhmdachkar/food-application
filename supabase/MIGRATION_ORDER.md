# SmartFood — Supabase Migration Order

All migrations listed below have been applied manually via the Supabase SQL Editor.
New migrations should be added as timestamped files in `supabase/migrations/`.

## Execution Order

Run these in **exact order** for a fresh Supabase instance.
Skip already-applied steps for existing deployments.

| # | File | Description | Priority | Status |
|---|------|-------------|----------|--------|
| 1 | `seed.sql` | Schema creation + seed data (tables, RLS, demo data) | Setup | Applied |
| 2 | `fix_rls_policies.sql` | Initial RLS fix — JWT-based role check | P0 | Applied (superseded by #8) |
| 3 | `fix_all_rls.sql` | Nuclear RLS rebuild — drops all policies, recreates without profiles subqueries | P0 | Applied |
| 4 | `new_features_schema.sql` | Loyalty, favorites, addresses, delivery notes, food memory tables | Feature | Applied |
| 5 | `fix_order_idempotency.sql` | Adds `idempotency_key` column + UNIQUE constraint to orders | P0 | Applied |
| 6 | `fix_promo_validation.sql` | Creates `promotions` table with server-side validation | P0 | Applied |
| 7 | `fix_server_price_validation.sql` | `create_order` RPC — server-side price calculation + promo validation | P0 | Applied |
| 8 | `fix_rls_role_check.sql` | Final RLS rewrite — `get_my_role()` SECURITY DEFINER reads `profiles.role` | P1 | Applied |
| 9 | `fix_demo_auth_v2.sql` | Demo user auth identities (v2 — no trigger disable needed) | Setup | Applied |

## Dependency Graph

```
seed.sql
├── fix_rls_policies.sql
├── fix_all_rls.sql
│   ├── new_features_schema.sql
│   ├── fix_demo_auth_v2.sql
│   └── fix_rls_role_check.sql (also requires #4, #6)
├── fix_order_idempotency.sql
├── fix_promo_validation.sql
└── fix_server_price_validation.sql (requires #5, #6)
```

## Superseded Files

| File | Superseded by | Notes |
|------|---------------|-------|
| `fix_demo_auth.sql` | `fix_demo_auth_v2.sql` | v1 required disabling triggers; v2 works without |
| `fix_rls_policies.sql` | `fix_rls_role_check.sql` | Early JWT-based fix replaced by `get_my_role()` approach |

## Adding New Migrations

1. Create a timestamped file in `supabase/migrations/`:
   ```
   supabase/migrations/YYYYMMDDHHMMSS_description.sql
   ```
2. Write idempotent SQL (use `IF NOT EXISTS`, `CREATE OR REPLACE`, etc.)
3. Test in a staging Supabase project first
4. Apply via `supabase db push` or Supabase SQL Editor
5. Update this table with the new entry

## Quick Setup (Fresh Instance)

```bash
# Via Supabase SQL Editor — paste each file in order:
# 1. seed.sql
# 2. fix_all_rls.sql
# 3. new_features_schema.sql
# 4. fix_order_idempotency.sql
# 5. fix_promo_validation.sql
# 6. fix_server_price_validation.sql
# 7. fix_rls_role_check.sql
# 8. fix_demo_auth_v2.sql
```
