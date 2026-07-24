insert into public.providers (id, name, capabilities, privacy_classes, settlement_account)
values ('provider-1', 'Provider One', array['summarize'], array['public'], '0.0.1001');

insert into public.offers (
  id, provider_id, capability, input_type, output_type, currency, amount_minor, expected_latency_ms
) values ('offer-1', 'provider-1', 'summarize', 'text', 'text', 'GBP', 250, 1000);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);

insert into public.requirements (id, capability, privacy_class, input_type, output_type)
values ('requirement-1', 'summarize', 'public', 'text', 'text');

insert into public.policies (
  id, version, budget_currency, budget_amount_minor,
  max_transaction_amount_minor, allowed_privacy_classes
) values ('policy-1', 1, 'GBP', 1000, 500, array['public']);

insert into public.jobs (id, requirement_id, policy_id)
values ('job-1', 'requirement-1', 'policy-1');

insert into public.quotes (id, job_id, offer_id, currency, amount_minor, expires_at)
values ('quote-1', 'job-1', 'offer-1', 'GBP', 250, now() + interval '5 minutes');

select public.accept_quote_and_reserve(
  'job-1', 'quote-1', 'decision-1', 'requirement-1', 'policy-1', 1,
  'provider-1', 'offer-1', '[]', '{}', '{}', 'accept-request-1'
);
select public.accept_quote_and_reserve(
  'job-1', 'quote-1', 'ignored-by-idempotency', 'requirement-1', 'policy-1', 1,
  'provider-1', 'offer-1', '[]', '{}', '{}', 'accept-request-1'
);

select public.append_job_event('job-1', 'event-1', 'provider.selected', '{}');
select public.append_job_event('job-1', 'event-1', 'provider.selected', '{}');

insert into public.payment_challenges (
  id, quote_id, payer_account, recipient_account, network, asset,
  amount_tinybar, memo, expires_at
) values (
  'challenge-1', 'quote-1', '0.0.1000', '0.0.1001', 'testnet', 'HBAR',
  1000000, 'job-1', now() + interval '5 minutes'
);
insert into public.payments (
  id, challenge_id, transaction_proof, status, amount_tinybar, idempotency_key
) values (
  'payment-1', 'challenge-1', 'proof-1', 'mirror_verified', 1000000, 'payment-request-1'
);
insert into public.deliveries (id, job_id, provider_id, status, artifact_reference, completed_at)
values ('delivery-1', 'job-1', 'provider-1', 'completed', 'artifact-1', now());

select public.consume_proof_and_create_receipt(
  'payment-1', 'receipt-1', 'job-1', 'decision-1', 'delivery-1',
  'GBP', 250, 'receipt-request-1'
);
select public.consume_proof_and_create_receipt(
  'payment-1', 'ignored-by-idempotency', 'job-1', 'decision-1', 'delivery-1',
  'GBP', 250, 'receipt-request-1'
);

do $$
begin
  if (select reserved_amount_minor from public.jobs where id = 'job-1') <> 250 then
    raise exception 'budget reservation was not durable';
  end if;
  if (select count(*) from public.decisions where job_id = 'job-1') <> 1 then
    raise exception 'decision idempotency failed';
  end if;
  if (select count(*) from public.events where job_id = 'job-1') <> 1 then
    raise exception 'event idempotency failed';
  end if;
  if (select count(*) from public.receipts where job_id = 'job-1') <> 1 then
    raise exception 'receipt idempotency failed';
  end if;
  if (select proof_consumed_at from public.payments where id = 'payment-1') is null then
    raise exception 'proof was not consumed';
  end if;

  begin
    perform public.consume_proof_and_create_receipt(
      'payment-1', 'receipt-2', 'job-1', 'decision-1', 'delivery-1',
      'GBP', 250, 'receipt-request-2'
    );
    raise exception 'replayed proof was accepted';
  exception
    when unique_violation then null;
  end;
end
$$;

