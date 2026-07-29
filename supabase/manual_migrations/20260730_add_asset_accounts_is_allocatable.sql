-- APPLIED MANUALLY TO PRODUCTION ON 2026-07-30.
-- Supabase project ref: kltwuquisrequgralzzh
-- Result: success, followed by read-only schema and row-count verification.
--
-- Purpose:
-- Restore compatibility with the current CUANSYNC account insert payload.
--
-- Production observations on 2026-07-29:
-- - public.asset_accounts exists.
-- - is_allocatable is physically absent.
-- - Existing account_type values: bank only (2 rows).
-- - Allowed account types: bank, cash, ewallet, investment, other.
-- - RLS and owner policies are already active.
--
-- Design:
-- - Keep the new column nullable and without a default for this emergency step.
-- - The current client sends an explicit boolean.
-- - Older clients that omit the field remain compatible.
-- - The frontend normalizer derives a fallback from account_type for NULL rows.
--
-- This file records the exact SQL that was executed after user approval.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter table public.asset_accounts
  add column if not exists is_allocatable boolean;

update public.asset_accounts
set is_allocatable = case
  when account_type in ('bank', 'cash', 'ewallet') then true
  when account_type in ('investment', 'other') then false
  else false
end
where is_allocatable is null;

commit;

-- Post-migration read-only verification:
--
-- select
--   account_type,
--   is_allocatable,
--   count(*) as account_count
-- from public.asset_accounts
-- group by account_type, is_allocatable
-- order by account_type, is_allocatable;
--
-- select
--   column_name,
--   data_type,
--   is_nullable,
--   column_default
-- from information_schema.columns
-- where table_schema = 'public'
--   and table_name = 'asset_accounts'
--   and column_name = 'is_allocatable';
--
-- Operational rollback without DROP:
-- deploy a client version that does not send or depend on is_allocatable,
-- and leave this additive column in place.
