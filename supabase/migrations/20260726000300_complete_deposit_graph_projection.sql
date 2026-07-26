alter table public.hedera_projection_cursors
  drop constraint hedera_projection_cursors_stream_id_check;
alter table public.hedera_projection_cursors
  add constraint hedera_projection_cursors_stream_id_check check (
    stream_id ~ '^(contract_log|hcs_message|native_transfer):[0-9]+\.[0-9]+\.[0-9]+$'
  );

create function public.complete_deposit_graph_projection(
  target_deposit_id text,
  target_source_event_id text,
  transaction_hash text,
  destination_block bigint
) returns public.deposits
language plpgsql security definer set search_path = ''
as $$
declare
  saved public.deposits;
begin
  if not exists (
    select 1
    from public.verified_hedera_projection_events event
    where event.source_event_id = target_source_event_id
      and event.deposit_id = target_deposit_id
      and event.state = 'confirmed'
      and event.destination_transaction_hash = transaction_hash
      and event.destination_block_number = destination_block
  ) then
    raise exception 'confirmed projection evidence mismatch' using errcode = 'P0001';
  end if;

  update public.monitoring_projection_outbox
  set delivered_at = coalesce(delivered_at, now()), last_error = null
  where deposit_id = target_deposit_id;

  update public.deposits
  set projection_state = 'projected', graph_state = 'indexed',
      projected_at = coalesce(projected_at, now()),
      indexed_at = coalesce(indexed_at, now()), updated_at = now()
  where id = target_deposit_id and state = 'credited'
  returning * into saved;
  if not found then
    raise exception 'credited deposit not found' using errcode = 'P0002';
  end if;
  return saved;
end
$$;

revoke all on function public.complete_deposit_graph_projection(
  text, text, text, bigint
) from public, anon, authenticated;
grant execute on function public.complete_deposit_graph_projection(
  text, text, text, bigint
) to service_role;
