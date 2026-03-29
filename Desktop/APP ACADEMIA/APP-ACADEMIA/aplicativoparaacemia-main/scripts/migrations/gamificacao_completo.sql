-- Gamificação AlimentaAI — pontuação semanal, desafio, badges, RLS, RPCs
-- Executar no SQL Editor do Supabase (projeto já com `usuarios`, `treinos_realizados`, `refeicoes`, `metas_macros`).
-- Semana: segunda a domingo (ISODOW). Datas de actividade: fuso America/Sao_Paulo.
-- Ranking: um único grupo — todos os utilizadores com `ranking_opt_in = true` (sem tabela `academias`).
-- `gamificacao_pontos_semana.pontos` = só actividade (dias); bónus do desafio entra via `desafio_progresso.bonus_aplicado` + `desafio_semanal.bonus_pontos` no ranking.
-- Se já aplicou uma versão antiga com `academias`, rode antes: `gamificacao_remover_academias.sql`

-- ---------------------------------------------------------------------------
-- 1) Colunas em usuarios (gamificação / ranking)
-- ---------------------------------------------------------------------------
ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS display_name text;

ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS ranking_opt_in boolean NOT NULL DEFAULT true;

-- ---------------------------------------------------------------------------
-- 2) Tabelas de gamificação
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gamificacao_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  titulo text NOT NULL,
  descricao text,
  icone text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gamificacao_usuario_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  badge_id uuid NOT NULL REFERENCES public.gamificacao_badges(id) ON DELETE CASCADE,
  semana_inicio date,
  concedido_em timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_gamif_usuario_badges_lifetime
  ON public.gamificacao_usuario_badges (usuario_id, badge_id)
  WHERE semana_inicio IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_gamif_usuario_badges_semana
  ON public.gamificacao_usuario_badges (usuario_id, badge_id, semana_inicio)
  WHERE semana_inicio IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.gamificacao_desafio_semanal (
  semana_inicio date PRIMARY KEY,
  titulo text NOT NULL DEFAULT 'Desafio da semana',
  min_dias_atividade int NOT NULL DEFAULT 5,
  min_treinos int NOT NULL DEFAULT 2,
  min_dias_macros int NOT NULL DEFAULT 3,
  badge_slug text NOT NULL DEFAULT 'desafio_semana',
  bonus_pontos int NOT NULL DEFAULT 25,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gamificacao_desafio_progresso (
  usuario_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  semana_inicio date NOT NULL REFERENCES public.gamificacao_desafio_semanal(semana_inicio) ON DELETE CASCADE,
  dias_atividade int NOT NULL DEFAULT 0,
  treinos_semana int NOT NULL DEFAULT 0,
  dias_macros int NOT NULL DEFAULT 0,
  completo boolean NOT NULL DEFAULT false,
  bonus_aplicado boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (usuario_id, semana_inicio)
);

CREATE TABLE IF NOT EXISTS public.gamificacao_dia_resumo (
  usuario_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  dia date NOT NULL,
  semana_inicio date NOT NULL,
  treinos_no_dia int NOT NULL DEFAULT 0,
  refeicoes_no_dia int NOT NULL DEFAULT 0,
  macros_no_alvo boolean NOT NULL DEFAULT false,
  pontos_consistencia int NOT NULL DEFAULT 0,
  pontos_macros int NOT NULL DEFAULT 0,
  pontos_treino int NOT NULL DEFAULT 0,
  pontos_total int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (usuario_id, dia)
);

CREATE INDEX IF NOT EXISTS ix_gamif_dia_resumo_semana ON public.gamificacao_dia_resumo (usuario_id, semana_inicio);

CREATE TABLE IF NOT EXISTS public.gamificacao_pontos_semana (
  usuario_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  semana_inicio date NOT NULL,
  pontos int NOT NULL DEFAULT 0,
  detalhe jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (usuario_id, semana_inicio)
);

INSERT INTO public.gamificacao_badges (slug, titulo, descricao, icone)
VALUES
  ('primeiro_treino', 'Primeiro treino', 'Concluiu o primeiro treino registado no app.', '🏋️'),
  ('desafio_semana', 'Campeão da semana', 'Completou o desafio semanal (actividade, treinos e macros).', '🏆'),
  ('quatro_refeicoes_dia', '4 refeições no dia', 'Registou pelo menos 4 refeições no mesmo dia.', '🍽️')
ON CONFLICT (slug) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3) Funções internas
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.gamificacao_semana_inicio(p_dia date)
RETURNS date
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT (p_dia - (EXTRACT(ISODOW FROM p_dia)::int - 1))::date;
$$;

CREATE OR REPLACE FUNCTION public.gamificacao_ensure_desafio(p_semana date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.gamificacao_desafio_semanal (semana_inicio, titulo, badge_slug)
  VALUES (p_semana, 'Desafio da semana', 'desafio_semana')
  ON CONFLICT (semana_inicio) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.gamificacao_pontos_ranking(p_usuario_id uuid, p_semana date)
RETURNS int
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    coalesce(g.pontos, 0)
    + CASE
        WHEN dp.bonus_aplicado THEN coalesce(d.bonus_pontos, 0)
        ELSE 0
      END
  FROM public.usuarios u
  LEFT JOIN public.gamificacao_pontos_semana g
    ON g.usuario_id = u.id AND g.semana_inicio = p_semana
  LEFT JOIN public.gamificacao_desafio_progresso dp
    ON dp.usuario_id = u.id AND dp.semana_inicio = p_semana
  LEFT JOIN public.gamificacao_desafio_semanal d ON d.semana_inicio = p_semana
  WHERE u.id = p_usuario_id
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.gamificacao_recalc_usuario_dia(p_usuario_id uuid, p_dia date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_semana date;
  v_treinos int;
  v_refeicoes int;
  v_kcal_sum numeric := 0;
  v_prot_sum numeric := 0;
  v_meta_kcal numeric := 0;
  v_meta_prot numeric := 0;
  v_macros_ok boolean := false;
  v_consistencia int := 0;
  v_macros_pts int := 0;
  v_treino_pts int := 0;
  v_total int := 0;
BEGIN
  v_semana := public.gamificacao_semana_inicio(p_dia);

  SELECT count(*)::int INTO v_treinos
  FROM public.treinos_realizados tr
  WHERE tr.usuario_id = p_usuario_id
    AND tr.concluido = true
    AND (COALESCE(tr.data_hora, now()) AT TIME ZONE 'America/Sao_Paulo')::date = p_dia;

  SELECT count(*)::int INTO v_refeicoes
  FROM public.refeicoes rf
  WHERE rf.usuario_id = p_usuario_id
    AND (rf.data_hora AT TIME ZONE 'America/Sao_Paulo')::date = p_dia;

  IF v_refeicoes > 0 THEN
    SELECT
      COALESCE(sum(COALESCE(rf.kcal, rf.calorias, rf.calorias_kcal, 0::numeric)), 0),
      COALESCE(sum(COALESCE(rf.proteina_g, rf.proteina, rf.proteinas_g, 0::numeric)), 0)
    INTO v_kcal_sum, v_prot_sum
    FROM public.refeicoes rf
    WHERE rf.usuario_id = p_usuario_id
      AND (rf.data_hora AT TIME ZONE 'America/Sao_Paulo')::date = p_dia;
  END IF;

  SELECT
    COALESCE(m.calorias_kcal, m.kcal_meta, m.meta_kcal, m.kcal_diaria, m.calorias_meta, 0::numeric),
    COALESCE(m.proteina_meta, m.meta_proteina, m.proteina_g, 0::numeric)
  INTO v_meta_kcal, v_meta_prot
  FROM public.metas_macros m
  WHERE m.usuario_id = p_usuario_id
  ORDER BY m.data_referencia DESC NULLS LAST
  LIMIT 1;

  v_meta_kcal := COALESCE(v_meta_kcal, 0);
  v_meta_prot := COALESCE(v_meta_prot, 0);

  IF v_refeicoes > 0 AND (v_meta_kcal > 0 OR v_meta_prot > 0) THEN
    v_macros_ok := true;
    IF v_meta_kcal > 0 THEN
      IF v_kcal_sum < v_meta_kcal * 0.9 OR v_kcal_sum > v_meta_kcal * 1.1 THEN
        v_macros_ok := false;
      END IF;
    END IF;
    IF v_meta_prot > 0 THEN
      IF v_prot_sum < v_meta_prot * 0.9 OR v_prot_sum > v_meta_prot * 1.1 THEN
        v_macros_ok := false;
      END IF;
    END IF;
  ELSE
    v_macros_ok := false;
  END IF;

  IF v_treinos > 0 OR v_refeicoes > 0 THEN
    v_consistencia := 10;
  ELSE
    v_consistencia := 0;
  END IF;

  v_macros_pts := CASE WHEN v_macros_ok THEN 15 ELSE 0 END;
  v_treino_pts := 20 * LEAST(GREATEST(v_treinos, 0), 2);
  v_total := v_consistencia + v_macros_pts + v_treino_pts;

  INSERT INTO public.gamificacao_dia_resumo (
    usuario_id, dia, semana_inicio, treinos_no_dia, refeicoes_no_dia, macros_no_alvo,
    pontos_consistencia, pontos_macros, pontos_treino, pontos_total, updated_at
  ) VALUES (
    p_usuario_id, p_dia, v_semana, v_treinos, v_refeicoes, v_macros_ok,
    v_consistencia, v_macros_pts, v_treino_pts, v_total, now()
  )
  ON CONFLICT (usuario_id, dia) DO UPDATE SET
    semana_inicio = excluded.semana_inicio,
    treinos_no_dia = excluded.treinos_no_dia,
    refeicoes_no_dia = excluded.refeicoes_no_dia,
    macros_no_alvo = excluded.macros_no_alvo,
    pontos_consistencia = excluded.pontos_consistencia,
    pontos_macros = excluded.pontos_macros,
    pontos_treino = excluded.pontos_treino,
    pontos_total = excluded.pontos_total,
    updated_at = now();

  PERFORM public.gamificacao_refresh_pontos_semana(p_usuario_id, v_semana);
END;
$$;

CREATE OR REPLACE FUNCTION public.gamificacao_refresh_pontos_semana(p_usuario_id uuid, p_semana date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sum int;
  v_dias int;
BEGIN
  PERFORM public.gamificacao_ensure_desafio(p_semana);

  SELECT
    COALESCE(sum(d.pontos_total), 0)::int,
    COUNT(*)::int
  INTO v_sum, v_dias
  FROM public.gamificacao_dia_resumo d
  WHERE d.usuario_id = p_usuario_id
    AND d.semana_inicio = p_semana;

  INSERT INTO public.gamificacao_pontos_semana (usuario_id, semana_inicio, pontos, detalhe, updated_at)
  VALUES (
    p_usuario_id,
    p_semana,
    v_sum,
    jsonb_build_object('dias_com_resumo', v_dias, 'pontos_actividade', v_sum),
    now()
  )
  ON CONFLICT (usuario_id, semana_inicio) DO UPDATE SET
    pontos = excluded.pontos,
    detalhe = excluded.detalhe,
    updated_at = now();

  PERFORM public.gamificacao_update_desafio_progresso(p_usuario_id, p_semana);
END;
$$;

CREATE OR REPLACE FUNCTION public.gamificacao_update_desafio_progresso(p_usuario_id uuid, p_semana date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d record;
  p record;
  v_dias_act int;
  v_treinos int;
  v_dias_macros int;
  v_badge_id uuid;
  v_ok boolean;
  v_exists int;
BEGIN
  PERFORM public.gamificacao_ensure_desafio(p_semana);

  SELECT * INTO d FROM public.gamificacao_desafio_semanal WHERE semana_inicio = p_semana LIMIT 1;

  SELECT
    COUNT(*) FILTER (WHERE dr.treinos_no_dia > 0 OR dr.refeicoes_no_dia > 0)::int,
    COALESCE(sum(dr.treinos_no_dia), 0)::int,
    COUNT(*) FILTER (WHERE dr.macros_no_alvo)::int
  INTO v_dias_act, v_treinos, v_dias_macros
  FROM public.gamificacao_dia_resumo dr
  WHERE dr.usuario_id = p_usuario_id
    AND dr.semana_inicio = p_semana;

  INSERT INTO public.gamificacao_desafio_progresso (
    usuario_id, semana_inicio, dias_atividade, treinos_semana, dias_macros, completo, bonus_aplicado, updated_at
  ) VALUES (
    p_usuario_id, p_semana, v_dias_act, v_treinos, v_dias_macros, false, false, now()
  )
  ON CONFLICT (usuario_id, semana_inicio) DO UPDATE SET
    dias_atividade = excluded.dias_atividade,
    treinos_semana = excluded.treinos_semana,
    dias_macros = excluded.dias_macros,
    updated_at = now();

  SELECT * INTO p FROM public.gamificacao_desafio_progresso WHERE usuario_id = p_usuario_id AND semana_inicio = p_semana;

  IF p.completo OR p.bonus_aplicado THEN
    RETURN;
  END IF;

  v_ok := v_dias_act >= d.min_dias_atividade
    AND v_treinos >= d.min_treinos
    AND v_dias_macros >= d.min_dias_macros;

  IF NOT v_ok THEN
    RETURN;
  END IF;

  UPDATE public.gamificacao_desafio_progresso
  SET completo = true,
      bonus_aplicado = true,
      updated_at = now()
  WHERE usuario_id = p_usuario_id
    AND semana_inicio = p_semana;

  UPDATE public.gamificacao_pontos_semana
  SET detalhe = COALESCE(detalhe, '{}'::jsonb) || jsonb_build_object('bonus_desafio', d.bonus_pontos),
      updated_at = now()
  WHERE usuario_id = p_usuario_id
    AND semana_inicio = p_semana;

  SELECT id INTO v_badge_id FROM public.gamificacao_badges WHERE slug = d.badge_slug LIMIT 1;

  IF v_badge_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_exists
    FROM public.gamificacao_usuario_badges
    WHERE usuario_id = p_usuario_id
      AND badge_id = v_badge_id
      AND semana_inicio = p_semana;

    IF v_exists = 0 THEN
      INSERT INTO public.gamificacao_usuario_badges (usuario_id, badge_id, semana_inicio, concedido_em)
      VALUES (p_usuario_id, v_badge_id, p_semana, now());
    END IF;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.gamificacao_award_primeiro_treino(p_usuario_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_n int;
  v_badge_id uuid;
  v_exists int;
BEGIN
  SELECT COUNT(*)::int INTO v_n FROM public.treinos_realizados WHERE usuario_id = p_usuario_id AND concluido = true;
  IF v_n != 1 THEN
    RETURN;
  END IF;

  SELECT id INTO v_badge_id FROM public.gamificacao_badges WHERE slug = 'primeiro_treino' LIMIT 1;
  IF v_badge_id IS NULL THEN
    RETURN;
  END IF;

  SELECT COUNT(*) INTO v_exists
  FROM public.gamificacao_usuario_badges
  WHERE usuario_id = p_usuario_id AND badge_id = v_badge_id AND semana_inicio IS NULL;

  IF v_exists > 0 THEN
    RETURN;
  END IF;

  INSERT INTO public.gamificacao_usuario_badges (usuario_id, badge_id, semana_inicio, concedido_em)
  VALUES (p_usuario_id, v_badge_id, NULL, now());
END;
$$;

CREATE OR REPLACE FUNCTION public.gamificacao_award_quatro_refeicoes_dia(p_usuario_id uuid, p_dia date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_n int;
  v_badge_id uuid;
  v_exists int;
BEGIN
  SELECT count(*)::int INTO v_n
  FROM public.refeicoes rf
  WHERE rf.usuario_id = p_usuario_id
    AND (rf.data_hora AT TIME ZONE 'America/Sao_Paulo')::date = p_dia;

  IF v_n < 4 THEN
    RETURN;
  END IF;

  SELECT id INTO v_badge_id FROM public.gamificacao_badges WHERE slug = 'quatro_refeicoes_dia' LIMIT 1;
  IF v_badge_id IS NULL THEN
    RETURN;
  END IF;

  SELECT COUNT(*) INTO v_exists
  FROM public.gamificacao_usuario_badges
  WHERE usuario_id = p_usuario_id AND badge_id = v_badge_id AND semana_inicio IS NULL;

  IF v_exists > 0 THEN
    RETURN;
  END IF;

  INSERT INTO public.gamificacao_usuario_badges (usuario_id, badge_id, semana_inicio, concedido_em)
  VALUES (p_usuario_id, v_badge_id, NULL, now());
END;
$$;

CREATE OR REPLACE FUNCTION public.gamificacao_trg_treino_fn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dia date;
BEGIN
  v_dia := (COALESCE(NEW.data_hora, now()) AT TIME ZONE 'America/Sao_Paulo')::date;
  PERFORM public.gamificacao_recalc_usuario_dia(NEW.usuario_id, v_dia);
  IF NEW.concluido IS TRUE THEN
    PERFORM public.gamificacao_award_primeiro_treino(NEW.usuario_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS gamificacao_trg_treino ON public.treinos_realizados;
CREATE TRIGGER gamificacao_trg_treino
  AFTER INSERT ON public.treinos_realizados
  FOR EACH ROW
  EXECUTE FUNCTION public.gamificacao_trg_treino_fn();

CREATE OR REPLACE FUNCTION public.gamificacao_trg_refeicao_fn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dia date;
BEGIN
  v_dia := (NEW.data_hora AT TIME ZONE 'America/Sao_Paulo')::date;
  PERFORM public.gamificacao_recalc_usuario_dia(NEW.usuario_id, v_dia);
  PERFORM public.gamificacao_award_quatro_refeicoes_dia(NEW.usuario_id, v_dia);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS gamificacao_trg_refeicao ON public.refeicoes;
CREATE TRIGGER gamificacao_trg_refeicao
  AFTER INSERT ON public.refeicoes
  FOR EACH ROW
  EXECUTE FUNCTION public.gamificacao_trg_refeicao_fn();

-- ---------------------------------------------------------------------------
-- 4) RPCs (cliente)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_gamificacao_resumo()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_semana date;
  v_hoje date;
  v_act int;
  v_det jsonb;
  v_dp record;
  v_des record;
  v_pos bigint;
  v_participantes bigint;
  v_total int;
  v_bonus int;
  v_opt_in boolean;
BEGIN
  SELECT u.id, u.ranking_opt_in
  INTO v_uid, v_opt_in
  FROM public.usuarios u
  WHERE u.auth_user_id = auth.uid()
  LIMIT 1;

  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'usuario_nao_encontrado');
  END IF;

  v_hoje := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_semana := public.gamificacao_semana_inicio(v_hoje);

  PERFORM public.gamificacao_recalc_usuario_dia(v_uid, v_hoje);

  SELECT gps.pontos, COALESCE(gps.detalhe, '{}'::jsonb)
  INTO v_act, v_det
  FROM public.gamificacao_pontos_semana gps
  WHERE gps.usuario_id = v_uid AND gps.semana_inicio = v_semana;

  IF NOT FOUND THEN
    v_act := 0;
    v_det := '{}'::jsonb;
  END IF;

  SELECT * INTO v_dp FROM public.gamificacao_desafio_progresso WHERE usuario_id = v_uid AND semana_inicio = v_semana;
  SELECT * INTO v_des FROM public.gamificacao_desafio_semanal WHERE semana_inicio = v_semana;

  v_bonus := 0;
  IF v_dp.usuario_id IS NOT NULL AND v_dp.bonus_aplicado THEN
    v_bonus := COALESCE(v_des.bonus_pontos, 0);
  END IF;
  v_total := COALESCE(v_act, 0) + v_bonus;

  IF v_opt_in THEN
    SELECT COUNT(*) INTO v_participantes
    FROM public.usuarios u2
    WHERE u2.ranking_opt_in = true;

    SELECT COUNT(*) + 1 INTO v_pos
    FROM public.usuarios u2
    WHERE u2.ranking_opt_in = true
      AND public.gamificacao_pontos_ranking(u2.id, v_semana) > v_total;
  ELSE
    v_participantes := 0;
    v_pos := 0;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'semana_inicio', v_semana,
    'pontos_semana', v_total,
    'pontos_actividade', COALESCE(v_act, 0),
    'pontos_bonus_desafio', v_bonus,
    'detalhe', v_det,
    'ranking_opt_in', v_opt_in,
    'posicao_ranking', v_pos,
    'participantes_ranking', v_participantes,
    'desafio', jsonb_build_object(
      'titulo', COALESCE(v_des.titulo, 'Desafio da semana'),
      'min_dias_atividade', COALESCE(v_des.min_dias_atividade, 5),
      'min_treinos', COALESCE(v_des.min_treinos, 2),
      'min_dias_macros', COALESCE(v_des.min_dias_macros, 3),
      'bonus_pontos', COALESCE(v_des.bonus_pontos, 25),
      'progresso', CASE WHEN v_dp.usuario_id IS NULL THEN NULL ELSE jsonb_build_object(
        'dias_atividade', v_dp.dias_atividade,
        'treinos_semana', v_dp.treinos_semana,
        'dias_macros', v_dp.dias_macros,
        'completo', v_dp.completo
      ) END
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_gamificacao_leaderboard(p_limit integer DEFAULT 20)
RETURNS TABLE (
  posicao bigint,
  usuario_id uuid,
  display_label text,
  pontos integer
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (
    SELECT u.ranking_opt_in
    FROM public.usuarios u
    WHERE u.auth_user_id = auth.uid()
    LIMIT 1
  ),
  sem AS (
    SELECT public.gamificacao_semana_inicio((now() AT TIME ZONE 'America/Sao_Paulo')::date) AS s
  ),
  ranked AS (
    SELECT
      u.id AS uid,
      public.gamificacao_pontos_ranking(u.id, sem.s) AS pts
    FROM public.usuarios u
    CROSS JOIN sem
    WHERE u.ranking_opt_in = true
      AND (SELECT ranking_opt_in FROM me) = true
  )
  SELECT
    row_number() OVER (ORDER BY r.pts DESC, r.uid) AS posicao,
    r.uid AS usuario_id,
    COALESCE(
      NULLIF(trim(u.display_name), ''),
      NULLIF(split_part(trim(COALESCE(u.email, '')), '@', 1), ''),
      'Aluno'
    ) AS display_label,
    r.pts::integer AS pontos
  FROM ranked r
  JOIN public.usuarios u ON u.id = r.uid
  WHERE r.pts > 0
  ORDER BY r.pts DESC, r.uid
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 20), 50));
$$;

CREATE OR REPLACE FUNCTION public.rpc_gamificacao_set_ranking_opt_in(p_opt_in boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.usuarios
  SET ranking_opt_in = p_opt_in
  WHERE auth_user_id = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_gamificacao_set_display_name(p_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.usuarios
  SET display_name = LEFT(NULLIF(trim(p_name), ''), 80)
  WHERE auth_user_id = auth.uid();
END;
$$;

-- ---------------------------------------------------------------------------
-- 5) RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.gamificacao_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gamificacao_usuario_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gamificacao_desafio_semanal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gamificacao_desafio_progresso ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gamificacao_dia_resumo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gamificacao_pontos_semana ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gamif_badges_read ON public.gamificacao_badges;
CREATE POLICY gamif_badges_read ON public.gamificacao_badges FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS gamif_desafio_def_read ON public.gamificacao_desafio_semanal;
CREATE POLICY gamif_desafio_def_read ON public.gamificacao_desafio_semanal FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS gamif_ub_read_own ON public.gamificacao_usuario_badges;
CREATE POLICY gamif_ub_read_own ON public.gamificacao_usuario_badges
  FOR SELECT TO authenticated
  USING (
    usuario_id IN (SELECT u2.id FROM public.usuarios u2 WHERE u2.auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS gamif_dp_read_own ON public.gamificacao_desafio_progresso;
CREATE POLICY gamif_dp_read_own ON public.gamificacao_desafio_progresso
  FOR SELECT TO authenticated
  USING (
    usuario_id IN (SELECT u2.id FROM public.usuarios u2 WHERE u2.auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS gamif_dr_read_own ON public.gamificacao_dia_resumo;
CREATE POLICY gamif_dr_read_own ON public.gamificacao_dia_resumo
  FOR SELECT TO authenticated
  USING (
    usuario_id IN (SELECT u2.id FROM public.usuarios u2 WHERE u2.auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS gamif_ps_read_own ON public.gamificacao_pontos_semana;
CREATE POLICY gamif_ps_read_own ON public.gamificacao_pontos_semana
  FOR SELECT TO authenticated
  USING (
    usuario_id IN (SELECT u2.id FROM public.usuarios u2 WHERE u2.auth_user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 6) Grants
-- ---------------------------------------------------------------------------
GRANT SELECT ON public.gamificacao_badges TO authenticated;
GRANT SELECT ON public.gamificacao_usuario_badges TO authenticated;
GRANT SELECT ON public.gamificacao_desafio_semanal TO authenticated;
GRANT SELECT ON public.gamificacao_desafio_progresso TO authenticated;
GRANT SELECT ON public.gamificacao_dia_resumo TO authenticated;
GRANT SELECT ON public.gamificacao_pontos_semana TO authenticated;

GRANT EXECUTE ON FUNCTION public.rpc_gamificacao_resumo() TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_gamificacao_leaderboard(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_gamificacao_set_ranking_opt_in(boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_gamificacao_set_display_name(text) TO authenticated;
