-- Safe migration to the eight active CUANSYNC expense categories.
-- Transaction amounts and account balances are never changed.
-- Duplicate budgets created by legacy aliases are merged before removal.

begin;

alter table public.budgets
  add column if not exists category text,
  add column if not exists currency text,
  add column if not exists limit_amount numeric(18, 4);

update public.transactions
set
  category = case
    when lower(trim(category)) in ('makan', 'makan harian', 'makanan')
      then 'Makan'
    when lower(trim(category)) in ('belanja', 'belanja kebutuhan', 'kebutuhan harian')
      then 'Belanja'
    when lower(trim(category)) in ('transport', 'transportasi')
      then 'Transportasi'
    when lower(trim(category)) in (
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
    when lower(trim(category)) = 'kesehatan'
      then 'Kesehatan'
    when lower(trim(category)) in (
      'tempat tinggal',
      'hunian',
      'sewa tempat',
      'sewa tempat / hunian',
      'sewa tempat & hunian'
    )
      then 'Tempat Tinggal'
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
    )
      then 'Hiburan & Gaya Hidup'
    when lower(trim(category)) in ('lainnya', 'lain-lain', 'other')
      then 'Lainnya'
    else category
  end,
  category_group = case
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
    )
      then 'wants'
    else 'needs'
  end
where
  type = 'expense'
  and category is not null;

update public.budgets
set
  currency = coalesce(
    currency,
    case when limit_thb is not null then 'THB' else 'IDR' end
  ),
  limit_amount = coalesce(limit_amount, limit_thb, 0);

drop index if exists public.budgets_user_month_category_currency_idx;

update public.budgets
set
  category = case
    when lower(trim(coalesce(category, group_key))) in ('makan', 'makan harian', 'makanan')
      then 'Makan'
    when lower(trim(coalesce(category, group_key))) in (
      'belanja',
      'belanja kebutuhan',
      'kebutuhan harian'
    )
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
    when lower(trim(coalesce(category, group_key))) = 'kesehatan'
      then 'Kesehatan'
    when lower(trim(coalesce(category, group_key))) in (
      'tempat tinggal',
      'hunian',
      'sewa tempat',
      'sewa tempat / hunian',
      'sewa tempat & hunian'
    )
      then 'Tempat Tinggal'
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
      'lainnya',
      'lain-lain',
      'other',
      'needs',
      'wants',
      'invest'
    )
      then 'Lainnya'
    else coalesce(nullif(trim(category), ''), 'Lainnya')
  end;

update public.budgets
set group_key = case
  when category = 'Hiburan & Gaya Hidup' then 'wants'
  else 'needs'
end;

do $$
declare
  duplicate_group record;
  keep_id uuid;
begin
  for duplicate_group in
    select
      user_id,
      month_key,
      currency,
      lower(trim(coalesce(category, group_key))) as category_key,
      array_agg(id order by created_at, id::text) as budget_ids,
      sum(coalesce(limit_amount, limit_thb, 0)) as merged_limit
    from public.budgets
    group by
      user_id,
      month_key,
      currency,
      lower(trim(coalesce(category, group_key)))
    having count(*) > 1
  loop
    keep_id := duplicate_group.budget_ids[1];

    update public.budgets
    set
      limit_amount = duplicate_group.merged_limit,
      limit_thb = case
        when currency = 'THB' then duplicate_group.merged_limit
        else coalesce(limit_thb, 0)
      end
    where id = keep_id;

    delete from public.budgets
    where id = any(duplicate_group.budget_ids)
      and id <> keep_id;
  end loop;
end $$;

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

commit;
