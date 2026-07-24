create type public.job_state as enum (
  'created', 'requirements_ready', 'providers_discovered', 'quotes_evaluated',
  'provider_selected', 'execution_requested', 'payment_required',
  'payment_submitted', 'payment_confirmed_mirror_pending', 'payment_verified',
  'execution_completed', 'receipt_recorded', 'failed'
);
create type public.payment_state as enum (
  'required', 'submitted', 'consensus_confirmed', 'mirror_verified',
  'reconciliation_required', 'failed'
);
create type public.delivery_state as enum ('requested', 'processing', 'completed', 'failed');

create table public.requirements (
  id text primary key,
  owner_id uuid not null default auth.uid(),
  capability text not null check (capability <> ''),
  privacy_class text not null check (privacy_class in ('public', 'confidential')),
  input_type text not null check (input_type <> ''),
  output_type text not null check (output_type <> ''),
  created_at timestamptz not null default now(),
  unique (id, owner_id)
);

create table public.policies (
  id text primary key,
  owner_id uuid not null default auth.uid(),
  version integer not null check (version > 0),
  budget_currency text not null check (budget_currency ~ '^[A-Z]{3}$'),
  budget_amount_minor bigint not null check (budget_amount_minor >= 0),
  max_transaction_amount_minor bigint not null check (max_transaction_amount_minor >= 0),
  allowed_privacy_classes text[] not null,
  required_capabilities text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (id, version),
  unique (id, owner_id)
);

create table public.providers (
  id text primary key,
  name text not null,
  capabilities text[] not null,
  privacy_classes text[] not null,
  settlement_account text not null,
  created_at timestamptz not null default now()
);

create table public.offers (
  id text primary key,
  provider_id text not null references public.providers(id),
  capability text not null,
  input_type text not null,
  output_type text not null,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  amount_minor bigint not null check (amount_minor >= 0),
  expected_latency_ms bigint not null check (expected_latency_ms >= 0),
  created_at timestamptz not null default now()
);

create table public.jobs (
  id text primary key,
  owner_id uuid not null default auth.uid(),
  requirement_id text not null,
  policy_id text not null,
  status public.job_state not null default 'created',
  failure_reason text,
  reserved_amount_minor bigint not null default 0 check (reserved_amount_minor >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id),
  foreign key (requirement_id, owner_id) references public.requirements(id, owner_id),
  foreign key (policy_id, owner_id) references public.policies(id, owner_id)
);

create table public.quotes (
  id text primary key,
  job_id text not null references public.jobs(id) on delete cascade,
  offer_id text not null references public.offers(id),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  amount_minor bigint not null check (amount_minor >= 0),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index one_accepted_quote_per_job on public.quotes(job_id)
  where accepted_at is not null;

create table public.decisions (
  id text primary key,
  job_id text not null unique references public.jobs(id) on delete cascade,
  requirement_id text not null references public.requirements(id),
  policy_id text not null references public.policies(id),
  policy_version integer not null check (policy_version > 0),
  selected_provider_id text references public.providers(id),
  selected_offer_id text references public.offers(id),
  considered jsonb not null check (jsonb_typeof(considered) = 'array'),
  policy_snapshot jsonb not null check (jsonb_typeof(policy_snapshot) = 'object'),
  evidence jsonb not null check (jsonb_typeof(evidence) = 'object'),
  idempotency_key text not null unique,
  created_at timestamptz not null default now()
);

create table public.payment_challenges (
  id text primary key,
  quote_id text not null unique references public.quotes(id),
  payer_account text not null,
  recipient_account text not null,
  network text not null,
  asset text not null,
  amount_tinybar bigint not null check (amount_tinybar >= 0),
  memo text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table public.payments (
  id text primary key,
  challenge_id text not null unique references public.payment_challenges(id),
  transaction_proof text not null unique,
  status public.payment_state not null,
  amount_tinybar bigint not null check (amount_tinybar >= 0),
  proof_consumed_at timestamptz,
  idempotency_key text not null unique,
  created_at timestamptz not null default now()
);

create table public.deliveries (
  id text primary key,
  job_id text not null unique references public.jobs(id) on delete cascade,
  provider_id text not null references public.providers(id),
  status public.delivery_state not null,
  artifact_reference text,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.receipts (
  id text primary key,
  job_id text not null unique references public.jobs(id) on delete cascade,
  decision_id text not null unique references public.decisions(id),
  payment_id text not null unique references public.payments(id),
  delivery_id text not null unique references public.deliveries(id),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  amount_minor bigint not null check (amount_minor >= 0),
  idempotency_key text not null unique,
  created_at timestamptz not null default now()
);

create table public.events (
  id bigint generated always as identity primary key,
  event_key text not null unique,
  job_id text not null references public.jobs(id) on delete cascade,
  sequence bigint not null check (sequence >= 0),
  type text not null,
  payload jsonb not null default '{}',
  occurred_at timestamptz not null default now(),
  unique (job_id, sequence)
);

create index quotes_job_id_idx on public.quotes(job_id);
create index events_job_id_id_idx on public.events(job_id, id);

alter table public.requirements enable row level security;
alter table public.policies enable row level security;
alter table public.jobs enable row level security;
alter table public.quotes enable row level security;
alter table public.decisions enable row level security;
alter table public.payment_challenges enable row level security;
alter table public.payments enable row level security;
alter table public.deliveries enable row level security;
alter table public.receipts enable row level security;
alter table public.events enable row level security;
alter table public.providers enable row level security;
alter table public.offers enable row level security;

create policy "owners manage requirements" on public.requirements
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owners manage policies" on public.policies
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owners manage jobs" on public.jobs
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "authenticated read providers" on public.providers
  for select to authenticated using (true);
create policy "authenticated read offers" on public.offers
  for select to authenticated using (true);

create function public.owns_job(target_job_id text) returns boolean
language sql stable security invoker set search_path = ''
as $$ select exists (
  select 1 from public.jobs where id = target_job_id and owner_id = auth.uid()
) $$;

create policy "owners manage quotes" on public.quotes for all to authenticated
  using (public.owns_job(job_id)) with check (public.owns_job(job_id));
create policy "owners manage decisions" on public.decisions for all to authenticated
  using (public.owns_job(job_id)) with check (public.owns_job(job_id));
create policy "owners manage deliveries" on public.deliveries for all to authenticated
  using (public.owns_job(job_id)) with check (public.owns_job(job_id));
create policy "owners manage receipts" on public.receipts for all to authenticated
  using (public.owns_job(job_id)) with check (public.owns_job(job_id));
create policy "owners manage events" on public.events for all to authenticated
  using (public.owns_job(job_id)) with check (public.owns_job(job_id));
create policy "owners manage challenges" on public.payment_challenges for all to authenticated
  using (exists (
    select 1 from public.quotes q where q.id = quote_id and public.owns_job(q.job_id)
  )) with check (exists (
    select 1 from public.quotes q where q.id = quote_id and public.owns_job(q.job_id)
  ));
create policy "owners manage payments" on public.payments for all to authenticated
  using (exists (
    select 1 from public.payment_challenges c join public.quotes q on q.id = c.quote_id
    where c.id = challenge_id and public.owns_job(q.job_id)
  )) with check (exists (
    select 1 from public.payment_challenges c join public.quotes q on q.id = c.quote_id
    where c.id = challenge_id and public.owns_job(q.job_id)
  ));

revoke all on function public.owns_job(text) from public;
grant execute on function public.owns_job(text) to authenticated;
