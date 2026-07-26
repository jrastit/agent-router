drop function if exists public.get_my_fund_activity();

create function public.get_my_fund_activity()
returns table (
  available_tinybars text,
  pending_verification_tinybars text,
  graph_pending_tinybars text,
  graph_indexed_tinybars text,
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
  with owner as (
    select auth.uid() as user_id
    where auth.uid() is not null
  ),
  totals as (
    select
      owner.user_id,
      coalesce(account.available_tinybar, 0)::text as available_tinybars,
      coalesce(sum(intent.amount_tinybar) filter (
        where deposit.state in (
          'submitted', 'consensus_confirmed', 'mirror_pending', 'mirror_verified'
        )
      ), 0)::text as pending_verification_tinybars,
      coalesce(sum(intent.amount_tinybar) filter (
        where deposit.state = 'credited' and deposit.graph_state <> 'indexed'
      ), 0)::text as graph_pending_tinybars,
      coalesce(sum(intent.amount_tinybar) filter (
        where deposit.state = 'credited' and deposit.graph_state = 'indexed'
      ), 0)::text as graph_indexed_tinybars,
      coalesce(account.reserved_tinybar, 0)::text as reserved_tinybars,
      coalesce(account.spent_tinybar, 0)::text as spent_tinybars,
      coalesce(account.refunded_tinybar, 0)::text as refunded_tinybars,
      coalesce(account.reconciliation_tinybar, 0)::text
        as reconciliation_tinybars,
      account.updated_at as account_updated_at
    from owner
    left join public.credit_accounts account
      on account.user_id = owner.user_id
    left join public.deposits deposit
      on deposit.user_id = owner.user_id
    left join public.deposit_intents intent
      on intent.id = deposit.id and intent.user_id = owner.user_id
    group by owner.user_id, account.user_id
  )
  select
    totals.available_tinybars,
    totals.pending_verification_tinybars,
    totals.graph_pending_tinybars,
    totals.graph_indexed_tinybars,
    totals.reserved_tinybars,
    totals.spent_tinybars,
    totals.refunded_tinybars,
    totals.reconciliation_tinybars,
    totals.account_updated_at,
    journal.id::text,
    journal.kind::text,
    journal.amount_tinybar::text,
    journal.deposit_id,
    deposit.transaction_proof,
    journal.created_at
  from totals
  left join public.credit_journal journal
    on journal.user_id = totals.user_id
  left join public.deposits deposit
    on deposit.id = journal.deposit_id
  order by journal.created_at desc nulls last, journal.id desc nulls last
$$;

revoke all on function public.get_my_fund_activity() from public;
grant execute on function public.get_my_fund_activity() to authenticated;
