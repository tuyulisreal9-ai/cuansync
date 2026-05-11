create extension if not exists pgcrypto;

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (type in ('income', 'exchange', 'expense')),
  occurred_at timestamptz not null default now(),
  description text not null default '',
  category text,
  amount_idr numeric(14, 2),
  amount_thb numeric(14, 2),
  locked_rate numeric(14, 6),
  created_at timestamptz not null default now()
);

alter table public.transactions
  add column if not exists category_group text
  check (category_group is null or category_group in ('needs', 'wants', 'invest'));

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

create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  month_key text not null,
  group_key text not null check (group_key in ('needs', 'wants', 'invest')),
  limit_thb numeric(14, 2) not null check (limit_thb >= 0),
  created_at timestamptz not null default now()
);

create unique index if not exists budgets_user_month_group_idx
  on public.budgets (user_id, month_key, group_key);

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
