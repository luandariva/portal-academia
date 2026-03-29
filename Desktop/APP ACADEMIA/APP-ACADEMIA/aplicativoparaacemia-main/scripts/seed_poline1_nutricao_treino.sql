-- Dados de exemplo: metas_macros, refeições e treinos para um utilizador por e-mail.
-- Executar no SQL Editor do Supabase (role postgres / service).
-- Pré-requisitos: linha em public.usuarios com este e-mail em usuarios.email OU auth_user_id = auth.users.id.
-- Ajuste as colunas se o teu schema tiver nomes diferentes (ver comentários no fim).

DO $$
DECLARE
  v_email constant text := 'poline1@gmail.com';
  v_uid uuid;
  v_plano_peito uuid;
  v_plano_costas uuid;
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
    RAISE EXCEPTION 'Nenhum public.usuarios encontrado para e-mail % (usuarios.email ou auth.users).', v_email;
  END IF;

  -- Meta diária (última por data_referencia no app).
  -- Este projeto costuma usar *_g para metas na tabela metas_macros (o PWA lê também proteina_meta / meta_*).
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

  -- Refeições: só colunas que existem na maioria dos schemas (muitas bases não têm proteina_g/carboidrato_g em refeicoes).
  -- data_hora em timestamptz (now() ± horas) para cair de certeza no filtro "últimos 14 dias" do portal.
  INSERT INTO public.refeicoes (usuario_id, data_hora, tipo_refeicao, calorias_kcal)
  VALUES
    (v_uid, now() - interval '5 hours', 'Pequeno-almoço', 420),
    (v_uid, now() - interval '4 hours', 'Almoço', 650),
    (v_uid, now() - interval '3 hours', 'Lanche', 280),
    (v_uid, now() - interval '2 hours', 'Jantar', 580);

  -- Planos de treino (personal_id nulo, como no builder do PWA)
  INSERT INTO public.treinos_plano (
    usuario_id,
    nome,
    personal_id,
    data_prevista,
    categoria,
    exercicios,
    criado_pelo_aluno
  )
  VALUES (
    v_uid,
    'Peito + Tríceps (seed)',
    NULL,
    CURRENT_DATE,
    'chest',
    '[
      {"id": "ex-1", "nome": "Supino reto", "series": 4, "repeticoes": 10, "carga": 60, "met": 5, "video_url": null},
      {"id": "ex-2", "nome": "Crucifixo", "series": 3, "repeticoes": 12, "carga": 16, "met": 4.5, "video_url": null},
      {"id": "ex-3", "nome": "Tríceps corda", "series": 3, "repeticoes": 15, "carga": 30, "met": 4, "video_url": null}
    ]'::jsonb,
    true
  )
  RETURNING id INTO v_plano_peito;

  INSERT INTO public.treinos_plano (
    usuario_id,
    nome,
    personal_id,
    data_prevista,
    categoria,
    exercicios,
    criado_pelo_aluno
  )
  VALUES (
    v_uid,
    'Costas + Bíceps (seed)',
    NULL,
    CURRENT_DATE + 1,
    'upper',
    '[
      {"id": "ex-4", "nome": "Puxada alta", "series": 4, "repeticoes": 12, "carga": 50, "met": 4.7, "video_url": null},
      {"id": "ex-5", "nome": "Remada curvada", "series": 4, "repeticoes": 10, "carga": 55, "met": 5.2, "video_url": null},
      {"id": "ex-6", "nome": "Rosca direta", "series": 3, "repeticoes": 12, "carga": 22, "met": 4.1, "video_url": null}
    ]'::jsonb,
    true
  )
  RETURNING id INTO v_plano_costas;

  -- Treinos concluídos (ligados aos planos criados acima)
  INSERT INTO public.treinos_realizados (
    usuario_id,
    plano_id,
    nome,
    data_hora,
    exercicios,
    duracao_min,
    kcal_gastas,
    concluido
  )
  VALUES (
    v_uid,
    v_plano_peito,
    'Peito + Tríceps (seed)',
    now() - interval '2 days',
    '[
      {"nome": "Supino reto", "series_feitas": 4, "met": 5, "duracao_min": 12},
      {"nome": "Crucifixo", "series_feitas": 3, "met": 4.5, "duracao_min": 10},
      {"nome": "Tríceps corda", "series_feitas": 3, "met": 4, "duracao_min": 8}
    ]'::jsonb,
    45,
    210,
    true
  );

  INSERT INTO public.treinos_realizados (
    usuario_id,
    plano_id,
    nome,
    data_hora,
    exercicios,
    duracao_min,
    kcal_gastas,
    concluido
  )
  VALUES (
    v_uid,
    v_plano_costas,
    'Costas + Bíceps (seed)',
    now() - interval '5 days',
    '[
      {"nome": "Puxada alta", "series_feitas": 4, "met": 4.7, "duracao_min": 14},
      {"nome": "Remada curvada", "series_feitas": 4, "met": 5.2, "duracao_min": 16},
      {"nome": "Rosca direta", "series_feitas": 3, "met": 4.1, "duracao_min": 10}
    ]'::jsonb,
    50,
    190,
    true
  );

  RAISE NOTICE 'Seed aplicado para usuario_id=% (%)', v_uid, v_email;
END $$;

-- Notas se der erro de coluna inexistente:
-- metas_macros: se não tiveres calorias_kcal, tenta meta_kcal ou kcal_meta; se não tiveres proteina_g, tenta meta_proteina ou proteina_meta.
-- refeicoes: se tipo_refeicao não existir, troca por refeicao. Macros (proteina_g, etc.) são opcionais no seed.
-- treinos_plano: se personal_id for NOT NULL na tua base, substitui NULL por um id válido de public.personais.
