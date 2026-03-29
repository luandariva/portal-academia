-- Coluna opcional para alinhar `public.usuarios` ao PWA e a `portal_create_aluno_invite` (upsert com email).
-- Se a tabela já tiver `email`, o IF NOT EXISTS não altera nada.
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS email text;

COMMENT ON COLUMN public.usuarios.email IS 'E-mail de contacto do perfil (opcional; pode coincidir com auth.users.email).';
