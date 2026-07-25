create function public.credit_verified_deposit_for_user(
  target_user_id uuid, target_deposit_id text, expected_proof text,
  verified_consensus_timestamp text, verified_at timestamptz,
  user_pseudonym text, transaction_hash text, request_key text
) returns public.credit_accounts
language plpgsql security definer set search_path = ''
as $$
declare
  locked_deposit public.deposits;
  intent public.deposit_intents;
  account public.credit_accounts;
begin
  select d.* into locked_deposit from public.deposits d
    where d.id = target_deposit_id and d.user_id = target_user_id for update;
  if not found then
    raise exception 'deposit not found or not owned' using errcode = 'P0002';
  end if;
  select * into intent from public.deposit_intents
    where id = target_deposit_id and user_id = target_user_id;
  if intent.expires_at < to_timestamp(
    split_part(verified_consensus_timestamp, '.', 1)::double precision
  ) then
    raise exception 'proof reached consensus after intent expiry' using errcode = 'P0001';
  end if;
  if locked_deposit.state = 'credited' then
    if locked_deposit.transaction_proof <> expected_proof then
      raise exception 'credited deposit proof mismatch' using errcode = 'P0001';
    end if;
    select * into account from public.credit_accounts
      where user_id = target_user_id;
    return account;
  end if;
  if locked_deposit.state not in (
    'submitted', 'consensus_confirmed', 'mirror_pending',
    'mirror_verified', 'reconciliation_required'
  ) then
    raise exception 'deposit is not creditable' using errcode = 'P0001';
  end if;

  update public.deposits set
    state = 'mirror_verified', transaction_proof = expected_proof,
    consensus_timestamp = verified_consensus_timestamp,
    consensus_confirmed_at = coalesce(consensus_confirmed_at, verified_at),
    mirror_verified_at = verified_at, updated_at = now()
  where id = target_deposit_id and user_id = target_user_id;

  insert into public.credit_accounts (user_id, available_tinybar)
    values (target_user_id, intent.amount_tinybar)
    on conflict (user_id) do update set
      available_tinybar = public.credit_accounts.available_tinybar
        + excluded.available_tinybar,
      updated_at = now()
    returning * into account;
  insert into public.credit_journal (
    user_id, kind, amount_tinybar, deposit_id, idempotency_key, metadata
  ) values (
    target_user_id, 'deposit', intent.amount_tinybar, target_deposit_id,
    request_key, jsonb_build_object('transactionProof', expected_proof)
  );
  update public.deposits set
    state = 'credited', credited_at = now(), projection_state = 'pending',
    graph_state = 'pending', updated_at = now()
  where id = target_deposit_id and user_id = target_user_id;
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

revoke all on function public.credit_verified_deposit_for_user(
  uuid,text,text,text,timestamptz,text,text,text
) from public;
grant execute on function public.credit_verified_deposit_for_user(
  uuid,text,text,text,timestamptz,text,text,text
) to service_role;
