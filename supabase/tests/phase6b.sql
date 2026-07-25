set local role service_role;

select public.persist_verified_hedera_projection(
  '0x' || repeat('a', 64), null, 'contract_log:0.0.7001',
  '1721234567.123456789',
  jsonb_build_object(
    'version', '1', 'network', 'hedera-testnet',
    'sourceType', 'contract_log', 'sourceId', '0.0.7001',
    'transactionHash', '0x' || repeat('b', 64),
    'consensusTimestamp', '1721234567.123456789',
    'sourceIndex', 2, 'eventKind', 'deposit.observed',
    'payloadDigest', '0x' || repeat('c', 64)
  ),
  now(), 'hedera-anchor:0x' || repeat('a', 64)
);
select public.persist_verified_hedera_projection(
  '0x' || repeat('a', 64), null, 'contract_log:0.0.7001',
  '1721234567.123456789',
  jsonb_build_object(
    'version', '1', 'network', 'hedera-testnet',
    'sourceType', 'contract_log', 'sourceId', '0.0.7001',
    'transactionHash', '0x' || repeat('b', 64),
    'consensusTimestamp', '1721234567.123456789',
    'sourceIndex', 2, 'eventKind', 'deposit.observed',
    'payloadDigest', '0x' || repeat('c', 64)
  ),
  now(), 'hedera-anchor:0x' || repeat('a', 64)
);
select public.record_hedera_projection_attempt(
  '0x' || repeat('a', 64), 'retryable_failure', null, null, '100', '200000',
  'RPC_TIMEOUT', 'receipt unavailable', now() + interval '1 minute'
);
select public.record_hedera_projection_attempt(
  '0x' || repeat('a', 64), 'submitted', '0x' || repeat('d', 64), 7,
  '100', '200000'
);
select public.record_hedera_projection_attempt(
  '0x' || repeat('a', 64), 'confirmed', '0x' || repeat('d', 64), 7,
  '100', '200000', null, null, null, 3
);

do $$
begin
  if (select count(*) from public.verified_hedera_projection_events) <> 1 then
    raise exception 'verified projection replay was not idempotent';
  end if;
  if not exists (
    select 1 from public.verified_hedera_projection_events
    where state = 'confirmed' and attempt_count = 3
      and destination_transaction_hash = '0x' || repeat('d', 64)
      and destination_block_number = 3
  ) then raise exception 'projection terminal evidence is incomplete'; end if;
  if (select count(*) from public.hedera_projection_attempts) <> 3 then
    raise exception 'projection attempts were not durably retained';
  end if;
  if (select count(*) from public.hedera_projection_progress_events) <> 4 then
    raise exception 'projection progress was not persisted before broadcast';
  end if;
end
$$;

create temporary table phase6b_credit_snapshot as
  select available_tinybar, reserved_tinybar, spent_tinybar, refunded_tinybar
  from public.credit_accounts
  where user_id = '00000000-0000-0000-0000-000000000001';

insert into public.deposit_intents (
  id, version, user_id, payer_account, treasury_account, network,
  amount_tinybar, memo, expires_at, idempotency_key
) values (
  'deposit-unverified', '1',
  '00000000-0000-0000-0000-000000000001',
  '0.0.1000', '0.0.2000', 'testnet', 1,
  'agent-router:deposit-unverified', now() + interval '5 minutes',
  'deposit-unverified-request'
);
insert into public.deposits (id, user_id) values (
  'deposit-unverified', '00000000-0000-0000-0000-000000000001'
);
do $$
begin
  begin
    perform public.persist_verified_hedera_projection(
      '0x' || repeat('9', 64), 'deposit-unverified',
      'contract_log:0.0.7004', '1721234568.000000003',
      jsonb_build_object(
        'version', '1', 'network', 'hedera-testnet',
        'sourceType', 'contract_log', 'sourceId', '0.0.7004',
        'transactionHash', '0x' || repeat('a', 64),
        'consensusTimestamp', '1721234568.000000003',
        'sourceIndex', 0, 'eventKind', 'deposit.observed',
        'payloadDigest', '0x' || repeat('b', 64)
      ),
      now(), 'hedera-anchor:0x' || repeat('9', 64)
    );
    raise exception 'unverified deposit was projected';
  exception when sqlstate 'P0001' then null;
  end;
end
$$;

select public.persist_verified_hedera_projection(
  '0x' || repeat('e', 64), 'deposit-1', 'contract_log:0.0.7002',
  '1721234568.000000001',
  jsonb_build_object(
    'version', '1', 'network', 'hedera-testnet',
    'sourceType', 'contract_log', 'sourceId', '0.0.7002',
    'transactionHash', '0x' || repeat('1', 64),
    'consensusTimestamp', '1721234568.000000001',
    'sourceIndex', 0, 'eventKind', 'deposit.observed',
    'payloadDigest', '0x' || repeat('2', 64)
  ),
  now(), 'hedera-anchor:0x' || repeat('e', 64)
);
select public.start_hedera_projection_attempt(
  '0x' || repeat('e', 64), 'hedera-anchor:0x' || repeat('e', 64),
  1337, 9, '100', '200000'
);
select public.record_hedera_projection_submission(
  '0x' || repeat('e', 64), '0x' || repeat('3', 64), 9
);
select public.confirm_hedera_projection(
  '0x' || repeat('e', 64), '0x' || repeat('3', 64), 8,
  '0x' || repeat('4', 64)
);

select public.persist_verified_hedera_projection(
  '0x' || repeat('f', 64), null, 'hcs_message:0.0.7003',
  '1721234568.000000002',
  jsonb_build_object(
    'version', '1', 'network', 'hedera-testnet',
    'sourceType', 'hcs_message', 'sourceId', '0.0.7003',
    'transactionHash', '0x' || repeat('7', 64),
    'consensusTimestamp', '1721234568.000000002',
    'sourceIndex', 1, 'eventKind', 'hcs.message',
    'payloadDigest', '0x' || repeat('8', 64)
  ),
  now(), 'hedera-anchor:0x' || repeat('f', 64)
);
do $$
begin
  begin
    perform public.start_hedera_projection_attempt(
      '0x' || repeat('f', 64), 'hedera-anchor:0x' || repeat('f', 64),
      1337, 9, '100', '200000'
    );
    raise exception 'duplicate destination nonce was reserved';
  exception when unique_violation then null;
  end;
end
$$;

select public.retry_hedera_projection(
  '0x' || repeat('e', 64), 'DESTINATION_REORGED',
  'transaction left canonical block 8', now(), true
);
select public.start_hedera_projection_attempt(
  '0x' || repeat('e', 64), 'hedera-anchor:0x' || repeat('e', 64),
  1337, 10, '100', '200000'
);
select public.record_hedera_projection_submission(
  '0x' || repeat('e', 64), '0x' || repeat('5', 64), 10
);
select public.confirm_hedera_projection(
  '0x' || repeat('e', 64), '0x' || repeat('5', 64), 9,
  '0x' || repeat('6', 64)
);

do $$
begin
  if not exists (
    select 1 from public.credit_accounts account
    join phase6b_credit_snapshot snapshot on
      account.available_tinybar = snapshot.available_tinybar
      and account.reserved_tinybar = snapshot.reserved_tinybar
      and account.spent_tinybar = snapshot.spent_tinybar
      and account.refunded_tinybar = snapshot.refunded_tinybar
    where account.user_id = '00000000-0000-0000-0000-000000000001'
  ) then
    raise exception 'monitoring projection changed authoritative credit';
  end if;
  if not exists (
    select 1 from public.verified_hedera_projection_events
    where source_event_id = '0x' || repeat('e', 64)
      and deposit_id = 'deposit-1'
      and state = 'confirmed'
      and attempt_count = 2
      and destination_nonce = 10
      and destination_transaction_hash = '0x' || repeat('5', 64)
      and destination_block_number = 9
      and destination_block_hash = '0x' || repeat('6', 64)
  ) then raise exception 'reorg recovery evidence is incomplete'; end if;
  if (
    select count(*) from public.hedera_projection_attempts
    where source_event_id = '0x' || repeat('e', 64)
  ) <> 2 then
    raise exception 'state transitions were counted as projection attempts';
  end if;
end
$$;
