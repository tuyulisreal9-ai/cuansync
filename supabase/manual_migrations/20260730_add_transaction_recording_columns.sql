-- APPLIED MANUALLY TO PRODUCTION ON 2026-07-30.
-- Supabase project ref: kltwuquisrequgralzzh
-- Result: success, followed by schema, row-count, RLS, and rollback verification.
--
-- Purpose:
-- Restore compatibility with the transaction payload sent by the current app.
-- The client sends these nullable fields for ordinary income and expense rows,
-- including when no fee or savings target is selected.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter table public.transactions
  add column if not exists fee_amount numeric(18, 4),
  add column if not exists fee_currency text,
  add column if not exists target_id uuid;

commit;

-- Production verification:
-- - transactions: 60 before, 60 after
-- - asset_accounts: 3 before, 3 after
-- - budgets: 7 before, 7 after
-- - goals: 2 before, 2 after
-- - all three columns exist
-- - RLS remains enabled with four transaction policies
-- - a transaction-shaped INSERT succeeded inside BEGIN/ROLLBACK
--
-- This migration intentionally does not install goal allocation triggers or the
-- atomic exchange RPC. Those remain separate migrations with a larger scope.
