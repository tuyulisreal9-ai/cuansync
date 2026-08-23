begin;

-- Clients released before account-aware targets do not send account_id. Keep
-- those writes visible as legacy progress without reserving an arbitrary
-- account. Current clients explicitly write mapping_status = 'mapped' through
-- record_goal_activity_atomic after the user chooses a funding account.
alter table public.goal_allocations
  alter column mapping_status set default 'unmapped_legacy';

drop policy if exists "Users can insert own goal allocations"
  on public.goal_allocations;
create policy "Users can insert own goal allocations"
  on public.goal_allocations for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.goals owned_goal
      where owned_goal.id = goal_allocations.goal_id
        and owned_goal.user_id = (select auth.uid())
    )
    and (
      (
        mapping_status = 'unmapped_legacy'
        and account_id is null
      )
      or (
        mapping_status = 'mapped'
        and account_id is not null
        and exists (
          select 1
          from public.goal_funding_accounts funding
          where funding.goal_id = goal_allocations.goal_id
            and funding.account_id = goal_allocations.account_id
            and funding.user_id = goal_allocations.user_id
            and funding.currency = goal_allocations.currency
            and funding.user_id = (select auth.uid())
        )
      )
    )
  );

commit;
