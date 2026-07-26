alter table public.llm_instances
  add column performance_score smallint check (
    performance_score between 0 and 100
  ),
  add column performance_score_basis text check (
    performance_score_basis is null
    or performance_score_basis = 'catalog-readiness-v1'
  );

comment on column public.llm_instances.performance_score is
  'Estimated agent performance/readiness score from 0 to 100; not a benchmark claim.';

comment on column public.llm_instances.performance_score_basis is
  'Versioned deterministic basis used to derive performance_score.';
