-- RPCs para o PWA: catálogo de treinos da academia e academias do aluno.
-- Roda com SECURITY DEFINER para contornar RLS em alunos_academia / treinos_plano no REST.
-- Vínculo aluno ↔ sessão: auth.uid() = usuarios.id OU usuarios.auth_user_id OU mesmo e-mail que auth.users.
-- Executar no SQL Editor do Supabase após portal_academia_mvp + colunas de catálogo em treinos_plano.

ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS auth_user_id uuid;

-- Match de perfil ao utilizador autenticado (mesma ideia que resolveUsuarioDb no app).
CREATE OR REPLACE FUNCTION public.usuario_corresponde_auth(p_usuario_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuarios u
    WHERE u.id = p_usuario_id
      AND (
        u.id = auth.uid()
        OR (u.auth_user_id IS NOT NULL AND u.auth_user_id = auth.uid())
        OR EXISTS (
          SELECT 1
          FROM auth.users au
          WHERE au.id = auth.uid()
            AND au.email IS NOT NULL
            AND u.email IS NOT NULL
            AND lower(trim(both from u.email)) = lower(trim(both from au.email))
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.usuario_corresponde_auth(uuid) FROM PUBLIC;
-- Não expor diretamente no PostgREST; só é chamada pelas RPCs acima (DEFINER).

-- Mesmo e-mail em duas linhas usuarios (id antigo em alunos_academia, sessão noutro id).
CREATE OR REPLACE FUNCTION public.aluno_academia_vinculo_por_email(p_usuario_aluno uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuarios u_link
    WHERE u_link.id = p_usuario_aluno
      AND u_link.email IS NOT NULL
      AND btrim(u_link.email) <> ''
      AND EXISTS (
        SELECT 1
        FROM public.usuarios u_sess
        WHERE u_sess.email IS NOT NULL
          AND btrim(u_sess.email) <> ''
          AND lower(trim(both from u_link.email)) = lower(trim(both from u_sess.email))
          AND (
            u_sess.id = auth.uid()
            OR (u_sess.auth_user_id IS NOT NULL AND u_sess.auth_user_id = auth.uid())
            OR EXISTS (
              SELECT 1
              FROM auth.users au
              WHERE au.id = auth.uid()
                AND au.email IS NOT NULL
                AND lower(trim(both from u_sess.email)) = lower(trim(both from au.email))
            )
          )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.aluno_academia_vinculo_por_email(uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.aluno_academia_ids()
RETURNS TABLE (academia_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT aa.academia_id
  FROM public.alunos_academia aa
  WHERE lower(trim(both from coalesce(aa.status, ''))) = 'ativo'
    AND (
      public.usuario_corresponde_auth(aa.usuario_id)
      OR public.aluno_academia_vinculo_por_email(aa.usuario_id)
    );
$$;

COMMENT ON FUNCTION public.aluno_academia_ids IS
  'Academias com vínculo ativo para o aluno da sessão.';

REVOKE ALL ON FUNCTION public.aluno_academia_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.aluno_academia_ids() TO authenticated;

-- Planos catalogo=true visíveis no app (bypass RLS em treinos_plano).
CREATE OR REPLACE FUNCTION public.treinos_catalogo_para_aluno()
RETURNS SETOF public.treinos_plano
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tp.*
  FROM public.treinos_plano tp
  WHERE tp.catalogo IS TRUE
    AND tp.academia_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.alunos_academia aa
      WHERE aa.academia_id = tp.academia_id
        AND lower(trim(both from coalesce(aa.status, ''))) = 'ativo'
        AND (
          public.usuario_corresponde_auth(aa.usuario_id)
          OR public.aluno_academia_vinculo_por_email(aa.usuario_id)
        )
    );
$$;

COMMENT ON FUNCTION public.treinos_catalogo_para_aluno IS
  'Treinos gerais da academia (catálogo) que o aluno autenticado pode ver.';

REVOKE ALL ON FUNCTION public.treinos_catalogo_para_aluno() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.treinos_catalogo_para_aluno() TO authenticated;
