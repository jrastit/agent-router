-- Phase 8 failure and RLS regression checks. Earlier phase fixtures run in the
-- same transaction, so owner one already has job-1 and its commerce records.

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000001',
  true
);

insert into public.quotes (
  id, job_id, offer_id, currency, amount_minor, expires_at
) values (
  'quote-phase8-expired', 'job-1', 'offer-1', 'GBP', 250, now() - interval '1 second'
);

do $$
begin
  begin
    perform public.accept_quote_and_reserve(
      'job-1', 'quote-phase8-expired', 'decision-phase8-expired',
      'requirement-1', 'policy-1', 1, 'provider-1', 'offer-1',
      '[]', '{}', '{}', 'accept-phase8-expired'
    );
    raise exception 'expired quote was accepted';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'quote expired' then raise; end if;
  end;
end
$$;

-- Anonymous clients receive no commerce-table access.
set local role anon;
do $$
begin
  if (select count(*) from public.jobs) <> 0 then
    raise exception 'anonymous client read jobs';
  end if;
  if (select count(*) from public.payments) <> 0 then
    raise exception 'anonymous client read payments';
  end if;
  if (select count(*) from public.credit_accounts) <> 0 then
    raise exception 'anonymous client read credit accounts';
  end if;
end
$$;

-- An authenticated user cannot observe or forge another user's rows.
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000002',
  true
);

do $$
begin
  if (select count(*) from public.jobs where id = 'job-1') <> 0 then
    raise exception 'cross-user job read passed RLS';
  end if;
  if (select count(*) from public.payments where id = 'payment-1') <> 0 then
    raise exception 'cross-user payment read passed RLS';
  end if;
  if (select count(*) from public.credit_accounts) <> 0 then
    raise exception 'cross-user credit-account read passed RLS';
  end if;
  begin
    insert into public.requirements (
      id, owner_id, capability, privacy_class, input_type, output_type
    ) values (
      'requirement-phase8-forged',
      '00000000-0000-0000-0000-000000000001',
      'summarize', 'public', 'text', 'text'
    );
    raise exception 'cross-user insert passed RLS';
  exception when insufficient_privilege then null;
  end;
end
$$;
