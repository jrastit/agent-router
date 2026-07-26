create function public.start_llm_job_attempt(
  target_job_id text,
  target_attempt_id text,
  request_key text
) returns public.llm_job_attempts
language plpgsql security definer set search_path = ''
as $$
declare
  target_job public.llm_jobs;
  saved public.llm_job_attempts;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = 'P0001';
  end if;
  select attempt.* into saved
  from public.llm_job_attempts attempt
  join public.llm_jobs job on job.id = attempt.job_id
  where attempt.idempotency_key = request_key and job.user_id = auth.uid();
  if found then return saved; end if;

  select * into target_job from public.llm_jobs
  where id = target_job_id and user_id = auth.uid()
  for update;
  if not found or target_job.state <> 'reserved' then
    raise exception 'LLM job is not ready to execute' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.llm_job_reservations
    where job_id = target_job_id and status = 'reserved'
  ) then
    raise exception 'LLM job has no active reservation' using errcode = 'P0001';
  end if;

  insert into public.llm_job_attempts (
    id, job_id, attempt_number, state, idempotency_key, started_at
  ) values (
    target_attempt_id, target_job_id, 1, 'started', request_key, now()
  ) returning * into saved;
  update public.llm_jobs set state = 'executing', updated_at = now()
  where id = target_job_id;
  return saved;
end
$$;

create function public.fail_llm_job_and_release_credit(
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
  if failure not in (
    'PROVIDER_AUTHENTICATION', 'INSTANCE_DISABLED',
    'CAPABILITY_INCOMPATIBLE', 'PRIVACY_INCOMPATIBLE',
    'PRICE_STALE', 'PROVIDER_UNCREDENTIALLED', 'INSUFFICIENT_CREDIT'
  ) then
    raise exception 'failure is not safely releasable' using errcode = 'P0001';
  end if;
  select * into target_job from public.llm_jobs
  where id = target_job_id and user_id = auth.uid()
  for update;
  if not found then
    raise exception 'LLM job not found or not owned' using errcode = 'P0002';
  end if;
  if target_job.state = 'failed' then return target_job; end if;
  if target_job.state not in ('reserved', 'executing') then
    raise exception 'LLM job credit is not releasable' using errcode = 'P0001';
  end if;

  select * into reservation from public.llm_job_reservations
  where job_id = target_job_id for update;
  if not found or reservation.status <> 'reserved' then
    raise exception 'LLM reservation is not releasable' using errcode = 'P0001';
  end if;
  update public.credit_accounts set
    reserved_tinybar = reserved_tinybar - reservation.amount_tinybar,
    available_tinybar = available_tinybar + reservation.amount_tinybar,
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
    auth.uid(), 'release', reservation.amount_tinybar, reservation.id,
    request_key, jsonb_build_object('llmJobId', target_job_id)
  );
  update public.llm_job_reservations set status = 'released'
  where id = reservation.id;
  update public.llm_job_attempts
  set state = 'failed', failure_code = failure, completed_at = now()
  where id = target_attempt_id and job_id = target_job_id;
  update public.llm_jobs set
    state = 'failed', failure_code = failure, updated_at = now()
  where id = target_job_id
  returning * into saved;
  return saved;
end
$$;

revoke all on function public.start_llm_job_attempt(text, text, text)
  from public, anon;
grant execute on function public.start_llm_job_attempt(text, text, text)
  to authenticated;
revoke all on function public.fail_llm_job_and_release_credit(
  text, text, public.llm_job_failure_code, text
) from public, anon;
grant execute on function public.fail_llm_job_and_release_credit(
  text, text, public.llm_job_failure_code, text
) to authenticated;
