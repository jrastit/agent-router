create function public.get_my_llm_job_snapshot(target_job_id text)
returns jsonb
language sql stable security invoker set search_path = ''
as $$
  select jsonb_build_object(
    'id', job.id,
    'state', job.state,
    'failureCode', job.failure_code,
    'provider', job.provider,
    'model', job.model,
    'capability', job.capability,
    'privacy', job.privacy,
    'maximumInputTokens', job.maximum_input_tokens,
    'maximumOutputTokens', job.maximum_output_tokens,
    'spendCeilingTinybars', job.spend_ceiling_tinybar::text,
    'selectedInstance', jsonb_build_object(
      'id', instance.id::text,
      'name', instance.name,
      'provider', instance.provider,
      'model', instance.model_id,
      'privacy', instance.privacy
    ),
    'usage', case when usage.job_id is null then null else jsonb_build_object(
      'promptTokens', usage.prompt_tokens,
      'completionTokens', usage.completion_tokens,
      'totalTokens', usage.total_tokens
    ) end,
    'accounting', case when reservation.id is null then null
      else jsonb_build_object(
        'reservedTinybars', reservation.amount_tinybar::text,
        'chargedTinybars', coalesce(charge.amount_tinybar, 0)::text,
        'refundedTinybars', coalesce(refund.amount_tinybar, 0)::text,
        'priceSnapshot', reservation.price_snapshot
      )
    end,
    'remainingBalanceTinybars', coalesce(account.available_tinybar, 0)::text,
    'output', result.output,
    'evidence', case when evidence.job_id is null then null
      else jsonb_build_object(
        'executionId', evidence.execution_id,
        'verificationLabel', evidence.verification_label,
        'providerAddress', evidence.provider_address,
        'trustMode', evidence.trust_mode
      )
    end,
    'createdAt', job.created_at,
    'updatedAt', job.updated_at
  )
  from public.llm_jobs job
  join public.llm_instances instance on instance.id = job.instance_id
  left join public.llm_job_usage usage on usage.job_id = job.id
  left join public.llm_job_reservations reservation
    on reservation.job_id = job.id
  left join public.llm_job_charges charge on charge.job_id = job.id
  left join public.llm_job_refunds refund on refund.job_id = job.id
  left join public.llm_job_results result on result.job_id = job.id
  left join public.llm_job_provider_evidence evidence
    on evidence.job_id = job.id
  left join public.credit_accounts account on account.user_id = job.user_id
  where job.id = target_job_id and job.user_id = auth.uid()
$$;

revoke all on function public.get_my_llm_job_snapshot(text) from public, anon;
grant execute on function public.get_my_llm_job_snapshot(text)
  to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) then
    create publication supabase_realtime;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'llm_jobs'
  ) then
    alter publication supabase_realtime add table public.llm_jobs;
  end if;
end
$$;
