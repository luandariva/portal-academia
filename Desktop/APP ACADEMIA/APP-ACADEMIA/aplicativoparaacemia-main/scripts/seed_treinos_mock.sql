-- Popular personais, treinos_plano e treinos_realizados (dados mock alinhados a src/pages/Treino.jsx)
-- Pré-requisitos: public.personais + FK treinos_plano.personal_id (rode personais_tabela_e_fk.sql)
--                 pelo menos 1 linha em public.usuarios
-- Execute no SQL Editor do Supabase.
-- Idempotente: não duplica personais (email), planos (mesmo aluno + nome), nem realizados (mesmo aluno + plano_id).

-- 0) Personais de exemplo (idempotente por email)
INSERT INTO public.personais (nome, email, cref)
VALUES
  ('Ana Costa', 'ana.exemplo@alimentaai.dev', 'CREF 123456-G/SP'),
  ('Bruno Mendes', 'bruno.exemplo@alimentaai.dev', 'CREF 654321-G/SP')
ON CONFLICT (email) DO NOTHING;

-- Alvo: primeiro usuario por id (comportamento original do seed)
-- 1) Planos (3 treinos) — só inserem se ainda não existir linha com mesmo usuario_id + nome
INSERT INTO public.treinos_plano (usuario_id, nome, personal_id, data_prevista, categoria, exercicios, criado_pelo_aluno)
SELECT a.id, 'Peito + Triceps', p.id, CURRENT_DATE, 'chest', '[
  {"id": 1, "nome": "Supino reto", "series": 4, "repeticoes": 10, "carga": 80, "met": 5.0, "video_url": null},
  {"id": 2, "nome": "Crucifixo inclinado", "series": 3, "repeticoes": 12, "carga": 20, "met": 4.5, "video_url": null},
  {"id": 3, "nome": "Triceps corda", "series": 3, "repeticoes": 15, "carga": 35, "met": 4.0, "video_url": null},
  {"id": 4, "nome": "Mergulho no banco", "series": 3, "repeticoes": 0, "carga": 0, "met": 4.0, "video_url": null}
]'::jsonb, false
FROM (SELECT id FROM public.usuarios ORDER BY id LIMIT 1) a
CROSS JOIN (SELECT id FROM public.personais WHERE email = 'ana.exemplo@alimentaai.dev' LIMIT 1) p
WHERE NOT EXISTS (
  SELECT 1 FROM public.treinos_plano tp
  WHERE tp.usuario_id = a.id AND tp.nome = 'Peito + Triceps'
);

INSERT INTO public.treinos_plano (usuario_id, nome, personal_id, data_prevista, categoria, exercicios, criado_pelo_aluno)
SELECT a.id, 'Costas + Biceps', p.id, CURRENT_DATE + 1, 'upper', '[
  {"id": 5, "nome": "Puxada alta", "series": 4, "repeticoes": 12, "carga": 55, "met": 4.7, "video_url": null},
  {"id": 6, "nome": "Remada curvada", "series": 4, "repeticoes": 10, "carga": 60, "met": 5.2, "video_url": null},
  {"id": 7, "nome": "Rosca direta", "series": 3, "repeticoes": 12, "carga": 25, "met": 4.1, "video_url": null}
]'::jsonb, false
FROM (SELECT id FROM public.usuarios ORDER BY id LIMIT 1) a
CROSS JOIN (SELECT id FROM public.personais WHERE email = 'ana.exemplo@alimentaai.dev' LIMIT 1) p
WHERE NOT EXISTS (
  SELECT 1 FROM public.treinos_plano tp
  WHERE tp.usuario_id = a.id AND tp.nome = 'Costas + Biceps'
);

INSERT INTO public.treinos_plano (usuario_id, nome, personal_id, data_prevista, categoria, exercicios, criado_pelo_aluno)
SELECT a.id, 'Pernas', p.id, CURRENT_DATE + 2, 'legs', '[
  {"id": 8, "nome": "Agachamento livre", "series": 4, "repeticoes": 8, "carga": 90, "met": 6.0, "video_url": null},
  {"id": 9, "nome": "Leg press", "series": 4, "repeticoes": 12, "carga": 180, "met": 5.6, "video_url": null},
  {"id": 10, "nome": "Extensora", "series": 3, "repeticoes": 15, "carga": 40, "met": 4.2, "video_url": null},
  {"id": 11, "nome": "Panturrilha em pe", "series": 4, "repeticoes": 20, "carga": 50, "met": 3.8, "video_url": null}
]'::jsonb, false
FROM (SELECT id FROM public.usuarios ORDER BY id LIMIT 1) a
CROSS JOIN (SELECT id FROM public.personais WHERE email = 'bruno.exemplo@alimentaai.dev' LIMIT 1) p
WHERE NOT EXISTS (
  SELECT 1 FROM public.treinos_plano tp
  WHERE tp.usuario_id = a.id AND tp.nome = 'Pernas'
);

-- 2) Exemplos de treinos realizados — um registro por (usuario_id, plano_id); usa o plano mais recente se houver vários
INSERT INTO public.treinos_realizados (usuario_id, plano_id, nome, data_hora, exercicios, duracao_min, kcal_gastas, concluido)
SELECT u.id, p.id, p.nome, now() - interval '2 days', '[
  {"nome": "Supino reto", "series_feitas": 4, "met": 5.0, "duracao_min": 12},
  {"nome": "Crucifixo inclinado", "series_feitas": 3, "met": 4.5, "duracao_min": 10},
  {"nome": "Triceps corda", "series_feitas": 3, "met": 4.0, "duracao_min": 8},
  {"nome": "Mergulho no banco", "series_feitas": 3, "met": 4.0, "duracao_min": 9}
]'::jsonb, 48, 220, true
FROM public.usuarios u
JOIN public.treinos_plano p ON p.usuario_id = u.id AND p.nome = 'Peito + Triceps'
WHERE u.id = (SELECT id FROM public.usuarios ORDER BY id LIMIT 1)
  AND NOT EXISTS (
    SELECT 1 FROM public.treinos_realizados tr
    WHERE tr.usuario_id = u.id AND tr.plano_id = p.id
  )
ORDER BY p.created_at DESC
LIMIT 1;

INSERT INTO public.treinos_realizados (usuario_id, plano_id, nome, data_hora, exercicios, duracao_min, kcal_gastas, concluido)
SELECT u.id, p.id, p.nome, now() - interval '5 days', '[
  {"nome": "Puxada alta", "series_feitas": 4, "met": 4.7, "duracao_min": 14},
  {"nome": "Remada curvada", "series_feitas": 4, "met": 5.2, "duracao_min": 16},
  {"nome": "Rosca direta", "series_feitas": 3, "met": 4.1, "duracao_min": 10}
]'::jsonb, 52, 195, true
FROM public.usuarios u
JOIN public.treinos_plano p ON p.usuario_id = u.id AND p.nome = 'Costas + Biceps'
WHERE u.id = (SELECT id FROM public.usuarios ORDER BY id LIMIT 1)
  AND NOT EXISTS (
    SELECT 1 FROM public.treinos_realizados tr
    WHERE tr.usuario_id = u.id AND tr.plano_id = p.id
  )
ORDER BY p.created_at DESC
LIMIT 1;

-- ---------------------------------------------------------------------------
-- Opcional: diagnosticar duplicatas já gravadas (rode à parte; não apaga dados)
-- ---------------------------------------------------------------------------
-- SELECT usuario_id, nome, count(*) AS qtd
-- FROM public.treinos_plano
-- GROUP BY usuario_id, nome
-- HAVING count(*) > 1;
--
-- SELECT email, count(*) FROM public.personais GROUP BY email HAVING count(*) > 1;
--
-- SELECT usuario_id, plano_id, count(*) AS qtd
-- FROM public.treinos_realizados
-- GROUP BY usuario_id, plano_id
-- HAVING count(*) > 1;
