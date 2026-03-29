# PRD — AlimentaAI PWA (app do aluno)

**Versão:** 1.0  
**Data:** 29/03/2026  
**Produto:** Progressive Web App para acompanhamento de treino, nutrição e engajamento (academia / nutrição orientada).

---

## 1. Resumo executivo

O **AlimentaAI PWA** é o aplicativo voltado ao **aluno/atleta**: permite login seguro, visualizar o dia (treino e refeições), executar treinos prescritos (série a série), acompanhar dieta e macros, ver histórico de atividade e participar de **gamificação** (pontos, badges e ranking opcional). O backend é **Supabase** (Auth + Postgres); automações complementares podem usar **n8n** via webhook após conclusão de treino.

**Proposta de valor:** centralizar plano de treino + nutrição no bolso, com experiência instalável (PWA), dados sincronizados com o que a academia ou o profissional já cadastrou no mesmo projeto Supabase.

---

## 2. Objetivos

| Objetivo | Descrição |
|----------|-----------|
| O1 — Adesão ao plano | O aluno vê e executa o treino do dia com clareza (exercícios, séries, vídeos quando houver). |
| O2 — Visibilidade nutricional | Exibir metas e refeições do dia para alinhar consumo ao plano. |
| O3 — Retenção | Streak, conquistas e ranking incentivam consistência sem bloquear o fluxo principal. |
| O4 — Integração operacional | Registrar treinos concluídos no banco e, opcionalmente, disparar n8n (ex.: cálculo de kcal, WhatsApp). |

**Não objetivos explícitos deste repositório:** painel administrativo da academia, prescrição de treinos pelo app (feita fora do PWA), gestão de pagamentos.

---

## 3. Personas e stakeholders

| Persona | Necessidade principal |
|---------|------------------------|
| **Aluno** | Entrar, ver resumo do dia, treinar, checar dieta, histórico e conquistas. |
| **Personal / nutricionista (indireto)** | Dados em `treinos_plano`, `refeicoes`, `metas_macros` consumidos pelo app. |
| **Operação / TI** | Supabase configurado, RLS, scripts de gamificação, webhook n8n opcional. |

---

## 4. Escopo funcional (estado atual no código)

### 4.1 Autenticação e segurança

- Login com **email/senha** (Supabase Auth).
- Rotas privadas: usuário não autenticado é redirecionado para `/login`.
- Fluxo **troca de senha obrigatória**: se `public.usuarios.must_change_password` for verdadeiro, redirecionamento para `/trocar-senha-inicial` até atualizar senha e limpar a flag.
- Associação **Auth → `usuarios`**: resolução por `auth_user_id`, `id` ou `email` (`resolveUsuarioDb`). Sem linha em `usuarios`, o app não deve usar `auth.uid()` como FK de treinos.

### 4.2 Navegação e shell

- **Bottom navigation fixa:** Início (`/`), Dieta (`/nutricao`), Treino (`/treino`), Histórico (`/historico`), Perfil (`/perfil`).
- Layout privado com scroll e área segura inferior (`safe-area`) para dispositivos com notch.

### 4.3 Início — Dashboard (`/`)

- Saudação com base no email.
- **Calendário semanal** e seleção de data.
- Para o dia selecionado: treino planejado (`treinos_plano` + `data_prevista`) ou treino concluído (`treinos_realizados`), e lista de **refeições** (`refeicoes`).
- Resumo agregado de refeições (totais, pendentes, kcal, proteína).
- **Widget de streak** (dias consecutivos ativos: ≥1 refeição ou ≥1 treino concluído no dia).

### 4.4 Treino (`/treino`)

- Listagem de treinos disponíveis (inclui planos do personal e fluxos auxiliares definidos no código, ex. categorias e RPCs quando aplicável).
- Filtro por categoria (ex.: peito, membros superiores, pernas).
- Detalhe do treino: exercícios com séries marcáveis, conclusão por exercício, suporte a **vídeo** (YouTube, Vimeo, arquivo direto ou link).
- **Finalizar treino:** insert em `treinos_realizados` com `concluido: true`, exercícios resumidos (nome, séries feitas, MET, duração estimada por exercício).
- Pós-conclusão: atualização de **gamificação** (RPC resumo), detecção de **badge** recente (toast), e **POST opcional** para `VITE_N8N_WEBHOOK_TREINO` com `usuario_id`, `exercicios`, `duracao_total_min`.
- UI continua em estado “concluído” mesmo se persistência ou webhook falharem (mensagem de erro não bloqueia encerramento visual).

### 4.5 Nutrição — Dieta (`/nutricao`)

- Navegação dia a dia (anterior / próximo; não avança além de hoje).
- Últimas **metas de macros** (`metas_macros` por `usuario_id`, ordenado por `data_referencia`).
- **Refeições do dia** (`refeicoes`): lista com status (pendente/registrada), kcal e macros; modal com detalhes.
- Cartões de resumo: meta kcal, consumido, proteína, saldo; barras de progresso para P/C/G.

### 4.6 Histórico (`/historico`)

- Visão por período (dia / semana / mês) com navegação.
- Consolidação de treinos realizados e indicadores derivados (conforme implementação atual: duração, kcal quando existir, etc.).

### 4.7 Perfil (`/perfil`)

- Dados básicos: avatar com iniciais, nome (`display_name` em `usuarios` ou prefixo do email), email.
- Incorpora a tela **Conquistas** (não é rota separada na `App`).

### 4.8 Gamificação (embutida em Treino + Conquistas no Perfil)

- RPCs: `rpc_gamificacao_resumo`, `rpc_gamificacao_leaderboard`, `rpc_gamificacao_set_ranking_opt_in`, `rpc_gamificacao_set_display_name`.
- Tabelas: `gamificacao_badges`, `gamificacao_usuario_badges` (e lógica no SQL/migrations do repositório).
- Abas típicas: resumo, conquistas (badges), ranking, configuração (opt-in ranking, nome de exibição, sair).

---

## 5. Requisitos não funcionais

| Área | Requisito |
|------|-----------|
| **Plataforma** | SPA React 18 + Vite; React Router v6. |
| **PWA** | `vite-plugin-pwa`: manifest AlimentaAI, `display: standalone`, ícones, workbox para assets estáticos, `registerType: autoUpdate`. |
| **Backend** | Supabase client com variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`. |
| **Idioma / locale** | Interface em português; formatação de datas pt-BR onde aplicável. |
| **UX mobile** | `100dvh`, navegação inferior, tema escuro com acentos (lime) alinhados ao CSS do projeto. |
| **Confiabilidade** | Operações críticas de treino: falha de rede não deve travar indefinidamente a UI (comportamento atual: concluir fluxo na UI com try/catch silencioso no final). |

---

## 6. Integrações

| Sistema | Uso |
|---------|-----|
| **Supabase Auth** | Sessão, credenciais. |
| **Supabase Postgres** | `usuarios`, `treinos_plano`, `treinos_realizados`, `refeicoes`, `metas_macros`, gamificação. |
| **n8n (opcional)** | Webhook JSON ao finalizar treino; pode calcular kcal, persistir e notificar (ex.: WhatsApp), conforme fluxo externo. |

---

## 7. Modelo de dados (mínimo referenciado pelo app)

- **`usuarios`:** ligação com auth (`auth_user_id`, `email`, `must_change_password`, `display_name`, etc.).
- **`treinos_plano`:** `usuario_id`, `nome`, `personal_id`, `data_prevista`, `exercicios` (jsonb), `criado_pelo_aluno`, `categoria`, timestamps.
- **`treinos_realizados`:** `usuario_id`, `plano_id`, `nome`, `data_hora`, `exercicios`, `duracao_min`, `kcal_gastas`, `concluido`.
- **`refeicoes`:** por `usuario_id` e `data_hora`; campos flexíveis para kcal, macros, status, observações.
- **`metas_macros`:** metas diárias/referência por usuário.
- **Gamificação:** badges, concessões por usuário, triggers/RPCs (ver `scripts/migrations/gamificacao_completo.sql`).

Scripts e seeds no repositório documentam evolução do schema (`scripts/migrations/`, `scripts/seed_*.sql`).

---

## 8. Fluxos críticos

1. **Onboarding técnico:** criar usuário em Auth + linha em `usuarios` com vínculo correto → aluno faz login.
2. **Primeiro acesso com senha provisória:** login → `/trocar-senha-inicial` → atualização Auth + `must_change_password = false` → Dashboard.
3. **Dia típico:** Dashboard mostra treino/refeições → Treino executado → insert `treinos_realizados` → gamificação + webhook → retorno à lista ou conclusão.
4. **Streak:** leitura de `treinos_realizados` e `refeicoes` em janela recente para marcar dias ativos.

---

## 9. Métricas de produto (sugestão)

- DAU / retenção D7 (alunos com sessão).
- Taxa de treinos iniciados vs. concluídos (via `treinos_realizados`).
- Média de dias com streak ≥ 3.
- Uso de Dieta (dias com ≥1 refeição visualizada ou registrada no backend).
- Opt-in ao ranking (se política de privacidade permitir divulgação agregada).

---

## 10. Riscos e dependências

- **Sincronização Auth ↔ `usuarios`:** falha de cadastro duplica ou desencontra IDs → treinos não carregam.
- **RLS Supabase:** políticas devem permitir leitura/escrita apenas do próprio `usuario_id`.
- **RPCs de gamificação ausentes:** resumo/ranking quebram ou retornam erro; o app deve degradar com mensagens amigáveis onde já tratado.
- **Webhook n8n:** URL inválida ou indisponível não deve impedir uso local do app (tratamento atual: POST best-effort).

---

## 11. Roadmap sugerido (fora do escopo fechado do PRD)

- Tela dedicada de **Conquistas** na navegação principal (hoje só no Perfil).
- **Evolução** corporal / gráficos (README antigo citava `/evolucao`; rota não está no `App.jsx` atual).
- Registro de refeições pelo aluno no app (hoje consumo majoritariamente leitura).
- Notificações push (PWA) para lembrete de treino/refeição.
- Testes E2E (Playwright) para fluxos login → treino → conclusão.

---

## 12. Glossário

| Termo | Significado |
|-------|-------------|
| **PWA** | App web instalável, com manifest e service worker. |
| **Plano** | Registro em `treinos_plano` com data e exercícios. |
| **Streak** | Sequência de dias com atividade (treino concluído ou refeição registrada). |
| **MET** | Metabolic equivalent; usado no resumo enviado ao webhook e armazenado no json de exercícios. |

---

*Documento derivado da implementação em `src/` e `README.md` deste repositório; atualizar quando rotas, tabelas ou integrações mudarem.*
