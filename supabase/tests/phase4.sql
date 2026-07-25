reset role;

insert into public.providers (id, name, capabilities, privacy_classes, settlement_account)
values ('planner-provider', 'Planner Provider', array['summarize'], array['public'], '0.0.1002');

insert into public.offers (
  id, provider_id, capability, input_type, output_type, currency, amount_minor, expected_latency_ms
) values (
  'planner-offer', 'planner-provider', 'summarize', 'text', 'text', 'GBP', 125, 500
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);

insert into public.requirements (id, capability, privacy_class, input_type, output_type)
values ('planner-requirement', 'pending', 'public', 'text', 'text');

insert into public.policies (
  id, version, budget_currency, budget_amount_minor,
  max_transaction_amount_minor, allowed_privacy_classes
) values ('planner-policy', 4, 'GBP', 500, 250, array['public']);

insert into public.jobs (id, requirement_id, policy_id)
values ('planner-job', 'planner-requirement', 'planner-policy');

insert into public.quotes (id, job_id, offer_id, currency, amount_minor, expires_at)
values (
  'planner-quote', 'planner-job', 'planner-offer', 'GBP', 125,
  now() + interval '5 minutes'
);

select public.persist_planner_decision(
  'planner-job', 'planner-quote', 'planner-decision', 'planner-requirement',
  'summarize', 'public', 'text', 'text', 'planner-policy', 4,
  'planner-provider', 'planner-offer',
  '[{"providerId":"planner-provider","offerId":"planner-offer","eligible":true,"reasonCodes":[],"modelScore":90,"rationale":"fit","rank":1}]',
  '{"id":"planner-policy","version":4}',
  '{"requirementSource":"model","evaluationSource":"model","fallbackReasons":[]}',
  'planner-request'
);

select public.persist_planner_decision(
  'planner-job', 'planner-quote', 'ignored-decision', 'planner-requirement',
  'summarize', 'public', 'text', 'text', 'planner-policy', 4,
  'planner-provider', 'planner-offer', '[]', '{}', '{}', 'planner-request'
);

do $$
begin
  if (select capability from public.requirements where id = 'planner-requirement')
     <> 'summarize' then
    raise exception 'model-derived requirement was not persisted';
  end if;
  if (select reserved_amount_minor from public.jobs where id = 'planner-job') <> 125 then
    raise exception 'selected quote was not reserved exactly once';
  end if;
  if (select count(*) from public.decisions where job_id = 'planner-job') <> 1 then
    raise exception 'planner decision idempotency failed';
  end if;
  if (select (considered -> 0 ->> 'modelScore')::integer
      from public.decisions where id = 'planner-decision') <> 90 then
    raise exception 'planner score evidence was not persisted';
  end if;
end
$$;
