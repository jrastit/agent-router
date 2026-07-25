alter table public.payment_challenges
  add column version text not null default '1' check (version = '1');

alter table public.payments
  add column submitted_at timestamptz,
  add column consensus_confirmed_at timestamptz,
  add column mirror_verified_at timestamptz,
  add column consensus_timestamp text,
  add column hashscan_transaction_url text;

create function public.mark_payment_mirror_verified(
  target_payment_id text,
  expected_transaction_proof text,
  verified_consensus_timestamp text,
  verified_at timestamptz,
  hashscan_url text
) returns public.payments
language plpgsql security invoker set search_path = ''
as $$
declare
  locked_payment public.payments;
begin
  select p.* into locked_payment
    from public.payments p
    join public.payment_challenges c on c.id = p.challenge_id
    join public.quotes q on q.id = c.quote_id
    where p.id = target_payment_id
      and q.job_id in (select id from public.jobs where owner_id = auth.uid())
    for update of p;
  if not found then
    raise exception 'payment not found or not owned' using errcode = 'P0002';
  end if;
  if locked_payment.transaction_proof <> expected_transaction_proof then
    raise exception 'transaction proof mismatch' using errcode = 'P0001';
  end if;
  if locked_payment.status = 'mirror_verified' then
    return locked_payment;
  end if;
  if locked_payment.status not in ('submitted', 'consensus_confirmed', 'reconciliation_required') then
    raise exception 'invalid payment state for verification' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.payments
    where transaction_proof = expected_transaction_proof and id <> target_payment_id
  ) then
    raise exception 'transaction proof already used' using errcode = '23505';
  end if;

  update public.payments set
    status = 'mirror_verified',
    consensus_timestamp = verified_consensus_timestamp,
    consensus_confirmed_at = coalesce(consensus_confirmed_at, verified_at),
    mirror_verified_at = verified_at,
    hashscan_transaction_url = hashscan_url
  where id = target_payment_id
  returning * into locked_payment;
  return locked_payment;
end
$$;

revoke all on function public.mark_payment_mirror_verified(text,text,text,timestamptz,text) from public;
grant execute on function public.mark_payment_mirror_verified(text,text,text,timestamptz,text) to authenticated;
