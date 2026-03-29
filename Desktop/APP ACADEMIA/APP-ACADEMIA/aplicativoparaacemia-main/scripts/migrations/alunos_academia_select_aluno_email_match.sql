-- Alinha a política de leitura de `alunos_academia` pelo aluno com `usuario_corresponde_auth`
-- (e-mail igual ao de auth.users quando id/auth_user_id não batem).
-- Rode no SQL Editor após existir a coluna `usuarios.email` (opcional mas recomendado).

DROP POLICY IF EXISTS alunos_academia_select_aluno_self ON public.alunos_academia;
CREATE POLICY alunos_academia_select_aluno_self
  ON public.alunos_academia
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.usuarios u
      WHERE u.id = alunos_academia.usuario_id
        AND (
          u.auth_user_id = auth.uid()
          OR u.id = auth.uid()
          OR (
            u.email IS NOT NULL
            AND EXISTS (
              SELECT 1
              FROM auth.users au
              WHERE au.id = auth.uid()
                AND au.email IS NOT NULL
                AND lower(trim(both from u.email)) = lower(trim(both from au.email))
            )
          )
        )
    )
  );
