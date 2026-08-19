-- Require every new or updated transaction to reference an owned spendable
-- wallet. Existing legacy rows remain readable because the constraints and
-- foreign keys are added NOT VALID.

alter table public.transactions
  drop constraint if exists transactions_shape_chk;

alter table public.transactions
  add constraint transactions_shape_chk
  check (
    (
      type = 'income' and
      currency is not null and
      amount is not null and amount > 0 and
      source_account_id is null and
      destination_account_id is not null
    )
    or
    (
      type = 'expense' and
      currency is not null and
      amount is not null and amount > 0 and
      source_account_id is not null and
      destination_account_id is null
    )
    or
    (
      type = 'exchange' and
      from_currency is not null and
      to_currency is not null and
      from_amount is not null and from_amount > 0 and
      to_amount is not null and to_amount > 0 and
      rate is not null and rate > 0 and
      source_account_id is not null and
      destination_account_id is not null and
      source_account_id <> destination_account_id and
      (from_currency <> to_currency or rate = 1)
    )
  ) not valid;

do $migration$
begin
  if to_regclass('public.asset_accounts') is null then
    raise notice 'asset_accounts belum tersedia; validasi relasi dompet dilewati.';
    return;
  end if;

  execute 'create unique index if not exists asset_accounts_id_user_idx
    on public.asset_accounts (id, user_id)';

  if not exists (
    select 1
    from pg_constraint
    where conname = 'transactions_source_account_owner_fkey'
      and conrelid = 'public.transactions'::regclass
  ) then
    alter table public.transactions
      add constraint transactions_source_account_owner_fkey
      foreign key (source_account_id, user_id)
      references public.asset_accounts (id, user_id)
      on delete restrict
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'transactions_destination_account_owner_fkey'
      and conrelid = 'public.transactions'::regclass
  ) then
    alter table public.transactions
      add constraint transactions_destination_account_owner_fkey
      foreign key (destination_account_id, user_id)
      references public.asset_accounts (id, user_id)
      on delete restrict
      not valid;
  end if;

  execute $function$
    create or replace function public.validate_wallet_transaction_links()
    returns trigger
    language plpgsql
    security invoker
    set search_path = public
    as $body$
    declare
      v_source_currency text;
      v_source_type text;
      v_destination_currency text;
      v_destination_type text;
    begin
      if new.type in ('expense', 'exchange') then
        select upper(currency), account_type
        into v_source_currency, v_source_type
        from public.asset_accounts
        where id = new.source_account_id and user_id = new.user_id;

        if not found then
          raise exception 'Dompet sumber tidak ditemukan atau bukan milik pengguna.';
        end if;
        if v_source_type not in ('bank', 'cash', 'ewallet', 'other') then
          raise exception 'Akun sumber bukan dompet transaksi.';
        end if;
        if v_source_currency <> upper(
          case when new.type = 'exchange' then new.from_currency else new.currency end
        ) then
          raise exception 'Mata uang dompet sumber tidak sesuai.';
        end if;
      end if;

      if new.type in ('income', 'exchange') then
        select upper(currency), account_type
        into v_destination_currency, v_destination_type
        from public.asset_accounts
        where id = new.destination_account_id and user_id = new.user_id;

        if not found then
          raise exception 'Dompet tujuan tidak ditemukan atau bukan milik pengguna.';
        end if;
        if v_destination_type not in ('bank', 'cash', 'ewallet', 'other') then
          raise exception 'Akun tujuan bukan dompet transaksi.';
        end if;
        if v_destination_currency <> upper(
          case when new.type = 'exchange' then new.to_currency else new.currency end
        ) then
          raise exception 'Mata uang dompet tujuan tidak sesuai.';
        end if;
      end if;

      return new;
    end;
    $body$;
  $function$;

  drop trigger if exists validate_wallet_transaction_links_before_write
    on public.transactions;
  create trigger validate_wallet_transaction_links_before_write
    before insert or update on public.transactions
    for each row execute function public.validate_wallet_transaction_links();

  revoke all on function public.validate_wallet_transaction_links() from public;
  revoke all on function public.validate_wallet_transaction_links() from anon;
  revoke all on function public.validate_wallet_transaction_links() from authenticated;
end
$migration$;
