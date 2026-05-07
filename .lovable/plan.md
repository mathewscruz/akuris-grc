## Objetivo

Reproduzir fielmente as 4 telas do design Claude no módulo `/riscos`, mantendo o `RiscoDialog` (wizard de criação/edição) intacto e adaptando cores/dados ao sistema Akuris (DM Sans, tokens HSL, dark/light, status-tone, AkurisPulse).

## Telas a reproduzir

1. **Visão geral** — banner de apetite + 4 KPIs editoriais clicáveis + gráfico de evolução (área + linha de apetite) + barras de distribuição por categoria + watchlist top 5
2. **Matriz** — 4 KPIs por severidade (Críticos/Altos/Médios/Baixos com vs mês anterior) + heatmap 5×5 com badges empilhados + painel lateral da célula selecionada + rodapé com apetite
3. **Tabela** — chips de visões salvas (Todos / Acima do apetite / Sem responsável / Revisão vencida / Meus riscos) + busca + filtros + DataTable com coluna de severidade pill, P×I, sparkline de tendência, status, responsável (avatar+nome), atualizado, SLA
4. **Drawer lateral 540px** com 4 abas: Visão (descrição, nível inicial × residual, causas/consequências, tags) · Tratamentos (lista com barra de progresso por status) · Histórico (timeline) · Controles (lista com % cobertura). Footer fixo com "Aceitar formalmente" e "Novo tratamento"

## Adaptações cromáticas (design → Akuris)

| Design Claude | Akuris |
|---|---|
| Fundo `#fafaf9` warm | `bg-background` (HSL token, navy no dark) |
| Cartões `#ffffff` | `bg-card` |
| Bordas `#e7e5e4` | `border-border` |
| Acento OKLCH azul | `--primary` (#7552FF) |
| Severidade crit/high/med/low | tons já definidos: destructive/warning/amber/success via `resolveNivelRiscoTone` |
| Inter Tight (display) / Inter (body) | DM Sans (toda a UI Akuris) |
| Status chips coloridos | `<StatusBadge>` + `resolveRiscoStatusTone` |

## Arquitetura de arquivos

**Novos** (`src/components/riscos/`):
- `RiscosTabs.tsx` — controla `view` via `?view=overview|matrix|table` (default = `table` para preservar UX atual no primeiro acesso; depois passa a respeitar última escolha via localStorage)
- `overview/AppetiteBanner.tsx`
- `overview/RiskKpiQuad.tsx` — os 4 cards "Acima do apetite / Sem responsável / Revisão vencida / Em tratamento" com CTA inline
- `overview/RiskTrendChart.tsx` — Recharts `ComposedChart` (área + linha + `ReferenceLine` apetite + tabs 3M/6M/12M)
- `overview/RiskCategoryBars.tsx` — barras stack por severidade dentro de cada categoria
- `overview/RiskWatchlist.tsx`
- `matrix/SeverityKpiRow.tsx` — 4 cards com borda lateral colorida e "vs mês anterior"
- `matrix/RiskHeatmap.tsx` — grade 5×5 lendo `riscos_matriz_configuracao` da empresa; badges empilhados com `R-NNN`; clique seleciona célula
- `matrix/HeatmapCellPanel.tsx` — painel lateral sticky com riscos da célula
- `matrix/AppetiteFooter.tsx`
- `table/RiscosViewChips.tsx` — chips de visões salvas (counts derivados)
- `table/SparklineCell.tsx` — promove o `MiniSparkline` já existente em `Riscos.tsx`
- `RiscoDetailDrawer.tsx` — `<Sheet side="right">` 540px desktop, fullscreen mobile, com 4 abas
- `drawer/DrawerVisaoTab.tsx`
- `drawer/DrawerTratamentosTab.tsx` — consome `riscos_tratamentos`
- `drawer/DrawerHistoricoTab.tsx` — consome `riscos_historico_avaliacoes` + auditoria
- `drawer/DrawerControlesTab.tsx` — consome `controles` vinculados ao risco
- `useRiscoDetail.ts` — hook React Query que carrega tratamentos + histórico + controles do risco aberto

**Editados (cirúrgico)**:
- `src/pages/Riscos.tsx` — envolve conteúdo em `RiscosTabs`; adiciona estado `openRiskId` + `<RiscoDetailDrawer/>` global; clique de linha agora abre drawer (botão "Editar" no drawer abre o `RiscoDialog` existente)
- `src/hooks/useRiscosStats.tsx` — adiciona: `acimaApetite`, `semResponsavel`, `revisaoVencida`, `emTratamento`, `serieScore` (agregado por mês p/ trend chart), `apetiteScore` (derivado de `riscos_matriz_configuracao.niveis_risco` — limite superior do nível "médio")
- `src/i18n/pt.ts` + `en.ts` — strings `modules.riscos.views.*` e `modules.riscos.drawer.*`

**Não tocar**: `RiscoDialog`, `RiscoFormWizard`, `MatrizDialog`, `MatrizForm`, `CategoriasDialog`, `TratamentosDialog`, `TratamentoForm`, `AprovacaoRiscoDialog`, `HistoricoAvaliacoesDialog`, `TrilhaAuditoriaRiscos`, `ExportRiscosPDF/CSV`, edge functions, RLS, planos, créditos IA.

## Mapeamento de dados (design → Supabase)

| Campo design | Origem real |
|---|---|
| `R-014` (ID curto) | derivar dos últimos 3 chars do `riscos.id` (uuid), prefixado por `R-`. Display only |
| `prob × imp` | `probabilidade_inicial`/`impacto_inicial` (string "1".."5") |
| Severidade | `nivel_risco_inicial` via `resolveNivelRiscoTone` |
| `status` (Novo/Em tratamento/Monitorado/Tratado) | `riscos.status` (já existe) |
| `responsável` (avatar+iniciais) | `responsavel_nome` + `responsavel_foto` |
| `sla` (no prazo/atenção/vencido) | derivado de `data_proxima_revisao` (já no banco) |
| `treats` (count) | `riscos_tratamentos` agrupado por `risco_id` |
| `apetite` linha | `niveis_risco[médio].max` (do `riscos_matriz_configuracao`) |
| Categoria do design | `categorias.nome` |
| Owner ("TI", "Jurídico"…) | tag livre — usar `categoria.nome` como fallback se não houver campo "owner" |
| Histórico (timeline) | `riscos_historico_avaliacoes` + trilha de auditoria |
| Controles vinculados + % cobertura | `controles_riscos` ↔ `controles.eficacia` |
| Tags | tabela `riscos_tags` se existir; senão exibir só categoria |

Toda query nova com `.eq('empresa_id', profile.empresa_id)` (Core rule).

## Garantias

- Zero migração SQL, zero alteração em RLS / edge / MFA / planos.
- Tabela existente preservada como aba default.
- Loaders = `<AkurisPulse/>`. Badges = `<StatusBadge/>`. Toasts = Sonner. Sem cores Tailwind cruas em badges.
- Tema dark/light via tokens HSL — heatmap usa `bg-destructive/10`, `bg-warning/10`, etc.
- Mobile: drawer vira fullscreen; matriz ganha scroll horizontal; chips de visão viram select.
- i18n PT/EN para todas as strings novas.

## Entrega em 4 ondas (cada uma testável isoladamente)

1. **RiscosTabs + Tabela refinada** — adiciona as 3 abas (Visão geral e Matriz como placeholders) + chips de visões + coluna de sparkline na tabela atual.
2. **Visão geral completa** — banner, 4 KPIs CTAs, trend chart, barras por categoria, watchlist.
3. **Matriz refeita** — KPIs com vs-mês, heatmap 5×5, painel lateral, rodapé apetite.
4. **RiscoDetailDrawer** — drawer 540px com 4 abas e CTAs; conecta a watchlist, células do heatmap e linhas da tabela.
