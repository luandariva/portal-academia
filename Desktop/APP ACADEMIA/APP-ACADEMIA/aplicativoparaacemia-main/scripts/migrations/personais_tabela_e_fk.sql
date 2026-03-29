-- Tabela de personais (educadores físicos) e vínculo com treinos_plano
-- Execute no SQL Editor do Supabase após já existir public.treinos_plano.

-- ---------------------------------------------------------------------------
-- 1) Tabela personais
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.personais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  email text UNIQUE,
  cref text,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.personais IS 'Profissionais que prescrevem treinos (ligação opcional em treinos_plano.personal_id)';

-- ---------------------------------------------------------------------------
-- 2) Acessos e RLS (leitura para utilizadores autenticados no PWA)
-- ---------------------------------------------------------------------------
ALTER TABLE public.personais ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS personais_select_authenticated ON public.personais;
CREATE POLICY personais_select_authenticated
  ON public.personais
  FOR SELECT
  TO authenticated
  USING (true);

GRANT SELECT ON public.personais TO authenticated;

-- ---------------------------------------------------------------------------
-- 3) FK: personal_id → personais(id)
-- ---------------------------------------------------------------------------
UPDATE public.treinos_plano tp
SET personal_id = NULL
WHERE tp.personal_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.personais p WHERE p.id = tp.personal_id
  );

ALTER TABLE public.treinos_plano
  DROP CONSTRAINT IF EXISTS treinos_plano_personal_id_fkey;

ALTER TABLE public.treinos_plano
  ADD CONSTRAINT treinos_plano_personal_id_fkey
  FOREIGN KEY (personal_id) REFERENCES public.personais(id) ON DELETE SET NULL;
