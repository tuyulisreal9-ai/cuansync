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
  rate_base_currency text,
  rate_quote_currency text,
  exchange_rate numeric(24, 12),
  rate_type text,
  source_account_id uuid,
  destination_account_id uuid,
  fee_amount numeric(18, 4),
  fee_currency text,
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
  add column if not exists rate_base_currency text,
  add column if not exists rate_quote_currency text,
  add column if not exists exchange_rate numeric(24, 12),
  add column if not exists rate_type text,
  add column if not exists source_account_id uuid,
  add column if not exists destination_account_id uuid,
  add column if not exists fee_amount numeric(18, 4),
  add column if not exists fee_currency text,
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
set category = case
  when lower(trim(category)) in ('makan', 'makan harian', 'makanan') then 'Makan'
  when lower(trim(category)) in ('belanja', 'belanja kebutuhan', 'kebutuhan harian') then 'Belanja'
  when lower(trim(category)) in ('transport', 'transportasi') then 'Transportasi'
  when lower(trim(category)) in (
    'tagihan',
    'internet',
    'internet & pulsa',
    'internet dan pulsa',
    'pulsa',
    'paket data',
    'wi-fi',
    'wifi'
  ) then 'Tagihan'
  when lower(trim(category)) in (
    'hiburan',
    'gaya hidup',
    'hiburan & gaya hidup',
    'hiburan dan gaya hidup',
    'ngopi',
    'hadiah',
    'travel',
    'rekreasi',
    'hobi',
    'perawatan pribadi'
  ) then 'Hiburan & Gaya Hidup'
  when lower(trim(category)) in (
    'hunian',
    'sewa tempat',
    'sewa tempat / hunian',
    'sewa tempat & hunian'
  ) then 'Tempat Tinggal'
  when lower(trim(category)) in ('lain-lain', 'other') then 'Lainnya'
  else category
end
where type = 'expense' and category is not null;

update public.transactions
set category_group = case
  when category = 'Hiburan & Gaya Hidup' then 'wants'
  else 'needs'
end
where type = 'expense';

create index if not exists transactions_user_time_idx
  on public.transactions (user_id, occurred_at desc, created_at desc);

create index if not exists transactions_user_group_idx
  on public.transactions (user_id, category_group, occurred_at desc);

create index if not exists transactions_user_category_time_idx
  on public.transactions (user_id, category, occurred_at desc)
  where type = 'expense';

create index if not exists transactions_user_type_currency_time_idx
  on public.transactions (user_id, type, currency, occurred_at desc);

create index if not exists transactions_user_exchange_pair_time_idx
  on public.transactions (user_id, from_currency, to_currency, occurred_at desc)
  where type = 'exchange';

create index if not exists transactions_user_source_account_time_idx
  on public.transactions (user_id, source_account_id, occurred_at desc)
  where source_account_id is not null;

create index if not exists transactions_user_destination_account_time_idx
  on public.transactions (user_id, destination_account_id, occurred_at desc)
  where destination_account_id is not null;

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
end $$;

create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  month_key text not null,
  group_key text not null check (group_key in ('needs', 'wants', 'invest')),
  category text,
  input_amount numeric(18, 4),
  input_currency text,
  base_amount numeric(18, 4),
  base_currency text,
  planning_rate numeric(24, 12),
  rate_source text,
  rate_date date,
  rate_from_currency text,
  rate_to_currency text,
  currency text not null default 'IDR',
  limit_amount numeric(18, 4) not null check (limit_amount >= 0),

  -- Legacy budget column. New code writes currency + limit_amount.
  limit_thb numeric(14, 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

alter table public.budgets
  add column if not exists category text,
  add column if not exists input_amount numeric(18, 4),
  add column if not exists input_currency text,
  add column if not exists base_amount numeric(18, 4),
  add column if not exists base_currency text,
  add column if not exists planning_rate numeric(24, 12),
  add column if not exists rate_source text,
  add column if not exists rate_date date,
  add column if not exists rate_from_currency text,
  add column if not exists rate_to_currency text,
  add column if not exists currency text,
  add column if not exists limit_amount numeric(18, 4),
  add column if not exists updated_at timestamptz;

update public.budgets
set
  currency = coalesce(currency, 'THB'),
  limit_amount = coalesce(limit_amount, limit_thb, 0)
where currency is null or limit_amount is null;

update public.budgets
set category = coalesce(nullif(trim(category), ''), group_key)
where category is null or trim(category) = '';

update public.budgets
set
  input_currency = coalesce(nullif(input_currency, ''), nullif(currency, ''), 'IDR'),
  input_amount = coalesce(input_amount, limit_amount, limit_thb),
  base_currency = coalesce(nullif(base_currency, ''), 'IDR'),
  base_amount = coalesce(
    base_amount,
    case
      when coalesce(nullif(input_currency, ''), nullif(currency, ''), 'IDR') =
        coalesce(nullif(base_currency, ''), 'IDR')
        then coalesce(limit_amount, limit_thb)
      else null
    end
  ),
  planning_rate = coalesce(
    planning_rate,
    case
      when coalesce(nullif(input_currency, ''), nullif(currency, ''), 'IDR') =
        coalesce(nullif(base_currency, ''), 'IDR')
        then 1
      else null
    end
  ),
  rate_source = coalesce(
    nullif(rate_source, ''),
    case
      when coalesce(nullif(input_currency, ''), nullif(currency, ''), 'IDR') =
        coalesce(nullif(base_currency, ''), 'IDR')
        then 'legacy'
      else 'missing'
    end
  ),
  rate_date = coalesce(rate_date, created_at::date),
  rate_from_currency = coalesce(
    nullif(rate_from_currency, ''),
    nullif(input_currency, ''),
    nullif(currency, ''),
    'IDR'
  ),
  rate_to_currency = coalesce(nullif(rate_to_currency, ''), nullif(base_currency, ''), 'IDR'),
  updated_at = coalesce(updated_at, created_at, now());

drop index if exists budgets_user_month_category_currency_idx;

update public.budgets
set category = case
  when lower(trim(coalesce(category, group_key))) in ('makan', 'makan harian', 'makanan')
    then 'Makan'
  when lower(trim(coalesce(category, group_key))) in ('belanja', 'belanja kebutuhan', 'kebutuhan harian')
    then 'Belanja'
  when lower(trim(coalesce(category, group_key))) in ('transport', 'transportasi')
    then 'Transportasi'
  when lower(trim(coalesce(category, group_key))) in (
    'tagihan',
    'internet',
    'internet & pulsa',
    'internet dan pulsa',
    'pulsa',
    'paket data',
    'wi-fi',
    'wifi'
  )
    then 'Tagihan'
  when lower(trim(coalesce(category, group_key))) in (
    'hiburan',
    'gaya hidup',
    'hiburan & gaya hidup',
    'hiburan dan gaya hidup',
    'ngopi',
    'hadiah',
    'travel',
    'rekreasi',
    'hobi',
    'perawatan pribadi'
  )
    then 'Hiburan & Gaya Hidup'
  when lower(trim(coalesce(category, group_key))) in (
    'hunian',
    'sewa tempat',
    'sewa tempat / hunian',
    'sewa tempat & hunian'
  )
    then 'Tempat Tinggal'
  when lower(trim(coalesce(category, group_key))) in (
    'lain-lain',
    'other',
    'needs',
    'wants',
    'invest'
  )
    then 'Lainnya'
  else category
end;

update public.budgets
set group_key = case
  when category = 'Hiburan & Gaya Hidup' then 'wants'
  else 'needs'
end;

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
        'Inspect duplicate rows manually before creating the unique index.';
  end if;
end $$;

alter table public.budgets
  alter column currency set default 'IDR',
  alter column currency set not null;

alter table public.budgets
  alter column limit_thb drop not null,
  alter column limit_thb set default 0,
  alter column limit_amount set not null;

drop index if exists budgets_user_month_group_idx;
drop index if exists budgets_user_month_group_currency_idx;
drop index if exists budgets_user_month_category_currency_idx;

create unique index if not exists budgets_user_month_category_idx
  on public.budgets (
    user_id,
    month_key,
    lower(trim(coalesce(category, group_key)))
  );

create index if not exists budgets_user_base_month_idx
  on public.budgets (user_id, base_currency, month_key desc);

create index if not exists budgets_user_category_month_idx
  on public.budgets (
    user_id,
    lower(trim(coalesce(category, group_key))),
    month_key desc
  );

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

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  base_currency text not null default 'IDR',
  active_currencies text[] not null default array['IDR']::text[],
  daily_currency text not null default 'IDR',
  theme text not null default 'system' check (theme in ('system', 'light', 'dark')),
  balance_visible boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_settings
  add column if not exists daily_currency text not null default 'IDR';

alter table public.user_settings
  alter column theme set default 'system';

alter table public.user_settings
  drop constraint if exists user_settings_theme_check;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'user_settings_theme_mode_chk'
  ) then
    alter table public.user_settings
      add constraint user_settings_theme_mode_chk
      check (theme in ('system', 'light', 'dark')) not valid;
  end if;
end $$;

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
          'SGD',
          'MYR',
          'JPY',
          'KRW',
          'TWD',
          'HKD',
          'CNY',
          'VND',
          'PHP',
          'INR',
          'LKR',
          'SAR',
          'AED',
          'USD',
          'AUD',
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
          'SGD',
          'MYR',
          'JPY',
          'KRW',
          'TWD',
          'HKD',
          'CNY',
          'VND',
          'PHP',
          'INR',
          'LKR',
          'SAR',
          'AED',
          'USD',
          'AUD',
          'EUR',
          'GBP'
        ]::text[])
      ) not valid;
  end if;
end $$;

create index if not exists user_settings_active_currencies_idx
  on public.user_settings using gin (active_currencies);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  avatar_url text,
  base_currency text default 'IDR',
  daily_currency text default 'IDR',
  theme_mode text default 'system' check (theme_mode in ('system', 'light', 'dark')),
  hide_balances boolean default false,
  country_code text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles
  add column if not exists email text,
  add column if not exists display_name text,
  add column if not exists avatar_url text,
  add column if not exists base_currency text default 'IDR',
  add column if not exists daily_currency text default 'IDR',
  add column if not exists theme_mode text default 'system',
  add column if not exists hide_balances boolean default false,
  add column if not exists country_code text,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

alter table public.profiles
  alter column base_currency set default 'IDR',
  alter column daily_currency set default 'IDR',
  alter column theme_mode set default 'system',
  alter column hide_balances set default false;

alter table public.profiles
  drop constraint if exists profiles_theme_mode_check;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_theme_mode_chk'
  ) then
    alter table public.profiles
      add constraint profiles_theme_mode_chk
      check (theme_mode in ('system', 'light', 'dark')) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_currency_code_chk'
  ) then
    alter table public.profiles
      add constraint profiles_currency_code_chk
      check (
        coalesce(base_currency, 'IDR') ~ '^[A-Z]{3}$' and
        coalesce(daily_currency, 'IDR') ~ '^[A-Z]{3}$'
      ) not valid;
  end if;
end $$;

create index if not exists profiles_id_idx
  on public.profiles (id);

create table if not exists public.user_currencies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  currency_code text not null,
  is_active boolean default true,
  is_base boolean default false,
  is_daily boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, currency_code)
);

alter table public.user_currencies
  add column if not exists user_id uuid references auth.users (id) on delete cascade,
  add column if not exists currency_code text,
  add column if not exists is_active boolean default true,
  add column if not exists is_base boolean default false,
  add column if not exists is_daily boolean default false,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

alter table public.user_currencies
  alter column currency_code set not null,
  alter column is_active set default true,
  alter column is_base set default false,
  alter column is_daily set default false;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'user_currencies_user_currency_key'
  ) then
    alter table public.user_currencies
      add constraint user_currencies_user_currency_key unique (user_id, currency_code);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'user_currencies_currency_code_chk'
  ) then
    alter table public.user_currencies
      add constraint user_currencies_currency_code_chk
      check (currency_code ~ '^[A-Z]{3}$') not valid;
  end if;
end $$;

create index if not exists user_currencies_user_id_idx
  on public.user_currencies (user_id);

create index if not exists user_currencies_user_currency_idx
  on public.user_currencies (user_id, currency_code);

insert into public.profiles (
  id,
  email,
  display_name,
  avatar_url,
  base_currency,
  daily_currency,
  theme_mode,
  hide_balances,
  created_at,
  updated_at
)
select
  users.id,
  users.email,
  coalesce(users.raw_user_meta_data ->> 'full_name', split_part(users.email, '@', 1)),
  users.raw_user_meta_data ->> 'avatar_url',
  coalesce(nullif(settings.base_currency, ''), 'IDR'),
  coalesce(
    nullif(settings.daily_currency, ''),
    settings.active_currencies[1],
    nullif(settings.base_currency, ''),
    'IDR'
  ),
  case
    when settings.theme in ('system', 'light', 'dark') then settings.theme
    else 'system'
  end,
  coalesce(not settings.balance_visible, false),
  coalesce(users.created_at, now()),
  now()
from auth.users as users
left join public.user_settings as settings on settings.user_id = users.id
on conflict (id) do update
set
  email = coalesce(public.profiles.email, excluded.email),
  display_name = coalesce(public.profiles.display_name, excluded.display_name),
  avatar_url = coalesce(public.profiles.avatar_url, excluded.avatar_url),
  base_currency = coalesce(nullif(public.profiles.base_currency, ''), excluded.base_currency, 'IDR'),
  daily_currency = coalesce(
    nullif(public.profiles.daily_currency, ''),
    excluded.daily_currency,
    excluded.base_currency,
    'IDR'
  ),
  theme_mode = coalesce(nullif(public.profiles.theme_mode, ''), excluded.theme_mode, 'system'),
  hide_balances = coalesce(public.profiles.hide_balances, excluded.hide_balances, false),
  updated_at = now();

update public.profiles
set
  base_currency = coalesce(nullif(base_currency, ''), 'IDR'),
  daily_currency = coalesce(nullif(daily_currency, ''), nullif(base_currency, ''), 'IDR'),
  theme_mode = case
    when theme_mode in ('system', 'light', 'dark') then theme_mode
    else 'system'
  end,
  hide_balances = coalesce(hide_balances, false),
  updated_at = now()
where
  base_currency is null or base_currency = '' or
  daily_currency is null or daily_currency = '' or
  theme_mode is null or theme_mode not in ('system', 'light', 'dark') or
  hide_balances is null;

insert into public.user_currencies (
  user_id,
  currency_code,
  is_active,
  is_base,
  is_daily,
  updated_at
)
select
  settings.user_id,
  currency_code,
  true,
  currency_code = coalesce(nullif(settings.base_currency, ''), 'IDR'),
  currency_code = coalesce(
    nullif(settings.daily_currency, ''),
    settings.active_currencies[1],
    nullif(settings.base_currency, ''),
    'IDR'
  ),
  now()
from public.user_settings as settings
cross join lateral unnest(settings.active_currencies) as currency_code
where currency_code ~ '^[A-Z]{3}$'
on conflict (user_id, currency_code) do update
set
  is_active = true,
  is_base = excluded.is_base,
  is_daily = excluded.is_daily,
  updated_at = now();

insert into public.user_currencies (
  user_id,
  currency_code,
  is_active,
  is_base,
  is_daily,
  updated_at
)
select
  profiles.id,
  coalesce(nullif(profiles.base_currency, ''), 'IDR'),
  true,
  true,
  coalesce(nullif(profiles.base_currency, ''), 'IDR') = coalesce(
    nullif(profiles.daily_currency, ''),
    nullif(profiles.base_currency, ''),
    'IDR'
  ),
  now()
from public.profiles as profiles
where not exists (
  select 1
  from public.user_currencies as currencies
  where currencies.user_id = profiles.id
)
on conflict (user_id, currency_code) do update
set
  is_active = true,
  is_base = true,
  is_daily = excluded.is_daily,
  updated_at = now();

insert into public.user_currencies (
  user_id,
  currency_code,
  is_active,
  is_base,
  is_daily,
  updated_at
)
select distinct
  transactions.user_id,
  'THB',
  true,
  false,
  false,
  now()
from public.transactions as transactions
where (
    transactions.currency = 'THB' or
    transactions.from_currency = 'THB' or
    transactions.to_currency = 'THB' or
    coalesce(transactions.amount_thb, 0) <> 0
  )
  and not exists (
    select 1
    from public.user_currencies as currencies
    where currencies.user_id = transactions.user_id
      and currencies.currency_code = 'THB'
  )
on conflict (user_id, currency_code) do update
set
  is_active = true,
  updated_at = now();

insert into public.user_currencies (
  user_id,
  currency_code,
  is_active,
  is_base,
  is_daily,
  updated_at
)
select
  profiles.id,
  coalesce(nullif(profiles.daily_currency, ''), nullif(profiles.base_currency, ''), 'IDR'),
  true,
  false,
  true,
  now()
from public.profiles as profiles
on conflict (user_id, currency_code) do update
set
  is_active = true,
  is_daily = true,
  updated_at = now();

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    email,
    display_name,
    avatar_url,
    base_currency,
    daily_currency,
    theme_mode,
    hide_balances
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url',
    'IDR',
    'IDR',
    'system',
    false
  )
  on conflict (id) do nothing;

  insert into public.user_currencies (
    user_id,
    currency_code,
    is_active,
    is_base,
    is_daily
  )
  values (new.id, 'IDR', true, true, true)
  on conflict (user_id, currency_code) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute function public.handle_new_user_profile();

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
alter table public.profiles enable row level security;
alter table public.user_currencies enable row level security;

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

drop policy if exists "Users can delete own settings" on public.user_settings;
create policy "Users can delete own settings"
  on public.user_settings
  for delete
  using (auth.uid() = user_id);

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
  on public.profiles
  for select
  using (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles
  for insert
  with check (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Users can delete own profile" on public.profiles;
create policy "Users can delete own profile"
  on public.profiles
  for delete
  using (auth.uid() = id);

drop policy if exists "Users can read own currencies" on public.user_currencies;
create policy "Users can read own currencies"
  on public.user_currencies
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own currencies" on public.user_currencies;
create policy "Users can insert own currencies"
  on public.user_currencies
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own currencies" on public.user_currencies;
create policy "Users can update own currencies"
  on public.user_currencies
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own currencies" on public.user_currencies;
create policy "Users can delete own currencies"
  on public.user_currencies
  for delete
  using (auth.uid() = user_id);

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

-- YNAB-style target allocation. This section is additive and preserves
-- target_amount_idr/saved_amount_idr as a safe legacy baseline.
alter table public.goals
  add column if not exists currency text,
  add column if not exists target_amount numeric(18, 4),
  add column if not exists target_type text,
  add column if not exists status text,
  add column if not exists note text,
  add column if not exists completed_at timestamptz,
  add column if not exists archived_at timestamptz,
  add column if not exists updated_at timestamptz;

update public.goals
set
  currency = coalesce(currency, 'IDR'),
  target_amount = coalesce(target_amount, target_amount_idr),
  target_type = coalesce(
    target_type,
    case when deadline is null then 'hold_balance' else 'collect_by_date' end
  ),
  status = coalesce(
    status,
    case
      when saved_amount_idr >= target_amount_idr then 'completed'
      when deadline is not null and deadline < current_date then 'overdue'
      else 'active'
    end
  ),
  updated_at = coalesce(updated_at, created_at)
where
  currency is null
  or target_amount is null
  or target_type is null
  or status is null
  or updated_at is null;

alter table public.goals
  alter column currency set default 'IDR',
  alter column currency set not null,
  alter column target_amount set not null,
  alter column target_type set default 'hold_balance',
  alter column target_type set not null,
  alter column status set default 'active',
  alter column status set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'goals_currency_code_chk'
  ) then
    alter table public.goals
      add constraint goals_currency_code_chk
      check (currency ~ '^[A-Z]{3}$') not valid;
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'goals_target_amount_chk'
  ) then
    alter table public.goals
      add constraint goals_target_amount_chk
      check (target_amount > 0) not valid;
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'goals_target_type_chk'
  ) then
    alter table public.goals
      add constraint goals_target_type_chk
      check (target_type in ('hold_balance', 'collect_by_date')) not valid;
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'goals_status_chk'
  ) then
    alter table public.goals
      add constraint goals_status_chk
      check (
        status in (
          'active',
          'completed',
          'overdue',
          'used',
          'paused',
          'archived'
        )
      ) not valid;
  end if;
end $$;

alter table public.transactions
  add column if not exists target_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'transactions_target_id_fkey'
  ) then
    alter table public.transactions
      add constraint transactions_target_id_fkey
      foreign key (target_id)
      references public.goals (id)
      on delete set null
      not valid;
  end if;
end $$;

create index if not exists transactions_user_target_time_idx
  on public.transactions (user_id, target_id, occurred_at desc)
  where target_id is not null;

create table if not exists public.goal_allocations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  goal_id uuid not null references public.goals (id) on delete cascade,
  type text not null,
  amount numeric(18, 4) not null,
  currency text not null,
  transaction_id uuid unique references public.transactions (id) on delete cascade,
  note text,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'goal_allocations_type_chk'
  ) then
    alter table public.goal_allocations
      add constraint goal_allocations_type_chk
      check (type in ('assign', 'release', 'spend', 'adjustment')) not valid;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'goal_allocations_amount_chk'
  ) then
    alter table public.goal_allocations
      add constraint goal_allocations_amount_chk
      check (
        (type = 'adjustment' and amount <> 0)
        or (type <> 'adjustment' and amount > 0)
      ) not valid;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'goal_allocations_currency_code_chk'
  ) then
    alter table public.goal_allocations
      add constraint goal_allocations_currency_code_chk
      check (currency ~ '^[A-Z]{3}$') not valid;
  end if;
end $$;

create index if not exists goal_allocations_user_goal_time_idx
  on public.goal_allocations (user_id, goal_id, created_at desc);
create index if not exists goal_allocations_user_currency_time_idx
  on public.goal_allocations (user_id, currency, created_at desc);

alter table public.goal_allocations enable row level security;

drop policy if exists "Users can read own goal allocations"
  on public.goal_allocations;
create policy "Users can read own goal allocations"
  on public.goal_allocations for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own goal allocations"
  on public.goal_allocations;
create policy "Users can insert own goal allocations"
  on public.goal_allocations for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.goals
      where goals.id = goal_id and goals.user_id = auth.uid()
    )
  );

drop policy if exists "Users can update own goal allocations"
  on public.goal_allocations;
create policy "Users can update own goal allocations"
  on public.goal_allocations for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own goal allocations"
  on public.goal_allocations;
create policy "Users can delete own goal allocations"
  on public.goal_allocations for delete
  using (auth.uid() = user_id);

create or replace function public.sync_goal_allocation_from_transaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_currency text;
begin
  if tg_op = 'DELETE' then
    delete from public.goal_allocations where transaction_id = old.id;
    return old;
  end if;

  if tg_op = 'UPDATE' then
    delete from public.goal_allocations where transaction_id = old.id;
  end if;

  if new.type = 'expense' and new.target_id is not null then
    select goals.currency
    into target_currency
    from public.goals
    where goals.id = new.target_id and goals.user_id = new.user_id;

    if target_currency is null then
      raise exception 'Target tidak ditemukan untuk pengguna ini.';
    end if;
    if target_currency <> new.currency then
      raise exception 'Mata uang target harus sama dengan mata uang transaksi.';
    end if;

    insert into public.goal_allocations (
      user_id,
      goal_id,
      type,
      amount,
      currency,
      transaction_id,
      note,
      created_at
    )
    values (
      new.user_id,
      new.target_id,
      'spend',
      new.amount,
      new.currency,
      new.id,
      nullif(new.description, ''),
      coalesce(new.occurred_at, now())
    )
    on conflict (transaction_id)
    do update set
      goal_id = excluded.goal_id,
      amount = excluded.amount,
      currency = excluded.currency,
      note = excluded.note,
      created_at = excluded.created_at;
  end if;

  return new;
end;
$$;

drop trigger if exists sync_goal_allocation_after_transaction
  on public.transactions;
create trigger sync_goal_allocation_after_transaction
  after insert or update or delete on public.transactions
  for each row execute function public.sync_goal_allocation_from_transaction();

do $$
begin
  if to_regclass('public.asset_accounts') is not null then
    alter table public.asset_accounts
      add column if not exists is_allocatable boolean;
    update public.asset_accounts
    set is_allocatable = account_type in ('bank', 'cash', 'ewallet')
    where is_allocatable is null;
    alter table public.asset_accounts
      alter column is_allocatable set default false;
  end if;
end $$;
