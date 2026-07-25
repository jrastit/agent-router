select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000001',
  true
);

update public.payments
set status = 'consensus_confirmed',
    proof_consumed_at = null,
    consensus_confirmed_at = now()
where id = 'payment-1';

select public.mark_payment_mirror_verified(
  'payment-1',
  'proof-1',
  '1753444802.000000001',
  now(),
  'https://hashscan.io/testnet/transaction/0.0.1000@1.000000001'
);

insert into public.quotes (
  id, job_id, offer_id, currency, amount_minor, expires_at
) values (
  'quote-replay', 'job-1', 'offer-1', 'GBP', 250, now() + interval '5 minutes'
);
insert into public.payment_challenges (
  id, quote_id, payer_account, recipient_account, network, asset,
  amount_tinybar, memo, expires_at
) values (
  'challenge-replay', 'quote-replay', '0.0.1000', '0.0.2000', 'testnet',
  'HBAR', 250000000, 'quote-replay', now() + interval '5 minutes'
);

do $$
begin
  if not exists (
    select 1 from public.payments
    where id = 'payment-1'
      and status = 'mirror_verified'
      and consensus_timestamp = '1753444802.000000001'
      and mirror_verified_at is not null
      and hashscan_transaction_url like 'https://hashscan.io/testnet/transaction/%'
  ) then
    raise exception 'mirror verification state was not persisted';
  end if;

  begin
    insert into public.payments (
      id, challenge_id, transaction_proof, status, amount_tinybar, idempotency_key
    ) values (
      'payment-replay', 'challenge-replay', 'proof-1',
      'submitted', 250000000, 'payment-request-replay'
    );
    raise exception 'duplicate transaction proof was accepted';
  exception when unique_violation then
    null;
  end;
end
$$;
