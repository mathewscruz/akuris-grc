## Objetivo

Fechar os gaps remanescentes para que /riscos fique fiel ao design Riscos-2 (`views.jsx`, `drawer.jsx`, `shared.jsx`), sem tocar no `RiscoDialog` (wizard de criação).

## Mudanças

### 1. Página `src/pages/Riscos.tsx` — limpar topo e ajustar ritmo

- **Remover os 4 StatCards do topo** (`Total`, `Tratamentos Concluídos`, `Riscos Aceitos`, `RiskScoreCard`). No design eles não existem — os KPIs agora vivem dentro das abas (`RiskKpiQuad` na Visão geral, `SeverityKpiRow` na Matriz).
- **Remover** os imports/funções não usadas após a limpeza (`StatCard`, `RiskScoreCard`, `calcTrend`, `MiniSparkline`).
- **Espaçamentos**: trocar `space-y-6` por `space-y-5`, alinhar paddings das views internas (`px-0 py-1`) e usar `gap-5` entre tabs e o conteúdo. Toolbar global (Categorias / Matriz / Exportar / Novo Risco) fica logo abaixo do `PageHeader`, antes do `RiscosTabs`.

### 2. Visão geral (`overview/`)

- **`RiskKpiQuad`**: aumentar valor herói para `text-[42px]`, usar tons distintos por card — `destructive / warning / amber / success` mapeando para 4 cores diferentes (hoje "amber" reusa `bg-warning`). Garantir min-height consistente.
- **`AppetiteBanner`**: ajustar para `border-l-[3px]`, padding `px-4 py-3.5`, ícone com `bg-destructive/10` e texto secundário fonte 12.
- **`RiskWatchlist`**: adicionar chevron direito por linha (`ChevronRight`), trocar dot por `SevDot` (dot + halo soft), reduzir gap interno para 16px.

### 3. Matriz (`matrix/`)

- **`RiskHeatmap`**: adicionar legenda topo-direita com 4 chips (Crítico/Alto/Médio/Baixo) e título "Probabilidade × Impacto / Mapa de calor". Trocar header da Card.
- Remover `Card` interno duplicado da página — `RiskHeatmap` já desenha o card completo (header + grade + legend).
- **`SeverityKpiRow`**: aumentar valor para `text-[28px]` e padding `px-[18px] py-[14px]`, alinhar com design.
- **`HeatmapCellPanel`**: header com `bg-{sev}/8` (já temos parcial), corrigir `tone` para `Médio`/`Baixo` real.

### 4. Tabela (`table/`) — gap maior, criar componentes novos

- **Novo `table/RiscosViewChips.tsx`**: chips/aba inferior `Todos · Acima do apetite · Sem responsável · Revisão vencida · Meus riscos` com counts derivados em tempo real. Visão ativa controla um filtro virtual aplicado antes do `sortedRiscos`.
- **Refatorar colunas da DataTable** para refletir o design:
  - `id` (mono pequeno, `R-XXX` derivado) — coluna nova de 72px
  - `nome` (com `SevDot` antes do texto, click abre drawer — já existe)
  - `categoria` (texto simples)
  - `nivel_risco_inicial` (`SevPill` formato "ALTO" caixa-alta)
  - `pi` (`prob × imp` mono) — coluna nova
  - `trend` (sparkline 52×18) — coluna nova, baseada em diff inicial→residual
  - `status` (StatusBadge — já existe)
  - `responsavel` (avatar 20px + último nome) — ajustar a coluna existente
  - `updated` (relativo "há Nd") — coluna nova
  - `sla` (pill "no prazo / atenção / vencido") — coluna nova baseada em `data_proxima_revisao`
  - `actions` (DropdownMenu — já existe)
- **Promover `MiniSparkline`** para `table/SparklineCell.tsx` reutilizável.
- **Remover** as colunas atuais "Tags" e "Tratam." que não aparecem no design da tabela (continuam acessíveis via drawer).

### 5. Drawer (`RiscoDetailDrawer.tsx`)

- **Header**: linha superior com `R-XXX (mono) · SevPill · StatusBadge` + ações `Editar / X` à direita. Embaixo, título e **grid 4-col** com Categoria / Owner / Responsável / Atualizado em estilo "metadata cards" inline (vs. linha de texto atual).
- **Aba Visão**: trocar texto livre de "Causas/Consequências" por **lista de chips** com tag `CAUSA` / `CONSEQ.` (parseando o texto por linhas, fallback para parágrafo se for um bloco só). Adicionar bloco "Tags" mostrando categoria + nivel_risco residual quando existir.
- **Aba Tratamentos**: cada item ganha **barra de progresso individual** (status `concluído` = 100% verde, `em andamento` = 60% accent, `pendente` = 0% muted). Manter o resumo agregado no topo.
- **Aba Controles**: mostrar **% cobertura grande à direita** (de `eficacia_estimada` interpretado: "Eficaz"=100, "Parcial"=60, "Em implantação"=30, default 0), colorida por faixa.
- **Footer**: à esquerda "Última revisão por X · há Yd" (de `historico` mais recente). À direita: `Aceitar formalmente` + `+ Novo tratamento` (primary).

### 6. Tokens / cores

Sem novos tokens. Mantém `destructive / warning / amber / success` (HSL) com a única ressalva de garantir 4 tons distintos para Críticos/Altos/Médios/Baixos:

| Severidade | Tone |
|---|---|
| Crítico | `destructive` |
| Alto | `warning` |
| Médio | `amber` (hoje reusa warning — corrigir no `RiskKpiQuad` e `RiskCategoryBars` usando `bg-warning/60`) |
| Baixo | `success` |

## Não-mexer

- `RiscoDialog` / `RiscoFormWizard` (wizard de criação/edição).
- SQL, RLS, edge functions, créditos IA, planos.
- `MatrizDialog`, `CategoriasDialog`, `TratamentosDialog`, `AprovacaoRiscoDialog`, `HistoricoAvaliacoesDialog`, `TrilhaAuditoriaRiscos`, exports PDF/CSV.
- `useRiscosStats` (os campos hoje retornados deixam de ser exibidos no topo, mas seguem em uso pelo `useDashboardStats` global / outras telas — manter).

## Arquivos

**Editar**:
- `src/pages/Riscos.tsx` — remove 4 StatCards e imports órfãos; revisa `space-y` e ordem (PageHeader → Toolbar → RiscosTabs).
- `src/components/riscos/overview/RiskKpiQuad.tsx` — mapeamento de tons + valor 42px.
- `src/components/riscos/overview/AppetiteBanner.tsx` — proporções.
- `src/components/riscos/overview/RiskWatchlist.tsx` — chevron + dot halo.
- `src/components/riscos/overview/RiskCategoryBars.tsx` — 4ª faixa Médio (hoje sumida).
- `src/components/riscos/matrix/RiskHeatmap.tsx` — header + legenda interna.
- `src/components/riscos/matrix/SeverityKpiRow.tsx` — proporções.
- `src/components/riscos/RiscoDetailDrawer.tsx` — header em grid, causas/conseq como chips, % cobertura nos controles, last-review no footer.

**Criar**:
- `src/components/riscos/table/RiscosViewChips.tsx`
- `src/components/riscos/table/SparklineCell.tsx`
- `src/components/riscos/table/SlaCell.tsx`

## Garantias

- Tudo segue tokens HSL Akuris (DM Sans, dark/light, sem cores Tailwind cruas em badges).
- `<AkurisPulse/>` permanece como único loader.
- `<StatusBadge/>` para todas as severidades/status; nada de pílulas com `bg-red-100`.
- Multi-tenant intacto (queries já com `.eq('empresa_id', ...)`).
- Mobile: tabela continua com scroll horizontal; chips de visão viram select rolável.
