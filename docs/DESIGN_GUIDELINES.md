# Alimenta Aí Portal - Guidelines de Design & UI

Este documento visa estabelecer as diretrizes de design e identidade visual do projeto **Alimenta Aí Portal**, para garantir que todas as novas páginas, componentes ou funcionalidades mantenham forte coesão visual e modernidade inerente do sistema atual.

**Sempre que uma nova funcionalidade de interface for desenvolvida por você (IA) ou outros devs, ela DEVE obedecer às regras aqui descritas.** 

> [!NOTE] 
> O projeto **não** utiliza Tailwind CSS nem Styled Components; todas as estilizações partem de estilos globais controlados por puro CSS a partir do arquivo `src/index.css`.

---

## 🎨 Cores (Variáveis CSS)

O projeto adota um tema **Dark Mode**, com contrastes bem definidos e toques vibrantes na cor Lime (Verde Limão). 

### Fundos (Backgrounds)
As cores de fundo criam uma hierarquia visual de profundidade:
- `var(--bg)`: `#0b0c0e` - Fundo absoluto da aplicação.
- `var(--bg-2)`: `#111316` - Fundo secundário (aplicado em containeres maiores).
- `var(--bg-3)`: `#17191e` - Fundo terciário (aplicado em inputs e cards primários).
- `var(--bg-4)`: `#1e2026` - Fundo de foco e hover (elementos menores e flutuantes).

### Textos
- `var(--text)`: `#eceef2` - Texto primário de alto contraste (títulos, valores principais).
- `var(--text-2)`: `#9da3b0` - Desfoque mediano (subtítulos, descrições secundárias).
- `var(--text-3)`: `#5c6270` - Texto em labels de formulário ou pequenos detalhes de tabela (menor ênfase).

### Acentos e Cores Semânticas
- **Acento Primário (Brand):** `var(--lime)`: `#c9f24d` - Botões de ação primário, modais, spinners e interações alvo.
  - *Variações atreladas*: 
    - `var(--lime-dim)`: `rgba(201, 242, 77, 0.12)` - Background suave para tags lime.
    - `var(--lime-border)`: `rgba(201, 242, 77, 0.28)` - Contornos interativos e glows.
- **Semânticas:**
  - `var(--red)`: `#f05b5b` - Erros, exclusões ou ações destrutivas críticas.
  - `var(--amber)`: `#f0a84b` - Alertas e pendências.
  - `var(--blue)`: `#5b9ef0` - Informações neutras.
  - `var(--green)`: `#4bf07a` - Ações concluídas ou status de sucesso.

### Bordas
Para divisórias ou delineamentos gerais:
- `var(--border)`: `rgba(255, 255, 255, 0.07)` - Bordas base (divisórias de tabela).
- `var(--border-2)`: `rgba(255, 255, 255, 0.12)` - Borda em inputs, outlines de botões falsos e contornos de cards.

---

## 🔤 Tipografia e Espaçamento

### Fontes (Fonts)
O design exala um estilo moderno através dessas combinações:
- **Títulos e Destaques (Display):** `var(--font-display)` -> **'Syne', sans-serif**
- **Corpo e UI (Forms/Tabelas):** `var(--font-body)` -> **'Space Grotesk', sans-serif**
- **Dados brutos/Código:** `var(--font-mono)` -> **'JetBrains Mono', monospace**

### Layout & Estrutura
- **Sidebar Width:** `var(--sidebar-w): 240px`
- **Header Height:** `var(--header-h): 60px`
- **Raio de Bordas (Border Radius):** 
  - O projeto arredonda os cantos num padrão base de **10px** (`var(--radius)`). A preservação desta medida é vital para não distorcer o layout base com componentes pontiagudos.
- **Sombras (Shadows):** 
  - `var(--shadow): 0 4px 24px rgba(0,0,0,0.45)` (Utilizado em modais globais e tooltips).

---

## 🧩 Componentes Modulares e UI Kits

O CSS do projeto disponibiliza tokens utilitárias prontos para uso em qualque view nova. Sempre use-os via `className="nome-da-classe"` e evite injetar CSS arbitrário nos seus arquivos.

### 1. Botões (`.btn`)
Use `.btn` combinado com as variações para criar os *Call to Action*:
- **`.btn-primary`**: Botão Call To Action principal da tela (Lime Background + cor preta).
- **`.btn-ghost`**: Modificador de ações secundárias (Voltar, Cancelar). Background transparente e bordas sutis.
- **`.btn-danger`**: Ações severas e deletérias. Possui marcação vermelha.

### 2. Controles de Formulário (`.field`, `.input`)
A construção de um formulário sempre deve seguir a tríade Container -> Label -> Input Control. 
As classes `.input` em `input`, `textarea`, ou `select` asseguram foco interativo brilhoso na borda que reforça aderência (`--lime-border`).

```jsx
<div className="field">
  <label>Nome do Aluno</label>
  <input type="text" className="input" placeholder="Digite o nome..." />
</div>
```

### 3. Informativos & Badges (`.tag`)
Utilizadas para marcações rápidas, contagens ou definições de status condensadas. Use `.tag` acompanhado da variação referida: (ex: `.tag-green`, `.tag-amber`, `.tag-red`, `.tag-blue`, `.tag-lime`). Elas criam um pill com cantos arredondados, fundo de `0.12` de densidade da cor principal e um tom bold da mesma variação correspondente.

### 4. Tabelas Inteligentes (`.table-wrap`)
Ao carregar listas grandes:
1. Englobe a tabela com `<div className="table-wrap">`.
2. As tags `<table>`, `<thead>`, `<tbody>`, `<tr>`, `<th>` e `<td>` **não** requerem classes. Elas aplicam os espaçamentos automáticos pelo `index.css`.
3. Os cabeçalhos `<th>` automaticamente ficam com formato All Caps, subtom e fonte tamanho `11px`.

### 5. Micro-animações
As entradas de página e feedbacks são fluidos:
- **`className="anim"`**: Um efeito de esmaecimento ("Fade Up/In") para componentes visíveis assim que a rota entrar no display.
- **`className="anim-2" / "anim-3"`**: Efeito idêntico, porém com `animation-delay` maior, gerando o comportamento charmoso de entrada progressiva num layout em cascata.
- **`className="spinner"`**: Um simples indicador giratório com borda circular do tema lime.

---

## 🚀 Boas Práticas para o Desenvolvimento

1. **Inline-Styles Restritos:** Nunca faça o design de componentes base com atributos `style={{ color: '#F3212' ... }}`. Respeite as variáveis base como `style={{ color: 'var(--text-2)' }}` na extrema exclusividade de não poder criar uma classe.
2. **Reutilize:** Todo componente simples, caixas de diálogo, listagem nova, não prescinde de novidade de classe — junte `.field`, `.input`, `.btn`, `.tag`.
3. **Novas Seções:** Se você necessita criar uma folha CSS local nova (ex: `MeuComponente.css`), mantenha estrita menção à `var(--bg-3)` para backplates de cards ou `var(--radius)` (sempre fixado no token `var(--radius)` para as bordas).
