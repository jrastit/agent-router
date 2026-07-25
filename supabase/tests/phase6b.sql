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
