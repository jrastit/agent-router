alter table public.llm_instances
  add column input_price_tinybar_per_million bigint check (
    input_price_tinybar_per_million is null
    or input_price_tinybar_per_million >= 0
  ),
  add column output_price_tinybar_per_million bigint check (
    output_price_tinybar_per_million is null
    or output_price_tinybar_per_million >= 0
  ),
  add column price_synced_at timestamptz;

create table public.llm_job_inputs (
  job_id text primary key,
  user_id uuid not null,
  prompt text not null check (
    prompt <> '' and octet_length(prompt) <= 400000
  ),
  created_at timestamptz not null default now(),
  foreign key (job_id, user_id) references public.llm_jobs(id, user_id)
);

alter table public.llm_job_inputs enable row level security;
create policy "owners read llm job inputs" on public.llm_job_inputs
  for select to authenticated using (user_id = auth.uid());

revoke all on public.llm_job_inputs from public, anon;
grant select on public.llm_job_inputs to authenticated;
grant all on public.llm_job_inputs to service_role;
