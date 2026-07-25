alter table public.receipts
  add column hcs_topic_id text,
  add column hcs_sequence_number bigint check (hcs_sequence_number > 0),
  add column hcs_transaction_id text,
  add column hashscan_topic_url text,
  add column hashscan_transaction_url text;

create unique index receipts_hcs_sequence_unique
  on public.receipts(hcs_topic_id, hcs_sequence_number)
  where hcs_topic_id is not null and hcs_sequence_number is not null;
