alter table public.verified_hedera_projection_events
  add column destination_block_hash text check (
    destination_block_hash is null
    or destination_block_hash ~ '^0x[0-9a-f]{64}$'
  );

create unique index one_projection_nonce_per_chain
  on public.verified_hedera_projection_events(
    destination_chain_id, destination_nonce
  )
  where destination_chain_id is not null and destination_nonce is not null;

create function public.start_hedera_projection_attempt(
  target_source_event_id text,
  target_request_key text,
  target_destination_chain_id bigint,
  target_nonce bigint,
  max_fee_wei text,
  target_gas_limit text
) returns public.verified_hedera_projection_events
language plpgsql security definer set search_path = ''
as $$
declare saved public.verified_hedera_projection_events;
declare next_attempt integer;
begin
  select * into saved from public.verified_hedera_projection_events
    where source_event_id = target_source_event_id for update;
  if not found then
    raise exception 'projection event not found' using errcode = 'P0002';
  end if;
  if saved.idempotency_key <> target_request_key then
    raise exception 'projection idempotency key mismatch' using errcode = 'P0001';
  end if;
  if saved.state in ('confirmed', 'failed_terminal') then return saved; end if;
  if saved.state = 'submitting' then
    if saved.destination_chain_id <> target_destination_chain_id
      or saved.destination_nonce <> target_nonce then
      raise exception 'projection nonce reservation mismatch' using errcode = 'P0001';
    end if;
    return saved;
  end if;
  if saved.state not in ('verified', 'retry_wait') then
    raise exception 'projection attempt is already in flight' using errcode = 'P0001';
  end if;

  next_attempt := saved.attempt_count + 1;
  update public.verified_hedera_projection_events set
    state = 'submitting',
    attempt_count = next_attempt,
    destination_chain_id = target_destination_chain_id,
    destination_nonce = target_nonce,
    destination_transaction_hash = null,
    destination_block_number = null,
    destination_block_hash = null,
    next_attempt_at = null,
    last_error = null,
    updated_at = now()
  where source_event_id = target_source_event_id
  returning * into saved;

  insert into public.hedera_projection_attempts (
    source_event_id, attempt_number, state, destination_nonce,
    max_fee_per_gas_wei, gas_limit
  ) values (
    target_source_event_id, next_attempt, 'started', target_nonce,
    max_fee_wei, target_gas_limit
  );
  insert into public.hedera_projection_progress_events (
    source_event_id, state, evidence
  ) values (
    target_source_event_id, 'submitting',
    jsonb_build_object(
      'attempt', next_attempt,
      'destinationChainId', target_destination_chain_id,
      'nonce', target_nonce
    )
  );
  return saved;
end
$$;

create function public.record_hedera_projection_submission(
  target_source_event_id text,
  transaction_hash text,
  transaction_nonce bigint
) returns public.verified_hedera_projection_events
language plpgsql security definer set search_path = ''
as $$
declare saved public.verified_hedera_projection_events;
begin
  select * into saved from public.verified_hedera_projection_events
    where source_event_id = target_source_event_id for update;
  if not found then
    raise exception 'projection event not found' using errcode = 'P0002';
  end if;
  if saved.state = 'confirmed' then
    if saved.destination_transaction_hash is distinct from transaction_hash then
      raise exception 'confirmed projection hash mismatch' using errcode = 'P0001';
    end if;
    return saved;
  end if;
  if saved.state = 'failed_terminal' then return saved; end if;
  if saved.state not in ('submitting', 'submitted')
    or saved.destination_nonce is distinct from transaction_nonce then
    raise exception 'projection submission nonce mismatch' using errcode = 'P0001';
  end if;
  if saved.state = 'submitted' then
    if saved.destination_transaction_hash is distinct from transaction_hash then
      raise exception 'projection submission hash mismatch' using errcode = 'P0001';
    end if;
    return saved;
  end if;

  update public.hedera_projection_attempts set
    state = 'submitted',
    destination_transaction_hash = transaction_hash,
    destination_nonce = transaction_nonce,
    completed_at = now()
  where source_event_id = target_source_event_id
    and attempt_number = saved.attempt_count;
  update public.verified_hedera_projection_events set
    state = 'submitted',
    destination_transaction_hash = transaction_hash,
    submitted_at = now(),
    updated_at = now()
  where source_event_id = target_source_event_id
  returning * into saved;
  insert into public.hedera_projection_progress_events (
    source_event_id, state, evidence
  ) values (
    target_source_event_id, 'submitted',
    jsonb_build_object(
      'attempt', saved.attempt_count,
      'transactionHash', transaction_hash,
      'nonce', transaction_nonce
    )
  );
  return saved;
end
$$;

create function public.confirm_hedera_projection(
  target_source_event_id text,
  transaction_hash text,
  destination_block bigint,
  block_hash text
) returns public.verified_hedera_projection_events
language plpgsql security definer set search_path = ''
as $$
declare saved public.verified_hedera_projection_events;
begin
  select * into saved from public.verified_hedera_projection_events
    where source_event_id = target_source_event_id for update;
  if not found then
    raise exception 'projection event not found' using errcode = 'P0002';
  end if;
  if saved.state = 'failed_terminal' then return saved; end if;
  if saved.state = 'confirmed' then
    if saved.destination_transaction_hash is distinct from transaction_hash
      or saved.destination_block_number is distinct from destination_block
      or saved.destination_block_hash is distinct from block_hash then
      raise exception 'confirmed projection evidence mismatch' using errcode = 'P0001';
    end if;
    return saved;
  end if;
  if saved.destination_transaction_hash is not null
    and saved.destination_transaction_hash <> transaction_hash then
    raise exception 'projection confirmation hash mismatch' using errcode = 'P0001';
  end if;

  update public.hedera_projection_attempts set
    state = 'confirmed',
    destination_transaction_hash = transaction_hash,
    completed_at = now()
  where source_event_id = target_source_event_id
    and attempt_number = saved.attempt_count;
  update public.verified_hedera_projection_events set
    state = 'confirmed',
    destination_transaction_hash = transaction_hash,
    destination_block_number = destination_block,
    destination_block_hash = block_hash,
    confirmed_at = now(),
    updated_at = now()
  where source_event_id = target_source_event_id
  returning * into saved;
  insert into public.hedera_projection_progress_events (
    source_event_id, state, evidence
  ) values (
    target_source_event_id, 'confirmed',
    jsonb_build_object(
      'attempt', saved.attempt_count,
      'transactionHash', transaction_hash,
      'blockNumber', destination_block,
      'blockHash', block_hash
    )
  );
  return saved;
end
$$;

create function public.retry_hedera_projection(
  target_source_event_id text,
  failure_code text,
  failure_message text,
  retry_at timestamptz,
  clear_destination boolean
) returns public.verified_hedera_projection_events
language plpgsql security definer set search_path = ''
as $$
declare saved public.verified_hedera_projection_events;
begin
  select * into saved from public.verified_hedera_projection_events
    where source_event_id = target_source_event_id for update;
  if not found then
    raise exception 'projection event not found' using errcode = 'P0002';
  end if;
  if saved.state = 'failed_terminal' then return saved; end if;

  update public.hedera_projection_attempts set
    state = 'retryable_failure',
    error_code = failure_code,
    error_message = failure_message,
    completed_at = now()
  where source_event_id = target_source_event_id
    and attempt_number = saved.attempt_count;
  update public.verified_hedera_projection_events set
    state = 'retry_wait',
    destination_transaction_hash = case
      when clear_destination then null else destination_transaction_hash end,
    destination_nonce = case
      when clear_destination then null else destination_nonce end,
    destination_block_number = case
      when clear_destination then null else destination_block_number end,
    destination_block_hash = case
      when clear_destination then null else destination_block_hash end,
    next_attempt_at = retry_at,
    last_error = failure_message,
    updated_at = now()
  where source_event_id = target_source_event_id
  returning * into saved;
  insert into public.hedera_projection_progress_events (
    source_event_id, state, evidence
  ) values (
    target_source_event_id, 'retry_wait',
    jsonb_build_object(
      'attempt', saved.attempt_count,
      'errorCode', failure_code,
      'retryAt', retry_at,
      'destinationCleared', clear_destination
    )
  );
  return saved;
end
$$;

revoke all on function public.start_hedera_projection_attempt(
  text, text, bigint, bigint, text, text
) from public, anon, authenticated;
revoke all on function public.record_hedera_projection_submission(
  text, text, bigint
) from public, anon, authenticated;
revoke all on function public.confirm_hedera_projection(
  text, text, bigint, text
) from public, anon, authenticated;
revoke all on function public.retry_hedera_projection(
  text, text, text, timestamptz, boolean
) from public, anon, authenticated;
grant execute on function public.start_hedera_projection_attempt(
  text, text, bigint, bigint, text, text
) to service_role;
grant execute on function public.record_hedera_projection_submission(
  text, text, bigint
) to service_role;
grant execute on function public.confirm_hedera_projection(
  text, text, bigint, text
) to service_role;
grant execute on function public.retry_hedera_projection(
  text, text, text, timestamptz, boolean
) to service_role;
