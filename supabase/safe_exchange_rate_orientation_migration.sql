-- Safe additive migration for normalized exchange-rate orientation.
-- Existing transactions, source/target amounts, and account balances are not
-- updated. Legacy rows remain readable through frontend normalization.

alter table public.transactions
  add column if not exists rate_base_currency text,
  add column if not exists rate_quote_currency text,
  add column if not exists exchange_rate numeric(24, 12),
  add column if not exists rate_type text;

alter table public.transactions
  drop constraint if exists transactions_rate_orientation_chk;

alter table public.transactions
  add constraint transactions_rate_orientation_chk
  check (
    rate_type is null
    or rate_type in (
      'realtime',
      'automatic',
      'custom',
      'historical',
      'transfer',
      'legacy',
      'base'
    )
  ) not valid;

do $migration$
begin
  if to_regclass('public.asset_accounts') is null then
    raise notice 'asset_accounts belum tersedia; fungsi atomik tidak dibuat.';
    return;
  end if;

  execute $function$
    create or replace function public.create_exchange_transaction_atomic(
      p_transaction jsonb
    )
    returns public.transactions
    language plpgsql
    security invoker
    set search_path = public
    as $body$
    declare
      v_user_id uuid := auth.uid();
      v_source_id uuid := nullif(p_transaction->>'source_account_id', '')::uuid;
      v_destination_id uuid := nullif(p_transaction->>'destination_account_id', '')::uuid;
      v_from_currency text := upper(p_transaction->>'from_currency');
      v_to_currency text := upper(p_transaction->>'to_currency');
      v_rate_base text := upper(p_transaction->>'rate_base_currency');
      v_rate_quote text := upper(p_transaction->>'rate_quote_currency');
      v_rate_type text := coalesce(p_transaction->>'rate_type', 'legacy');
      v_from_amount numeric := (p_transaction->>'from_amount')::numeric;
      v_to_amount numeric := (p_transaction->>'to_amount')::numeric;
      v_exchange_rate numeric := (p_transaction->>'exchange_rate')::numeric;
      v_directional_rate numeric := (p_transaction->>'rate')::numeric;
      v_fee numeric := coalesce((p_transaction->>'fee_amount')::numeric, 0);
      v_fee_currency text := upper(
        coalesce(
          nullif(p_transaction->>'fee_currency', ''),
          p_transaction->>'from_currency'
        )
      );
      v_source_balance numeric;
      v_source_currency text;
      v_destination_currency text;
      v_expected_target numeric;
      v_target_tolerance numeric;
      v_saved public.transactions;
    begin
      if v_user_id is null then
        raise exception 'Sesi pengguna tidak valid.';
      end if;
      if v_source_id is null or v_destination_id is null then
        raise exception 'Dompet asal dan tujuan wajib dipilih.';
      end if;
      if v_source_id = v_destination_id then
        raise exception 'Dompet asal dan tujuan tidak boleh sama.';
      end if;
      if v_from_amount <= 0 or v_to_amount <= 0 then
        raise exception 'Nominal tukar harus lebih besar dari nol.';
      end if;
      if v_exchange_rate <= 0 or v_directional_rate <= 0 then
        raise exception 'Kurs harus lebih besar dari nol.';
      end if;
      if v_fee < 0 then
        raise exception 'Biaya admin tidak boleh negatif.';
      end if;
      if v_fee > 0 and v_fee_currency <> v_from_currency then
        raise exception 'Mata uang biaya harus sama dengan dompet asal.';
      end if;
      if v_rate_type not in ('realtime', 'custom', 'transfer', 'legacy') then
        raise exception 'Jenis kurs tidak valid.';
      end if;

      select balance_amount, upper(currency)
      into v_source_balance, v_source_currency
      from public.asset_accounts
      where id = v_source_id and user_id = v_user_id
      for update;

      if not found then
        raise exception 'Dompet asal tidak ditemukan.';
      end if;

      select upper(currency)
      into v_destination_currency
      from public.asset_accounts
      where id = v_destination_id and user_id = v_user_id
      for update;

      if not found then
        raise exception 'Dompet tujuan tidak ditemukan.';
      end if;

      if v_source_currency <> v_from_currency then
        raise exception 'Mata uang dompet asal tidak sesuai.';
      end if;
      if v_destination_currency <> v_to_currency then
        raise exception 'Mata uang dompet tujuan tidak sesuai.';
      end if;
      if v_source_balance < v_from_amount + v_fee then
        raise exception 'Saldo % tidak mencukupi.', v_from_currency;
      end if;

      if v_from_currency = v_to_currency then
        if v_exchange_rate <> 1 or v_directional_rate <> 1 then
          raise exception 'Transfer internal harus memakai kurs 1.';
        end if;
        v_expected_target := v_from_amount;
      else
        if not (
          (v_rate_base = v_from_currency and v_rate_quote = v_to_currency)
          or
          (v_rate_base = v_to_currency and v_rate_quote = v_from_currency)
        ) then
          raise exception 'Orientasi kurs tidak sesuai dengan pasangan mata uang.';
        end if;
        if v_from_currency = v_rate_base then
          v_expected_target := v_from_amount * v_exchange_rate;
        else
          v_expected_target := v_from_amount / v_exchange_rate;
        end if;
      end if;

      v_target_tolerance := case
        when v_to_currency in ('IDR', 'JPY', 'KRW') then 0.500001
        else 0.005001
      end;
      if abs(v_expected_target - v_to_amount) > v_target_tolerance then
        raise exception 'Hasil konversi tidak sesuai dengan kurs.';
      end if;

      insert into public.transactions (
        id,
        user_id,
        type,
        occurred_at,
        description,
        category,
        category_group,
        amount_idr,
        amount_thb,
        locked_rate,
        currency,
        amount,
        base_currency,
        base_amount,
        from_currency,
        to_currency,
        from_amount,
        to_amount,
        rate,
        rate_base_currency,
        rate_quote_currency,
        exchange_rate,
        rate_type,
        fee_amount,
        fee_currency,
        source_account_id,
        destination_account_id,
        created_at,
        updated_at
      )
      values (
        coalesce(nullif(p_transaction->>'id', '')::uuid, gen_random_uuid()),
        v_user_id,
        'exchange',
        (p_transaction->>'occurred_at')::timestamptz,
        coalesce(p_transaction->>'description', ''),
        null,
        null,
        nullif(p_transaction->>'amount_idr', '')::numeric,
        nullif(p_transaction->>'amount_thb', '')::numeric,
        v_directional_rate,
        null,
        null,
        coalesce(p_transaction->>'base_currency', 'IDR'),
        nullif(p_transaction->>'base_amount', '')::numeric,
        v_from_currency,
        v_to_currency,
        v_from_amount,
        v_to_amount,
        v_directional_rate,
        v_rate_base,
        v_rate_quote,
        v_exchange_rate,
        v_rate_type,
        nullif(p_transaction->>'fee_amount', '')::numeric,
        case when v_fee > 0 then v_fee_currency else null end,
        v_source_id,
        v_destination_id,
        coalesce(
          nullif(p_transaction->>'created_at', '')::timestamptz,
          now()
        ),
        coalesce(
          nullif(p_transaction->>'updated_at', '')::timestamptz,
          now()
        )
      )
      returning * into v_saved;

      update public.asset_accounts
      set
        balance_amount = balance_amount - v_from_amount - v_fee,
        updated_at = now()
      where id = v_source_id and user_id = v_user_id;

      update public.asset_accounts
      set
        balance_amount = balance_amount + v_to_amount,
        updated_at = now()
      where id = v_destination_id and user_id = v_user_id;

      return v_saved;
    end;
    $body$;
  $function$;

  execute 'grant execute on function public.create_exchange_transaction_atomic(jsonb) to authenticated';
end
$migration$;
