-- Safe additive migration for YNAB-style goal allocation.
-- Existing goal rows and saved_amount_idr are preserved as a legacy baseline.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

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
  on public.goal_allocations
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own goal allocations"
  on public.goal_allocations;
create policy "Users can insert own goal allocations"
  on public.goal_allocations
  for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.goals
      where goals.id = goal_id and goals.user_id = auth.uid()
    )
  );

drop policy if exists "Users can update own goal allocations"
  on public.goal_allocations;
create policy "Users can update own goal allocations"
  on public.goal_allocations
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own goal allocations"
  on public.goal_allocations;
create policy "Users can delete own goal allocations"
  on public.goal_allocations
  for delete
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
    delete from public.goal_allocations
    where transaction_id = old.id;
    return old;
  end if;

  if tg_op = 'UPDATE' then
    delete from public.goal_allocations
    where transaction_id = old.id;
  end if;

  if new.type = 'expense' and new.target_id is not null then
    select goals.currency
    into target_currency
    from public.goals
    where goals.id = new.target_id
      and goals.user_id = new.user_id;

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

commit;
