
# Reforma Gap Analysis — Estrutura Claude, Identidade Akuris

Reorganizar o módulo Gap Analysis em **5 telas + 4 overlays** conforme o design enviado, mantendo Navy/Purple/DM Sans, tokens semânticos atuais (`success/warning/destructive/info/primary`), `StatusBadge`, `AkurisPulse`, ícones proprietários e regras de segurança/empresa_id.

A reforma é grande e será entregue em **5 ondas independentes**, cada uma testável isoladamente. Implementadas em sequência, mas você pode pausar entre ondas.

---

## Inventário de mudanças (resumo do que existe vs. o que vem)

| Tela | Hoje | Novo |
|---|---|---|
| Frameworks (lista) | `WelcomeHero` + `FrameworkCard` grid + `FrameworkCatalog` | Hero de Maturidade (escala 5 níveis + próximo marco + gaps + insight IA) + framework ativo full-width com `StackBar` + "Recomendados pela IA" com % de sobreposição + "Outros disponíveis" |
| Avaliação | `FrameworkHeroSummary` (donut) + `CategoryBarChart` + `GenericRequirementsTable` | 3 cards **Insight strips** (Onde focar / Padrão detectado / Ganho rápido) + Donut compacto + **Fila de prioridade IA (top-5)** + **Heatmap por seção** + tabela com coluna **"IA sugere"**, density toggle, chips de filtro contextuais |
| Documentos | parte do `EvidenceLibraryHub` | **Hero dropzone roxo** ("Suba o documento, a IA mapeia"), tipos sugeridos faltantes, 4 KPIs, cards de análises recentes com chips de cláusulas cobertas/gaps + badge de confiança IA |
| Remediação | `RemediationTab` (StatCards + lista simples) | 4 KPIs + **Sugestões IA por causa-raiz** (agrupa N requisitos em 1 plano consolidado, com esforço/dias/impacto) + **Kanban** (A iniciar / Em andamento / Em revisão / Concluído) |
| SoA | `SoATab` | 7 KPIs compactos + filtros segmentados + **Bulk action bar** dark sticky (alterar status / atribuir / definir prazo / criar plano em lote / gerar justificativa IA) + inline observações |
| **Modal requisito** | `RequirementDetailDialog` (modal central, 1300 linhas) | **Drawer lateral 820px** com tabs (Avaliação/Evidências/Plano/Histórico/Discussão), `StatusSeg` C-P-N-A com atalhos teclado, **AI Diagnostic Card** com confiança/fontes/ações, blocos Texto Oficial + Pontos Avaliados (checklist) + Justificativa, navegação ↑↓ requisitos, footer com autosave + "Salvar e próximo" |
| **Command Palette ⌘K** | inexistente | Overlay global de busca semântica (requisitos, ações rápidas, frameworks) com atalhos |
| **AI Diagnostic Popup** | parte do dialog | Modal compacto inline na tabela (status sugerido, confiança, pontos atendidos, justificativa gerada, Aplicar/Regenerar/Descartar) |
| **Evidence Picker** | `EvidenceReusePanel` | Modal redesenhado: tabela com seleção, "também cobre N cláusulas", aderência por % (verde/amarelo), CTA "Vincular ao requisito X" |

---

## ONDA 1 — Tokens e primitivos compartilhados (base de tudo)

Sem alterações visuais ainda, só plataforma para as ondas seguintes.

**Novos componentes em `src/components/gap-analysis/v2/`:**
- `MaturityScale.tsx` — barra horizontal 5-níveis (Inicial→Otimizado) com tokens `destructive/warning/primary/success`.
- `StackBar.tsx` — barra empilhada (conforme/parcial/não-conforme/N-A) reutilizável.
- `StatusSeg.tsx` — segmented control C / P / N / A com atalhos teclado + indicador de sugestão IA.
- `InsightStrip.tsx` — card de insight com ribbon lateral colorida + label IA + body + CTA.
- `KpiTiny.tsx` — KPI compacto (eyebrow + value tnum + foot) para rows de 4/7 colunas.
- `AIBadge.tsx` — chip "IA" reutilizando token `primary`.
- `FwMono.tsx` — selo monocromático do framework (l1/l2).
- `SectionHead.tsx` — header de seção com title + count + rule + slot direita.

**Tokens novos em `index.css`** (sob `:root` e `.dark`):
- `--gap-rule`, `--gap-surface-2`, `--gap-surface-3` (alias dos atuais para coesão com o design).

**Arquivo**: `src/styles/gap-analysis-tokens.css` (importado uma vez no `index.css`).

**Sem migração de banco.**

---

## ONDA 2 — Página Frameworks (lista)

Reescrever `GapAnalysisFrameworks.tsx` com:
- **Hero de Maturidade**: score grande + nível + delta 30d + `MaturityScale` + sub-cards (Próximo marco com barra de meta, Gaps a tratar com críticos/vencidos, Insight IA usando `useFrameworksOverview`/score histórico já existente).
- **Filtros** mantidos (Search + chips de categoria).
- **Frameworks ativos**: card full-width com `FwMono` + título + `StackBar` + score lateral + CTA "Continuar avaliação".
- **Recomendados pela IA**: 4 tiles com barra de sobreposição (% calculado por overlap de categorias entre frameworks ativos e disponíveis — heurística simples no client; AI scoring real fica para onda futura).
- **Outros disponíveis**: grid compacto restante.

Mantém: `WelcomeHero` para estado vazio inicial, `FrameworkCatalog` lazy-loaded para "Adicionar framework".

---

## ONDA 3 — Página Avaliação (a maior)

Reorganizar `GapAnalysisFrameworkDetail.tsx` + criar componentes:
- **`AssessmentInsightsStrip.tsx`** — 3 insights derivados de `gap_analysis_evaluations` (causa-raiz, gaps por seção, evidências reaproveitáveis).
- **`PriorityQueueCard.tsx`** — top-5 requisitos a triar, ordenados por: crítico > prazo > peso. Coluna direita do hero. Cada item: rank, código, título, motivo IA, status, responsável avatar, botão "Triagem →" abre Drawer.
- **`SectionHeatmap.tsx`** — para cada seção, células coloridas (1 por requisito) com legenda + % e contagem.
- **`v2/RequirementsTableV2.tsx`** — refatorar `GenericRequirementsTable`:
  - Colunas: ☐ / Código (com ⚠ se prioritário) / Requisito / Prazo / Responsável / Status / **IA sugere** / Evid. / Avaliação (select inline).
  - Tools row: chips contextuais (Sem evidência · Críticos · Prazo vencido · Sugeridos IA) + density toggle (usa `useTableDensity` existente) + view toggle (tabela/quadro).
- Mantém `useFrameworkScore`, `loadCategoryData`, etc.

---

## ONDA 4 — Drawer + Overlays (substitui modal atual)

- **`RequirementDrawer.tsx`** — substitui `RequirementDetailDialog`. Sheet lateral 820px (usa shadcn `Sheet`).
  - Header fixo: code badge + Crítico pill + título + close + `StatusSeg` + AI Badge + nav ↑↓ requisitos + meta (framework/seção/responsável/prazo/atualizado).
  - Tabs: Avaliação / Evidências (count) / Plano de Ação (count) / Histórico (count) / Discussão (count).
  - Body: `AIDiagnosticCard` + `OfficialTextBlock` + `EvaluatedPointsChecklist` (4 critérios marcados auto pela IA) + `JustificationTextarea` com botão "Gerar com IA" + autosave.
  - Footer fixo: kbd hints (C/P/N/A status, E evidência, ⌘↵ salvar) + autosave dot + "Próximo requisito" + "Salvar e fechar".
  - Atalhos teclado via novo hook `useDrawerShortcuts`.

- **`CommandPalette.tsx`** — global, ⌘K abre. Busca em `gap_analysis_requirements` (full-text) + ações rápidas + frameworks. Registrado em `App.tsx` ou no layout do módulo.

- **`AIDiagnosticPopup.tsx`** — modal centralizado pequeno, alternativa ao Drawer para triagem rápida na tabela (botão "diagnóstico inline" em cada linha).

- **`EvidencePickerDialog.tsx`** — refatorar `EvidenceReusePanel` para o layout do design (tabela com aderência, "também cobre N cláusulas", CTA específico).

- Edge function nova: `gap-analysis-ai-diagnostic/index.ts` — recebe `requirement_id` + lista de evidências, retorna `{ status_sugerido, confianca, pontos_atendidos, justificativa, fontes[] }` usando Lovable AI. Respeita `consume_ai_credit` + 402. (Reusa pattern de `analyze-evidence-against-requirement` existente.)

---

## ONDA 5 — Documentos · Remediação · SoA

- **`DocumentosTab.tsx`** (nova aba no detail ou rota dedicada):
  - Hero roxo dropzone + tipos sugeridos faltantes (derivados de cláusulas sem evidência).
  - 4 KPIs (analisados, conformidade média, cláusulas cobertas, sem cobertura).
  - Cards de análises recentes com chips cobre/gaps + confiança IA. Reusa storage atual.

- **`RemediationTabV2.tsx`** — substitui `RemediationTab`:
  - 4 KPIs (gaps abertos, sugeridos IA, em execução, impacto potencial).
  - **`AISuggestedPlanCards.tsx`** — agrupa requisitos não-conformes por `categoria`/causa-raiz e gera 1-3 cards "plano consolidado" com esforço/dias/impacto. Botão "Criar plano →" chama `planos_acao` insert vinculando todos os requirements.
  - Kanban 4 colunas (A iniciar / Em andamento / Em revisão / Concluído) com drag opcional (sem na v1, só botões mover).
  - Edge function `gap-analysis-cluster-plans/index.ts` — agrupa por causa-raiz com IA.

- **`SoATabV2.tsx`** — substitui `SoATab`:
  - 7 KPIs (Total, Aplicáveis, N/A, Conformes, Parciais, Não conformes, Não avaliados).
  - Filtros segmentados (Cláusulas / Anexo A / Todos).
  - Tabela com checkbox por linha + observações inline.
  - **`BulkActionBar.tsx`** — barra dark sticky aparece quando 1+ selecionados: Alterar status / Atribuir / Definir prazo / Criar plano em lote / Gerar justificativa IA / Limpar.

---

## Detalhes técnicos

- **Identidade preservada**: nada de `oklch()` cru, Hanken Grotesk, off-white #f0eee9. Tudo via `hsl(var(--*))`, DM Sans, `bg-background`. Roxo Akuris (`--primary`) ocupa o papel do "roxo atenuado" do design.
- **Status colors**: continua `success/warning/destructive/info/muted-foreground` via `STATUS_BG_CLASS`/`STATUS_TEXT_CLASS` de `gap-analysis-tokens.ts`.
- **Loading**: `AkurisPulse` em todos os pontos, nada de `animate-spin`/skeleton visível.
- **Badges**: `StatusBadge` + `status-tone.tsx`, sem cores Tailwind cruas.
- **Tabelas**: respeitam `useTableDensity`.
- **Segurança**: toda query mantém `.eq('empresa_id', empresaId)`.
- **AI Credits**: novas edge functions chamam `consume_ai_credit` RPC, retornam 402.
- **Logs**: `logger.ts`, `invokeEdgeFunction` wrapper.
- **Sem mudança de schema** na v1 (todas as features novas operam sobre tabelas existentes: `gap_analysis_frameworks`, `_requirements`, `_evaluations`, `planos_acao`).

## Arquivos que serão removidos/depreciados ao final

- `RequirementDetailDialog.tsx` (1300 linhas) → substituído por `RequirementDrawer.tsx`.
- `EvidenceReusePanel.tsx` → substituído por `EvidencePickerDialog.tsx`.
- `RemediationTab.tsx`, `SoATab.tsx` → V2.
- `FrameworkHeroSummary.tsx` é mantido (usado em outros pontos), mas o detail page passa a usar componentes novos.

## Quanto demora

Cada onda = 1 a 2 conversas. Recomendo aprovar o plano e fazermos **Onda 1 + 2** primeiro (base + Frameworks), validamos visualmente, e seguimos.

```text
Onda 1  [primitivos]       ───┐
Onda 2  [Frameworks list]  ───┤  validar
Onda 3  [Avaliação grande] ───┤
Onda 4  [Drawer + ⌘K]      ───┤  validar
Onda 5  [Docs · Rem · SoA] ───┘
```

---

## Status

- **Onda 1** ✅ primitivos criados em `src/components/gap-analysis/v2/`.
- **Onda 2** ✅ página Frameworks reformulada:
  - `MaturityHero` (score grande, MaturityScale CMMI, StackBar global, 3 KPIs).
  - `AIRecommendedTile` (selo FwMono, badge IA, overlap %, CTA).
  - `ActiveFrameworkRow` (full-width: selo + score 50px + StackBar + chips + CTA).
  - `fw-utils.ts` (deriveFwMono, getFwCategory).
  - Loader trocado por `AkurisPulse`.
  - `WelcomeHero` e `FrameworkCatalog` mantidos (zero-state e catálogo agrupado).

- **Onda 3** ✅ página de Avaliação reformulada:
  - `AssessmentInsightsStrip` (3 cartões editoriais: Cobertura · Criticidade · Parciais com CTAs).
  - `PriorityQueueCard` (top-5 requisitos ordenados por peso × penalidade de status × urgência de prazo; CTA "Triagem" filtra a tabela via `?q=`).
  - `SectionHeatmap` (grade compacta de categorias substituindo `CategoryBarChart`, clique filtra a tabela).
  - Tabela de requisitos preservada (será substituída na Onda 4 junto com o Drawer).
