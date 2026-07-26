create function public.reserve_llm_job_credit(
  target_job_id text,
  target_reservation_id text,
  request_key text
) returns public.llm_job_reservations
language plpgsql security definer set search_path = ''
as $$
declare
  target_job public.llm_jobs;
  target_instance public.llm_instances;
  account public.credit_accounts;
  saved public.llm_job_reservations;
  maximum_charge bigint;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = 'P0001';
  end if;

  select reservation.* into saved
  from public.llm_job_reservations reservation
  join public.llm_jobs job on job.id = reservation.job_id
  where reservation.idempotency_key = request_key
    and job.user_id = auth.uid();
  if found then
    if saved.job_id <> target_job_id then
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
  if target_job.state <> 'accepted' then
    raise exception 'LLM job is not reservable' using errcode = 'P0001';
  end if;

  select * into target_instance
  from public.llm_instances
  where id = target_job.instance_id;
  if not found or not target_instance.enabled then
    raise exception 'LLM instance is unavailable' using errcode = 'P0001';
  end if;
  if target_instance.input_price_tinybar_per_million is null
    or target_instance.output_price_tinybar_per_million is null
    or target_instance.price_synced_at is null
    or target_instance.price_synced_at < now() - interval '24 hours'
  then
    raise exception 'LLM instance price is missing or stale'
      using errcode = 'P0001';
  end if;

  maximum_charge :=
    (
      target_job.maximum_input_tokens::bigint
      * target_instance.input_price_tinybar_per_million
      + 999999
    ) / 1000000
    + (
      target_job.maximum_output_tokens::bigint
      * target_instance.output_price_tinybar_per_million
      + 999999
    ) / 1000000;
  if maximum_charge <= 0
    or maximum_charge > target_job.spend_ceiling_tinybar
  then
    raise exception 'maximum charge exceeds spend ceiling'
      using errcode = 'P0001';
  end if;

  select * into account
  from public.credit_accounts
  where user_id = auth.uid()
  for update;
  if not found or account.available_tinybar < maximum_charge then
    raise exception 'insufficient application credit' using errcode = 'P0001';
  end if;

  insert into public.llm_job_reservations (
    id, job_id, amount_tinybar, price_snapshot, status, idempotency_key
  ) values (
    target_reservation_id,
    target_job_id,
    maximum_charge,
    jsonb_build_object(
      'currency', 'tinybar',
      'inputTinybarsPerMillionTokens',
        target_instance.input_price_tinybar_per_million::text,
      'outputTinybarsPerMillionTokens',
        target_instance.output_price_tinybar_per_million::text,
      'catalogSyncedAt', target_instance.price_synced_at
    ),
    'reserved',
    request_key
  ) returning * into saved;

  update public.credit_accounts
  set
    available_tinybar = available_tinybar - maximum_charge,
    reserved_tinybar = reserved_tinybar + maximum_charge,
    updated_at = now()
  where user_id = auth.uid();
  insert into public.credit_journal (
    user_id, kind, amount_tinybar, reservation_id, idempotency_key,
    metadata
  ) values (
    auth.uid(), 'reservation', maximum_charge, target_reservation_id,
    'llm-journal:' || request_key,
    jsonb_build_object('llmJobId', target_job_id)
  );
  update public.llm_jobs
  set state = 'reserved', updated_at = now()
  where id = target_job_id;

  return saved;
end
$$;

revoke all on function public.reserve_llm_job_credit(text, text, text)
  from public, anon;
grant execute on function public.reserve_llm_job_credit(text, text, text)
  to authenticated;
