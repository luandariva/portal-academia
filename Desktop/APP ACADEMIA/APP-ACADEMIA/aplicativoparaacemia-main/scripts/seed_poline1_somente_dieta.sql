-- Só metas_macros + refeições (não duplica treinos). Para quem já tem planos/realizados mas a dieta falhou no seed completo.
-- Executar no SQL Editor do Supabase.

DO $$
DECLARE
  v_email constant text := 'poline1@gmail.com';
  v_uid uuid;
BEGIN
  SELECT x.id INTO v_uid
  FROM (
    SELECT u.id
    FROM public.usuarios u
    WHERE lower(trim(coalesce(u.email, ''))) = lower(trim(v_email))
    UNION
    SELECT u.id
    FROM public.usuarios u
    JOIN auth.users a ON a.id = u.auth_user_id
    WHERE lower(trim(a.email)) = lower(trim(v_email))
    LIMIT 1
  ) x
  LIMIT 1;

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Usuario nao encontrado para %', v_email;
  END IF;

  INSERT INTO public.metas_macros (
    usuario_id,
    data_referencia,
    calorias_kcal,
    proteina_g,
    carboidrato_g,
    gordura_g
  )
  VALUES (
    v_uid,
    (timezone('America/Sao_Paulo', now()))::date,
    2000,
    120,
    220,
    65
  )
  ON CONFLICT (usuario_id, data_referencia) DO UPDATE SET
    calorias_kcal = EXCLUDED.calorias_kcal,
    proteina_g = EXCLUDED.proteina_g,
    carboidrato_g = EXCLUDED.carboidrato_g,
    gordura_g = EXCLUDED.gordura_g;

  INSERT INTO public.refeicoes (usuario_id, data_hora, tipo_refeicao, calorias_kcal)
  VALUES
    (v_uid, now() - interval '5 hours', 'Pequeno-almoço', 420),
    (v_uid, now() - interval '4 hours', 'Almoço', 650),
    (v_uid, now() - interval '3 hours', 'Lanche', 280),
    (v_uid, now() - interval '2 hours', 'Jantar', 580);

  RAISE NOTICE 'Dieta seed ok usuario_id=%', v_uid;
END $$;
