-- Treinos de catálogo da academia (sem aluno vinculado), visíveis no app aos alunos ativos da mesma unidade.
-- Executar no SQL Editor do Supabase após `portal_academia_mvp.sql` (tabela `academias`).

ALTER TABLE public.treinos_plano
  ADD COLUMN IF NOT EXISTS catalogo boolean NOT NULL DEFAULT false;

ALTER TABLE public.treinos_plano
  ADD COLUMN IF NOT EXISTS academia_id uuid REFERENCES public.academias (id) ON DELETE CASCADE;

COMMENT ON COLUMN public.treinos_plano.catalogo IS 'Quando true, o plano é modelo da academia (usuario_id nulo); alunos da mesma academia veem no app.';
COMMENT ON COLUMN public.treinos_plano.academia_id IS 'Unidade do catálogo; obrigatório quando catalogo = true.';

-- Planos por aluno continuam com usuario_id obrigatório; catálogo usa usuario_id NULL.
ALTER TABLE public.treinos_plano
  ALTER COLUMN usuario_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS ix_treinos_plano_catalogo_academia
  ON public.treinos_plano (academia_id)
  WHERE catalogo = true;

ALTER TABLE public.treinos_plano
  DROP CONSTRAINT IF EXISTS treinos_plano_catalogo_chk;

ALTER TABLE public.treinos_plano
  ADD CONSTRAINT treinos_plano_catalogo_chk
  CHECK (
    (catalogo = false AND usuario_id IS NOT NULL)
    OR
    (catalogo = true AND usuario_id IS NULL AND academia_id IS NOT NULL)
  );

-- Coluna usada na política seguinte. Se não existir, o Postgres falha ao avaliar RLS e o REST devolve 500 no GET.
ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS auth_user_id uuid;

COMMENT ON COLUMN public.usuarios.auth_user_id IS 'auth.users.id quando o id da linha em usuarios é distinto do login Supabase.';

-- Aluno autenticado vê o próprio vínculo (necessário para listar treinos de catálogo da unidade no app).
DROP POLICY IF EXISTS alunos_academia_select_aluno_self ON public.alunos_academia;
CREATE POLICY alunos_academia_select_aluno_self
  ON public.alunos_academia
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.usuarios u
      WHERE u.id = alunos_academia.usuario_id
        AND (u.auth_user_id = auth.uid() OR u.id = auth.uid())
    )
  );

-- Opcional (se já usar RLS em treinos_plano): política de leitura dos modelos da academia.
-- Não ative RLS só com isto sem políticas para os planos do próprio aluno (usuario_id).
--
-- DROP POLICY IF EXISTS treinos_plano_select_catalogo_mesma_academia ON public.treinos_plano;
-- CREATE POLICY treinos_plano_select_catalogo_mesma_academia
--   ON public.treinos_plano FOR SELECT TO authenticated
--   USING (
--     catalogo = true AND academia_id IS NOT NULL
--     AND EXISTS (
--       SELECT 1 FROM public.alunos_academia aa
--       INNER JOIN public.usuarios u ON u.id = aa.usuario_id
--       WHERE aa.academia_id = treinos_plano.academia_id AND aa.status = 'ativo'
--         AND (u.auth_user_id = auth.uid() OR u.id = auth.uid())
--     )
--   );
