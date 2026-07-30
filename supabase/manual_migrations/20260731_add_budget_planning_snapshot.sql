-- CUANSYNC budget planning snapshot.
--
-- This migration is additive and keeps every existing budget row.
-- It must be reviewed and run manually. Do not run schema.sql on production.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter table public.budgets
  add column if not exists input_amount numeric(18, 4),
  add column if not exists input_currency text,
  add column if not exists base_amount numeric(18, 4),
  add column if not exists base_currency text,
  add column if not exists planning_rate numeric(24, 12),
  add column if not exists rate_source text,
  add column if not exists rate_date date,
  add column if not exists rate_from_currency text,
  add column if not exists rate_to_currency text,
  add column if not exists updated_at timestamptz;

-- rate_type is the existing transaction-rate source field. occurred_at remains
-- the authoritative transaction-rate date, so no second date field is added.
alter table public.transactions
  add column if not exists rate_type text;

with resolved as (
  select
    budgets.id,
    coalesce(
      nullif(budgets.base_currency, ''),
      nullif(profiles.base_currency, ''),
      nullif(settings.base_currency, ''),
      'IDR'
    ) as resolved_base_currency,
    coalesce(
      nullif(budgets.input_currency, ''),
      nullif(budgets.currency, ''),
      nullif(profiles.base_currency, ''),
      nullif(settings.base_currency, ''),
      'IDR'
    ) as resolved_input_currency,
    coalesce(
      budgets.input_amount,
      budgets.limit_amount,
      budgets.limit_thb
    ) as resolved_input_amount,
    coalesce(budgets.base_amount, budgets.limit_amount) as legacy_limit
  from public.budgets as budgets
  left join public.profiles as profiles
    on profiles.id = budgets.user_id
  left join public.user_settings as settings
    on settings.user_id = budgets.user_id
)
update public.budgets as budgets
set
  input_currency = resolved.resolved_input_currency,
  input_amount = resolved.resolved_input_amount,
  base_currency = resolved.resolved_base_currency,
  base_amount = coalesce(
    budgets.base_amount,
    case
      when resolved.resolved_input_currency = resolved.resolved_base_currency
        then resolved.legacy_limit
      else null
    end
  ),
  planning_rate = coalesce(
    budgets.planning_rate,
    case
      when resolved.resolved_input_currency = resolved.resolved_base_currency
        then 1
      when budgets.base_amount > 0 and resolved.resolved_input_amount > 0
        then budgets.base_amount / resolved.resolved_input_amount
      else null
    end
  ),
  rate_source = coalesce(
    nullif(budgets.rate_source, ''),
    case
      when resolved.resolved_input_currency = resolved.resolved_base_currency
        then 'legacy'
      else 'missing'
    end
  ),
  rate_date = coalesce(
    budgets.rate_date,
    budgets.created_at::date
  ),
  rate_from_currency = coalesce(
    nullif(budgets.rate_from_currency, ''),
    resolved.resolved_input_currency
  ),
  rate_to_currency = coalesce(
    nullif(budgets.rate_to_currency, ''),
    resolved.resolved_base_currency
  ),
  updated_at = coalesce(budgets.updated_at, budgets.created_at, now())
from resolved
where resolved.id = budgets.id;

update public.transactions
set rate_type = case
  when currency = base_currency then 'base'
  when coalesce(rate, locked_rate, 0) > 0 then 'legacy'
  else null
end
where type in ('income', 'expense')
  and rate_type is null;

-- Input currency must not create a second budget identity. Stop instead of
-- deleting or merging rows when production contains duplicates.
do $$
begin
  if exists (
    select 1
    from public.budgets
    group by
      user_id,
      month_key,
      lower(trim(coalesce(category, group_key)))
    having count(*) > 1
  ) then
    raise exception
      'Duplicate budgets exist for the same user, month, and category.'
      using hint =
        'Inspect duplicate rows manually before replacing the unique index.';
  end if;
end $$;

drop index if exists public.budgets_user_month_group_idx;
drop index if exists public.budgets_user_month_group_currency_idx;
drop index if exists public.budgets_user_month_category_currency_idx;

create unique index if not exists budgets_user_month_category_idx
  on public.budgets (
    user_id,
    month_key,
    lower(trim(coalesce(category, group_key)))
  );

create index if not exists budgets_user_base_month_idx
  on public.budgets (user_id, base_currency, month_key desc);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'budgets_planning_currency_code_chk'
  ) then
    alter table public.budgets
      add constraint budgets_planning_currency_code_chk
      check (
        (input_currency is null or input_currency ~ '^[A-Z]{3}$') and
        (base_currency is null or base_currency ~ '^[A-Z]{3}$') and
        (rate_from_currency is null or rate_from_currency ~ '^[A-Z]{3}$') and
        (rate_to_currency is null or rate_to_currency ~ '^[A-Z]{3}$')
      ) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'budgets_planning_amount_chk'
  ) then
    alter table public.budgets
      add constraint budgets_planning_amount_chk
      check (
        (input_amount is null or input_amount > 0) and
        (base_amount is null or base_amount > 0) and
        (planning_rate is null or planning_rate > 0)
      ) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'budgets_planning_orientation_chk'
  ) then
    alter table public.budgets
      add constraint budgets_planning_orientation_chk
      check (
        rate_from_currency is null or
        rate_to_currency is null or
        (
          rate_from_currency = input_currency and
          rate_to_currency = base_currency
        )
      ) not valid;
  end if;
end $$;

commit;

-- Read-only preflight before production:
--
-- select
--   user_id,
--   month_key,
--   lower(trim(coalesce(category, group_key))) as category_key,
--   count(*) as duplicate_count
-- from public.budgets
-- group by
--   user_id,
--   month_key,
--   lower(trim(coalesce(category, group_key)))
-- having count(*) > 1;
--
-- Foreign legacy rows with base_amount is null intentionally require an
-- explicit rate decision. This migration never uses today's rate for history.
