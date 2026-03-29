# AlimentaAI PWA

App mobile progressivo para acompanhamento de treino e nutrição.

## Stack
- React 18 + Vite
- Supabase Auth (email/senha)
- vite-plugin-pwa (installable, offline-ready)
- React Router v6

## Estrutura de telas
- `/` — Dashboard (saldo do dia, refeições, métricas)
- `/treino` — Treino do dia (plano + execução série a série)
- `/nutricao` — Nutrição (em desenvolvimento)
- `/evolucao` — Histórico e evolução (em desenvolvimento)

## Setup

```bash
# 1. Instalar dependências
npm install

# 2. Configurar variáveis de ambiente
cp .env.example .env
# Editar .env com suas credenciais do Supabase

# 3. Rodar em desenvolvimento
npm run dev

# 4. Build para produção
npm run build
```

## Variáveis de ambiente necessárias
```
VITE_SUPABASE_URL=https://SEU_PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=SUA_CHAVE_ANON_PUBLICA
VITE_N8N_WEBHOOK_TREINO=https://seu-n8n.com/webhook/treino_concluido
```

## Integração com n8n

Quando o aluno finaliza o treino, o PWA chama o webhook do n8n com:
```json
{
  "usuario_id": "uuid",
  "exercicios": [
    { "nome": "Supino reto", "series_feitas": 4, "met": 5.0, "duracao_min": 15 }
  ],
  "duracao_total_min": 45
}
```
O n8n calcula o gasto calórico, salva no Supabase e envia a notificação via WhatsApp.

## Tabelas Supabase necessárias

```sql
-- Treinos planejados pelo personal
create table treinos_plano (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid references usuarios(id),
  nome text,
  personal_id uuid,
  data_prevista date,
  exercicios jsonb,
  criado_pelo_aluno boolean not null default false,
  categoria text,
  created_at timestamptz default now()
);

-- Treinos realizados pelo aluno
create table treinos_realizados (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid references usuarios(id),
  plano_id uuid references treinos_plano(id),
  nome text,
  data_hora timestamptz default now(),
  exercicios jsonb,
  duracao_min int,
  kcal_gastas float,
  concluido boolean default false
);
```

Se `treinos_plano` ja existir sem colunas novas, rode no **SQL Editor** do Supabase o script unificado:

`scripts/migrations/treinos_plano_colunas_app.sql`

(Alternativa: `add_criado_pelo_aluno_treinos_plano.sql` e depois `add_categoria_treinos_plano.sql`.)

## Deploy sugerido
- **Vercel** (zero config para Vite + React)
- Ou Netlify, Cloudflare Pages

## PWA — instalar no celular
Após deploy, acesse pelo celular e use "Adicionar à tela inicial" no browser.
