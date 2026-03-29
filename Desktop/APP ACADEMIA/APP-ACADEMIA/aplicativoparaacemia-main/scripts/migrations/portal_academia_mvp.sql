-- =============================================================================
-- Portal Academia + Personal (MVP)
-- Pré-requisitos: public.usuarios, public.personais, public.treinos_plano (FK personal_id)
-- Executar no SQL Editor do Supabase.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) academias
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.academias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  slug text UNIQUE,
  timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.academias IS 'Unidade física; staff e alunos vinculam-se aqui.';

-- ---------------------------------------------------------------------------
-- 2) membros_portal (staff: gestor | personal)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.membros_portal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users (id) ON DELETE CASCADE,
  academia_id uuid NOT NULL REFERENCES public.academias (id) ON DELETE CASCADE,
  papel text NOT NULL CHECK (papel IN ('gestor', 'personal')),
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_membros_portal_academia ON public.membros_portal (academia_id);

COMMENT ON TABLE public.membros_portal IS 'Contas que acedem ao painel web (não alunos).';

-- ---------------------------------------------------------------------------
-- 3) personais.membro_portal_id (ligação login portal ↔ CREF)
-- ---------------------------------------------------------------------------
ALTER TABLE public.personais
  ADD COLUMN IF NOT EXISTS membro_portal_id uuid REFERENCES public.membros_portal (id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_personais_membro_portal_id
  ON public.personais (membro_portal_id)
  WHERE membro_portal_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 4) alunos_academia
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.alunos_academia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES public.usuarios (id) ON DELETE CASCADE,
  academia_id uuid NOT NULL REFERENCES public.academias (id) ON DELETE CASCADE,
  personal_principal_id uuid REFERENCES public.personais (id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('convite_pendente', 'ativo', 'inativo')),
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (usuario_id, academia_id)
);

CREATE INDEX IF NOT EXISTS ix_alunos_academia_academia ON public.alunos_academia (academia_id);
CREATE INDEX IF NOT EXISTS ix_alunos_academia_personal ON public.alunos_academia (personal_principal_id);

-- ---------------------------------------------------------------------------
-- 5) convites_aluno
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.convites_aluno (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  academia_id uuid NOT NULL REFERENCES public.academias (id) ON DELETE CASCADE,
  email text NOT NULL,
  token text NOT NULL UNIQUE,
  expira_em timestamptz NOT NULL,
  consumido_em timestamptz,
  usuario_id uuid REFERENCES public.usuarios (id) ON DELETE SET NULL,
  criado_por uuid NOT NULL REFERENCES public.membros_portal (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_convites_academia_email ON public.convites_aluno (academia_id, lower(email));

-- ---------------------------------------------------------------------------
-- 6) updated_at trigger (alunos_academia)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.portal_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_alunos_academia_updated ON public.alunos_academia;
CREATE TRIGGER trg_alunos_academia_updated
  BEFORE UPDATE ON public.alunos_academia
  FOR EACH ROW
  EXECUTE PROCEDURE public.portal_set_updated_at();

-- ---------------------------------------------------------------------------
-- 7) RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.academias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membros_portal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alunos_academia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.convites_aluno ENABLE ROW LEVEL SECURITY;

-- academias: staff da mesma unidade lê
DROP POLICY IF EXISTS academias_select_staff ON public.academias;
CREATE POLICY academias_select_staff
  ON public.academias
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.membros_portal mp
      WHERE mp.user_id = auth.uid()
        AND mp.ativo
        AND mp.academia_id = academias.id
    )
  );

-- membros_portal: cada um lê a própria linha
DROP POLICY IF EXISTS membros_portal_select_self ON public.membros_portal;
CREATE POLICY membros_portal_select_self
  ON public.membros_portal
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- membros do mesmo academia (gestor vê equipa) — útil para listar personais
DROP POLICY IF EXISTS membros_portal_select_same_academy ON public.membros_portal;
CREATE POLICY membros_portal_select_same_academy
  ON public.membros_portal
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.membros_portal me
      WHERE me.user_id = auth.uid()
        AND me.ativo
        AND me.papel = 'gestor'
        AND me.academia_id = membros_portal.academia_id
    )
  );

-- alunos_academia
DROP POLICY IF EXISTS alunos_academia_select_gestor ON public.alunos_academia;
CREATE POLICY alunos_academia_select_gestor
  ON public.alunos_academia
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.membros_portal mp
      WHERE mp.user_id = auth.uid()
        AND mp.ativo
        AND mp.papel = 'gestor'
        AND mp.academia_id = alunos_academia.academia_id
    )
  );

DROP POLICY IF EXISTS alunos_academia_select_personal ON public.alunos_academia;
CREATE POLICY alunos_academia_select_personal
  ON public.alunos_academia
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.membros_portal mp
      JOIN public.personais p ON p.membro_portal_id = mp.id
      WHERE mp.user_id = auth.uid()
        AND mp.ativo
        AND mp.papel = 'personal'
        AND mp.academia_id = alunos_academia.academia_id
        AND alunos_academia.personal_principal_id = p.id
    )
  );

DROP POLICY IF EXISTS alunos_academia_insert_staff ON public.alunos_academia;
CREATE POLICY alunos_academia_insert_staff
  ON public.alunos_academia
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.membros_portal mp
      WHERE mp.user_id = auth.uid()
        AND mp.ativo
        AND mp.academia_id = alunos_academia.academia_id
        AND (
          mp.papel = 'gestor'
          OR (
            mp.papel = 'personal'
            AND alunos_academia.personal_principal_id IN (
              SELECT p.id FROM public.personais p WHERE p.membro_portal_id = mp.id
            )
          )
        )
    )
  );

DROP POLICY IF EXISTS alunos_academia_update_staff ON public.alunos_academia;
CREATE POLICY alunos_academia_update_staff
  ON public.alunos_academia
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.membros_portal mp
      WHERE mp.user_id = auth.uid()
        AND mp.ativo
        AND mp.academia_id = alunos_academia.academia_id
        AND (
          mp.papel = 'gestor'
          OR (
            mp.papel = 'personal'
            AND alunos_academia.personal_principal_id IN (
              SELECT p.id FROM public.personais p WHERE p.membro_portal_id = mp.id
            )
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.membros_portal mp
      WHERE mp.user_id = auth.uid()
        AND mp.ativo
        AND mp.academia_id = alunos_academia.academia_id
        AND (
          mp.papel = 'gestor'
          OR (
            mp.papel = 'personal'
            AND alunos_academia.personal_principal_id IN (
              SELECT p.id FROM public.personais p WHERE p.membro_portal_id = mp.id
            )
          )
        )
    )
  );

-- convites_aluno
DROP POLICY IF EXISTS convites_select_staff ON public.convites_aluno;
CREATE POLICY convites_select_staff
  ON public.convites_aluno
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.membros_portal mp
      WHERE mp.user_id = auth.uid()
        AND mp.ativo
        AND mp.academia_id = convites_aluno.academia_id
    )
  );

DROP POLICY IF EXISTS convites_insert_staff ON public.convites_aluno;
CREATE POLICY convites_insert_staff
  ON public.convites_aluno
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.membros_portal mp
      WHERE mp.user_id = auth.uid()
        AND mp.ativo
        AND mp.academia_id = convites_aluno.academia_id
        AND mp.id = convites_aluno.criado_por
    )
  );

DROP POLICY IF EXISTS convites_update_staff ON public.convites_aluno;
CREATE POLICY convites_update_staff
  ON public.convites_aluno
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.membros_portal mp
      WHERE mp.user_id = auth.uid()
        AND mp.ativo
        AND mp.academia_id = convites_aluno.academia_id
    )
  );

-- ---------------------------------------------------------------------------
-- 8) Grants (authenticated)
-- ---------------------------------------------------------------------------
GRANT SELECT ON public.academias TO authenticated;
GRANT SELECT ON public.membros_portal TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.alunos_academia TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.convites_aluno TO authenticated;

-- Nota: inserções de membros_portal / academias costumam ser feitas com service role
-- ou SQL manual no primeiro deploy.
