## Diagnóstico — o que diverge dos mockups

Comparei tela a tela com as 9 imagens enviadas. Identifiquei **3 grupos**:

### A. Equalização tipográfica e cromática (atravessa todas as telas)
Os números grandes do mockup ("47%", "46", "117/121", "+33pts") usam **DM Sans bold**, não monospace. Hoje os componentes V2 (`MaturityHero`, `KpiTiny`, `AssessmentInsightsStrip`, `ActiveFrameworkRow`, `PriorityQueueCard`, `RemediationTabV2`) renderizam esses numerais com `font-mono`, o que produz aspecto técnico ≠ identidade Akuris. **Eyebrows** uppercase (`ÍNDICE DE MATURIDADE`, `PRÓXIMO MARCO`, etc.) ficam em mono — bate com mockup.

O `KpiTiny` tem hoje uma listra colorida no **topo**; mockups das telas Documentos, Remediação e SoA mostram **listra na esquerda** dos cards de KPI.

### B. Telas que precisam de reestruturação visual
1. **Frameworks · Hero (img 252)** — hoje é 2 colunas (score+escala | distribuição+KPIs). Mockup é dashboard de **4 colunas**: `Índice de Maturidade` | `Próximo Marco` | `Gaps a Tratar` | `Insight da IA`. A `MaturityScale` fica embaixo da coluna 1, não em destaque.
2. **Avaliação (img 253)** — hoje renderiza o `FrameworkHeroSummary` (donut grande full-width) + Insights + Priority Queue empilhados. Mockup mostra **Conformidade card (donut compacto) + PriorityQueueCard lado a lado em 2 colunas**, sem o `FrameworkHeroSummary` legado.
3. **Avaliação · Tabela** — falta a faixa de **chips contextuais** (Todos · 121 / Sem evidência · 46 / Críticos · 18 / Prazo vencido · 3 / Sugeridos pela IA · 12) + toggle `Densidade conforto|Compacta` e `Tabela|Quadro` acima do `GenericRequirementsTable`.
4. **Documentos (img 254)** — `DocumentsHero` hoje é uma faixa horizontal só com convite. Mockup tem **2 colunas**: convite à esquerda + painel "Tipos sugeridos para esta avaliação" (com chip "FALTA") à direita.
5. **Remediação (img 255)** — falta o **segmento `Por causa-raiz | Por seção | Por esforço`** acima das sugestões, o **toggle `Quadro | Lista | Timeline`** do board, e os **chips de códigos** dentro dos cards de sugestão IA (4.1 4.2 4.3 ...).

### C. Higiene e remoção de redundância
- `RemediationTab.tsx` (legacy) — substituído por `RemediationTabV2`, nada mais importa: **deletar**.
- `SoATab.tsx` (legacy) — substituído por `SoATabV2`, nada mais importa: **deletar**.
- `FrameworkHeroSummary.tsx` — só é usado em `GapAnalysisFrameworkDetail` (lugar que vamos refatorar). Após o C2 fica órfão: **deletar**.
- `CategoryBarChart.tsx` — não é usado em lugar nenhum desde a Onda 3: **deletar**.
- `dialogs/EvidenceReusePanel.tsx` permanece (usado pelo `RequirementDetailDialog` ainda em uso para "Edição completa" do drawer) — **manter**.

---

## Plano de execução

### Etapa 1 — Padronização tipográfica V2
Substituir `font-mono` por DM Sans nos **números heróicos** dos componentes abaixo, mantendo `tabular-nums` para alinhamento e mantendo `font-mono` nos *eyebrows* (caixa alta + tracking) e em códigos técnicos (`4.1.2`, `A.5.4`):

- `MaturityHero.tsx` — score `47` e KpiCells
- `KpiTiny.tsx` — valor herói + listra de acento muda de `top` para **`left` (2px)**
- `AssessmentInsightsStrip.tsx` — valor herói
- `ActiveFrameworkRow.tsx` — score lateral 47%
- `PriorityQueueCard.tsx` — códigos permanecem em mono; ajustes mínimos
- `RemediationTabV2.tsx` — números dos cards de cluster

### Etapa 2 — Frameworks Hero em 4 colunas (img 252)
Reescrever `MaturityHero.tsx` como `grid grid-cols-1 lg:grid-cols-[1.4fr_1fr_0.8fr_1.2fr]` com separadores verticais sutis (`border-l border-border/40`):

```text
┌──────────────────────┬──────────────┬─────────────┬────────────────┐
│ ÍNDICE DE MATURIDADE │ PRÓXIMO MARCO│ GAPS A TRATAR│ ✦ INSIGHT DA IA│
│ 47%  [Nível 3]       │ Auditoria … │ 46 (destr.) │ Mantendo o     │
│ ▲ +22.4 pts · 30d    │ 26 abr 2026 │ Req. não    │ ritmo…         │
│ [MaturityScale 5lvl] │ progress    │ conformes   │ Ver plano →    │
│                      │ 47%→meta60% │ 18 críticos │                │
│                      │             │ 3 vencidos  │                │
└──────────────────────┴──────────────┴─────────────┴────────────────┘
```

Dados:
- **Próximo Marco** — placeholder estático na primeira passada (o módulo não tem ainda tabela de marcos do framework). Texto "Defina um marco" + CTA se ausente.
- **Gaps a Tratar** — derivar `naoConformeCount` (já calculado) + `criticosCount` (peso alto) + `vencidosCount` (evaluations com `prazo < now`).
- **Insight IA** — texto contextual gerado client-side (mesmo padrão do `contextMessage` atual) com link "Ver plano sugerido →" que troca tab para `remediacao`.

### Etapa 3 — Avaliação · 2 colunas Conformidade + Fila (img 253)
Em `GapAnalysisFrameworkDetail.tsx`:
1. **Remover** o `<FrameworkHeroSummary …>` da aba `avaliacao`.
2. Criar `src/components/gap-analysis/v2/ConformityCard.tsx` — card editorial com:
   - Donut 110px (success/warning/destructive/info), score central
   - Pill "Nível X — Definido" no topo
   - Legenda compacta (Conforme 43 · Parcial 25 · Não conf. 46 · N/A 3)
   - Tríade rodapé: `PROGRESSO 117/121` | `META Q1 60%` | `Δ 30d +22,4`
3. Renderizar `ConformityCard` + `PriorityQueueCard` em `grid lg:grid-cols-[1fr_1.6fr]`.
4. `AssessmentInsightsStrip` continua acima (3 cards).

### Etapa 4 — Avaliação · faixa de chips + toggles acima da tabela (img 253)
Criar `src/components/gap-analysis/v2/RequirementsTableToolbar.tsx`:
- **Chips contextuais** com contagens reais (Todos / Sem evidência / Críticos / Prazo vencido / Sugeridos IA) — cada chip aplica filtro via `searchParams`.
- Toggle `Tabela | Quadro` (Quadro inicialmente desabilitado com tooltip "em breve" — mantém escopo).
- Reaproveitar `DensityToggle` já existente para `Conforto | Compacta`.
- Encaixa **acima** do `<GenericRequirementsTable>` no `<div id="reqs-table">`.

### Etapa 5 — Documentos · hero 2 colunas + tipos sugeridos (img 254)
Refatorar `DocumentsHero.tsx`:
- Grid `lg:grid-cols-[1.6fr_1fr]`.
- Esquerda: convite + 3 botões (Anexar arquivos roxo, Adicionar link, Gerar com IA).
- Direita: painel "TIPOS SUGERIDOS PARA ESTA AVALIAÇÃO" listando 4 tipos derivados dos requisitos sem evidência (`Política de Segurança` cobre A.5.1 etc.) com chip `FALTA`.
- Manter os 4 KpiTiny já existentes — mas agora com listra **esquerda** vinda da Etapa 1.

### Etapa 6 — Remediação · segmentos + Kanban com toggle (img 255)
Em `RemediationTabV2.tsx`:
- Adicionar segmento `Por causa-raiz | Por seção | Por esforço` no header de `Sugestões da IA` (segment controla agrupamento; "Por seção" e "Por esforço" reagrupam o array já carregado).
- Cards de cluster: trocar paragrafo "Tratar N gaps em X" pelo formato do mockup (chips dos códigos: `4.1 4.2 4.3 +5`) e meta `M esforço · 12d estimado · +18 pts impacto`.
- Header do Kanban: toggle `Quadro | Lista | Timeline` (apenas Quadro funcional, demais como "em breve" com tooltip).
- Empty-state do Kanban: 2-col text "Adote uma sugestão acima · ou crie um plano avulso." quando vazio.

### Etapa 7 — Limpeza
Remover arquivos órfãos:
```text
src/components/gap-analysis/RemediationTab.tsx
src/components/gap-analysis/SoATab.tsx
src/components/gap-analysis/FrameworkHeroSummary.tsx
src/components/gap-analysis/CategoryBarChart.tsx
```
E remover imports/usages eventualmente apontando para esses caminhos (já confirmei que após a Etapa 3, ninguém os importa).

---

## Fora deste plano (decisões explícitas)

- **Drawer (img 257), Command Palette (img 258), AI Diagnostic Popup (img 259), Evidence Picker (img 260)** — já implementados nas Ondas 4–5. Nas screenshots tirei o mesmo layout/estrutura; manter como está, sem reabrir.
- **Marcos do framework** — o mockup mostra "Auditoria externa ISO/IEC 27001 · 26 abr 2026". O sistema ainda não tem tabela de marcos por framework. Renderizo como placeholder ("Defina um marco · CTA") nesta passada e crio o banco depois, se você confirmar.
- **Schema** — sem mudanças no banco.

Quando aprovar, executo as 7 etapas sequencialmente em uma única passada (consigo concluir Etapas 1+3+4+5+6+7 no mesmo turno; Etapa 2 é a única que envolve repensar visual de fato).