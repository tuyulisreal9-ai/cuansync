-- Account-aware goal funding and atomic wallet mutations.
--
-- Safety properties:
-- - legacy goal allocations are retained and explicitly marked unmapped;
-- - no account source is guessed for historical rows;
-- - all new relations carry user/currency ownership in their foreign keys;
-- - RPCs lock affected wallets and mutate balances + ledgers in one transaction;
-- - SECURITY DEFINER entry points use an empty search_path and authenticated UID.

begin;

set local lock_timeout = '10s';
set local statement_timeout = '120s';

create extension if not exists pgcrypto;

alter table public.asset_accounts
  add column if not exists account_purpose text,
  add column if not exists is_archived boolean not null default false;

update public.asset_accounts
set account_purpose = case
  when account_type = 'investment' then 'investment'
  else 'general'
end
where account_purpose is null;

alter table public.asset_accounts
  alter column account_purpose set default 'general',
  alter column account_purpose set not null,
  alter column is_allocatable set default false;

update public.asset_accounts
set is_allocatable = account_type in ('bank', 'cash', 'ewallet')
where is_allocatable is null;

alter table public.asset_accounts
  alter column is_allocatable set not null;

alter table public.asset_accounts
  drop constraint if exists asset_accounts_purpose_chk;
alter table public.asset_accounts
  add constraint asset_accounts_purpose_chk
  check (account_purpose in ('daily', 'savings', 'bills', 'general', 'investment'))
  not valid;
alter table public.asset_accounts validate constraint asset_accounts_purpose_chk;

create unique index if not exists asset_accounts_id_user_currency_idx
  on public.asset_accounts (id, user_id, currency);
create unique index if not exists asset_accounts_id_user_idx
  on public.asset_accounts (id, user_id);

alter table public.transactions
  drop constraint if exists transactions_shape_chk;
alter table public.transactions
  add constraint transactions_shape_chk
  check (
    (
      type = 'income' and currency is not null and amount > 0
      and source_account_id is null and destination_account_id is not null
    ) or (
      type = 'expense' and currency is not null and amount > 0
      and source_account_id is not null and destination_account_id is null
    ) or (
      type = 'exchange'
      and from_currency is not null and to_currency is not null
      and from_amount > 0 and to_amount > 0 and rate > 0
      and source_account_id is not null and destination_account_id is not null
      and source_account_id <> destination_account_id
      and (from_currency <> to_currency or rate = 1)
    )
  ) not valid;

do $migration$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'transactions_source_account_owner_fkey'
      and conrelid = 'public.transactions'::regclass
  ) then
    alter table public.transactions
      add constraint transactions_source_account_owner_fkey
      foreign key (source_account_id, user_id)
      references public.asset_accounts (id, user_id)
      on delete restrict not valid;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'transactions_destination_account_owner_fkey'
      and conrelid = 'public.transactions'::regclass
  ) then
    alter table public.transactions
      add constraint transactions_destination_account_owner_fkey
      foreign key (destination_account_id, user_id)
      references public.asset_accounts (id, user_id)
      on delete restrict not valid;
  end if;
end
$migration$;

create or replace function public.validate_wallet_transaction_links()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_source public.asset_accounts%rowtype;
  v_destination public.asset_accounts%rowtype;
begin
  if new.type in ('expense', 'exchange') then
    select * into v_source from public.asset_accounts account
    where account.id = new.source_account_id and account.user_id = new.user_id;
    if not found or v_source.account_type not in ('bank', 'cash', 'ewallet', 'other')
      or v_source.is_archived then
      raise exception 'Akun sumber tidak ditemukan atau bukan dompet aktif.';
    end if;
    if v_source.currency <> upper(case when new.type = 'exchange'
      then new.from_currency else new.currency end) then
      raise exception 'Mata uang akun sumber tidak sesuai.';
    end if;
  end if;
  if new.type in ('income', 'exchange') then
    select * into v_destination from public.asset_accounts account
    where account.id = new.destination_account_id and account.user_id = new.user_id;
    if not found or v_destination.account_type not in ('bank', 'cash', 'ewallet', 'other')
      or v_destination.is_archived then
      raise exception 'Akun tujuan tidak ditemukan atau bukan dompet aktif.';
    end if;
    if v_destination.currency <> upper(case when new.type = 'exchange'
      then new.to_currency else new.currency end) then
      raise exception 'Mata uang akun tujuan tidak sesuai.';
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists validate_wallet_transaction_links_before_write
  on public.transactions;
create trigger validate_wallet_transaction_links_before_write
  before insert or update on public.transactions
  for each row execute function public.validate_wallet_transaction_links();

revoke all on function public.validate_wallet_transaction_links()
  from public, anon, authenticated;

create table if not exists public.account_preferences (
  user_id uuid not null references auth.users (id) on delete cascade,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  flow_type text not null
    check (flow_type in ('income', 'expense', 'transfer', 'exchange')),
  account_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, currency, flow_type),
  constraint account_preferences_owned_account_fkey
    foreign key (account_id, user_id, currency)
    references public.asset_accounts (id, user_id, currency)
    on delete cascade
);

alter table public.account_preferences enable row level security;

drop policy if exists "Users can read own account preferences"
  on public.account_preferences;
create policy "Users can read own account preferences"
  on public.account_preferences for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own account preferences"
  on public.account_preferences;
create policy "Users can insert own account preferences"
  on public.account_preferences for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.asset_accounts account
      where account.id = account_id
        and account.user_id = (select auth.uid())
        and account.currency = account_preferences.currency
        and account.is_archived = false
    )
  );

drop policy if exists "Users can update own account preferences"
  on public.account_preferences;
create policy "Users can update own account preferences"
  on public.account_preferences for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.asset_accounts account
      where account.id = account_id
        and account.user_id = (select auth.uid())
        and account.currency = account_preferences.currency
        and account.is_archived = false
    )
  );

drop policy if exists "Users can delete own account preferences"
  on public.account_preferences;
create policy "Users can delete own account preferences"
  on public.account_preferences for delete to authenticated
  using ((select auth.uid()) = user_id);

alter table public.goals
  add column if not exists protection_mode text,
  add column if not exists funding_status text,
  add column if not exists spending_reduces_progress boolean not null default true;

update public.goals
set
  protection_mode = coalesce(protection_mode, 'flexible'),
  funding_status = coalesce(funding_status, 'unmapped_legacy')
where protection_mode is null or funding_status is null;

alter table public.goals
  alter column protection_mode set default 'flexible',
  alter column protection_mode set not null,
  alter column funding_status set default 'plan_only',
  alter column funding_status set not null;

alter table public.goals drop constraint if exists goals_protection_mode_chk;
alter table public.goals
  add constraint goals_protection_mode_chk
  check (protection_mode in ('strict', 'flexible', 'informational')) not valid;
alter table public.goals validate constraint goals_protection_mode_chk;

alter table public.goals drop constraint if exists goals_funding_status_chk;
alter table public.goals
  add constraint goals_funding_status_chk
  check (funding_status in ('funded', 'plan_only', 'unmapped_legacy')) not valid;
alter table public.goals validate constraint goals_funding_status_chk;

create unique index if not exists goals_id_user_idx
  on public.goals (id, user_id);
create unique index if not exists goals_id_user_currency_idx
  on public.goals (id, user_id, currency);

create table if not exists public.goal_funding_accounts (
  goal_id uuid not null,
  account_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (goal_id, account_id),
  constraint goal_funding_accounts_goal_owner_fkey
    foreign key (goal_id, user_id, currency)
    references public.goals (id, user_id, currency)
    on delete cascade,
  constraint goal_funding_accounts_account_owner_fkey
    foreign key (account_id, user_id, currency)
    references public.asset_accounts (id, user_id, currency)
    on delete restrict,
  constraint goal_funding_accounts_identity_key
    unique (goal_id, account_id, user_id, currency)
);

create unique index if not exists goal_funding_accounts_one_primary_idx
  on public.goal_funding_accounts (goal_id)
  where is_primary;
create index if not exists goal_funding_accounts_account_idx
  on public.goal_funding_accounts (user_id, account_id, goal_id);
create index if not exists goal_funding_accounts_goal_owner_idx
  on public.goal_funding_accounts (goal_id, user_id, currency);
create index if not exists goal_funding_accounts_account_owner_idx
  on public.goal_funding_accounts (account_id, user_id, currency);

alter table public.goal_funding_accounts enable row level security;

drop policy if exists "Users can read own goal funding accounts"
  on public.goal_funding_accounts;
create policy "Users can read own goal funding accounts"
  on public.goal_funding_accounts for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own goal funding accounts"
  on public.goal_funding_accounts;
create policy "Users can insert own goal funding accounts"
  on public.goal_funding_accounts for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.goals goal
      where goal.id = goal_id
        and goal.user_id = (select auth.uid())
        and goal.currency = goal_funding_accounts.currency
    )
    and exists (
      select 1 from public.asset_accounts account
      where account.id = account_id
        and account.user_id = (select auth.uid())
        and account.currency = goal_funding_accounts.currency
        and account.is_archived = false
        and account.is_allocatable = true
    )
  );

drop policy if exists "Users can update own goal funding accounts"
  on public.goal_funding_accounts;
create policy "Users can update own goal funding accounts"
  on public.goal_funding_accounts for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.goals goal
      where goal.id = goal_id
        and goal.user_id = (select auth.uid())
        and goal.currency = goal_funding_accounts.currency
    )
    and exists (
      select 1 from public.asset_accounts account
      where account.id = account_id
        and account.user_id = (select auth.uid())
        and account.currency = goal_funding_accounts.currency
        and account.is_archived = false
        and account.is_allocatable = true
    )
  );

drop policy if exists "Users can delete own goal funding accounts"
  on public.goal_funding_accounts;
create policy "Users can delete own goal funding accounts"
  on public.goal_funding_accounts for delete to authenticated
  using ((select auth.uid()) = user_id);

alter table public.goal_allocations
  add column if not exists account_id uuid,
  add column if not exists mapping_status text,
  add column if not exists event_group_id uuid,
  add column if not exists client_request_id uuid;

update public.goal_allocations
set mapping_status = case
  when account_id is null then 'unmapped_legacy'
  else 'mapped'
end
where mapping_status is null;

alter table public.goal_allocations
  alter column mapping_status set default 'mapped',
  alter column mapping_status set not null;

alter table public.goal_allocations
  drop constraint if exists goal_allocations_mapping_status_chk;
alter table public.goal_allocations
  add constraint goal_allocations_mapping_status_chk
  check (
    (mapping_status = 'mapped' and account_id is not null)
    or (mapping_status = 'unmapped_legacy' and account_id is null)
  ) not valid;
alter table public.goal_allocations validate constraint goal_allocations_mapping_status_chk;

alter table public.goal_allocations
  drop constraint if exists goal_allocations_type_chk;
alter table public.goal_allocations
  add constraint goal_allocations_type_chk
  check (type in ('assign', 'release', 'spend', 'adjustment', 'transfer_in', 'transfer_out'))
  not valid;
alter table public.goal_allocations validate constraint goal_allocations_type_chk;

do $migration$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'goal_allocations_owned_funding_fkey'
      and conrelid = 'public.goal_allocations'::regclass
  ) then
    alter table public.goal_allocations
      add constraint goal_allocations_owned_funding_fkey
      foreign key (goal_id, account_id, user_id, currency)
      references public.goal_funding_accounts (goal_id, account_id, user_id, currency)
      on delete restrict
      not valid;
  end if;
end
$migration$;

create index if not exists goal_allocations_account_time_idx
  on public.goal_allocations (user_id, account_id, created_at desc)
  where account_id is not null;
create index if not exists goal_allocations_goal_idx
  on public.goal_allocations (goal_id);
create index if not exists goal_allocations_owned_funding_idx
  on public.goal_allocations (goal_id, account_id, user_id, currency)
  where account_id is not null;
create unique index if not exists goal_allocations_user_client_request_idx
  on public.goal_allocations (user_id, client_request_id)
  where client_request_id is not null;

alter table public.transactions
  add column if not exists client_request_id uuid;

create unique index if not exists transactions_user_client_request_idx
  on public.transactions (user_id, client_request_id)
  where client_request_id is not null;
create index if not exists transactions_source_account_owner_idx
  on public.transactions (source_account_id, user_id)
  where source_account_id is not null;
create index if not exists transactions_destination_account_owner_idx
  on public.transactions (destination_account_id, user_id)
  where destination_account_id is not null;
create index if not exists transactions_target_owner_idx
  on public.transactions (target_id, user_id)
  where target_id is not null;
create index if not exists account_preferences_account_owner_idx
  on public.account_preferences (account_id, user_id, currency);

do $migration$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'transactions_target_owner_fkey'
      and conrelid = 'public.transactions'::regclass
  ) then
    alter table public.transactions
      add constraint transactions_target_owner_fkey
      foreign key (target_id, user_id)
      references public.goals (id, user_id)
      on delete restrict
      not valid;
  end if;
end
$migration$;

-- Historical trigger rows do not contain an account source. New writes are
-- handled by the atomic RPC below so the trigger must not create unmapped data.
drop trigger if exists sync_goal_allocation_after_transaction
  on public.transactions;

create or replace function public.get_account_reserved_amount(
  p_user_id uuid,
  p_account_id uuid,
  p_exclude_transaction_id uuid default null
)
returns numeric
language sql
stable
security definer
set search_path = ''
as $function$
  select coalesce(sum(
    case allocation.type
      when 'assign' then allocation.amount
      when 'transfer_in' then allocation.amount
      when 'release' then -allocation.amount
      when 'spend' then -allocation.amount
      when 'transfer_out' then -allocation.amount
      else allocation.amount
    end
  ), 0)::numeric
  from public.goal_allocations allocation
  join public.goals goal
    on goal.id = allocation.goal_id
   and goal.user_id = allocation.user_id
  where allocation.user_id = p_user_id
    and allocation.account_id = p_account_id
    and allocation.mapping_status = 'mapped'
    and goal.protection_mode in ('strict', 'flexible')
    and goal.status not in ('archived', 'used')
    and (p_exclude_transaction_id is null
      or allocation.transaction_id is distinct from p_exclude_transaction_id);
$function$;

create or replace function public.get_goal_account_amount(
  p_user_id uuid,
  p_goal_id uuid,
  p_account_id uuid,
  p_exclude_transaction_id uuid default null
)
returns numeric
language sql
stable
security definer
set search_path = ''
as $function$
  select coalesce(sum(
    case allocation.type
      when 'assign' then allocation.amount
      when 'transfer_in' then allocation.amount
      when 'release' then -allocation.amount
      when 'spend' then -allocation.amount
      when 'transfer_out' then -allocation.amount
      else allocation.amount
    end
  ), 0)::numeric
  from public.goal_allocations allocation
  where allocation.user_id = p_user_id
    and allocation.goal_id = p_goal_id
    and allocation.account_id = p_account_id
    and allocation.mapping_status = 'mapped'
    and (p_exclude_transaction_id is null
      or allocation.transaction_id is distinct from p_exclude_transaction_id);
$function$;

create or replace view public.account_available_balances
with (security_invoker = true)
as
with reservation_totals as (
  select
    allocation.user_id,
    allocation.account_id,
    coalesce(sum(case allocation.type
      when 'assign' then allocation.amount
      when 'transfer_in' then allocation.amount
      when 'release' then -allocation.amount
      when 'spend' then -allocation.amount
      when 'transfer_out' then -allocation.amount
      else allocation.amount
    end), 0) as reserved_balance
  from public.goal_allocations allocation
  join public.goals goal
    on goal.id = allocation.goal_id
   and goal.user_id = allocation.user_id
  where allocation.mapping_status = 'mapped'
    and goal.protection_mode in ('strict', 'flexible')
    and goal.status not in ('archived', 'used')
  group by allocation.user_id, allocation.account_id
)
select
  account.id as account_id,
  account.user_id,
  account.currency,
  account.balance_amount as actual_balance,
  greatest(coalesce(reservation.reserved_balance, 0), 0) as reserved_balance,
  account.balance_amount - greatest(coalesce(reservation.reserved_balance, 0), 0)
    as available_balance
from public.asset_accounts account
left join reservation_totals reservation
  on reservation.user_id = account.user_id
 and reservation.account_id = account.id
where account.is_archived = false;

create or replace function public.set_account_preference(
  p_currency text,
  p_flow_type text,
  p_account_id uuid
)
returns public.account_preferences
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_currency text := upper(trim(p_currency));
  v_saved public.account_preferences%rowtype;
begin
  if v_user_id is null then
    raise exception 'Sesi pengguna tidak valid.' using errcode = '42501';
  end if;
  if p_flow_type not in ('income', 'expense', 'transfer', 'exchange') then
    raise exception 'Jenis preferensi akun tidak valid.' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.asset_accounts account
    where account.id = p_account_id
      and account.user_id = v_user_id
      and account.currency = v_currency
      and account.is_archived = false
  ) then
    raise exception 'Akun utama tidak ditemukan atau tidak kompatibel.' using errcode = '22023';
  end if;

  insert into public.account_preferences (
    user_id, currency, flow_type, account_id, updated_at
  ) values (
    v_user_id, v_currency, p_flow_type, p_account_id, now()
  )
  on conflict (user_id, currency, flow_type)
  do update set account_id = excluded.account_id, updated_at = now()
  returning * into v_saved;

  return v_saved;
end;
$function$;

create or replace function public.create_goal_with_funding_atomic(
  p_goal jsonb,
  p_account_id uuid default null,
  p_initial_allocation numeric default 0,
  p_client_request_id uuid default null
)
returns public.goals
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_goal_id uuid := coalesce(nullif(p_goal->>'id', '')::uuid, gen_random_uuid());
  v_currency text := upper(coalesce(nullif(trim(p_goal->>'currency'), ''), 'IDR'));
  v_target numeric := nullif(p_goal->>'target_amount', '')::numeric;
  v_protection text := coalesce(nullif(p_goal->>'protection_mode', ''), 'flexible');
  v_initial numeric := coalesce(p_initial_allocation, 0);
  v_account public.asset_accounts%rowtype;
  v_saved public.goals%rowtype;
  v_reserved numeric;
begin
  if v_user_id is null then
    raise exception 'Sesi pengguna tidak valid.' using errcode = '42501';
  end if;
  if coalesce(trim(p_goal->>'name'), '') = '' then
    raise exception 'Nama target wajib diisi.' using errcode = '22023';
  end if;
  if coalesce(v_target, 0) <= 0 then
    raise exception 'Nominal target harus lebih besar dari 0.' using errcode = '22023';
  end if;
  if v_protection not in ('strict', 'flexible', 'informational') then
    raise exception 'Mode perlindungan target tidak valid.' using errcode = '22023';
  end if;
  if v_initial < 0 then
    raise exception 'Alokasi awal tidak boleh negatif.' using errcode = '22023';
  end if;
  if v_initial > 0 and p_account_id is null then
    raise exception 'Pilih akun sumber untuk alokasi awal.' using errcode = '22023';
  end if;

  if p_account_id is not null then
    select * into v_account
    from public.asset_accounts account
    where account.id = p_account_id and account.user_id = v_user_id
    for update;
    if not found or v_account.currency <> v_currency
      or v_account.is_archived or not v_account.is_allocatable then
      raise exception 'Akun sumber target tidak tersedia atau tidak kompatibel.' using errcode = '22023';
    end if;
    v_reserved := public.get_account_reserved_amount(v_user_id, p_account_id);
    if v_initial > v_account.balance_amount - greatest(v_reserved, 0) + 0.0001 then
      raise exception 'Dana tersedia pada akun sumber tidak mencukupi.' using errcode = 'P0001';
    end if;
  end if;

  insert into public.goals (
    id, user_id, name, currency, target_amount, target_amount_idr,
    saved_amount_idr, target_type, deadline, note, status,
    protection_mode, funding_status, spending_reduces_progress,
    created_at, updated_at
  ) values (
    v_goal_id, v_user_id, trim(p_goal->>'name'), v_currency, v_target,
    v_target, 0,
    case when p_goal->>'target_type' = 'collect_by_date'
      then 'collect_by_date' else 'hold_balance' end,
    nullif(p_goal->>'deadline', '')::date,
    coalesce(p_goal->>'note', ''), 'active', v_protection,
    case when p_account_id is null then 'plan_only' else 'funded' end,
    coalesce(nullif(p_goal->>'spending_reduces_progress', '')::boolean, true),
    coalesce(nullif(p_goal->>'created_at', '')::timestamptz, now()), now()
  )
  returning * into v_saved;

  if p_account_id is not null then
    insert into public.goal_funding_accounts (
      goal_id, account_id, user_id, currency, is_primary
    ) values (v_goal_id, p_account_id, v_user_id, v_currency, true);
  end if;

  if v_initial > 0 then
    insert into public.goal_allocations (
      user_id, goal_id, account_id, type, amount, currency,
      mapping_status, client_request_id, note, created_at
    ) values (
      v_user_id, v_goal_id, p_account_id, 'assign', v_initial, v_currency,
      'mapped', p_client_request_id, 'Alokasi awal', now()
    );
  end if;

  return v_saved;
end;
$function$;

create or replace function public.record_goal_activity_atomic(
  p_goal_id uuid,
  p_account_id uuid,
  p_type text,
  p_amount numeric,
  p_note text default '',
  p_client_request_id uuid default null
)
returns public.goal_allocations
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_goal public.goals%rowtype;
  v_account public.asset_accounts%rowtype;
  v_reserved numeric;
  v_goal_amount numeric;
  v_saved public.goal_allocations%rowtype;
begin
  if v_user_id is null then
    raise exception 'Sesi pengguna tidak valid.' using errcode = '42501';
  end if;
  if p_type not in ('assign', 'release') or coalesce(p_amount, 0) <= 0 then
    raise exception 'Aktivitas atau nominal target tidak valid.' using errcode = '22023';
  end if;

  if p_client_request_id is not null then
    select * into v_saved from public.goal_allocations
    where user_id = v_user_id and client_request_id = p_client_request_id;
    if found then return v_saved; end if;
  end if;

  select * into v_goal from public.goals
  where id = p_goal_id and user_id = v_user_id;
  if not found or v_goal.status in ('archived', 'used') then
    raise exception 'Target tidak tersedia.' using errcode = '22023';
  end if;

  select * into v_account from public.asset_accounts
  where id = p_account_id and user_id = v_user_id
  for update;
  if not found or v_account.currency <> v_goal.currency
    or v_account.is_archived or not v_account.is_allocatable then
    raise exception 'Akun sumber target tidak tersedia atau tidak kompatibel.' using errcode = '22023';
  end if;

  insert into public.goal_funding_accounts (
    goal_id, account_id, user_id, currency, is_primary
  ) values (
    p_goal_id, p_account_id, v_user_id, v_goal.currency,
    not exists (select 1 from public.goal_funding_accounts where goal_id = p_goal_id)
  ) on conflict (goal_id, account_id) do nothing;

  if p_type = 'assign' then
    v_reserved := public.get_account_reserved_amount(v_user_id, p_account_id);
    if p_amount > v_account.balance_amount - greatest(v_reserved, 0) + 0.0001 then
      raise exception 'Dana tersedia pada akun sumber tidak mencukupi.' using errcode = 'P0001';
    end if;
  else
    v_goal_amount := public.get_goal_account_amount(v_user_id, p_goal_id, p_account_id);
    if p_amount > v_goal_amount + 0.0001 then
      raise exception 'Dana target pada akun sumber tidak mencukupi.' using errcode = 'P0001';
    end if;
  end if;

  insert into public.goal_allocations (
    user_id, goal_id, account_id, type, amount, currency,
    mapping_status, client_request_id, note, created_at
  ) values (
    v_user_id, p_goal_id, p_account_id, p_type, p_amount, v_goal.currency,
    'mapped', p_client_request_id, nullif(trim(p_note), ''), now()
  ) returning * into v_saved;

  update public.goals set funding_status = 'funded', updated_at = now()
  where id = p_goal_id and user_id = v_user_id;

  return v_saved;
end;
$function$;

create or replace function public.move_goal_allocation_atomic(
  p_source_goal_id uuid,
  p_destination_goal_id uuid,
  p_account_id uuid,
  p_amount numeric,
  p_client_request_id uuid default null
)
returns setof public.goal_allocations
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_source public.goals%rowtype;
  v_destination public.goals%rowtype;
  v_account public.asset_accounts%rowtype;
  v_available numeric;
  v_event_group uuid := gen_random_uuid();
begin
  if v_user_id is null then
    raise exception 'Sesi pengguna tidak valid.' using errcode = '42501';
  end if;
  if p_source_goal_id = p_destination_goal_id or coalesce(p_amount, 0) <= 0 then
    raise exception 'Pemindahan alokasi tidak valid.' using errcode = '22023';
  end if;

  select * into v_source from public.goals
  where id = p_source_goal_id and user_id = v_user_id;
  select * into v_destination from public.goals
  where id = p_destination_goal_id and user_id = v_user_id;
  if v_source.id is null or v_destination.id is null
    or v_source.currency <> v_destination.currency then
    raise exception 'Target sumber dan tujuan harus valid serta bermata uang sama.' using errcode = '22023';
  end if;

  select * into v_account from public.asset_accounts
  where id = p_account_id and user_id = v_user_id for update;
  if not found or v_account.currency <> v_source.currency or v_account.is_archived then
    raise exception 'Akun sumber tidak kompatibel.' using errcode = '22023';
  end if;

  v_available := public.get_goal_account_amount(
    v_user_id, p_source_goal_id, p_account_id
  );
  if p_amount > v_available + 0.0001 then
    raise exception 'Dana target sumber tidak mencukupi.' using errcode = 'P0001';
  end if;

  insert into public.goal_funding_accounts (
    goal_id, account_id, user_id, currency, is_primary
  ) values (
    p_destination_goal_id, p_account_id, v_user_id, v_source.currency,
    not exists (select 1 from public.goal_funding_accounts where goal_id = p_destination_goal_id)
  ) on conflict (goal_id, account_id) do nothing;

  return query
  insert into public.goal_allocations (
    user_id, goal_id, account_id, type, amount, currency,
    mapping_status, event_group_id, client_request_id, note, created_at
  ) values
    (v_user_id, p_source_goal_id, p_account_id, 'transfer_out', p_amount,
      v_source.currency, 'mapped', v_event_group, p_client_request_id,
      'Dipindahkan ke ' || v_destination.name, now()),
    (v_user_id, p_destination_goal_id, p_account_id, 'transfer_in', p_amount,
      v_source.currency, 'mapped', v_event_group, null,
      'Dipindahkan dari ' || v_source.name, now())
  returning *;
end;
$function$;

create or replace function public.record_transaction_atomic(
  p_transaction jsonb,
  p_reserved_action text default null
)
returns public.transactions
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_id uuid := coalesce(nullif(p_transaction->>'id', '')::uuid, gen_random_uuid());
  v_client_request_id uuid := nullif(p_transaction->>'client_request_id', '')::uuid;
  v_type text := p_transaction->>'type';
  v_currency text := upper(nullif(p_transaction->>'currency', ''));
  v_from_currency text := upper(nullif(p_transaction->>'from_currency', ''));
  v_to_currency text := upper(nullif(p_transaction->>'to_currency', ''));
  v_amount numeric := nullif(p_transaction->>'amount', '')::numeric;
  v_from_amount numeric := nullif(p_transaction->>'from_amount', '')::numeric;
  v_to_amount numeric := nullif(p_transaction->>'to_amount', '')::numeric;
  v_fee numeric := coalesce(nullif(p_transaction->>'fee_amount', '')::numeric, 0);
  v_source_id uuid := nullif(p_transaction->>'source_account_id', '')::uuid;
  v_destination_id uuid := nullif(p_transaction->>'destination_account_id', '')::uuid;
  v_target_id uuid := nullif(p_transaction->>'target_id', '')::uuid;
  v_source public.asset_accounts%rowtype;
  v_destination public.asset_accounts%rowtype;
  v_goal public.goals%rowtype;
  v_saved public.transactions%rowtype;
  v_debit numeric := 0;
  v_reserved numeric := 0;
  v_goal_amount numeric := 0;
  v_other_reserved numeric := 0;
begin
  if v_user_id is null then
    raise exception 'Sesi pengguna tidak valid.' using errcode = '42501';
  end if;
  if v_type not in ('income', 'expense', 'exchange') then
    raise exception 'Jenis transaksi tidak valid.' using errcode = '22023';
  end if;

  if v_client_request_id is not null then
    select * into v_saved from public.transactions
    where user_id = v_user_id and client_request_id = v_client_request_id;
    if found then return v_saved; end if;
  end if;

  if v_type = 'income' then
    if coalesce(v_amount, 0) <= 0 or v_destination_id is null then
      raise exception 'Pemasukan memerlukan nominal dan akun tujuan.' using errcode = '22023';
    end if;
    select * into v_destination from public.asset_accounts
    where id = v_destination_id and user_id = v_user_id for update;
    if not found or v_destination.currency <> v_currency or v_destination.is_archived then
      raise exception 'Akun tujuan tidak tersedia atau mata uang tidak sesuai.' using errcode = '22023';
    end if;
  elsif v_type = 'expense' then
    if coalesce(v_amount, 0) <= 0 or v_source_id is null then
      raise exception 'Pengeluaran memerlukan nominal dan akun sumber.' using errcode = '22023';
    end if;
    select * into v_source from public.asset_accounts
    where id = v_source_id and user_id = v_user_id for update;
    if not found or v_source.currency <> v_currency or v_source.is_archived then
      raise exception 'Akun sumber tidak tersedia atau mata uang tidak sesuai.' using errcode = '22023';
    end if;
    v_debit := v_amount;
  else
    if coalesce(v_from_amount, 0) <= 0 or coalesce(v_to_amount, 0) <= 0
      or v_source_id is null or v_destination_id is null
      or v_source_id = v_destination_id then
      raise exception 'Transfer/exchange memerlukan dua akun dan nominal valid.' using errcode = '22023';
    end if;
    perform 1 from public.asset_accounts account
    where account.user_id = v_user_id
      and account.id in (v_source_id, v_destination_id)
    order by account.id for update;
    select * into v_source from public.asset_accounts
    where id = v_source_id and user_id = v_user_id;
    select * into v_destination from public.asset_accounts
    where id = v_destination_id and user_id = v_user_id;
    if v_source.id is null or v_destination.id is null
      or v_source.currency <> v_from_currency
      or v_destination.currency <> v_to_currency
      or v_source.is_archived or v_destination.is_archived then
      raise exception 'Akun transfer/exchange tidak tersedia atau mata uang tidak sesuai.' using errcode = '22023';
    end if;
    v_debit := v_from_amount + v_fee;
  end if;

  if v_type in ('expense', 'exchange') then
    if v_debit > v_source.balance_amount + 0.0001 then
      raise exception 'Saldo aktual akun sumber tidak mencukupi.' using errcode = 'P0001';
    end if;
    v_reserved := greatest(public.get_account_reserved_amount(v_user_id, v_source_id), 0);

    if v_type = 'expense' and v_target_id is not null then
      select * into v_goal from public.goals
      where id = v_target_id and user_id = v_user_id;
      if not found or v_goal.currency <> v_currency
        or v_goal.status in ('archived', 'used')
        or not exists (
          select 1 from public.goal_funding_accounts funding
          where funding.goal_id = v_target_id
            and funding.account_id = v_source_id
            and funding.user_id = v_user_id
            and funding.currency = v_currency
        ) then
        raise exception 'Target tidak terhubung ke akun sumber transaksi.' using errcode = '22023';
      end if;
      v_goal_amount := greatest(public.get_goal_account_amount(
        v_user_id, v_target_id, v_source_id
      ), 0);
      if v_amount > v_goal_amount + 0.0001 then
        raise exception 'Dana target pada akun sumber tidak mencukupi.' using errcode = 'P0001';
      end if;

      if v_goal.spending_reduces_progress then
        v_other_reserved := greatest(v_reserved - case
          when v_goal.protection_mode in ('strict', 'flexible') then v_goal_amount
          else 0 end, 0);
        if v_debit > v_source.balance_amount - v_other_reserved + 0.0001 then
          raise exception 'Transaksi akan memakai dana target lain yang dilindungi.' using errcode = 'P0001';
        end if;
      elsif v_debit > v_source.balance_amount - v_reserved + 0.0001 then
        raise exception 'Target ini tidak mengurangi progres; dana bebas akun tidak mencukupi.' using errcode = 'P0001';
      end if;
    elsif v_debit > v_source.balance_amount - v_reserved + 0.0001 then
      if p_reserved_action = 'use_goal' then
        raise exception 'Pilih target yang akan digunakan sebelum melanjutkan.' using errcode = 'P0001';
      end if;
      raise exception 'Dana tersedia akun tidak mencukupi karena sebagian saldo dilindungi target.' using errcode = 'P0001';
    end if;
  end if;

  insert into public.transactions (
    id, user_id, type, occurred_at, description, category, category_group,
    currency, amount, base_currency, base_amount,
    from_currency, to_currency, from_amount, to_amount, rate,
    rate_base_currency, rate_quote_currency, exchange_rate, rate_type,
    source_account_id, destination_account_id, fee_amount, fee_currency,
    target_id, amount_idr, amount_thb, locked_rate,
    created_at, updated_at, client_request_id
  ) values (
    v_id, v_user_id, v_type,
    coalesce(nullif(p_transaction->>'occurred_at', '')::timestamptz, now()),
    coalesce(p_transaction->>'description', ''),
    nullif(p_transaction->>'category', ''),
    nullif(p_transaction->>'category_group', ''),
    v_currency, v_amount,
    upper(coalesce(nullif(p_transaction->>'base_currency', ''), 'IDR')),
    nullif(p_transaction->>'base_amount', '')::numeric,
    v_from_currency, v_to_currency, v_from_amount, v_to_amount,
    nullif(p_transaction->>'rate', '')::numeric,
    upper(nullif(p_transaction->>'rate_base_currency', '')),
    upper(nullif(p_transaction->>'rate_quote_currency', '')),
    nullif(p_transaction->>'exchange_rate', '')::numeric,
    nullif(p_transaction->>'rate_type', ''),
    v_source_id, v_destination_id,
    nullif(p_transaction->>'fee_amount', '')::numeric,
    upper(nullif(p_transaction->>'fee_currency', '')),
    v_target_id,
    nullif(p_transaction->>'amount_idr', '')::numeric,
    nullif(p_transaction->>'amount_thb', '')::numeric,
    nullif(p_transaction->>'locked_rate', '')::numeric,
    coalesce(nullif(p_transaction->>'created_at', '')::timestamptz, now()),
    now(), v_client_request_id
  ) returning * into v_saved;

  if v_type = 'income' then
    update public.asset_accounts
    set balance_amount = balance_amount + v_amount, updated_at = now()
    where id = v_destination_id and user_id = v_user_id;
  elsif v_type = 'expense' then
    update public.asset_accounts
    set balance_amount = balance_amount - v_amount, updated_at = now()
    where id = v_source_id and user_id = v_user_id;
  else
    update public.asset_accounts
    set balance_amount = balance_amount - v_debit, updated_at = now()
    where id = v_source_id and user_id = v_user_id;
    update public.asset_accounts
    set balance_amount = balance_amount + v_to_amount, updated_at = now()
    where id = v_destination_id and user_id = v_user_id;
  end if;

  if v_type = 'expense' and v_target_id is not null
    and v_goal.spending_reduces_progress then
    insert into public.goal_allocations (
      user_id, goal_id, account_id, type, amount, currency,
      transaction_id, mapping_status, note, created_at
    ) values (
      v_user_id, v_target_id, v_source_id, 'spend', v_amount, v_currency,
      v_saved.id, 'mapped', nullif(v_saved.description, ''), v_saved.occurred_at
    );
  end if;

  return v_saved;
end;
$function$;

create or replace function public.update_transaction_atomic(
  p_transaction_id uuid,
  p_transaction jsonb,
  p_reserved_action text default null
)
returns public.transactions
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_old public.transactions%rowtype;
  v_destination public.asset_accounts%rowtype;
  v_destination_reserved numeric;
  v_payload jsonb;
begin
  if v_user_id is null then
    raise exception 'Sesi pengguna tidak valid.' using errcode = '42501';
  end if;
  select * into v_old from public.transactions
  where id = p_transaction_id and user_id = v_user_id for update;
  if not found then
    raise exception 'Transaksi tidak ditemukan.' using errcode = 'P0002';
  end if;

  perform 1 from public.asset_accounts account
  where account.user_id = v_user_id
    and account.id in (
      v_old.source_account_id, v_old.destination_account_id,
      nullif(p_transaction->>'source_account_id', '')::uuid,
      nullif(p_transaction->>'destination_account_id', '')::uuid
    )
  order by account.id for update;

  if v_old.type = 'income' and v_old.destination_account_id is not null then
    select * into v_destination from public.asset_accounts
    where id = v_old.destination_account_id and user_id = v_user_id;
    v_destination_reserved := greatest(public.get_account_reserved_amount(
      v_user_id, v_old.destination_account_id
    ), 0);
    if v_destination.balance_amount - coalesce(v_old.amount, 0)
      < v_destination_reserved - 0.0001 then
      raise exception 'Pemasukan tidak dapat diubah karena dananya sudah dipakai atau dilindungi.' using errcode = 'P0001';
    end if;
    update public.asset_accounts
    set balance_amount = balance_amount - v_old.amount, updated_at = now()
    where id = v_old.destination_account_id and user_id = v_user_id;
  elsif v_old.type = 'expense' and v_old.source_account_id is not null then
    update public.asset_accounts
    set balance_amount = balance_amount + v_old.amount, updated_at = now()
    where id = v_old.source_account_id and user_id = v_user_id;
  elsif v_old.type = 'exchange' then
    select * into v_destination from public.asset_accounts
    where id = v_old.destination_account_id and user_id = v_user_id;
    v_destination_reserved := greatest(public.get_account_reserved_amount(
      v_user_id, v_old.destination_account_id
    ), 0);
    if v_destination.balance_amount - coalesce(v_old.to_amount, 0)
      < v_destination_reserved - 0.0001 then
      raise exception 'Transfer tidak dapat diubah karena dana tujuan sudah dipakai atau dilindungi.' using errcode = 'P0001';
    end if;
    update public.asset_accounts
    set balance_amount = balance_amount + coalesce(v_old.from_amount, 0)
      + coalesce(v_old.fee_amount, 0), updated_at = now()
    where id = v_old.source_account_id and user_id = v_user_id;
    update public.asset_accounts
    set balance_amount = balance_amount - coalesce(v_old.to_amount, 0), updated_at = now()
    where id = v_old.destination_account_id and user_id = v_user_id;
  end if;

  delete from public.transactions where id = v_old.id and user_id = v_user_id;
  v_payload := p_transaction || jsonb_build_object(
    'id', p_transaction_id,
    'client_request_id', coalesce(
      nullif(p_transaction->>'client_request_id', ''),
      v_old.client_request_id::text
    ),
    'created_at', v_old.created_at
  );
  return public.record_transaction_atomic(v_payload, p_reserved_action);
end;
$function$;

create or replace function public.delete_transaction_atomic(
  p_transaction_id uuid
)
returns public.transactions
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_old public.transactions%rowtype;
  v_destination public.asset_accounts%rowtype;
  v_destination_reserved numeric;
begin
  if v_user_id is null then
    raise exception 'Sesi pengguna tidak valid.' using errcode = '42501';
  end if;
  select * into v_old from public.transactions
  where id = p_transaction_id and user_id = v_user_id for update;
  if not found then
    raise exception 'Transaksi tidak ditemukan.' using errcode = 'P0002';
  end if;

  perform 1 from public.asset_accounts account
  where account.user_id = v_user_id
    and account.id in (v_old.source_account_id, v_old.destination_account_id)
  order by account.id for update;

  if v_old.type = 'income' and v_old.destination_account_id is not null then
    select * into v_destination from public.asset_accounts
    where id = v_old.destination_account_id and user_id = v_user_id;
    v_destination_reserved := greatest(public.get_account_reserved_amount(
      v_user_id, v_old.destination_account_id, v_old.id
    ), 0);
    if v_destination.balance_amount - coalesce(v_old.amount, 0)
      < v_destination_reserved - 0.0001 then
      raise exception 'Pemasukan tidak dapat dihapus karena dananya sudah dipakai atau dilindungi.' using errcode = 'P0001';
    end if;
    update public.asset_accounts
    set balance_amount = balance_amount - v_old.amount, updated_at = now()
    where id = v_old.destination_account_id and user_id = v_user_id;
  elsif v_old.type = 'expense' and v_old.source_account_id is not null then
    update public.asset_accounts
    set balance_amount = balance_amount + v_old.amount, updated_at = now()
    where id = v_old.source_account_id and user_id = v_user_id;
  elsif v_old.type = 'exchange' then
    select * into v_destination from public.asset_accounts
    where id = v_old.destination_account_id and user_id = v_user_id;
    v_destination_reserved := greatest(public.get_account_reserved_amount(
      v_user_id, v_old.destination_account_id, v_old.id
    ), 0);
    if v_destination.balance_amount - coalesce(v_old.to_amount, 0)
      < v_destination_reserved - 0.0001 then
      raise exception 'Transfer tidak dapat dihapus karena dana tujuan sudah dipakai atau dilindungi.' using errcode = 'P0001';
    end if;
    update public.asset_accounts
    set balance_amount = balance_amount + coalesce(v_old.from_amount, 0)
      + coalesce(v_old.fee_amount, 0), updated_at = now()
    where id = v_old.source_account_id and user_id = v_user_id;
    update public.asset_accounts
    set balance_amount = balance_amount - coalesce(v_old.to_amount, 0), updated_at = now()
    where id = v_old.destination_account_id and user_id = v_user_id;
  end if;

  delete from public.transactions where id = v_old.id and user_id = v_user_id;
  return v_old;
end;
$function$;

-- Harden existing ownership policies and scope them to authenticated callers.
drop policy if exists "Users can read own asset accounts" on public.asset_accounts;
create policy "Users can read own asset accounts"
  on public.asset_accounts for select to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists "Users can insert own asset accounts" on public.asset_accounts;
create policy "Users can insert own asset accounts"
  on public.asset_accounts for insert to authenticated
  with check ((select auth.uid()) = user_id);
drop policy if exists "Users can update own asset accounts" on public.asset_accounts;
create policy "Users can update own asset accounts"
  on public.asset_accounts for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
drop policy if exists "Users can delete own asset accounts" on public.asset_accounts;
create policy "Users can delete own asset accounts"
  on public.asset_accounts for delete to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can read own goals" on public.goals;
create policy "Users can read own goals"
  on public.goals for select to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists "Users can insert own goals" on public.goals;
create policy "Users can insert own goals"
  on public.goals for insert to authenticated
  with check ((select auth.uid()) = user_id);
drop policy if exists "Users can update own goals" on public.goals;
create policy "Users can update own goals"
  on public.goals for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
drop policy if exists "Users can delete own goals" on public.goals;
create policy "Users can delete own goals"
  on public.goals for delete to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can read own goal allocations" on public.goal_allocations;
create policy "Users can read own goal allocations"
  on public.goal_allocations for select to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists "Users can insert own goal allocations" on public.goal_allocations;
create policy "Users can insert own goal allocations"
  on public.goal_allocations for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and mapping_status = 'mapped'
    and exists (
      select 1 from public.goal_funding_accounts funding
      where funding.goal_id = goal_id
        and funding.account_id = account_id
        and funding.user_id = (select auth.uid())
        and funding.currency = goal_allocations.currency
    )
  );
drop policy if exists "Users can update own goal allocations" on public.goal_allocations;
drop policy if exists "Users can delete own goal allocations" on public.goal_allocations;

drop policy if exists "Users can read own transactions" on public.transactions;
create policy "Users can read own transactions"
  on public.transactions for select to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists "Users can insert own transactions" on public.transactions;
create policy "Users can insert own transactions"
  on public.transactions for insert to authenticated
  with check ((select auth.uid()) = user_id);
drop policy if exists "Users can update own transactions" on public.transactions;
create policy "Users can update own transactions"
  on public.transactions for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
drop policy if exists "Users can delete own transactions" on public.transactions;
create policy "Users can delete own transactions"
  on public.transactions for delete to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.account_preferences from anon;
revoke all on table public.goal_funding_accounts from anon;
revoke all on table public.account_preferences from authenticated;
revoke all on table public.goal_funding_accounts from authenticated;
grant select, insert, update, delete on table public.account_preferences to authenticated;
grant select, insert, update, delete on table public.goal_funding_accounts to authenticated;
revoke all on table public.goal_allocations from anon;
grant select, insert on table public.goal_allocations to authenticated;
grant select on table public.account_available_balances to authenticated;
revoke all on table public.account_available_balances from anon;

revoke all on function public.get_account_reserved_amount(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.get_goal_account_amount(uuid, uuid, uuid, uuid) from public, anon, authenticated;

revoke all on function public.set_account_preference(text, text, uuid) from public, anon;
revoke all on function public.create_goal_with_funding_atomic(jsonb, uuid, numeric, uuid) from public, anon;
revoke all on function public.record_goal_activity_atomic(uuid, uuid, text, numeric, text, uuid) from public, anon;
revoke all on function public.move_goal_allocation_atomic(uuid, uuid, uuid, numeric, uuid) from public, anon;
revoke all on function public.record_transaction_atomic(jsonb, text) from public, anon;
revoke all on function public.update_transaction_atomic(uuid, jsonb, text) from public, anon;
revoke all on function public.delete_transaction_atomic(uuid) from public, anon;

grant execute on function public.set_account_preference(text, text, uuid) to authenticated;
grant execute on function public.create_goal_with_funding_atomic(jsonb, uuid, numeric, uuid) to authenticated;
grant execute on function public.record_goal_activity_atomic(uuid, uuid, text, numeric, text, uuid) to authenticated;
grant execute on function public.move_goal_allocation_atomic(uuid, uuid, uuid, numeric, uuid) to authenticated;
grant execute on function public.record_transaction_atomic(jsonb, text) to authenticated;
grant execute on function public.update_transaction_atomic(uuid, jsonb, text) to authenticated;
grant execute on function public.delete_transaction_atomic(uuid) to authenticated;

-- Remove legacy SECURITY DEFINER execution paths from API callers. The auth
-- trigger remains able to invoke handle_new_user_profile internally.
revoke execute on function public.sync_goal_allocation_from_transaction() from public, anon, authenticated;
revoke execute on function public.handle_new_user_profile() from public, anon, authenticated;

do $migration$
begin
  if to_regprocedure('public.set_updated_at()') is not null then
    alter function public.set_updated_at() set search_path = '';
  end if;
end
$migration$;

commit;
