-- Safe additive migration for account-to-account transfers and exchange fees.
-- It does not remove transaction data. The existing shape check is replaced so
-- same-currency transfers can be stored as an internal exchange with rate 1.

alter table public.transactions
  add column if not exists source_account_id uuid,
  add column if not exists destination_account_id uuid,
  add column if not exists fee_amount numeric(18, 4),
  add column if not exists fee_currency text;

create index if not exists transactions_user_source_account_time_idx
  on public.transactions (user_id, source_account_id, occurred_at desc)
  where source_account_id is not null;

create index if not exists transactions_user_destination_account_time_idx
  on public.transactions (user_id, destination_account_id, occurred_at desc)
  where destination_account_id is not null;

alter table public.transactions
  drop constraint if exists transactions_shape_chk;

alter table public.transactions
  add constraint transactions_shape_chk
  check (
    (
      type in ('income', 'expense') and
      currency is not null and
      amount is not null and amount > 0
    )
    or
    (
      type = 'exchange' and
      from_currency is not null and
      to_currency is not null and
      from_amount is not null and from_amount > 0 and
      to_amount is not null and to_amount > 0 and
      rate is not null and rate > 0 and
      (
        from_currency <> to_currency
        or (
          source_account_id is not null and
          destination_account_id is not null and
          source_account_id <> destination_account_id and
          rate = 1
        )
      )
    )
  ) not valid;
