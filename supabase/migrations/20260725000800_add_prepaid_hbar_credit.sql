create type public.deposit_state as enum (
  'intent_created', 'submitted', 'consensus_confirmed', 'mirror_pending',
  'mirror_verified', 'credited', 'reconciliation_required', 'rejected'
);
create type public.projection_state as enum ('not_ready', 'pending', 'projected', 'failed');
create type public.graph_indexing_state as enum (
  'not_ready', 'pending', 'indexed', 'stale', 'mismatched'
);
create type public.credit_entry_kind as enum (
  'deposit', 'reservation', 'charge', 'refund', 'release', 'reconciliation'
);

create table public.credit_accounts (
  user_id uuid primary key,
  available_tinybar bigint not null default 0 check (available_tinybar >= 0),
  reserved_tinybar bigint not null default 0 check (reserved_tinybar >= 0),
  spent_tinybar bigint not null default 0 check (spent_tinybar >= 0),
  refunded_tinybar bigint not null default 0 check (refunded_tinybar >= 0),
  reconciliation_tinybar bigint not null default 0 check (reconciliation_tinybar >= 0),
  updated_at timestamptz not null default now()
);

create table public.deposit_intents (
  id text primary key,
  version text not null check (version = '1'),
  user_id uuid not null default auth.uid(),
  payer_account text not null check (payer_account ~ '^[0-9]+\.[0-9]+\.[0-9]+$'),
  treasury_account text not null check (treasury_account ~ '^[0-9]+\.[0-9]+\.[0-9]+$'),
  network text not null check (network = 'testnet'),
  amount_tinybar bigint not null check (amount_tinybar > 0),
  memo text not null check (memo <> '' and octet_length(memo) <= 100),
  expires_at timestamptz not null,
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.deposits (
  id text primary key references public.deposit_intents(id),
  user_id uuid not null,
  state public.deposit_state not null default 'intent_created',
  transaction_proof text unique,
  consensus_timestamp text,
  submitted_at timestamptz,
  consensus_confirmed_at timestamptz,
  mirror_verified_at timestamptz,
  credited_at timestamptz,
  rejected_reason text,
  projection_state public.projection_state not null default 'not_ready',
  graph_state public.graph_indexing_state not null default 'not_ready',
  projection_attempts integer not null default 0 check (projection_attempts >= 0),
  projected_at timestamptz,
  indexed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (id, user_id) references public.deposit_intents(id, user_id)
);

create table public.credit_journal (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  kind public.credit_entry_kind not null,
  amount_tinybar bigint not null check (amount_tinybar > 0),
  deposit_id text references public.deposits(id),
  reservation_id text,
  idempotency_key text not null unique,
  metadata jsonb not null default '{}' check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);
create unique index one_deposit_credit on public.credit_journal(deposit_id)
  where kind = 'deposit';

create table public.monitoring_projection_outbox (
  deposit_id text primary key references public.deposits(id),
  version text not null check (version = '1'),
  payload jsonb not null check (
    jsonb_typeof(payload) = 'object'
    and payload ?& array[
      'version', 'depositId', 'userPseudonym', 'transactionHash',
      'amountTinybars', 'verifiedAt'
    ]
    and payload - array[
      'version', 'depositId', 'userPseudonym', 'transactionHash',
      'amountTinybars', 'verifiedAt'
    ] = '{}'::jsonb
  ),
  idempotency_key text not null unique,
  available_at timestamptz not null default now(),
  delivered_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);

create table public.credit_reservations (
  id text primary key,
  user_id uuid not null,
  job_id text not null references public.jobs(id),
  quoted_tinybar bigint not null check (quoted_tinybar > 0),
  charged_tinybar bigint check (
    charged_tinybar is null or charged_tinybar between 0 and quoted_tinybar
  ),
  exchange_rate_snapshot jsonb not null check (jsonb_typeof(exchange_rate_snapshot) = 'object'),
  treasury_liability_tinybar bigint not null check (treasury_liability_tinybar >= 0),
  status text not null check (status in ('reserved', 'settled', 'released', 'reconciliation_required')),
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  settled_at timestamptz
);

create table public.og_treasury_inventory (
  singleton boolean primary key default true check (singleton),
  available_amount text not null check (available_amount ~ '^[0-9]+(\.[0-9]+)?$'),
  asset text not null,
  network text not null,
  updated_at timestamptz not null default now()
);

alter table public.credit_accounts enable row level security;
alter table public.deposit_intents enable row level security;
alter table public.deposits enable row level security;
alter table public.credit_journal enable row level security;
alter table public.monitoring_projection_outbox enable row level security;
alter table public.credit_reservations enable row level security;
alter table public.og_treasury_inventory enable row level security;

create policy "owners read credit accounts" on public.credit_accounts
  for select to authenticated using (user_id = auth.uid());
create policy "owners create deposit intents" on public.deposit_intents
  for insert to authenticated with check (user_id = auth.uid());
create policy "owners read deposit intents" on public.deposit_intents
  for select to authenticated using (user_id = auth.uid());
create policy "owners read deposits" on public.deposits
  for select to authenticated using (user_id = auth.uid());
create policy "owners read credit journal" on public.credit_journal
  for select to authenticated using (user_id = auth.uid());
create policy "owners read deposit projection evidence" on public.monitoring_projection_outbox
  for select to authenticated using (
    exists (
      select 1 from public.deposits
      where id = deposit_id and user_id = auth.uid()
    )
  );
create policy "owners read reservations" on public.credit_reservations
  for select to authenticated using (user_id = auth.uid());

create function public.create_deposit_intent(
  target_id text, intent_version text, payer text, treasury text, target_network text,
  exact_tinybar bigint, bound_memo text, target_expiry timestamptz, request_key text
) returns public.deposit_intents
language plpgsql security definer set search_path = ''
as $$
declare saved public.deposit_intents;
begin
  select * into saved from public.deposit_intents where idempotency_key = request_key;
  if found then return saved; end if;
  if target_expiry <= now() then
    raise exception 'deposit intent expiry must be in the future' using errcode = 'P0001';
  end if;
  insert into public.deposit_intents (
    id, version, user_id, payer_account, treasury_account, network,
    amount_tinybar, memo, expires_at, idempotency_key
  ) values (
    target_id, intent_version, auth.uid(), payer, treasury, target_network,
    exact_tinybar, bound_memo, target_expiry, request_key
  ) returning * into saved;
  insert into public.deposits (id, user_id) values (saved.id, saved.user_id);
  return saved;
end
$$;

create function public.credit_verified_deposit(
  target_deposit_id text, expected_proof text, verified_consensus_timestamp text,
  verified_at timestamptz, user_pseudonym text, transaction_hash text,
  request_key text
) returns public.credit_accounts
language plpgsql security definer set search_path = ''
as $$
declare
  locked_deposit public.deposits;
  intent public.deposit_intents;
  account public.credit_accounts;
begin
  select d.* into locked_deposit from public.deposits d
    where d.id = target_deposit_id and d.user_id = auth.uid() for update;
  if not found then raise exception 'deposit not found or not owned' using errcode = 'P0002'; end if;
  select * into intent from public.deposit_intents where id = target_deposit_id;
  if intent.expires_at < to_timestamp(split_part(verified_consensus_timestamp, '.', 1)::double precision) then
    raise exception 'proof reached consensus after intent expiry' using errcode = 'P0001';
  end if;
  if locked_deposit.state = 'credited' then
    if locked_deposit.transaction_proof <> expected_proof then
      raise exception 'credited deposit proof mismatch' using errcode = 'P0001';
    end if;
    select * into account from public.credit_accounts where user_id = auth.uid();
    return account;
  end if;
  if locked_deposit.state not in (
    'submitted', 'consensus_confirmed', 'mirror_pending',
    'mirror_verified', 'reconciliation_required'
  ) then raise exception 'deposit is not creditable' using errcode = 'P0001'; end if;

  update public.deposits set
    state = 'mirror_verified', transaction_proof = expected_proof,
    consensus_timestamp = verified_consensus_timestamp,
    consensus_confirmed_at = coalesce(consensus_confirmed_at, verified_at),
    mirror_verified_at = verified_at, updated_at = now()
  where id = target_deposit_id;

  insert into public.credit_accounts (user_id, available_tinybar)
    values (auth.uid(), intent.amount_tinybar)
    on conflict (user_id) do update set
      available_tinybar = public.credit_accounts.available_tinybar + excluded.available_tinybar,
      updated_at = now()
    returning * into account;
  insert into public.credit_journal (
    user_id, kind, amount_tinybar, deposit_id, idempotency_key,
    metadata
  ) values (
    auth.uid(), 'deposit', intent.amount_tinybar, target_deposit_id, request_key,
    jsonb_build_object('transactionProof', expected_proof)
  );
  update public.deposits set
    state = 'credited', credited_at = now(), projection_state = 'pending',
    graph_state = 'pending', updated_at = now()
  where id = target_deposit_id;
  insert into public.monitoring_projection_outbox (
    deposit_id, version, payload, idempotency_key
  ) values (
    target_deposit_id, '1',
    jsonb_build_object(
      'version', '1', 'depositId', target_deposit_id,
      'userPseudonym', user_pseudonym, 'transactionHash', transaction_hash,
      'amountTinybars', intent.amount_tinybar::text, 'verifiedAt', verified_at
    ),
    'deposit-observed:' || target_deposit_id
  );
  return account;
end
$$;

create function public.submit_deposit_proof(
  target_deposit_id text, submitted_proof text
) returns public.deposits
language plpgsql security definer set search_path = ''
as $$
declare saved public.deposits;
begin
  update public.deposits set
    state = 'submitted', transaction_proof = submitted_proof,
    submitted_at = now(), updated_at = now()
  where id = target_deposit_id and user_id = auth.uid()
    and state in ('intent_created', 'submitted', 'mirror_pending')
    and (transaction_proof is null or transaction_proof = submitted_proof)
  returning * into saved;
  if not found then
    raise exception 'deposit not found, already advanced, or proof mismatch' using errcode = 'P0001';
  end if;
  return saved;
end
$$;

create function public.mark_deposit_reconciliation_required(
  target_deposit_id text, reason text
) returns public.deposits
language plpgsql security definer set search_path = ''
as $$
declare saved public.deposits;
begin
  update public.deposits set
    state = 'reconciliation_required', rejected_reason = reason, updated_at = now()
  where id = target_deposit_id and user_id = auth.uid()
    and state in ('mirror_verified', 'credited', 'reconciliation_required')
  returning * into saved;
  if not found then
    raise exception 'deposit not found or not reconcilable' using errcode = 'P0002';
  end if;
  return saved;
end
$$;

create function public.reserve_user_credit(
  reservation_id text, target_job_id text, exact_tinybar bigint,
  rate_snapshot jsonb, liability_tinybar bigint, request_key text
) returns public.credit_reservations
language plpgsql security definer set search_path = ''
as $$
declare account public.credit_accounts; saved public.credit_reservations;
begin
  select * into saved from public.credit_reservations where idempotency_key = request_key;
  if found then return saved; end if;
  perform 1 from public.jobs where id = target_job_id and owner_id = auth.uid();
  if not found then raise exception 'job not found or not owned' using errcode = 'P0002'; end if;
  select * into account from public.credit_accounts where user_id = auth.uid() for update;
  if not found or account.available_tinybar < exact_tinybar then
    raise exception 'insufficient application credit' using errcode = 'P0001';
  end if;
  update public.credit_accounts set
    available_tinybar = available_tinybar - exact_tinybar,
    reserved_tinybar = reserved_tinybar + exact_tinybar, updated_at = now()
  where user_id = auth.uid();
  insert into public.credit_reservations (
    id, user_id, job_id, quoted_tinybar, exchange_rate_snapshot,
    treasury_liability_tinybar, status, idempotency_key
  ) values (
    reservation_id, auth.uid(), target_job_id, exact_tinybar, rate_snapshot,
    liability_tinybar, 'reserved', request_key
  ) returning * into saved;
  insert into public.credit_journal (
    user_id, kind, amount_tinybar, reservation_id, idempotency_key
  ) values (auth.uid(), 'reservation', exact_tinybar, reservation_id, 'journal:' || request_key);
  return saved;
end
$$;

create function public.settle_user_credit(
  reservation_id text, actual_tinybar bigint, request_key text
) returns public.credit_reservations
language plpgsql security definer set search_path = ''
as $$
declare saved public.credit_reservations; unused bigint;
begin
  select * into saved from public.credit_reservations
    where id = reservation_id and user_id = auth.uid() for update;
  if not found then raise exception 'reservation not found or not owned' using errcode = 'P0002'; end if;
  if saved.status = 'settled' then return saved; end if;
  if saved.status <> 'reserved' or actual_tinybar < 0 or actual_tinybar > saved.quoted_tinybar then
    raise exception 'invalid reservation settlement' using errcode = 'P0001';
  end if;
  unused := saved.quoted_tinybar - actual_tinybar;
  update public.credit_accounts set
    reserved_tinybar = reserved_tinybar - saved.quoted_tinybar,
    spent_tinybar = spent_tinybar + actual_tinybar,
    available_tinybar = available_tinybar + unused,
    refunded_tinybar = refunded_tinybar + unused,
    updated_at = now()
  where user_id = auth.uid();
  if actual_tinybar > 0 then
    insert into public.credit_journal (
      user_id, kind, amount_tinybar, reservation_id, idempotency_key
    ) values (auth.uid(), 'charge', actual_tinybar, reservation_id, 'charge:' || request_key);
  end if;
  if unused > 0 then
    insert into public.credit_journal (
      user_id, kind, amount_tinybar, reservation_id, idempotency_key
    ) values (auth.uid(), 'refund', unused, reservation_id, 'refund:' || request_key);
  end if;
  update public.credit_reservations set
    charged_tinybar = actual_tinybar, status = 'settled', settled_at = now()
  where id = reservation_id returning * into saved;
  return saved;
end
$$;

revoke all on function public.create_deposit_intent(text,text,text,text,text,bigint,text,timestamptz,text) from public;
revoke all on function public.credit_verified_deposit(text,text,text,timestamptz,text,text,text) from public;
revoke all on function public.submit_deposit_proof(text,text) from public;
revoke all on function public.mark_deposit_reconciliation_required(text,text) from public;
revoke all on function public.reserve_user_credit(text,text,bigint,jsonb,bigint,text) from public;
revoke all on function public.settle_user_credit(text,bigint,text) from public;
grant execute on function public.create_deposit_intent(text,text,text,text,text,bigint,text,timestamptz,text) to authenticated;
grant execute on function public.credit_verified_deposit(text,text,text,timestamptz,text,text,text) to service_role;
grant execute on function public.submit_deposit_proof(text,text) to authenticated;
grant execute on function public.mark_deposit_reconciliation_required(text,text) to service_role;
grant execute on function public.reserve_user_credit(text,text,bigint,jsonb,bigint,text) to authenticated;
grant execute on function public.settle_user_credit(text,bigint,text) to service_role;
