create function public.accept_quote_and_reserve(
  target_job_id text,
  target_quote_id text,
  new_decision_id text,
  decision_requirement_id text,
  decision_policy_id text,
  decision_policy_version integer,
  selected_provider_id text,
  selected_offer_id text,
  considered jsonb,
  policy_snapshot jsonb,
  evidence jsonb,
  request_key text
) returns public.decisions
language plpgsql security invoker set search_path = ''
as $$
declare
  locked_job public.jobs;
  accepted_quote public.quotes;
  saved_decision public.decisions;
  policy_budget bigint;
begin
  select * into locked_job from public.jobs
    where id = target_job_id and owner_id = auth.uid() for update;
  if not found then raise exception 'job not found or not owned' using errcode = 'P0002'; end if;

  select * into saved_decision from public.decisions where idempotency_key = request_key;
  if found then return saved_decision; end if;

  select * into accepted_quote from public.quotes
    where id = target_quote_id and job_id = target_job_id for update;
  if not found then raise exception 'quote not found' using errcode = 'P0002'; end if;
  if accepted_quote.expires_at <= now() then raise exception 'quote expired' using errcode = 'P0001'; end if;

  select budget_amount_minor into policy_budget from public.policies
    where id = locked_job.policy_id and owner_id = auth.uid();
  if accepted_quote.currency <> (select budget_currency from public.policies where id = locked_job.policy_id)
     or locked_job.reserved_amount_minor + accepted_quote.amount_minor > policy_budget then
    raise exception 'budget exceeded or currency mismatch' using errcode = 'P0001';
  end if;

  update public.quotes set accepted_at = now() where id = target_quote_id;
  update public.jobs set reserved_amount_minor = reserved_amount_minor + accepted_quote.amount_minor,
    status = 'provider_selected', updated_at = now() where id = target_job_id;
  insert into public.decisions (
    id, job_id, requirement_id, policy_id, policy_version, selected_provider_id,
    selected_offer_id, considered, policy_snapshot, evidence, idempotency_key
  ) values (
    new_decision_id, target_job_id, decision_requirement_id, decision_policy_id,
    decision_policy_version, selected_provider_id, selected_offer_id, considered,
    policy_snapshot, evidence, request_key
  ) returning * into saved_decision;
  return saved_decision;
end
$$;

create function public.consume_proof_and_create_receipt(
  target_payment_id text,
  new_receipt_id text,
  target_job_id text,
  target_decision_id text,
  target_delivery_id text,
  receipt_currency text,
  receipt_amount_minor bigint,
  request_key text
) returns public.receipts
language plpgsql security invoker set search_path = ''
as $$
declare
  locked_payment public.payments;
  saved_receipt public.receipts;
begin
  perform 1 from public.jobs where id = target_job_id and owner_id = auth.uid() for update;
  if not found then raise exception 'job not found or not owned' using errcode = 'P0002'; end if;

  select * into saved_receipt from public.receipts where idempotency_key = request_key;
  if found then return saved_receipt; end if;

  select p.* into locked_payment
    from public.payments p
    join public.payment_challenges c on c.id = p.challenge_id
    join public.quotes q on q.id = c.quote_id
    where p.id = target_payment_id and q.job_id = target_job_id
    for update of p;
  if not found then raise exception 'payment not found' using errcode = 'P0002'; end if;
  if locked_payment.status <> 'mirror_verified' then raise exception 'proof not verified' using errcode = 'P0001'; end if;
  if locked_payment.proof_consumed_at is not null then raise exception 'proof already consumed' using errcode = '23505'; end if;

  update public.payments set proof_consumed_at = now() where id = target_payment_id;
  insert into public.receipts (
    id, job_id, decision_id, payment_id, delivery_id, currency, amount_minor, idempotency_key
  ) values (
    new_receipt_id, target_job_id, target_decision_id, target_payment_id,
    target_delivery_id, receipt_currency, receipt_amount_minor, request_key
  ) returning * into saved_receipt;
  update public.jobs set status = 'receipt_recorded', updated_at = now() where id = target_job_id;
  return saved_receipt;
end
$$;

create function public.append_job_event(
  target_job_id text,
  target_event_key text,
  event_type text,
  event_payload jsonb default '{}'
) returns public.events
language plpgsql security invoker set search_path = ''
as $$
declare saved_event public.events;
begin
  perform 1 from public.jobs where id = target_job_id and owner_id = auth.uid() for update;
  if not found then raise exception 'job not found or not owned' using errcode = 'P0002'; end if;
  select * into saved_event from public.events where public.events.event_key = target_event_key;
  if found then return saved_event; end if;
  insert into public.events (event_key, job_id, sequence, type, payload)
    select target_event_key, target_job_id, coalesce(max(sequence) + 1, 0), event_type, event_payload
    from public.events where job_id = target_job_id
    returning * into saved_event;
  return saved_event;
end
$$;

revoke all on function public.accept_quote_and_reserve(text,text,text,text,text,integer,text,text,jsonb,jsonb,jsonb,text) from public;
revoke all on function public.consume_proof_and_create_receipt(text,text,text,text,text,text,bigint,text) from public;
revoke all on function public.append_job_event(text,text,text,jsonb) from public;
grant execute on function public.accept_quote_and_reserve(text,text,text,text,text,integer,text,text,jsonb,jsonb,jsonb,text) to authenticated;
grant execute on function public.consume_proof_and_create_receipt(text,text,text,text,text,text,bigint,text) to authenticated;
grant execute on function public.append_job_event(text,text,text,jsonb) to authenticated;
