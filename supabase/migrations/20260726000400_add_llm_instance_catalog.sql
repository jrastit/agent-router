create table public.llm_instances (
  id bigint generated always as identity primary key,
  provider text not null check (provider ~ '^[a-z0-9][a-z0-9._-]*$'),
  model_id text not null check (model_id <> '' and octet_length(model_id) <= 300),
  name text not null check (name <> '' and octet_length(name) <= 300),
  base_url text not null check (base_url ~ '^https://'),
  capabilities text[] not null check (cardinality(capabilities) > 0),
  privacy text not null check (privacy in ('public', 'confidential')),
  enabled boolean not null default true,
  expected_latency_ms integer not null default 0 check (expected_latency_ms >= 0),
  source_metadata jsonb not null default '{}' check (
    jsonb_typeof(source_metadata) = 'object'
  ),
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, model_id)
);

alter table public.llm_instances enable row level security;

create policy "public reads enabled llm instances"
  on public.llm_instances for select to anon, authenticated
  using (enabled);

revoke all on public.llm_instances from public;
grant select on public.llm_instances to anon, authenticated;
grant all on public.llm_instances to service_role;
grant usage, select on sequence public.llm_instances_id_seq to service_role;
