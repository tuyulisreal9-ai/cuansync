-- Snapshot rekonsiliasi hanya mencatat hasil perbandingan. Saldo dompet tetap
-- berubah melalui alur transaksi yang sudah ada, bukan melalui tabel ini.
begin;

create table if not exists public.account_reconciliations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid not null,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  checked_at timestamptz not null default now(),
  app_balance numeric(18, 4) not null check (app_balance >= 0),
  bank_balance numeric(18, 4) not null check (bank_balance >= 0),
  difference numeric(18, 4) not null,
  status text not null check (status in ('matched', 'different')),
  note text,
  created_at timestamptz not null default now(),
  constraint account_reconciliations_difference_chk
    check (difference = bank_balance - app_balance),
  constraint account_reconciliations_status_consistency_chk
    check (
      (difference = 0 and status = 'matched')
      or (difference <> 0 and status = 'different')
    ),
  constraint account_reconciliations_owned_account_fkey
    foreign key (account_id, user_id)
    references public.asset_accounts (id, user_id)
    on delete cascade
);

create index if not exists account_reconciliations_user_account_checked_idx
  on public.account_reconciliations
  (user_id, account_id, checked_at desc, created_at desc);

create index if not exists account_reconciliations_user_checked_idx
  on public.account_reconciliations
  (user_id, checked_at desc, created_at desc);

alter table public.account_reconciliations enable row level security;

drop policy if exists "Users can read own account reconciliations"
  on public.account_reconciliations;
create policy "Users can read own account reconciliations"
  on public.account_reconciliations for select to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.record_account_reconciliation(
  p_account_id uuid,
  p_bank_balance numeric,
  p_note text default null
)
returns public.account_reconciliations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_account public.asset_accounts%rowtype;
  v_bank_balance numeric(18, 4);
  v_saved public.account_reconciliations%rowtype;
begin
  if v_user_id is null then
    raise exception 'Pengguna belum masuk.';
  end if;
  if p_bank_balance is null or p_bank_balance < 0 then
    raise exception 'Saldo bank tidak boleh kosong atau negatif.';
  end if;
  select account.*
  into v_account
  from public.asset_accounts account
  where account.id = p_account_id
    and account.user_id = v_user_id
    and account.is_archived = false
  for update;

  if not found then
    raise exception 'Dompet aktif tidak ditemukan atau bukan milik pengguna.';
  end if;
  if v_account.account_type not in ('bank', 'cash', 'ewallet') then
    raise exception 'Cocokkan Saldo hanya tersedia untuk Bank, Cash, dan E-wallet.';
  end if;

  -- Penetapan ke numeric(18,4) dilakukan sebelum menghitung selisih agar nilai
  -- yang dibandingkan persis sama dengan snapshot yang akhirnya disimpan.
  v_bank_balance := p_bank_balance;

  insert into public.account_reconciliations (
    user_id,
    account_id,
    currency,
    checked_at,
    app_balance,
    bank_balance,
    difference,
    status,
    note
  ) values (
    v_user_id,
    v_account.id,
    upper(v_account.currency),
    now(),
    v_account.balance_amount,
    v_bank_balance,
    v_bank_balance - v_account.balance_amount,
    case
      when v_bank_balance = v_account.balance_amount then 'matched'
      else 'different'
    end,
    nullif(btrim(p_note), '')
  )
  returning * into v_saved;

  return v_saved;
end;
$$;

revoke all on table public.account_reconciliations from public;
revoke all on table public.account_reconciliations from anon;
revoke all on table public.account_reconciliations from authenticated;
grant select on table public.account_reconciliations to authenticated;

revoke all on function public.record_account_reconciliation(
  uuid,
  numeric,
  text
) from public;
revoke all on function public.record_account_reconciliation(
  uuid,
  numeric,
  text
) from anon;
revoke all on function public.record_account_reconciliation(
  uuid,
  numeric,
  text
) from authenticated;
grant execute on function public.record_account_reconciliation(
  uuid,
  numeric,
  text
) to authenticated;

commit;
