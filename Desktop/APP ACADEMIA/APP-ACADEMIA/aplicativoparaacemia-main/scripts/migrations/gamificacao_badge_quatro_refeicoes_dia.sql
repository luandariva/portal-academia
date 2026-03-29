-- Conquista: 4 refeições registadas no mesmo dia (badge único, semana_inicio NULL).
-- Aplicar no SQL Editor do Supabase se o projecto já tinha gamificação antes deste badge.

INSERT INTO public.gamificacao_badges (slug, titulo, descricao, icone)
VALUES
  ('quatro_refeicoes_dia', '4 refeições no dia', 'Registou pelo menos 4 refeições no mesmo dia.', '🍽️')
ON CONFLICT (slug) DO NOTHING;

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
