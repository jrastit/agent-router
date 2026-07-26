create function public.get_my_fund_activity()
returns table (
  available_tinybars text,
  reserved_tinybars text,
  spent_tinybars text,
  refunded_tinybars text,
  reconciliation_tinybars text,
  account_updated_at timestamptz,
  journal_id text,
  entry_kind text,
  amount_tinybars text,
  deposit_id text,
  transaction_proof text,
  entry_created_at timestamptz
)
language sql stable security invoker set search_path = ''
as $$
  select
    account.available_tinybar::text,
    account.reserved_tinybar::text,
    account.spent_tinybar::text,
    account.refunded_tinybar::text,
    account.reconciliation_tinybar::text,
    account.updated_at,
    journal.id::text,
    journal.kind::text,
    journal.amount_tinybar::text,
    journal.deposit_id,
    deposit.transaction_proof,
    journal.created_at
  from public.credit_accounts account
  left join public.credit_journal journal
    on journal.user_id = account.user_id
  left join public.deposits deposit
    on deposit.id = journal.deposit_id
  where account.user_id = auth.uid()
  order by journal.created_at desc nulls last, journal.id desc nulls last
$$;

revoke all on function public.get_my_fund_activity() from public;
grant execute on function public.get_my_fund_activity() to authenticated;

do $$
declare
  relation_name text;
begin
  if not exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) then
    create publication supabase_realtime;
  end if;

  foreach relation_name in array array[
    'credit_accounts', 'credit_journal', 'deposits', 'credit_reservations'
  ] loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = relation_name
    ) then
      execute format(
        'alter publication supabase_realtime add table public.%I',
        relation_name
      );
    end if;
  end loop;
end
$$;
