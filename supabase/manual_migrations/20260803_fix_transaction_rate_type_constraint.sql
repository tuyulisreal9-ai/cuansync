-- Repair the rate-type constraint installed by the first exchange migration.
-- This only replaces validation metadata. Transaction rows, categories,
-- amounts, and account balances are not changed.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter table public.transactions
  drop constraint if exists transactions_rate_orientation_chk;

alter table public.transactions
  add constraint transactions_rate_orientation_chk
  check (
    rate_type is null
    or rate_type in (
      'realtime',
      'automatic',
      'custom',
      'historical',
      'transfer',
      'legacy',
      'base'
    )
  ) not valid;

commit;
