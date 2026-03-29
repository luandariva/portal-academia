-- Política de leitura dos treinos de catálogo (treinos gerais) para o aluno autenticado,
-- alinhada à RPC `treinos_catalogo_para_aluno` / `usuario_corresponde_auth`.
-- Só é aplicada se `treinos_plano` já tiver RLS ativo (evita activar RLS sem outras políticas).
--
-- Rode no SQL Editor do Supabase após `rpc_aluno_academia_ids.sql` (incl. `aluno_academia_vinculo_por_email`).

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'treinos_plano'
      AND c.relrowsecurity = true
  ) THEN
    DROP POLICY IF EXISTS treinos_plano_select_catalogo_aluno ON public.treinos_plano;
    CREATE POLICY treinos_plano_select_catalogo_aluno
      ON public.treinos_plano
      FOR SELECT
      TO authenticated
      USING (
        catalogo IS TRUE
        AND academia_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM public.alunos_academia aa
          WHERE aa.academia_id = treinos_plano.academia_id
            AND lower(trim(both from coalesce(aa.status, ''))) = 'ativo'
            AND (
              public.usuario_corresponde_auth(aa.usuario_id)
              OR public.aluno_academia_vinculo_por_email(aa.usuario_id)
            )
        )
      );
  END IF;
END
$$;
