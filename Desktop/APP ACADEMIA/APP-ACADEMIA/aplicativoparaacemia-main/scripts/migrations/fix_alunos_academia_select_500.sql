-- Corrige GET /alunos_academia que devolve 500 no PostgREST quando a política RLS
-- alunos_academia_select_aluno_self referencia usuarios.auth_user_id e essa coluna não existe.
-- Rode no SQL Editor do Supabase (pode executar várias vezes).

ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS auth_user_id uuid;

COMMENT ON COLUMN public.usuarios.auth_user_id IS 'auth.users.id quando o id da linha em usuarios é distinto do login Supabase.';

-- Perfis antigos: preencher auth_user_id pelo mesmo e-mail do Auth (evita SELECT vazio após corrigir o 500).
UPDATE public.usuarios u
SET auth_user_id = a.id
FROM auth.users a
WHERE u.auth_user_id IS NULL
  AND u.email IS NOT NULL
  AND a.email IS NOT NULL
  AND lower(trim(u.email)) = lower(trim(a.email));

-- Quem usa o mesmo UUID em usuarios e em auth.users:
UPDATE public.usuarios u
SET auth_user_id = u.id
WHERE u.auth_user_id IS NULL
  AND EXISTS (SELECT 1 FROM auth.users a WHERE a.id = u.id);

DROP POLICY IF EXISTS alunos_academia_select_aluno_self ON public.alunos_academia;
CREATE POLICY alunos_academia_select_aluno_self
  ON public.alunos_academia
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.usuarios u
      WHERE u.id = alunos_academia.usuario_id
        AND (u.auth_user_id = auth.uid() OR u.id = auth.uid())
    )
  );
