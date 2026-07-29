-- Fix old CUANSYNC budget uniqueness rule.
--
-- Run this when Supabase shows:
-- duplicate key value violates unique constraint "budgets_user_month_group_currency_idx"
--
-- This removes only the old unique index that groups all categories by group_key.
-- It does not delete budget rows.

drop index if exists public.budgets_user_month_group_idx;
drop index if exists public.budgets_user_month_group_currency_idx;

create unique index if not exists budgets_user_month_category_currency_idx
  on public.budgets (
    user_id,
    month_key,
    currency,
    lower(trim(coalesce(category, group_key)))
  );

create index if not exists budgets_user_category_month_idx
  on public.budgets (
    user_id,
    lower(trim(coalesce(category, group_key))),
    month_key desc
  );

