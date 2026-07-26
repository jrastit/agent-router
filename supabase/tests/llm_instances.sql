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

set local role service_role;

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'llm_instances'
      and column_name = 'input_price_eur_per_million_tokens'
      and data_type = 'numeric'
      and numeric_scale = 6
  ) or not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'llm_instances'
      and column_name = 'output_price_eur_per_million_tokens'
      and data_type = 'numeric'
      and numeric_scale = 6
  ) then
    raise exception 'exact LLM token price columns are missing';
  end if;
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'llm_instances'
      and column_name = 'performance_score'
      and data_type = 'smallint'
  ) then
    raise exception 'LLM performance score column is missing';
  end if;

  begin
    insert into public.llm_instances (
      provider, model_id, name, base_url, capabilities, privacy,
      input_price_eur_per_million_tokens
    ) values (
      'test', 'negative-price', 'Negative price',
      'https://example.com/v1', array['chat'], 'public', -0.000001
    );
    raise exception 'negative token price was accepted';
  exception when check_violation then null;
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
