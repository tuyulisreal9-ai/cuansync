create extension if not exists pgcrypto;

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (type in ('income', 'exchange', 'expense')),
  occurred_at timestamptz not null default now(),
  description text not null default '',
  category text,
  category_group text check (category_group is null or category_group in ('needs', 'wants', 'invest')),
  currency text,
  amount numeric(18, 4),
  base_currency text not null default 'IDR',
  base_amount numeric(18, 4),
  from_currency text,
  to_currency text,
  from_amount numeric(18, 4),
  to_amount numeric(18, 4),
  rate numeric(18, 8),
  updated_at timestamptz,

  -- Legacy CUANSYNC/Kas Poipet columns. Keep nullable for old data compatibility.
  amount_idr numeric(14, 2),
  amount_thb numeric(14, 2),
  locked_rate numeric(14, 6),
  created_at timestamptz not null default now()
);

alter table public.transactions
  add column if not exists category_group text
  check (category_group is null or category_group in ('needs', 'wants', 'invest'));

alter table public.transactions
  add column if not exists currency text,
  add column if not exists amount numeric(18, 4),
  add column if not exists base_currency text not null default 'IDR',
  add column if not exists base_amount numeric(18, 4),
  add column if not exists from_currency text,
  add column if not exists to_currency text,
  add column if not exists from_amount numeric(18, 4),
  add column if not exists to_amount numeric(18, 4),
  add column if not exists rate numeric(18, 8),
  add column if not exists updated_at timestamptz;

update public.transactions
set
  currency = coalesce(
    currency,
    case
      when type in ('income', 'expense') and amount_thb is not null and amount_thb > 0 then 'THB'
      when type in ('income', 'expense') then 'IDR'
      else currency
    end
  ),
  amount = coalesce(
    amount,
    case
      when type in ('income', 'expense') and amount_thb is not null and amount_thb > 0 then amount_thb
      when type in ('income', 'expense') then amount_idr
      else amount
    end
  ),
  base_currency = coalesce(base_currency, 'IDR'),
  base_amount = coalesce(base_amount, amount_idr),
  rate = coalesce(rate, locked_rate),
  updated_at = coalesce(updated_at, created_at)
where type in ('income', 'expense');

update public.transactions
set
  from_currency = coalesce(
    from_currency,
    case
      when amount_thb is not null and amount_thb < 0 then 'THB'
      else 'IDR'
    end
  ),
  to_currency = coalesce(
    to_currency,
    case
      when amount_thb is not null and amount_thb < 0 then 'IDR'
      else 'THB'
    end
  ),
  from_amount = coalesce(
    from_amount,
    case
      when amount_thb is not null and amount_thb < 0 then abs(amount_thb)
      else amount_idr
    end
  ),
  to_amount = coalesce(
    to_amount,
    case
      when amount_thb is not null and amount_thb < 0 then amount_idr
      else abs(amount_thb)
    end
  ),
  base_currency = coalesce(base_currency, 'IDR'),
  base_amount = coalesce(base_amount, amount_idr),
  rate = coalesce(rate, locked_rate),
  updated_at = coalesce(updated_at, created_at)
where type = 'exchange';

update public.transactions
set category_group = case
  when category in ('Hiburan', 'Belanja', 'Ngopi', 'Hadiah', 'Travel') then 'wants'
  when category in ('Dana Darurat', 'Tabungan', 'Reksa Dana', 'Emas', 'Bisnis') then 'invest'
  else 'needs'
end
where type = 'expense' and category_group is null;

create index if not exists transactions_user_time_idx
  on public.transactions (user_id, occurred_at desc, created_at desc);

create index if not exists transactions_user_group_idx
  on public.transactions (user_id, category_group, occurred_at desc);

create index if not exists transactions_user_type_currency_time_idx
  on public.transactions (user_id, type, currency, occurred_at desc);

create index if not exists transactions_user_exchange_pair_time_idx
  on public.transactions (user_id, from_currency, to_currency, occurred_at desc)
  where type = 'exchange';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'transactions_currency_code_chk'
  ) then
    alter table public.transactions
      add constraint transactions_currency_code_chk
      check (
        (currency is null or currency ~ '^[A-Z]{3}$') and
        (base_currency ~ '^[A-Z]{3}$') and
        (from_currency is null or from_currency ~ '^[A-Z]{3}$') and
        (to_currency is null or to_currency ~ '^[A-Z]{3}$')
      ) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'transactions_shape_chk'
  ) then
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
          from_currency <> to_currency and
          from_amount is not null and from_amount > 0 and
          to_amount is not null and to_amount > 0 and
          rate is not null and rate > 0
        )
      ) not valid;
  end if;
end $$;

create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  month_key text not null,
  group_key text not null check (group_key in ('needs', 'wants', 'invest')),
  currency text not null default 'IDR',
  limit_amount numeric(18, 4) not null check (limit_amount >= 0),

  -- Legacy budget column. New code writes currency + limit_amount.
  limit_thb numeric(14, 2),
  created_at timestamptz not null default now()
);

alter table public.budgets
  add column if not exists currency text,
  add column if not exists limit_amount numeric(18, 4);

update public.budgets
set
  currency = coalesce(currency, 'THB'),
  limit_amount = coalesce(limit_amount, limit_thb, 0)
where currency is null or limit_amount is null;

alter table public.budgets
  alter column currency set default 'IDR',
  alter column currency set not null;

alter table public.budgets
  alter column limit_thb drop not null,
  alter column limit_thb set default 0,
  alter column limit_amount set not null;

drop index if exists budgets_user_month_group_idx;

create unique index if not exists budgets_user_month_group_currency_idx
  on public.budgets (user_id, month_key, group_key, currency);

create index if not exists budgets_user_currency_month_idx
  on public.budgets (user_id, currency, month_key desc);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'budgets_currency_code_chk'
  ) then
    alter table public.budgets
      add constraint budgets_currency_code_chk
      check (currency ~ '^[A-Z]{3}$') not valid;
  end if;
end $$;

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  base_currency text not null default 'IDR',
  active_currencies text[] not null default array['IDR']::text[],
  daily_currency text not null default 'IDR',
  theme text not null default 'light' check (theme in ('light', 'dark')),
  balance_visible boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_settings
  add column if not exists daily_currency text not null default 'IDR';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'user_settings_currency_code_chk'
  ) then
    alter table public.user_settings
      add constraint user_settings_currency_code_chk
      check (
        base_currency ~ '^[A-Z]{3}$' and
        daily_currency ~ '^[A-Z]{3}$' and
        array_length(active_currencies, 1) >= 1 and
        active_currencies <@ array[
          'IDR',
          'THB',
          'USD',
          'AUD',
          'KRW',
          'JPY',
          'SGD',
          'MYR',
          'EUR',
          'GBP'
        ]::text[]
      ) not valid;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'user_settings_daily_currency_chk'
  ) then
    alter table public.user_settings
      add constraint user_settings_daily_currency_chk
      check (
        daily_currency = any(active_currencies) and
        daily_currency = any(array[
          'IDR',
          'THB',
          'USD',
          'AUD',
          'KRW',
          'JPY',
          'SGD',
          'MYR',
          'EUR',
          'GBP'
        ]::text[])
      ) not valid;
  end if;
end $$;

create index if not exists user_settings_active_currencies_idx
  on public.user_settings using gin (active_currencies);

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  target_amount_idr numeric(14, 2) not null check (target_amount_idr > 0),
  saved_amount_idr numeric(14, 2) not null default 0 check (saved_amount_idr >= 0),
  deadline date,
  created_at timestamptz not null default now()
);

create index if not exists goals_user_created_idx
  on public.goals (user_id, created_at desc);

alter table public.transactions enable row level security;
alter table public.budgets enable row level security;
alter table public.goals enable row level security;
alter table public.user_settings enable row level security;

drop policy if exists "Users can read own transactions" on public.transactions;
create policy "Users can read own transactions"
  on public.transactions
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own transactions" on public.transactions;
create policy "Users can insert own transactions"
  on public.transactions
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own transactions" on public.transactions;
create policy "Users can update own transactions"
  on public.transactions
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own transactions" on public.transactions;
create policy "Users can delete own transactions"
  on public.transactions
  for delete
  using (auth.uid() = user_id);

drop policy if exists "Users can read own budgets" on public.budgets;
create policy "Users can read own budgets"
  on public.budgets
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own budgets" on public.budgets;
create policy "Users can insert own budgets"
  on public.budgets
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own budgets" on public.budgets;
create policy "Users can update own budgets"
  on public.budgets
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own budgets" on public.budgets;
create policy "Users can delete own budgets"
  on public.budgets
  for delete
  using (auth.uid() = user_id);

drop policy if exists "Users can read own settings" on public.user_settings;
create policy "Users can read own settings"
  on public.user_settings
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own settings" on public.user_settings;
create policy "Users can insert own settings"
  on public.user_settings
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own settings" on public.user_settings;
create policy "Users can update own settings"
  on public.user_settings
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can read own goals" on public.goals;
create policy "Users can read own goals"
  on public.goals
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own goals" on public.goals;
create policy "Users can insert own goals"
  on public.goals
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own goals" on public.goals;
create policy "Users can update own goals"
  on public.goals
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own goals" on public.goals;
create policy "Users can delete own goals"
  on public.goals
  for delete
  using (auth.uid() = user_id);
