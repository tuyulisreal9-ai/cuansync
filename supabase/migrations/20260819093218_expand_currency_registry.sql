alter table public.user_settings
  drop constraint if exists user_settings_currency_code_chk;

alter table public.user_settings
  add constraint user_settings_currency_code_chk
  check (
    base_currency ~ '^[A-Z]{3}$' and
    daily_currency ~ '^[A-Z]{3}$' and
    array_length(active_currencies, 1) >= 1 and
    active_currencies <@ array[
      'IDR',
      'THB',
      'SGD',
      'MYR',
      'JPY',
      'KRW',
      'TWD',
      'HKD',
      'CNY',
      'VND',
      'PHP',
      'INR',
      'LKR',
      'SAR',
      'AED',
      'USD',
      'AUD',
      'EUR',
      'GBP'
    ]::text[]
  ) not valid;

alter table public.user_settings
  validate constraint user_settings_currency_code_chk;

alter table public.user_settings
  drop constraint if exists user_settings_daily_currency_chk;

alter table public.user_settings
  add constraint user_settings_daily_currency_chk
  check (
    daily_currency = any(active_currencies) and
    daily_currency = any(array[
      'IDR',
      'THB',
      'SGD',
      'MYR',
      'JPY',
      'KRW',
      'TWD',
      'HKD',
      'CNY',
      'VND',
      'PHP',
      'INR',
      'LKR',
      'SAR',
      'AED',
      'USD',
      'AUD',
      'EUR',
      'GBP'
    ]::text[])
  ) not valid;

alter table public.user_settings
  validate constraint user_settings_daily_currency_chk;
