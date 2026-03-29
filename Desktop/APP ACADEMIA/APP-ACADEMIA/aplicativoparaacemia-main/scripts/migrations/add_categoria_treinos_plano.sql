-- Categoria do plano para filtros e badge (chest | upper | legs).
alter table public.treinos_plano
  add column if not exists categoria text;

comment on column public.treinos_plano.categoria is
  'Slug alinhado ao app: chest (Peito), upper (Membros superiores), legs (Pernas)';

-- Atualiza registros ja seedados sem categoria (nomes do seed padrao)
update public.treinos_plano
set categoria = 'chest'
where nome = 'Peito + Triceps' and coalesce(nullif(trim(categoria), ''), '') = '';

update public.treinos_plano
set categoria = 'upper'
where nome = 'Costas + Biceps' and coalesce(nullif(trim(categoria), ''), '') = '';

update public.treinos_plano
set categoria = 'legs'
where nome = 'Pernas' and coalesce(nullif(trim(categoria), ''), '') = '';
