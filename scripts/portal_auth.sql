-- Portal AlimentaAI: auth para personais e gestores
-- Execute no SQL Editor do Supabase

-- 1) Colunas necessárias em personais
ALTER TABLE public.personais
  ADD COLUMN IF NOT EXISTS auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'personal' CHECK (role IN ('personal', 'gestor')),
  ADD COLUMN IF NOT EXISTS avatar_url text;

CREATE UNIQUE INDEX IF NOT EXISTS personais_auth_user_id_idx ON public.personais(auth_user_id) WHERE auth_user_id IS NOT NULL;

-- 2) RLS para personais (leitura autenticada, escrita pelo próprio)
ALTER TABLE public.personais ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS personais_read ON public.personais;
CREATE POLICY personais_read ON public.personais
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS personais_update_own ON public.personais;
CREATE POLICY personais_update_own ON public.personais
  FOR UPDATE TO authenticated
  USING (auth_user_id = auth.uid());

-- 3) Vincula o seu usuário Supabase como gestor
-- Substitua 'seu@email.com' pelo e-mail do admin
-- UPDATE public.personais
--   SET auth_user_id = (SELECT id FROM auth.users WHERE email = 'seu@email.com'),
--       role = 'gestor'
--   WHERE email = 'seu@email.com';

-- Ou insira diretamente:
-- INSERT INTO public.personais (nome, email, auth_user_id, role)
-- SELECT 'Admin', 'seu@email.com', id, 'gestor'
-- FROM auth.users WHERE email = 'seu@email.com'
-- ON CONFLICT (email) DO UPDATE SET auth_user_id = EXCLUDED.auth_user_id, role = 'gestor';

-- 4) Vínculo de alunos (public.usuarios) com Auth + troca de senha obrigatória
ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS password_provisioned_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS usuarios_auth_user_id_idx
  ON public.usuarios(auth_user_id)
  WHERE auth_user_id IS NOT NULL;

-- 5) RLS mínima para alunos autenticados atualizarem sua própria flag
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS usuarios_read_auth ON public.usuarios;
CREATE POLICY usuarios_read_auth ON public.usuarios
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS usuarios_update_own_password_flag ON public.usuarios;
CREATE POLICY usuarios_update_own_password_flag ON public.usuarios
  FOR UPDATE TO authenticated
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

-- 6) Escopo de treinos: geral da academia (portal) e específico por aluno
ALTER TABLE public.treinos_plano
  ADD COLUMN IF NOT EXISTS tipo text;

UPDATE public.treinos_plano
SET tipo = 'user'
WHERE tipo IS NULL;

-- Ajustes de compatibilidade para dados legados:
-- 1) Sem usuario, mas com personal: tratar como treino geral
UPDATE public.treinos_plano
SET tipo = 'general'
WHERE usuario_id IS NULL
  AND personal_id IS NOT NULL
  AND tipo = 'user';

-- 2) Marcado como geral, mas vinculado a usuario: tratar como específico
UPDATE public.treinos_plano
SET tipo = 'user'
WHERE usuario_id IS NOT NULL
  AND tipo = 'general';

ALTER TABLE public.treinos_plano
  ALTER COLUMN tipo SET DEFAULT 'user';

ALTER TABLE public.treinos_plano
  ALTER COLUMN tipo SET NOT NULL;

ALTER TABLE public.treinos_plano
  DROP CONSTRAINT IF EXISTS treinos_plano_tipo_check;

ALTER TABLE public.treinos_plano
  ADD CONSTRAINT treinos_plano_tipo_check
  CHECK (tipo IN ('general', 'user'));

ALTER TABLE public.treinos_plano
  DROP CONSTRAINT IF EXISTS treinos_plano_tipo_integridade_check;

ALTER TABLE public.treinos_plano
  ADD CONSTRAINT treinos_plano_tipo_integridade_check
  CHECK (
    (tipo = 'general' AND personal_id IS NOT NULL AND usuario_id IS NULL)
    OR
    (tipo = 'user' AND usuario_id IS NOT NULL)
  ) NOT VALID;

-- 7) Gasto calorico estimado por treino (kcal)
ALTER TABLE public.treinos_plano
  ADD COLUMN IF NOT EXISTS gasto_calorico_kcal numeric;

-- 8) Estimativa estruturada: duracao prevista + gasto calorico estimado
ALTER TABLE public.treinos_plano
  ADD COLUMN IF NOT EXISTS duracao_prevista_min integer,
  ADD COLUMN IF NOT EXISTS gasto_calorico_estimado_kcal numeric;

-- Migra legado para a nova coluna estimada, quando aplicavel
UPDATE public.treinos_plano
SET gasto_calorico_estimado_kcal = gasto_calorico_kcal
WHERE gasto_calorico_estimado_kcal IS NULL
  AND gasto_calorico_kcal IS NOT NULL;

-- 9) Desafios semanais + conclusoes + integracao com gamificacao
CREATE TABLE IF NOT EXISTS public.desafios_semanais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  descricao text,
  data_inicio date NOT NULL,
  data_fim date NOT NULL,
  pontos integer NOT NULL DEFAULT 10 CHECK (pontos > 0),
  ativo boolean NOT NULL DEFAULT true,
  criado_por uuid REFERENCES public.personais(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT desafios_semanais_periodo_check CHECK (data_fim >= data_inicio)
);

CREATE INDEX IF NOT EXISTS desafios_semanais_periodo_idx
  ON public.desafios_semanais (ativo, data_inicio, data_fim);

CREATE TABLE IF NOT EXISTS public.desafios_semanais_conclusoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  desafio_id uuid NOT NULL REFERENCES public.desafios_semanais(id) ON DELETE CASCADE,
  usuario_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  concluido_em timestamptz NOT NULL DEFAULT now(),
  origem text NOT NULL DEFAULT 'autodeclarado' CHECK (origem IN ('autodeclarado', 'academia')),
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (desafio_id, usuario_id)
);

CREATE INDEX IF NOT EXISTS desafios_semanais_conclusoes_usuario_idx
  ON public.desafios_semanais_conclusoes (usuario_id, concluido_em DESC);

ALTER TABLE public.desafios_semanais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.desafios_semanais_conclusoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS desafios_semanais_read_auth ON public.desafios_semanais;
CREATE POLICY desafios_semanais_read_auth ON public.desafios_semanais
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS desafios_semanais_write_personal_gestor ON public.desafios_semanais;
CREATE POLICY desafios_semanais_write_personal_gestor ON public.desafios_semanais
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.personais p
      WHERE p.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.personais p
      WHERE p.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS desafios_semanais_conclusoes_read_auth ON public.desafios_semanais_conclusoes;
CREATE POLICY desafios_semanais_conclusoes_read_auth ON public.desafios_semanais_conclusoes
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS desafios_semanais_conclusoes_insert_own ON public.desafios_semanais_conclusoes;
CREATE POLICY desafios_semanais_conclusoes_insert_own ON public.desafios_semanais_conclusoes
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.usuarios u
      WHERE u.id = usuario_id
        AND u.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS desafios_semanais_conclusoes_insert_personal_gestor ON public.desafios_semanais_conclusoes;
CREATE POLICY desafios_semanais_conclusoes_insert_personal_gestor ON public.desafios_semanais_conclusoes
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.personais p
      WHERE p.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS desafios_semanais_conclusoes_delete_personal_gestor ON public.desafios_semanais_conclusoes;
CREATE POLICY desafios_semanais_conclusoes_delete_personal_gestor ON public.desafios_semanais_conclusoes
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.personais p
      WHERE p.auth_user_id = auth.uid()
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS gamificacao_pontos_semana_usuario_semana_idx
  ON public.gamificacao_pontos_semana (usuario_id, semana_inicio);

CREATE OR REPLACE FUNCTION public.fn_aplicar_pontos_desafio_semana()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_pontos integer;
  v_semana_inicio date;
BEGIN
  SELECT d.pontos
  INTO v_pontos
  FROM public.desafios_semanais d
  WHERE d.id = NEW.desafio_id;

  v_semana_inicio := date_trunc('week', NEW.concluido_em)::date;

  INSERT INTO public.gamificacao_pontos_semana (usuario_id, semana_inicio, pontos, detalhe)
  VALUES (
    NEW.usuario_id,
    v_semana_inicio,
    COALESCE(v_pontos, 0),
    jsonb_build_object('bonus_desafio', COALESCE(v_pontos, 0))
  )
  ON CONFLICT (usuario_id, semana_inicio)
  DO UPDATE SET
    pontos = public.gamificacao_pontos_semana.pontos + COALESCE(v_pontos, 0),
    detalhe = COALESCE(public.gamificacao_pontos_semana.detalhe, '{}'::jsonb)
      || jsonb_build_object(
        'bonus_desafio',
        COALESCE((public.gamificacao_pontos_semana.detalhe->>'bonus_desafio')::integer, 0) + COALESCE(v_pontos, 0)
      );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_aplicar_pontos_desafio_semana ON public.desafios_semanais_conclusoes;
CREATE TRIGGER trg_aplicar_pontos_desafio_semana
AFTER INSERT ON public.desafios_semanais_conclusoes
FOR EACH ROW
EXECUTE FUNCTION public.fn_aplicar_pontos_desafio_semana();
