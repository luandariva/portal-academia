# PRD — AlimentaAI Portal de Gestão

**Versão:** 1.0 (reflete o estado atual do código)  
**Produto:** Portal web de gestão para personais e gestores de academia  
**Ecossistema:** Mesmo backend Supabase do PWA do aluno; deploy sugerido em subdomínio (ex.: `portal.alimentaai.com`)

---

## 1. Visão e problema

**Visão:** Centralizar a operação da academia/personal trainer: cadastro de alunos, prescrição e visão de treinos, engajamento (gamificação e desafios), nutrição/registros e sinais de **risco de cancelamento**, com login seguro e papéis de staff.

**Problema que resolve:** Personais e gestores precisam de uma interface **desktop-first** para administrar alunos e acompanhar métricas sem depender só do app do aluno; o portal complementa o PWA com visão agregada e ações administrativas (ex.: provisionar acesso).

---

## 2. Personas e papéis

| Persona | Descrição | No produto |
|--------|-----------|------------|
| **Gestor** | Dono/coordenador da operação | Perfil em `personais` com `role = gestor`; mesmo acesso às telas do portal |
| **Personal** | Profissional que prescreve e acompanha | Perfil em `personais` (role padrão “Personal” na UI) |
| **Aluno** | Usuário final do app | **Não** é usuário do portal; existe em `usuarios` e autenticação própria no app |

**Pré-requisito de acesso:** Conta no Supabase Auth + linha em `personais` vinculada por `auth_user_id` (script SQL documentado no README).

---

## 3. Objetivos de negócio e indicadores

1. **Reduzir churn:** identificar alunos com baixo engajamento (risco de cancelamento).
2. **Aumentar adesão:** treinos prescritos vs. realizados; desafios semanais; registro de refeições.
3. **Eficiência operacional:** cadastro de aluno + criação de credenciais no app em um fluxo.
4. **Visão executiva:** KPIs em período configurável (7 / 30 / 90 dias).

**Métricas de sucesso (exemplos):** % ativos em 7 dias, % participação em desafios, % com registro de refeições, distribuição de risco (alto/médio/baixo), ranking de gamificação (top 5 no dashboard).

---

## 4. Escopo funcional (MVP implementado)

### 4.1 Autenticação e shell

- **Login** com e-mail e senha (Supabase Auth).
- **Sessão:** redirecionamento automático (`/login` ↔ área logada).
- **Layout:** sidebar fixa + área principal; **logout**.
- **Perfil staff:** nome e papel (Gestor / Personal) a partir de `personais`.

**Rotas principais:** `/login`, `/dashboard`, `/alunos`, `/alunos/:id`, `/treinos`, `/desafios`, `/gamificacao`, `/risco-cancelamento`; demais → `/dashboard`.

### 4.2 Dashboard executivo

- **Período:** seletor 7 / 30 / 90 dias.
- **Fonte de dados:** preferência por RPC `rpc_dashboard_exec_summary`; se indisponível, **fallback** com agregações no cliente a partir de tabelas (`usuarios`, `treinos_plano`, `treinos_realizados`, `desafios_semanais`, conclusões, `refeicoes`, `personais`).
- **KPIs:** total de alunos, ativos em 7 dias (número e %), aderência a desafios, % com registro de refeições no período.
- **Blocos adicionais:** resumo de risco de cancelamento (com link para página dedicada), treinos (prescritos/realizados, adesão, por tipo/personal), objetivos dos alunos, **top 5** do ranking de gamificação.

### 4.3 Alunos

- **Lista** de todos os registros em `usuarios`, ordenados por cadastro recente.
- **Busca** por nome ou e-mail.
- **Novo aluno:** modal com nome, e-mail, telefone, objetivo (valores como emagrecimento, hipertrofia, etc.).
- **Pós-cadastro:** chamada à Edge Function `provision-student-access` para criar acesso no app; exibir **senha temporária** quando retornada; mensagens de sucesso/erro parcial (aluno salvo sem provisionamento).

### 4.4 Perfil do aluno (`/alunos/:id`)

- **Abas:** Treinos (prescrição ao aluno), Histórico (realizados), Nutrição (refeições / macros), Gamificação (pontos, badges), Dados pessoais, Risco de cancelamento (cálculo por aluno).
- **Treinos:** categorias (peito, membros superiores, pernas); prescrição com exercícios (nome, séries, repetições, carga, MET, etc.).
- **Risco:** modelo heurístico com base em última atividade, frequência em 7 dias e refeições em 7 dias (consistente com a página global de risco).

### 4.5 Treinos (biblioteca)

- **Listagem** de `treinos_plano` com joins a aluno e personal.
- **Filtros:** categoria, tipo (geral vs. específico de usuário), busca textual.
- **Detalhe** de treino selecionado.
- **Nova prescrição “geral”:** treino template (`tipo: general`) com personal responsável obrigatório, duração, lista de exercícios em JSON.

### 4.6 Desafios semanais

- **CRUD essencial:** listar `desafios_semanais` e conclusões recentes; **criar** desafio (título, descrição, pontos, período início/fim, ativo).
- **Métricas:** totais ativos/encerrados; contagem de conclusões por desafio.
- **Associação** ao criador via `criado_por` (personal logado).

### 4.7 Gamificação

- **Ranking:** RPC `rpc_gamificacao_leaderboard` (limite alto na página dedicada).
- **Opt-in de ranking:** considera `usuarios.ranking_opt_in` quando não vem na RPC.
- **Badges:** listagem de `gamificacao_badges`.
- **Níveis** exibidos com rótulos (Iniciante → Lenda) conforme pontuação/nível retornado.

### 4.8 Risco de cancelamento (página dedicada)

- **Lista de alunos** com score 0–99, faixas alto/médio/baixo, última atividade.
- **Dados agregados:** treinos realizados, conclusões de desafios, refeições (chaves de data flexíveis).
- **Filtros:** busca, filtro por nível de risco (ex.: alto + médio).
- **Navegação** para o perfil do aluno.

---

## 5. Requisitos não funcionais

| Área | Requisito |
|------|-----------|
| **Plataforma** | Web, otimizado para **desktop** (layout com sidebar larga). |
| **Stack** | React 18, Vite, React Router v6, `@supabase/supabase-js`. |
| **Design** | Tema escuro “industrial”; fontes Space Grotesk + Syne (conforme README). |
| **Idioma** | UI em **português (pt-BR)**. |
| **Segurança** | Staff autenticado; Edge Function valida token e perfil em `personais`; service role só no backend da function. |
| **Resiliência** | Dashboard tolera ausência de RPC ou tabelas opcionais (mensagens/fallbacks onde implementado). |

---

## 6. Integrações e backend

- **Supabase:** Auth, Postgres (tabelas usadas pelas páginas), RPCs `rpc_dashboard_exec_summary` e `rpc_gamificacao_leaderboard`.
- **Edge Function:** `provision-student-access` — cria usuário Auth do aluno, senha temporária, vínculos necessários.
- **PWA AlimentaAI:** mesmo projeto Supabase; alunos usam o app; portal **não** substitui o app.

---

## 7. Premissas e dependências

- Schema Supabase alinhado às tabelas usadas (`usuarios`, `personais`, `treinos_plano`, `treinos_realizados`, `desafios_semanais`, `desafios_semanais_conclusoes`, `refeicoes`, `gamificacao_badges`, etc.).
- SQL inicial `scripts/portal_auth.sql` e vínculo gestor/personal em `personais`.
- Variáveis de ambiente para URL/anon key do Supabase; function com keys e service role no deploy.

---

## 8. Fora de escopo (neste PRD / código atual)

- App mobile do aluno (só referenciado).
- Gestão financeira, agenda de aulas, multi-tenant white-label.
- RBAC fino por permissão (além do papel gestor/personal na UI).
- Notificações in-app no portal (menções a WhatsApp/n8n na tela de login não implicam feature implementada no portal).

---

## 9. Riscos e observações

- **Dependência de RPCs:** se não existirem, o dashboard e a gamificação degradam para lógica alternativa ou erro — documentar no runbook de deploy.
- **Provisionamento:** falha parcial deixa aluno sem login no app; operação precisa de retry ou suporte manual.
- **Score de risco:** heurística, não modelo preditivo; tratar como **indicador operacional**, não diagnóstico.

---

## 10. Critérios de aceite (release do portal)

1. Login/logout e bloqueio de rotas privadas funcionando.
2. CRUD de aluno + invoke da function com tratamento de erro e senha temporária quando aplicável.
3. Dashboard com período selecionável e KPIs coerentes com dados de teste.
4. Biblioteca de treinos com criação de treino geral e filtros.
5. Desafios criáveis e listáveis com conclusões visíveis.
6. Páginas de gamificação e risco de cancelamento alimentadas pelas fontes documentadas.

---

## Referência rápida — rotas

| Rota | Descrição |
|------|-----------|
| `/login` | Autenticação |
| `/dashboard` | Visão geral (KPIs, ranking, risco, treinos) |
| `/alunos` | Lista + cadastro de alunos |
| `/alunos/:id` | Perfil completo do aluno |
| `/treinos` | Biblioteca e prescrição de treinos |
| `/desafios` | Desafios semanais |
| `/gamificacao` | Ranking e badges |
| `/risco-cancelamento` | Lista priorizada por risco |
