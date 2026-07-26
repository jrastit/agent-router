create type public.llm_job_state as enum (
  'accepted', 'reserved', 'executing', 'validating', 'settled', 'delivered',
  'reconciliation_required', 'failed'
);
create type public.llm_attempt_state as enum (
  'pending', 'started', 'provider_accepted', 'completed', 'ambiguous', 'failed'
);
create type public.llm_job_failure_code as enum (
  'INSTANCE_UNKNOWN', 'INSTANCE_DISABLED', 'CAPABILITY_INCOMPATIBLE',
  'PRIVACY_INCOMPATIBLE', 'PRICE_STALE', 'PROVIDER_UNCREDENTIALLED',
  'INSUFFICIENT_CREDIT', 'PROVIDER_AUTHENTICATION', 'PROVIDER_TIMEOUT',
  'PROVIDER_UNAVAILABLE', 'OUTPUT_INVALID', 'USAGE_MISSING', 'USAGE_EXCEEDED',
  'COMPLETION_AMBIGUOUS', 'SETTLEMENT_AMBIGUOUS'
);

create table public.llm_jobs (
  id text primary key,
  user_id uuid not null,
  instance_id bigint not null references public.llm_instances(id),
  provider text not null check (provider in ('scaleway', '0g')),
  model text not null check (model <> '' and octet_length(model) <= 300),
  capability text not null check (capability ~ '^[a-z0-9][a-z0-9._-]*$'),
  privacy text not null check (privacy in ('public', 'confidential')),
  state public.llm_job_state not null default 'accepted',
  maximum_input_tokens integer not null check (maximum_input_tokens > 0),
  maximum_output_tokens integer not null check (maximum_output_tokens > 0),
  spend_ceiling_tinybar bigint not null check (spend_ceiling_tinybar > 0),
  idempotency_key text not null unique check (idempotency_key <> ''),
  failure_code public.llm_job_failure_code,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.llm_job_attempts (
  id text primary key,
  job_id text not null references public.llm_jobs(id),
  attempt_number integer not null check (attempt_number > 0),
  state public.llm_attempt_state not null default 'pending',
  provider_request_id text,
  idempotency_key text not null unique,
  failure_code public.llm_job_failure_code,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (job_id, attempt_number),
  unique (id, job_id)
);

create table public.llm_job_usage (
  job_id text primary key references public.llm_jobs(id),
  attempt_id text not null,
  prompt_tokens integer not null check (prompt_tokens >= 0),
  completion_tokens integer not null check (completion_tokens >= 0),
  total_tokens integer not null check (
    total_tokens >= 0 and total_tokens = prompt_tokens + completion_tokens
  ),
  reported_by_provider boolean not null check (reported_by_provider),
  created_at timestamptz not null default now(),
  foreign key (attempt_id, job_id)
    references public.llm_job_attempts(id, job_id)
);

create table public.llm_job_reservations (
  id text primary key,
  job_id text not null unique references public.llm_jobs(id),
  amount_tinybar bigint not null check (amount_tinybar > 0),
  price_snapshot jsonb not null check (
    jsonb_typeof(price_snapshot) = 'object'
    and price_snapshot ?& array[
      'currency', 'inputTinybarsPerMillionTokens',
      'outputTinybarsPerMillionTokens', 'catalogSyncedAt'
    ]
    and price_snapshot ->> 'currency' = 'tinybar'
    and price_snapshot ->> 'inputTinybarsPerMillionTokens' ~ '^(0|[1-9][0-9]*)$'
    and price_snapshot ->> 'outputTinybarsPerMillionTokens' ~ '^(0|[1-9][0-9]*)$'
  ),
  status text not null check (
    status in ('reserved', 'settled', 'released', 'reconciliation_required')
  ),
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  settled_at timestamptz
);

create table public.llm_job_charges (
  id text primary key,
  job_id text not null unique references public.llm_jobs(id),
  reservation_id text not null unique references public.llm_job_reservations(id),
  amount_tinybar bigint not null check (amount_tinybar >= 0),
  idempotency_key text not null unique,
  charged_at timestamptz not null default now()
);

create table public.llm_job_refunds (
  id text primary key,
  job_id text not null unique references public.llm_jobs(id),
  reservation_id text not null unique references public.llm_job_reservations(id),
  amount_tinybar bigint not null check (amount_tinybar >= 0),
  idempotency_key text not null unique,
  refunded_at timestamptz not null default now()
);

create table public.llm_job_results (
  job_id text primary key references public.llm_jobs(id),
  output text not null check (output <> ''),
  content_type text not null default 'text/plain' check (content_type = 'text/plain'),
  delivered_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.llm_job_provider_evidence (
  job_id text primary key references public.llm_jobs(id),
  attempt_id text not null,
  provider text not null check (provider in ('scaleway', '0g')),
  model text not null check (model <> '' and octet_length(model) <= 300),
  execution_id text not null check (execution_id <> ''),
  verification_label text not null check (
    verification_label <> '' and octet_length(verification_label) <= 500
  ),
  provider_address text,
  trust_mode text check (trust_mode in ('standard', 'private')),
  redacted_metadata jsonb not null default '{}' check (
    jsonb_typeof(redacted_metadata) = 'object'
    and not (redacted_metadata ?| array[
      'prompt', 'output', 'apiKey', 'authorization', 'credential'
    ])
  ),
  created_at timestamptz not null default now(),
  foreign key (attempt_id, job_id)
    references public.llm_job_attempts(id, job_id)
);

alter table public.llm_jobs enable row level security;
alter table public.llm_job_attempts enable row level security;
alter table public.llm_job_usage enable row level security;
alter table public.llm_job_reservations enable row level security;
alter table public.llm_job_charges enable row level security;
alter table public.llm_job_refunds enable row level security;
alter table public.llm_job_results enable row level security;
alter table public.llm_job_provider_evidence enable row level security;

create policy "owners read llm jobs" on public.llm_jobs for select
  to authenticated using (user_id = auth.uid());
create policy "owners read llm attempts" on public.llm_job_attempts for select
  to authenticated using (
    exists (select 1 from public.llm_jobs
      where id = job_id and user_id = auth.uid())
  );
create policy "owners read llm usage" on public.llm_job_usage for select
  to authenticated using (
    exists (select 1 from public.llm_jobs
      where id = job_id and user_id = auth.uid())
  );
create policy "owners read llm reservations" on public.llm_job_reservations
  for select to authenticated using (
    exists (select 1 from public.llm_jobs
      where id = job_id and user_id = auth.uid())
  );
create policy "owners read llm charges" on public.llm_job_charges for select
  to authenticated using (
    exists (select 1 from public.llm_jobs
      where id = job_id and user_id = auth.uid())
  );
create policy "owners read llm refunds" on public.llm_job_refunds for select
  to authenticated using (
    exists (select 1 from public.llm_jobs
      where id = job_id and user_id = auth.uid())
  );
create policy "owners read llm results" on public.llm_job_results for select
  to authenticated using (
    exists (select 1 from public.llm_jobs
      where id = job_id and user_id = auth.uid())
  );
create policy "owners read llm evidence"
  on public.llm_job_provider_evidence for select to authenticated using (
    exists (select 1 from public.llm_jobs
      where id = job_id and user_id = auth.uid())
  );

revoke all on public.llm_jobs, public.llm_job_attempts, public.llm_job_usage,
  public.llm_job_reservations, public.llm_job_charges, public.llm_job_refunds,
  public.llm_job_results, public.llm_job_provider_evidence from public, anon;
grant select on public.llm_jobs, public.llm_job_attempts, public.llm_job_usage,
  public.llm_job_reservations, public.llm_job_charges, public.llm_job_refunds,
  public.llm_job_results, public.llm_job_provider_evidence to authenticated;
grant all on public.llm_jobs, public.llm_job_attempts, public.llm_job_usage,
  public.llm_job_reservations, public.llm_job_charges, public.llm_job_refunds,
  public.llm_job_results, public.llm_job_provider_evidence to service_role;
