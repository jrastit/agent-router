create function public.settle_llm_job_credit(
  target_job_id text,
  target_attempt_id text,
  prompt_token_count integer,
  completion_token_count integer,
  provider_execution_id text,
  returned_model text,
  private_output text,
  verification_label text,
  provider_address text,
  trust_mode text,
  request_key text
) returns public.llm_jobs
language plpgsql security definer set search_path = ''
as $$
declare
  target_job public.llm_jobs;
  attempt public.llm_job_attempts;
  reservation public.llm_job_reservations;
  account public.credit_accounts;
  saved public.llm_jobs;
  actual_charge bigint;
  unused_credit bigint;
  input_rate bigint;
  output_rate bigint;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = 'P0001';
  end if;
  if prompt_token_count < 0 or completion_token_count < 0 then
    raise exception 'provider usage must be nonnegative' using errcode = 'P0001';
  end if;

  select job.* into saved
  from public.llm_job_charges charge
  join public.llm_jobs job on job.id = charge.job_id
  where charge.idempotency_key = request_key
    and job.user_id = auth.uid();
  if found then
    if saved.id <> target_job_id then
      raise exception 'idempotency key belongs to another job'
        using errcode = 'P0001';
    end if;
    return saved;
  end if;

  select * into target_job
  from public.llm_jobs
  where id = target_job_id and user_id = auth.uid()
  for update;
  if not found then
    raise exception 'LLM job not found or not owned' using errcode = 'P0002';
  end if;
  if target_job.state not in ('executing', 'validating') then
    raise exception 'LLM job is not settleable' using errcode = 'P0001';
  end if;
  if target_job.model <> returned_model then
    raise exception 'provider model identity mismatch' using errcode = 'P0001';
  end if;
  if prompt_token_count > target_job.maximum_input_tokens
    or completion_token_count > target_job.maximum_output_tokens
  then
    raise exception 'provider usage exceeds requested limits'
      using errcode = 'P0001';
  end if;
  if private_output is null or btrim(private_output) = '' then
    raise exception 'provider output is empty' using errcode = 'P0001';
  end if;
  if provider_execution_id is null or provider_execution_id = '' then
    raise exception 'provider execution identifier is missing'
      using errcode = 'P0001';
  end if;
  if target_job.provider = '0g'
    and verification_label not like '%not independently attested%'
  then
    raise exception '0G verification label overstates evidence'
      using errcode = 'P0001';
  end if;

  select * into attempt
  from public.llm_job_attempts
  where id = target_attempt_id and job_id = target_job_id
  for update;
  if not found or attempt.state not in ('started', 'provider_accepted') then
    raise exception 'LLM attempt is not settleable' using errcode = 'P0001';
  end if;

  select * into reservation
  from public.llm_job_reservations
  where job_id = target_job_id
  for update;
  if not found or reservation.status <> 'reserved' then
    raise exception 'LLM reservation is not settleable' using errcode = 'P0001';
  end if;
  input_rate :=
    (reservation.price_snapshot ->> 'inputTinybarsPerMillionTokens')::bigint;
  output_rate :=
    (reservation.price_snapshot ->> 'outputTinybarsPerMillionTokens')::bigint;
  actual_charge :=
    (prompt_token_count::bigint * input_rate + 999999) / 1000000
    + (completion_token_count::bigint * output_rate + 999999) / 1000000;
  if actual_charge > reservation.amount_tinybar then
    raise exception 'actual charge exceeds reservation' using errcode = 'P0001';
  end if;
  unused_credit := reservation.amount_tinybar - actual_charge;

  select * into account from public.credit_accounts
  where user_id = auth.uid()
  for update;
  if not found or account.reserved_tinybar < reservation.amount_tinybar then
    raise exception 'reserved account balance is inconsistent'
      using errcode = 'P0001';
  end if;

  insert into public.llm_job_usage (
    job_id, attempt_id, prompt_tokens, completion_tokens, total_tokens,
    reported_by_provider
  ) values (
    target_job_id, target_attempt_id, prompt_token_count,
    completion_token_count, prompt_token_count + completion_token_count, true
  );
  insert into public.llm_job_results (job_id, output, delivered_at)
  values (target_job_id, private_output, now());
  insert into public.llm_job_provider_evidence (
    job_id, attempt_id, provider, model, execution_id, verification_label,
    provider_address, trust_mode, redacted_metadata
  ) values (
    target_job_id, target_attempt_id, target_job.provider, returned_model,
    provider_execution_id, verification_label, provider_address, trust_mode,
    jsonb_build_object('usageSource', 'provider-response')
  );
  insert into public.llm_job_charges (
    id, job_id, reservation_id, amount_tinybar, idempotency_key
  ) values (
    'charge:' || target_job_id, target_job_id, reservation.id, actual_charge,
    request_key
  );
  insert into public.llm_job_refunds (
    id, job_id, reservation_id, amount_tinybar, idempotency_key
  ) values (
    'refund:' || target_job_id, target_job_id, reservation.id, unused_credit,
    'refund:' || request_key
  );

  update public.credit_accounts set
    reserved_tinybar = reserved_tinybar - reservation.amount_tinybar,
    available_tinybar = available_tinybar + unused_credit,
    spent_tinybar = spent_tinybar + actual_charge,
    refunded_tinybar = refunded_tinybar + unused_credit,
    updated_at = now()
  where user_id = auth.uid();
  if actual_charge > 0 then
    insert into public.credit_journal (
      user_id, kind, amount_tinybar, reservation_id, idempotency_key,
      metadata
    ) values (
      auth.uid(), 'charge', actual_charge, reservation.id,
      'llm-charge:' || request_key,
      jsonb_build_object('llmJobId', target_job_id)
    );
  end if;
  if unused_credit > 0 then
    insert into public.credit_journal (
      user_id, kind, amount_tinybar, reservation_id, idempotency_key,
      metadata
    ) values (
      auth.uid(), 'refund', unused_credit, reservation.id,
      'llm-refund:' || request_key,
      jsonb_build_object('llmJobId', target_job_id)
    );
  end if;

  update public.llm_job_reservations
  set status = 'settled', settled_at = now()
  where id = reservation.id;
  update public.llm_job_attempts
  set state = 'completed', provider_request_id = provider_execution_id,
      completed_at = now()
  where id = target_attempt_id;
  update public.llm_jobs
  set state = 'delivered', updated_at = now()
  where id = target_job_id
  returning * into saved;
  return saved;
end
$$;

create function public.reconcile_ambiguous_llm_job(
  target_job_id text,
  target_attempt_id text,
  failure public.llm_job_failure_code,
  request_key text
) returns public.llm_jobs
language plpgsql security definer set search_path = ''
as $$
declare
  target_job public.llm_jobs;
  reservation public.llm_job_reservations;
  saved public.llm_jobs;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = 'P0001';
  end if;
  if failure not in ('COMPLETION_AMBIGUOUS', 'SETTLEMENT_AMBIGUOUS') then
    raise exception 'failure is not ambiguous' using errcode = 'P0001';
  end if;

  select * into target_job from public.llm_jobs
  where id = target_job_id and user_id = auth.uid()
  for update;
  if not found then
    raise exception 'LLM job not found or not owned' using errcode = 'P0002';
  end if;
  if target_job.state = 'reconciliation_required' then
    return target_job;
  end if;
  if target_job.state not in ('reserved', 'executing', 'validating') then
    raise exception 'LLM job is not reconcilable' using errcode = 'P0001';
  end if;

  select * into reservation from public.llm_job_reservations
  where job_id = target_job_id for update;
  if not found or reservation.status <> 'reserved' then
    raise exception 'LLM reservation is not reconcilable'
      using errcode = 'P0001';
  end if;

  update public.credit_accounts set
    reserved_tinybar = reserved_tinybar - reservation.amount_tinybar,
    reconciliation_tinybar =
      reconciliation_tinybar + reservation.amount_tinybar,
    updated_at = now()
  where user_id = auth.uid()
    and reserved_tinybar >= reservation.amount_tinybar;
  if not found then
    raise exception 'reserved account balance is inconsistent'
      using errcode = 'P0001';
  end if;
  insert into public.credit_journal (
    user_id, kind, amount_tinybar, reservation_id, idempotency_key, metadata
  ) values (
    auth.uid(), 'reconciliation', reservation.amount_tinybar, reservation.id,
    request_key, jsonb_build_object('llmJobId', target_job_id)
  );
  update public.llm_job_reservations
  set status = 'reconciliation_required'
  where id = reservation.id;
  update public.llm_job_attempts
  set state = 'ambiguous', failure_code = failure, completed_at = now()
  where id = target_attempt_id and job_id = target_job_id;
  update public.llm_jobs
  set state = 'reconciliation_required', failure_code = failure,
      updated_at = now()
  where id = target_job_id
  returning * into saved;
  return saved;
end
$$;

revoke all on function public.settle_llm_job_credit(
  text, text, integer, integer, text, text, text, text, text, text, text
) from public, anon;
grant execute on function public.settle_llm_job_credit(
  text, text, integer, integer, text, text, text, text, text, text, text
) to authenticated;
revoke all on function public.reconcile_ambiguous_llm_job(
  text, text, public.llm_job_failure_code, text
) from public, anon;
grant execute on function public.reconcile_ambiguous_llm_job(
  text, text, public.llm_job_failure_code, text
) to authenticated;
