-- Safe migration for CUANSYNC budget categories.
-- Run this in Supabase SQL Editor when the app shows:
-- "Could not find the 'category' column of 'budgets' in the schema cache"
--
-- This file only adds missing budget fields, fills empty values,
-- and creates helper indexes.

alter table public.budgets
  add column if not exists category text,
  add column if not exists currency text,
  add column if not exists limit_amount numeric(18, 4);

update public.budgets
set
  currency = coalesce(currency, 'THB'),
  limit_amount = coalesce(limit_amount, limit_thb, 0)
where currency is null or limit_amount is null;

update public.budgets
set category = coalesce(nullif(trim(category), ''), group_key)
where category is null or trim(category) = '';

alter table public.budgets
  alter column currency set default 'IDR';

alter table public.budgets
  alter column limit_thb set default 0;

create index if not exists budgets_user_currency_month_idx
  on public.budgets (user_id, currency, month_key desc);

create index if not exists budgets_user_category_month_idx
  on public.budgets (
    user_id,
    lower(trim(coalesce(category, group_key))),
    month_key desc
  );
