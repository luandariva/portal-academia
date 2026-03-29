-- =============================================================================
-- treinos_plano: colunas usadas pelo PWA (rode inteiro no SQL Editor do Supabase)
-- =============================================================================

-- Aluno criou o plano no construtor do app
alter table public.treinos_plano
  add column if not exists criado_pelo_aluno boolean not null default false;

comment on column public.treinos_plano.criado_pelo_aluno is
  'true = montado pelo aluno no app; false = prescrito pelo personal / seed';

-- Slug para badge e filtros: chest | upper | legs
alter table public.treinos_plano
  add column if not exists categoria text;

comment on column public.treinos_plano.categoria is
  'chest = Peito, upper = Membros superiores, legs = Pernas';

-- Dados ja inseridos pelo seed (sem categoria)
update public.treinos_plano
set categoria = 'chest'
where nome = 'Peito + Triceps'
  and (categoria is null or btrim(categoria) = '');

update public.treinos_plano
set categoria = 'upper'
where nome = 'Costas + Biceps'
  and (categoria is null or btrim(categoria) = '');

update public.treinos_plano
set categoria = 'legs'
where nome = 'Pernas'
  and (categoria is null or btrim(categoria) = '');
