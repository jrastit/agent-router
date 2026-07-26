alter table public.llm_instances
  add column input_price_eur_per_million_tokens numeric(18, 6),
  add column output_price_eur_per_million_tokens numeric(18, 6);

alter table public.llm_instances
  add constraint llm_instances_input_token_price_nonnegative
    check (
      input_price_eur_per_million_tokens is null
      or input_price_eur_per_million_tokens >= 0
    ),
  add constraint llm_instances_output_token_price_nonnegative
    check (
      output_price_eur_per_million_tokens is null
      or output_price_eur_per_million_tokens >= 0
    );

comment on column public.llm_instances.input_price_eur_per_million_tokens is
  'Exact EUR price for one million input tokens; null when the model is not token-priced.';

comment on column public.llm_instances.output_price_eur_per_million_tokens is
  'Exact EUR price for one million output tokens; null when the model is not token-priced.';
