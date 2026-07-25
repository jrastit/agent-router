create table if not exists public.validation_health (
  id text primary key,
  status text not null,
  updated_at timestamptz not null default now()
);

alter table public.validation_health enable row level security;

-- This validation table is intentionally server-only. The service-role key used
-- by the probe bypasses RLS; browser clients receive no access policy.
revoke all on table public.validation_health from anon, authenticated;
