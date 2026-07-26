set local role anon;

do $$
begin
  if exists (
    select 1 from public.llm_instances where not enabled
  ) then
    raise exception 'anonymous catalog exposed disabled model';
  end if;
  begin
    insert into public.llm_instances (
      provider, model_id, name, base_url, capabilities, privacy
    ) values (
      'unsafe', 'model', 'Unsafe', 'https://example.com/v1',
      array['chat'], 'public'
    );
    raise exception 'anonymous catalog write succeeded';
  exception when insufficient_privilege then null;
  end;
end
$$;

reset role;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.llm_instances'::regclass
      and contype = 'u'
  ) then
    raise exception 'llm instance provider/model uniqueness is missing';
  end if;
end
$$;
