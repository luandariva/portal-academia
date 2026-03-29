-- Correção do erro "column rf.kcal does not exist" na gamificação.
-- O QUE FAZER (3 passos):
-- 1) Abre https://supabase.com → o teu projeto → menu "SQL Editor".
-- 2) Cria uma query nova, cola TUDO este ficheiro aqui.
-- 3) Clica "Run". Deve aparecer "Success". Depois recarrega a app.

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
      COALESCE(sum(
        COALESCE(
          NULLIF(trim(to_jsonb(rf)->>'kcal'), '')::numeric,
          NULLIF(trim(to_jsonb(rf)->>'calorias'), '')::numeric,
          NULLIF(trim(to_jsonb(rf)->>'calorias_kcal'), '')::numeric,
          0::numeric
        )
      ), 0),
      COALESCE(sum(
        COALESCE(
          NULLIF(trim(to_jsonb(rf)->>'proteina_g'), '')::numeric,
          NULLIF(trim(to_jsonb(rf)->>'proteina'), '')::numeric,
          NULLIF(trim(to_jsonb(rf)->>'proteinas_g'), '')::numeric,
          0::numeric
        )
      ), 0)
    INTO v_kcal_sum, v_prot_sum
    FROM public.refeicoes rf
    WHERE rf.usuario_id = p_usuario_id
      AND (rf.data_hora AT TIME ZONE 'America/Sao_Paulo')::date = p_dia;
  END IF;

  SELECT
    COALESCE(
      NULLIF(trim(to_jsonb(m)->>'calorias_kcal'), '')::numeric,
      NULLIF(trim(to_jsonb(m)->>'kcal_meta'), '')::numeric,
      NULLIF(trim(to_jsonb(m)->>'meta_kcal'), '')::numeric,
      NULLIF(trim(to_jsonb(m)->>'kcal_diaria'), '')::numeric,
      NULLIF(trim(to_jsonb(m)->>'calorias_meta'), '')::numeric,
      0::numeric
    ),
    COALESCE(
      NULLIF(trim(to_jsonb(m)->>'proteina_meta'), '')::numeric,
      NULLIF(trim(to_jsonb(m)->>'meta_proteina'), '')::numeric,
      NULLIF(trim(to_jsonb(m)->>'proteina_g'), '')::numeric,
      0::numeric
    )
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
