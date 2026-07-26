-- Owner one receives exact-string account totals and their own journal only.
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000001',
  true
);

do $$
declare
  activity record;
begin
  select * into activity from public.get_my_fund_activity() limit 1;
  if activity.available_tinybars <> '7000000'
    or activity.reserved_tinybars <> '0'
    or activity.spent_tinybars <> '4000000'
    or activity.refunded_tinybars <> '2000000'
  then
    raise exception 'fund activity totals are incorrect or not exact strings';
  end if;
  if activity.journal_id is null or activity.entry_kind is null then
    raise exception 'fund activity omitted the owner journal';
  end if;
end
$$;

-- Owner two cannot observe owner one's account through the read model.
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000002',
  true
);

do $$
begin
  if (select count(*) from public.get_my_fund_activity()) <> 0 then
    raise exception 'cross-user fund activity read passed RLS';
  end if;
end
$$;

-- Anonymous clients cannot execute the authenticated read model.
set local role anon;
do $$
begin
  begin
    perform public.get_my_fund_activity();
    raise exception 'anonymous fund activity execution succeeded';
  exception when insufficient_privilege then null;
  end;
end
$$;

reset role;

do $$
declare
  missing_count integer;
begin
  select count(*) into missing_count
  from unnest(array[
    'credit_accounts', 'credit_journal', 'deposits', 'credit_reservations'
  ]) expected(tablename)
  where not exists (
    select 1
    from pg_publication_tables published
    where published.pubname = 'supabase_realtime'
      and published.schemaname = 'public'
      and published.tablename = expected.tablename
  );
  if missing_count <> 0 then
    raise exception 'fund activity tables are missing from Realtime';
  end if;
end
$$;
