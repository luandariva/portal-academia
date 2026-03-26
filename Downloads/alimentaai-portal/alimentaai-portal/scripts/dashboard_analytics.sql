-- Dashboard Executivo AlimentaAI
-- Execute este arquivo no SQL Editor do Supabase.
-- Objetivo: consolidar metricas de negocio/engajamento para o dashboard.

CREATE OR REPLACE FUNCTION public.rpc_dashboard_exec_summary(p_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_days integer := GREATEST(COALESCE(p_days, 30), 1);
  v_since_ts timestamptz := now() - make_interval(days => v_days);
  v_since_date date := (now() - make_interval(days => v_days))::date;
  v_total_alunos integer := 0;
  v_ativos_7d integer := 0;
  v_sem_atividade integer := 0;
  v_risco_alto integer := 0;
  v_risco_medio integer := 0;
  v_risco_baixo integer := 0;
  v_treinos_prescritos integer := 0;
  v_treinos_realizados integer := 0;
  v_desafios_ativos integer := 0;
  v_desafio_participantes integer := 0;
  v_refeicao_participantes integer := 0;
  v_refeicao_date_col text := null;
  v_pct_desafio numeric := 0;
  v_pct_refeicao numeric := 0;
  v_pct_ativos_7d numeric := 0;
  v_by_tipo jsonb := '[]'::jsonb;
  v_by_personal jsonb := '[]'::jsonb;
BEGIN
  IF to_regclass('public.usuarios') IS NOT NULL THEN
    SELECT COUNT(*)::int INTO v_total_alunos FROM public.usuarios;
  END IF;

  CREATE TEMP TABLE tmp_activity_agg (
    usuario_id uuid PRIMARY KEY,
    last_activity_at timestamptz,
    activities_7d integer NOT NULL DEFAULT 0
  ) ON COMMIT DROP;

  -- Treinos realizados
  IF to_regclass('public.treinos_realizados') IS NOT NULL THEN
    INSERT INTO tmp_activity_agg (usuario_id, last_activity_at, activities_7d)
    SELECT
      tr.usuario_id,
      MAX(tr.data_hora) AS last_activity_at,
      COUNT(*) FILTER (WHERE tr.data_hora >= now() - interval '7 day')::int AS activities_7d
    FROM public.treinos_realizados tr
    WHERE tr.usuario_id IS NOT NULL
    GROUP BY tr.usuario_id
    ON CONFLICT (usuario_id) DO UPDATE SET
      last_activity_at = GREATEST(tmp_activity_agg.last_activity_at, EXCLUDED.last_activity_at),
      activities_7d = tmp_activity_agg.activities_7d + EXCLUDED.activities_7d;
  END IF;

  -- Conclusoes de desafios
  IF to_regclass('public.desafios_semanais_conclusoes') IS NOT NULL THEN
    INSERT INTO tmp_activity_agg (usuario_id, last_activity_at, activities_7d)
    SELECT
      dc.usuario_id,
      MAX(dc.concluido_em) AS last_activity_at,
      COUNT(*) FILTER (WHERE dc.concluido_em >= now() - interval '7 day')::int AS activities_7d
    FROM public.desafios_semanais_conclusoes dc
    WHERE dc.usuario_id IS NOT NULL
    GROUP BY dc.usuario_id
    ON CONFLICT (usuario_id) DO UPDATE SET
      last_activity_at = GREATEST(tmp_activity_agg.last_activity_at, EXCLUDED.last_activity_at),
      activities_7d = tmp_activity_agg.activities_7d + EXCLUDED.activities_7d;
  END IF;

  -- Refeicoes com coluna de data dinamica
  IF to_regclass('public.refeicoes') IS NOT NULL THEN
    SELECT c.column_name
    INTO v_refeicao_date_col
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'refeicoes'
      AND c.column_name IN ('data_hora', 'created_at', 'data_ref', 'data', 'concluido_em')
    ORDER BY CASE c.column_name
      WHEN 'data_hora' THEN 1
      WHEN 'created_at' THEN 2
      WHEN 'data_ref' THEN 3
      WHEN 'data' THEN 4
      WHEN 'concluido_em' THEN 5
      ELSE 99
    END
    LIMIT 1;

    IF v_refeicao_date_col IS NOT NULL THEN
      EXECUTE format(
        'INSERT INTO tmp_activity_agg (usuario_id, last_activity_at, activities_7d)
         SELECT
           r.usuario_id,
           MAX((r.%1$I)::timestamptz) AS last_activity_at,
           COUNT(*) FILTER (WHERE (r.%1$I)::timestamptz >= now() - interval ''7 day'')::int AS activities_7d
         FROM public.refeicoes r
         WHERE r.usuario_id IS NOT NULL
         GROUP BY r.usuario_id
         ON CONFLICT (usuario_id) DO UPDATE SET
           last_activity_at = GREATEST(tmp_activity_agg.last_activity_at, EXCLUDED.last_activity_at),
           activities_7d = tmp_activity_agg.activities_7d + EXCLUDED.activities_7d;',
        v_refeicao_date_col
      );
    END IF;
  END IF;

  -- Risco e atividade geral
  IF v_total_alunos > 0 THEN
    SELECT
      COUNT(*) FILTER (WHERE t.activities_7d > 0),
      COUNT(*) FILTER (WHERE t.last_activity_at IS NULL),
      COUNT(*) FILTER (
        WHERE
          CASE
            WHEN t.last_activity_at IS NULL THEN 95
            WHEN now() - t.last_activity_at <= interval '3 day' THEN GREATEST(0, 15 - CASE WHEN t.activities_7d >= 6 THEN 25 WHEN t.activities_7d >= 3 THEN 10 WHEN t.activities_7d <= 1 THEN -10 ELSE 0 END)
            WHEN now() - t.last_activity_at <= interval '7 day' THEN GREATEST(0, 35 - CASE WHEN t.activities_7d >= 6 THEN 25 WHEN t.activities_7d >= 3 THEN 10 WHEN t.activities_7d <= 1 THEN -10 ELSE 0 END)
            WHEN now() - t.last_activity_at <= interval '14 day' THEN GREATEST(0, 55 - CASE WHEN t.activities_7d >= 6 THEN 25 WHEN t.activities_7d >= 3 THEN 10 WHEN t.activities_7d <= 1 THEN -10 ELSE 0 END)
            WHEN now() - t.last_activity_at <= interval '21 day' THEN GREATEST(0, 75 - CASE WHEN t.activities_7d >= 6 THEN 25 WHEN t.activities_7d >= 3 THEN 10 WHEN t.activities_7d <= 1 THEN -10 ELSE 0 END)
            ELSE GREATEST(0, 90 - CASE WHEN t.activities_7d >= 6 THEN 25 WHEN t.activities_7d >= 3 THEN 10 WHEN t.activities_7d <= 1 THEN -10 ELSE 0 END)
          END >= 70
      ),
      COUNT(*) FILTER (
        WHERE
          CASE
            WHEN t.last_activity_at IS NULL THEN 95
            WHEN now() - t.last_activity_at <= interval '3 day' THEN GREATEST(0, 15 - CASE WHEN t.activities_7d >= 6 THEN 25 WHEN t.activities_7d >= 3 THEN 10 WHEN t.activities_7d <= 1 THEN -10 ELSE 0 END)
            WHEN now() - t.last_activity_at <= interval '7 day' THEN GREATEST(0, 35 - CASE WHEN t.activities_7d >= 6 THEN 25 WHEN t.activities_7d >= 3 THEN 10 WHEN t.activities_7d <= 1 THEN -10 ELSE 0 END)
            WHEN now() - t.last_activity_at <= interval '14 day' THEN GREATEST(0, 55 - CASE WHEN t.activities_7d >= 6 THEN 25 WHEN t.activities_7d >= 3 THEN 10 WHEN t.activities_7d <= 1 THEN -10 ELSE 0 END)
            WHEN now() - t.last_activity_at <= interval '21 day' THEN GREATEST(0, 75 - CASE WHEN t.activities_7d >= 6 THEN 25 WHEN t.activities_7d >= 3 THEN 10 WHEN t.activities_7d <= 1 THEN -10 ELSE 0 END)
            ELSE GREATEST(0, 90 - CASE WHEN t.activities_7d >= 6 THEN 25 WHEN t.activities_7d >= 3 THEN 10 WHEN t.activities_7d <= 1 THEN -10 ELSE 0 END)
          END BETWEEN 40 AND 69
      ),
      COUNT(*) FILTER (
        WHERE
          CASE
            WHEN t.last_activity_at IS NULL THEN 95
            WHEN now() - t.last_activity_at <= interval '3 day' THEN GREATEST(0, 15 - CASE WHEN t.activities_7d >= 6 THEN 25 WHEN t.activities_7d >= 3 THEN 10 WHEN t.activities_7d <= 1 THEN -10 ELSE 0 END)
            WHEN now() - t.last_activity_at <= interval '7 day' THEN GREATEST(0, 35 - CASE WHEN t.activities_7d >= 6 THEN 25 WHEN t.activities_7d >= 3 THEN 10 WHEN t.activities_7d <= 1 THEN -10 ELSE 0 END)
            WHEN now() - t.last_activity_at <= interval '14 day' THEN GREATEST(0, 55 - CASE WHEN t.activities_7d >= 6 THEN 25 WHEN t.activities_7d >= 3 THEN 10 WHEN t.activities_7d <= 1 THEN -10 ELSE 0 END)
            WHEN now() - t.last_activity_at <= interval '21 day' THEN GREATEST(0, 75 - CASE WHEN t.activities_7d >= 6 THEN 25 WHEN t.activities_7d >= 3 THEN 10 WHEN t.activities_7d <= 1 THEN -10 ELSE 0 END)
            ELSE GREATEST(0, 90 - CASE WHEN t.activities_7d >= 6 THEN 25 WHEN t.activities_7d >= 3 THEN 10 WHEN t.activities_7d <= 1 THEN -10 ELSE 0 END)
          END < 40
      )
    INTO v_ativos_7d, v_sem_atividade, v_risco_alto, v_risco_medio, v_risco_baixo
    FROM (
      SELECT
        u.id AS usuario_id,
        a.last_activity_at,
        COALESCE(a.activities_7d, 0) AS activities_7d
      FROM public.usuarios u
      LEFT JOIN tmp_activity_agg a ON a.usuario_id = u.id
    ) t;
  END IF;

  -- Treinos: prescritos/realizados, por tipo e por personal
  IF to_regclass('public.treinos_plano') IS NOT NULL THEN
    SELECT COUNT(*)::int
    INTO v_treinos_prescritos
    FROM public.treinos_plano tp
    WHERE (tp.created_at IS NULL OR tp.created_at >= v_since_ts);

    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'tipo', x.tipo,
          'prescritos', x.prescritos
        ) ORDER BY x.prescritos DESC
      ),
      '[]'::jsonb
    )
    INTO v_by_tipo
    FROM (
      SELECT COALESCE(tp.tipo, 'nao_informado') AS tipo, COUNT(*)::int AS prescritos
      FROM public.treinos_plano tp
      WHERE (tp.created_at IS NULL OR tp.created_at >= v_since_ts)
      GROUP BY COALESCE(tp.tipo, 'nao_informado')
    ) x;

    IF to_regclass('public.personais') IS NOT NULL THEN
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'personal_id', y.personal_id,
            'personal_nome', y.personal_nome,
            'prescritos', y.prescritos
          ) ORDER BY y.prescritos DESC
        ),
        '[]'::jsonb
      )
      INTO v_by_personal
      FROM (
        SELECT
          tp.personal_id,
          COALESCE(p.nome, 'Sem personal') AS personal_nome,
          COUNT(*)::int AS prescritos
        FROM public.treinos_plano tp
        LEFT JOIN public.personais p ON p.id = tp.personal_id
        WHERE (tp.created_at IS NULL OR tp.created_at >= v_since_ts)
        GROUP BY tp.personal_id, COALESCE(p.nome, 'Sem personal')
      ) y;
    END IF;
  END IF;

  IF to_regclass('public.treinos_realizados') IS NOT NULL THEN
    SELECT COUNT(*)::int
    INTO v_treinos_realizados
    FROM public.treinos_realizados tr
    WHERE tr.data_hora >= v_since_ts;
  END IF;

  -- Desafios
  IF to_regclass('public.desafios_semanais') IS NOT NULL THEN
    SELECT COUNT(*)::int
    INTO v_desafios_ativos
    FROM public.desafios_semanais d
    WHERE d.ativo = true;
  END IF;

  IF to_regclass('public.desafios_semanais_conclusoes') IS NOT NULL THEN
    SELECT COUNT(DISTINCT dc.usuario_id)::int
    INTO v_desafio_participantes
    FROM public.desafios_semanais_conclusoes dc
    WHERE dc.concluido_em >= v_since_ts;
  END IF;

  -- Nutricao
  IF to_regclass('public.refeicoes') IS NOT NULL AND v_refeicao_date_col IS NOT NULL THEN
    EXECUTE format(
      'SELECT COUNT(DISTINCT r.usuario_id)::int
       FROM public.refeicoes r
       WHERE r.usuario_id IS NOT NULL
         AND (r.%1$I)::timestamptz >= $1',
      v_refeicao_date_col
    )
    INTO v_refeicao_participantes
    USING v_since_ts;
  END IF;

  IF v_total_alunos > 0 THEN
    v_pct_desafio := ROUND((v_desafio_participantes::numeric / v_total_alunos::numeric) * 100, 2);
    v_pct_refeicao := ROUND((v_refeicao_participantes::numeric / v_total_alunos::numeric) * 100, 2);
    v_pct_ativos_7d := ROUND((v_ativos_7d::numeric / v_total_alunos::numeric) * 100, 2);
  END IF;

  RETURN jsonb_build_object(
    'period_days', v_days,
    'generated_at', now(),
    'alunos', jsonb_build_object(
      'total', v_total_alunos,
      'ativos_7d', v_ativos_7d,
      'ativos_7d_percentual', v_pct_ativos_7d
    ),
    'risco_cancelamento', jsonb_build_object(
      'alto', v_risco_alto,
      'medio', v_risco_medio,
      'baixo', v_risco_baixo,
      'sem_atividade', v_sem_atividade
    ),
    'desafios', jsonb_build_object(
      'ativos', v_desafios_ativos,
      'participantes_periodo', v_desafio_participantes,
      'percentual_participacao', v_pct_desafio
    ),
    'refeicoes', jsonb_build_object(
      'participantes_periodo', v_refeicao_participantes,
      'percentual_registro', v_pct_refeicao
    ),
    'treinos', jsonb_build_object(
      'prescritos_periodo', v_treinos_prescritos,
      'realizados_periodo', v_treinos_realizados,
      'adesao_percentual', CASE
        WHEN v_treinos_prescritos > 0
        THEN ROUND((v_treinos_realizados::numeric / v_treinos_prescritos::numeric) * 100, 2)
        ELSE 0
      END,
      'por_tipo', v_by_tipo,
      'por_personal', v_by_personal
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_dashboard_exec_summary(integer) TO authenticated;
