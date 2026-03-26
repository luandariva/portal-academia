# AlimentaAI — Portal de Gestão

Dashboard web desktop para personais e gestores de academia.

## Stack
- React 18 + Vite
- Supabase (mesmo projeto do PWA)
- React Router v6
- Design: industrial dark, Space Grotesk + Syne

## Rotas
- `/login` — autenticação
- `/dashboard` — visão geral (alunos, treinos, ranking)
- `/alunos` — lista + cadastro de alunos
- `/alunos/:id` — perfil completo (treinos, histórico, gamificação, dados)
- `/treinos` — biblioteca de todos os treinos prescritos

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

## Configuração inicial no Supabase

1. Execute `scripts/portal_auth.sql` no SQL Editor
2. Vincule seu usuário à tabela `personais`:

```sql
INSERT INTO public.personais (nome, email, auth_user_id, role)
SELECT 'Seu Nome', 'seu@email.com', id, 'gestor'
FROM auth.users WHERE email = 'seu@email.com'
ON CONFLICT (email) DO UPDATE
  SET auth_user_id = EXCLUDED.auth_user_id, role = 'gestor';
```

3. Acesse `/login` com o e-mail/senha do Supabase Auth

## Funcionalidades MVP

| Feature | Status |
|---|---|
| Login com Supabase Auth | ✅ |
| Dashboard com métricas | ✅ |
| Cadastro de alunos | ✅ |
| Prescrição de treinos | ✅ |
| Histórico de treinos realizados | ✅ |
| Gamificação — pontos e badges | ✅ |
| Biblioteca de treinos | ✅ |
| Perfil detalhado do aluno | ✅ |

## Deploy sugerido
- Vercel (zero config Vite)
- Deploy separado do PWA em subdomínio: `portal.alimentaai.com`
