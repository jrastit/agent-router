create type public.relay_projection_state as enum (
  'verified', 'submitting', 'submitted', 'confirmed', 'retry_wait', 'failed_terminal'
);
create type public.relay_attempt_state as enum (
  'started', 'submitted', 'confirmed', 'retryable_failure', 'terminal_failure'
);

create table public.hedera_projection_cursors (
  stream_id text primary key check (
    stream_id ~ '^(contract_log|hcs_message):[0-9]+\.[0-9]+\.[0-9]+$'
  ),
  consensus_timestamp text not null check (
    consensus_timestamp ~ '^[0-9]+\.[0-9]{1,9}$'
  ),
  updated_at timestamptz not null default now()
);

create table public.verified_hedera_projection_events (
  source_event_id text primary key check (source_event_id ~ '^0x[0-9a-f]{64}$'),
  deposit_id text unique references public.deposits(id),
  stream_id text not null,
  consensus_timestamp text not null,
  anchor jsonb not null check (
    jsonb_typeof(anchor) = 'object'
    and anchor ?& array[
      'version', 'network', 'sourceType', 'sourceId', 'transactionHash',
      'consensusTimestamp', 'sourceIndex', 'eventKind', 'payloadDigest'
    ]
    and anchor - array[
      'version', 'network', 'sourceType', 'sourceId', 'transactionHash',
      'consensusTimestamp', 'sourceIndex', 'eventKind', 'payloadDigest'
    ] = '{}'::jsonb
  ),
  mirror_verified_at timestamptz not null,
  state public.relay_projection_state not null default 'verified',
  attempt_count integer not null default 0 check (attempt_count >= 0),
  next_attempt_at timestamptz,
  destination_chain_id bigint,
  destination_transaction_hash text unique check (
    destination_transaction_hash is null
    or destination_transaction_hash ~ '^0x[0-9a-f]{64}$'
  ),
  destination_nonce bigint check (destination_nonce is null or destination_nonce >= 0),
  destination_block_number bigint check (
    destination_block_number is null or destination_block_number >= 0
  ),
  last_error text,
  terminal_failed_at timestamptz,
  submitted_at timestamptz,
  confirmed_at timestamptz,
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (stream_id) references public.hedera_projection_cursors(stream_id)
);

create table public.hedera_projection_attempts (
  id bigint generated always as identity primary key,
  source_event_id text not null references public.verified_hedera_projection_events(source_event_id),
  attempt_number integer not null check (attempt_number > 0),
  state public.relay_attempt_state not null,
  destination_transaction_hash text,
  destination_nonce bigint,
  max_fee_per_gas_wei text check (
    max_fee_per_gas_wei is null or max_fee_per_gas_wei ~ '^[0-9]+$'
  ),
  gas_limit text check (gas_limit is null or gas_limit ~ '^[0-9]+$'),
  error_code text,
  error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (source_event_id, attempt_number)
);

create table public.hedera_projection_progress_events (
  id bigint generated always as identity primary key,
  source_event_id text not null references public.verified_hedera_projection_events(source_event_id),
  state public.relay_projection_state not null,
  evidence jsonb not null default '{}' check (jsonb_typeof(evidence) = 'object'),
  created_at timestamptz not null default now()
);

alter table public.hedera_projection_cursors enable row level security;
alter table public.verified_hedera_projection_events enable row level security;
alter table public.hedera_projection_attempts enable row level security;
alter table public.hedera_projection_progress_events enable row level security;

create policy "owners read verified projection events"
  on public.verified_hedera_projection_events for select to authenticated
  using (
    deposit_id is not null and exists (
      select 1 from public.deposits
      where id = deposit_id and user_id = auth.uid()
    )
  );
create policy "owners read projection attempts"
  on public.hedera_projection_attempts for select to authenticated
  using (
    exists (
      select 1 from public.verified_hedera_projection_events event
      join public.deposits deposit on deposit.id = event.deposit_id
      where event.source_event_id = public.hedera_projection_attempts.source_event_id
        and deposit.user_id = auth.uid()
    )
  );
create policy "owners read projection progress"
  on public.hedera_projection_progress_events for select to authenticated
  using (
    exists (
      select 1 from public.verified_hedera_projection_events event
      join public.deposits deposit on deposit.id = event.deposit_id
      where event.source_event_id = public.hedera_projection_progress_events.source_event_id
        and deposit.user_id = auth.uid()
    )
  );

create function public.persist_verified_hedera_projection(
  target_source_event_id text,
  target_deposit_id text,
  target_stream_id text,
  target_consensus_timestamp text,
  target_anchor jsonb,
  verified_at timestamptz,
  request_key text
) returns public.verified_hedera_projection_events
language plpgsql security definer set search_path = ''
as $$
declare saved public.verified_hedera_projection_events;
begin
  select * into saved from public.verified_hedera_projection_events
    where idempotency_key = request_key;
  if found then
    if saved.source_event_id <> target_source_event_id then
      raise exception 'projection idempotency key mismatch' using errcode = 'P0001';
    end if;
    return saved;
  end if;

  if target_deposit_id is not null and not exists (
    select 1 from public.deposits
    where id = target_deposit_id and state = 'credited'
  ) then
    raise exception 'projection deposit must already be credited' using errcode = 'P0001';
  end if;
  if target_anchor->>'consensusTimestamp' <> target_consensus_timestamp then
    raise exception 'projection cursor does not match anchor' using errcode = 'P0001';
  end if;

  insert into public.hedera_projection_cursors (stream_id, consensus_timestamp)
    values (target_stream_id, target_consensus_timestamp)
    on conflict (stream_id) do update set
      consensus_timestamp = excluded.consensus_timestamp,
      updated_at = now()
    where (
      split_part(public.hedera_projection_cursors.consensus_timestamp, '.', 1)::numeric,
      split_part(public.hedera_projection_cursors.consensus_timestamp, '.', 2)::numeric
    ) <= (
      split_part(excluded.consensus_timestamp, '.', 1)::numeric,
      split_part(excluded.consensus_timestamp, '.', 2)::numeric
    );

  insert into public.verified_hedera_projection_events (
    source_event_id, deposit_id, stream_id, consensus_timestamp, anchor,
    mirror_verified_at, idempotency_key
  ) values (
    target_source_event_id, target_deposit_id, target_stream_id,
    target_consensus_timestamp, target_anchor, verified_at, request_key
  ) returning * into saved;
  insert into public.hedera_projection_progress_events (
    source_event_id, state, evidence
  ) values (
    target_source_event_id, 'verified',
    jsonb_build_object('mirrorVerifiedAt', verified_at)
  );
  return saved;
end
$$;

create function public.record_hedera_projection_attempt(
  target_source_event_id text,
  target_state public.relay_attempt_state,
  transaction_hash text default null,
  transaction_nonce bigint default null,
  max_fee_wei text default null,
  target_gas_limit text default null,
  failure_code text default null,
  failure_message text default null,
  retry_at timestamptz default null,
  destination_block bigint default null
) returns public.verified_hedera_projection_events
language plpgsql security definer set search_path = ''
as $$
declare saved public.verified_hedera_projection_events;
declare next_attempt integer;
declare relay_state public.relay_projection_state;
begin
  select * into saved from public.verified_hedera_projection_events
    where source_event_id = target_source_event_id for update;
  if not found then raise exception 'projection event not found' using errcode = 'P0002'; end if;
  if saved.state in ('confirmed', 'failed_terminal') then return saved; end if;

  next_attempt := saved.attempt_count + 1;
  relay_state := case target_state
    when 'started' then 'submitting'
    when 'submitted' then 'submitted'
    when 'confirmed' then 'confirmed'
    when 'retryable_failure' then 'retry_wait'
    when 'terminal_failure' then 'failed_terminal'
  end;
  insert into public.hedera_projection_attempts (
    source_event_id, attempt_number, state, destination_transaction_hash,
    destination_nonce, max_fee_per_gas_wei, gas_limit, error_code,
    error_message, completed_at
  ) values (
    target_source_event_id, next_attempt, target_state, transaction_hash,
    transaction_nonce, max_fee_wei, target_gas_limit, failure_code,
    failure_message, case when target_state = 'started' then null else now() end
  );
  update public.verified_hedera_projection_events set
    state = relay_state,
    attempt_count = next_attempt,
    destination_transaction_hash = coalesce(transaction_hash, destination_transaction_hash),
    destination_nonce = coalesce(transaction_nonce, destination_nonce),
    destination_block_number = coalesce(destination_block, destination_block_number),
    next_attempt_at = retry_at,
    last_error = failure_message,
    submitted_at = case when target_state = 'submitted' then now() else submitted_at end,
    confirmed_at = case when target_state = 'confirmed' then now() else confirmed_at end,
    terminal_failed_at = case when target_state = 'terminal_failure' then now() else terminal_failed_at end,
    updated_at = now()
  where source_event_id = target_source_event_id
  returning * into saved;
  insert into public.hedera_projection_progress_events (
    source_event_id, state, evidence
  ) values (
    target_source_event_id, relay_state,
    jsonb_strip_nulls(jsonb_build_object(
      'attempt', next_attempt, 'transactionHash', transaction_hash,
      'errorCode', failure_code, 'retryAt', retry_at
    ))
  );
  return saved;
end
$$;

revoke all on function public.persist_verified_hedera_projection(
  text, text, text, text, jsonb, timestamptz, text
) from public, anon, authenticated;
revoke all on function public.record_hedera_projection_attempt(
  text, public.relay_attempt_state, text, bigint, text, text, text, text,
  timestamptz, bigint
) from public, anon, authenticated;
grant execute on function public.persist_verified_hedera_projection(
  text, text, text, text, jsonb, timestamptz, text
) to service_role;
grant execute on function public.record_hedera_projection_attempt(
  text, public.relay_attempt_state, text, bigint, text, text, text, text,
  timestamptz, bigint
) to service_role;
