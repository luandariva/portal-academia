-- Opcional: remove multi-academia de uma instalação que já aplicou `gamificacao_completo.sql` antigo.
-- Ordem segura: remover FK/columna, depois tabela. Reaplicar funções RPC a partir de `gamificacao_completo.sql`
-- (secções 4+) ou colar só os CREATE OR REPLACE das RPCs actualizadas.

ALTER TABLE public.usuarios
  DROP CONSTRAINT IF EXISTS usuarios_academia_id_fkey;

ALTER TABLE public.usuarios
  DROP COLUMN IF EXISTS academia_id;

DROP TABLE IF EXISTS public.academias;

-- Depois de correr isto, actualize no SQL Editor:
--   CREATE OR REPLACE FUNCTION public.rpc_gamificacao_resumo() ...
--   CREATE OR REPLACE FUNCTION public.rpc_gamificacao_leaderboard(...) ...
