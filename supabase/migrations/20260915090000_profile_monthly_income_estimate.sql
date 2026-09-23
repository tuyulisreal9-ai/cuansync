-- Perkiraan pemasukan bulanan untuk Kondisi keuanganmu.
--
-- Ini bukan transaksi dan tidak memengaruhi saldo. Aplikasi memakainya untuk
-- menilai arus kas selama pemasukan yang tercatat pada bulan berjalan masih
-- lebih kecil dari perkiraan, misalnya gaji yang belum masuk.
--
-- Tabel profiles sudah punya kebijakan RLS baca/tambah/ubah/hapus milik
-- sendiri, jadi kolom baru ini tidak membutuhkan kebijakan tambahan.

alter table public.profiles
  add column if not exists monthly_income_estimate numeric(20, 6),
  add column if not exists monthly_income_estimate_currency text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_monthly_income_estimate_chk'
  ) then
    alter table public.profiles
      add constraint profiles_monthly_income_estimate_chk
      check (
        (
          monthly_income_estimate is null
          and monthly_income_estimate_currency is null
        )
        or (
          monthly_income_estimate > 0
          and monthly_income_estimate_currency ~ '^[A-Z]{3}$'
        )
      );
  end if;
end $$;

notify pgrst, 'reload schema';
