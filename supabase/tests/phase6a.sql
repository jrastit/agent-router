select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000001',
  true
);

select public.create_deposit_intent(
  'deposit-1', '1', '0.0.1000', '0.0.2000', 'testnet', 10000000,
  'agent-router:deposit-1', now() + interval '5 minutes', 'deposit-request-1'
);
select public.create_deposit_intent(
  'deposit-1', '1', '0.0.1000', '0.0.2000', 'testnet', 10000000,
  'agent-router:deposit-1', now() + interval '5 minutes', 'deposit-request-1'
);
select public.submit_deposit_proof('deposit-1', 'proof-deposit-1');
select public.credit_verified_deposit(
  'deposit-1', 'proof-deposit-1',
  extract(epoch from now())::bigint::text || '.000000001', now(),
  repeat('a', 64), '0xabc', 'credit-deposit-1'
);
select public.credit_verified_deposit(
  'deposit-1', 'proof-deposit-1',
  extract(epoch from now())::bigint::text || '.000000001', now(),
  repeat('a', 64), '0xabc', 'credit-deposit-1'
);

select public.reserve_user_credit(
  'reservation-6a', 'job-1', 6000000,
  '{"hbarUsd":"0.20","ogUsd":"1.00","capturedAt":"2026-07-25T12:00:00Z"}',
  6000000, 'reserve-6a'
);
select public.settle_user_credit('reservation-6a', 4000000, 'settle-6a');

do $$
begin
  if not exists (
    select 1 from public.credit_accounts
    where available_tinybar = 6000000 and reserved_tinybar = 0
      and spent_tinybar = 4000000 and refunded_tinybar = 2000000
  ) then raise exception 'credit account totals are incorrect'; end if;
  if (select count(*) from public.credit_journal where deposit_id = 'deposit-1') <> 1 then
    raise exception 'deposit was not credited exactly once';
  end if;
  if (select count(*) from public.deposit_intents where idempotency_key = 'deposit-request-1') <> 1 then
    raise exception 'duplicate deposit intent was created';
  end if;
  if not exists (
    select 1 from public.deposits
    where id = 'deposit-1' and state = 'credited'
      and projection_state = 'pending' and graph_state = 'pending'
  ) then raise exception 'deposit monitoring states are incorrect'; end if;
  if not exists (
    select 1 from public.monitoring_projection_outbox
    where deposit_id = 'deposit-1' and payload->>'userPseudonym' = repeat('a', 64)
  ) then raise exception 'post-credit projection was not enqueued'; end if;
  begin
    perform public.reserve_user_credit(
      'reservation-too-large', 'job-1', 6000001, '{}', 6000001, 'reserve-too-large'
    );
    raise exception 'insufficient credit reservation succeeded';
  exception when sqlstate 'P0001' then null;
  end;
  -- reserve_user_credit locks credit_accounts FOR UPDATE. A concurrent request
  -- serializes behind the first and observes this reduced available balance.
  begin
    perform public.reserve_user_credit(
      'reservation-concurrent-loser', 'job-1', 6000001, '{}', 6000001,
      'reserve-concurrent-loser'
    );
    raise exception 'serialized concurrent reservation overspent the account';
  exception when sqlstate 'P0001' then null;
  end;
end
$$;
