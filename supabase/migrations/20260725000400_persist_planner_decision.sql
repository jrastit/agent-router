create function public.persist_planner_decision(
  target_job_id text,
  target_quote_id text,
  new_decision_id text,
  decision_requirement_id text,
  requirement_capability text,
  requirement_privacy_class text,
  requirement_input_type text,
  requirement_output_type text,
  decision_policy_id text,
  decision_policy_version integer,
  selected_provider_id text,
  selected_offer_id text,
  considered jsonb,
  policy_snapshot jsonb,
  evidence jsonb,
  request_key text
) returns public.decisions
language plpgsql security invoker set search_path = ''
as $$
declare
  locked_job public.jobs;
  selected_quote public.quotes;
  saved_decision public.decisions;
  policy_row public.policies;
begin
  select * into locked_job from public.jobs
    where id = target_job_id and owner_id = auth.uid() for update;
  if not found then
    raise exception 'job not found or not owned' using errcode = 'P0002';
  end if;

  select * into saved_decision from public.decisions
    where idempotency_key = request_key;
  if found then return saved_decision; end if;

  if locked_job.requirement_id <> decision_requirement_id
     or locked_job.policy_id <> decision_policy_id then
    raise exception 'planner inputs do not match job' using errcode = 'P0001';
  end if;

  update public.requirements set
    capability = requirement_capability,
    privacy_class = requirement_privacy_class,
    input_type = requirement_input_type,
    output_type = requirement_output_type
  where id = decision_requirement_id and owner_id = auth.uid();
  if not found then
    raise exception 'requirement not found or not owned' using errcode = 'P0002';
  end if;

  select * into policy_row from public.policies
    where id = decision_policy_id and owner_id = auth.uid()
      and version = decision_policy_version;
  if not found then
    raise exception 'policy version not found or not owned' using errcode = 'P0002';
  end if;

  if selected_offer_id is null or selected_provider_id is null then
    if selected_offer_id is not null or selected_provider_id is not null
       or target_quote_id is not null then
      raise exception 'selection fields must all be present or absent'
        using errcode = 'P0001';
    end if;
  else
    select q.* into selected_quote
      from public.quotes q
      join public.offers o on o.id = q.offer_id
      where q.id = target_quote_id
        and q.job_id = target_job_id
        and q.offer_id = selected_offer_id
        and o.provider_id = selected_provider_id
      for update of q;
    if not found then
      raise exception 'selected quote does not match decision' using errcode = 'P0002';
    end if;
    if selected_quote.expires_at <= now() then
      raise exception 'quote expired' using errcode = 'P0001';
    end if;
    if selected_quote.currency <> policy_row.budget_currency
       or selected_quote.amount_minor > policy_row.max_transaction_amount_minor
       or locked_job.reserved_amount_minor + selected_quote.amount_minor
          > policy_row.budget_amount_minor then
      raise exception 'budget exceeded or currency mismatch' using errcode = 'P0001';
    end if;

    update public.quotes set accepted_at = now() where id = target_quote_id;
    update public.jobs set
      reserved_amount_minor = reserved_amount_minor + selected_quote.amount_minor,
      status = 'provider_selected',
      updated_at = now()
    where id = target_job_id;
  end if;

  insert into public.decisions (
    id, job_id, requirement_id, policy_id, policy_version, selected_provider_id,
    selected_offer_id, considered, policy_snapshot, evidence, idempotency_key
  ) values (
    new_decision_id, target_job_id, decision_requirement_id, decision_policy_id,
    decision_policy_version, selected_provider_id, selected_offer_id, considered,
    policy_snapshot, evidence, request_key
  ) returning * into saved_decision;

  return saved_decision;
end
$$;
