-- Marca treinos criados pelo proprio aluno (ex.: construtor do app).
-- Execute uma vez no SQL Editor do Supabase apos criar treinos_plano.

alter table public.treinos_plano
  add column if not exists criado_pelo_aluno boolean not null default false;

comment on column public.treinos_plano.criado_pelo_aluno is
  'true = montado pelo aluno no app; false = prescrito pelo personal / seed';
