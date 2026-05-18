## Objetivo

Corrigir inconsistências visuais nas abas do módulo Gap Analysis, remover rótulos "Sugestão" / "Sugestão da IA" e padronizar fonte (DM Sans) e cores (tokens semânticos).

## Diagnóstico

Pelos prints anexos identifiquei 4 problemas reais:

1. **Donut de Conformidade com número quebrado** (img-261): o `overallScore` vem do hook como float (ex.: `58.0645161290323`) e o `ConformityCard` renderiza `{overallScore}%` sem `Math.round`. O texto transborda do donut e sobrepõe a legenda. Mesmo problema potencial no `MaturityHero` (col. 1) e em `KpiTiny` de `DocumentsHero`/`RemediationTabV2`.

2. **Status duplicado** (img-262): em algum render de requisito aparece `⚠ NÃO CONFORME  não conforme` — o `StatusBadge` já mostra o label canônico e, ao lado, alguém imprime o `conformity_status` cru. Vou auditar `GenericRequirementsTable`, `RequirementDrawer`, `RequirementDetailDialog` e `PriorityQueueCard` e remover a impressão duplicada.

3. **Rótulos "Sugestão" / "Sugestão da IA"** espalhados:
   - `RemediationTabV2.tsx` — título "Sugestões da IA", chip "Sugestão · cobre X requisitos", empty state "Adote uma sugestão acima".
   - `DocumentsHero.tsx` — "Nenhuma sugestão — todos os requisitos…".
   - `RequirementDrawer.tsx` — "Clique em Gerar diagnóstico para receber a sugestão da IA".
   - `AIDiagnosticCard.tsx` — "Sugestão: {statusLabel}".
   - `EvidenceLibraryHub.tsx` — "Sugestões geradas pela IA", "X sugestões pendentes", "Sugestões para …".
   - `EvidenceReusePanel.tsx` (dialog) — aba "Sugestões da IA · N".
   - `StatusSeg.tsx` — `aria-label="Sugestão da IA"` (apenas a11y, mantém).
   
   Substituição padrão: o módulo já tem o `<AIBadge>IA</AIBadge>`. Vou trocar por rótulos editoriais consistentes (ex.: "Recomendado pela IA" no chip + AIBadge no canto, "Planos consolidados", "Diagnóstico IA", "Itens propostos pela IA"), mantendo apenas o badge **IA** como marcador.

4. **Tipografia não padronizada nos KPIs** (img-263): os números grandes (`0`, `67%`, `68/121`, `53`) parecem renderizar com fallback do sistema porque o `KpiTiny` usa `text-2xl font-semibold` mas o `font-bold tabular-nums` do donut/Hero usa DM Sans. Vou padronizar:
   - números herói → `font-bold tabular-nums tracking-tight` (já é DM Sans via body).
   - KPIs → `font-semibold tabular-nums`, mesmo tamanho/peso em todos os 4 KPI cards visíveis na tela.
   - garantir `Math.round` em todos os valores percentuais antes de renderizar.

## Mudanças propostas (apenas UI/apresentação)

### Aba Avaliação
- `v2/ConformityCard.tsx`: `Math.round(overallScore)` no centro do donut; reduzir `text-3xl` para evitar overflow quando score = 100%; mover legenda para abaixo do donut em viewport apertado.
- Auditar `GenericRequirementsTable.tsx` e remover qualquer span de `conformity_status` cru ao lado do `getStatusBadge`.
- `v2/PriorityQueueCard.tsx` e `v2/RequirementDrawer.tsx`: idem.

### Aba Análise de Documentos
- `v2/DocumentsHero.tsx`: trocar "Nenhuma sugestão — …" por "Sem lacunas documentais — todos os requisitos têm cobertura inicial." Renomear bloco "Tipos sugeridos para esta avaliação" → "Lacunas documentais detectadas". Padronizar `KpiTiny` numéricos.

### Aba Remediação
- `v2/RemediationTabV2.tsx`:
  - KPI eyebrow `SUGERIDOS PELA IA` → `PLANOS CONSOLIDADOS` (mantém AIBadge no card).
  - `SectionHead title="Sugestões da IA"` → `Planos consolidados pela IA`.
  - Chip do cluster `Sugestão · cobre N requisitos` → `Cobre N requisitos` (com `<AIBadge/>` antes).
  - Empty state `Adote uma sugestão acima · ou crie um plano avulso` → `Crie um plano de ação a partir de um requisito não conforme.`
  - Tooltip do KPI "se aplicar todas as sugestões" → "se aplicar todos os planos consolidados".

### Aba Biblioteca de Evidências
- `EvidenceLibraryHub.tsx`: "Sugestões geradas pela IA" → "Cruzamentos identificados pela IA"; "X sugestões pendentes" → "X cruzamentos pendentes"; título do dialog "Sugestões para …" → "Cruzamentos para …".
- `dialogs/EvidenceReusePanel.tsx`: aba `Sugestões da IA` → `Recomendado pela IA` (com `<AIBadge/>`). Toast "Sugestão da IA aceita" → "Recomendação aplicada".
- `dialogs/RequirementDetailDialog.tsx`: "Sugestão da IA:" → "Recomendação IA:" (com badge); "receber uma sugestão de status" → "receber a recomendação de status".
- `v2/AIDiagnosticCard.tsx`: "Sugestão: X" → "Status recomendado: X".
- `v2/RequirementDrawer.tsx`: "receber a sugestão da IA com" → "receber a análise da IA com".

### Padronização tipográfica global do módulo
- Todos os números herói usam classes consistentes: `font-bold tabular-nums tracking-tight` para 4xl+ e `font-semibold tabular-nums` para os KPIs.
- Todos os percentuais derivados de cálculo passam por `Math.round` antes do render.
- Nenhuma cor crua Tailwind — manter apenas tokens semânticos.

## Detalhes técnicos

- Sem alteração de schema, RLS, edge functions ou regra de negócio. Apenas componentes de apresentação.
- Manter `aria-label="Sugestão da IA"` em `StatusSeg.tsx` (acessibilidade descreve a função do botão; não é label visível).
- Preservar o componente `AIBadge` como o único marcador visual de origem IA.

## Validação

1. Abrir `/gap-analysis/framework/:id` → conferir donut sem overflow em score 0%, 58%, 100%.
2. Tabela de requisitos → conferir que cada linha mostra **apenas** o `StatusBadge`, sem texto cru ao lado.
3. Aba Remediação → conferir que nenhum texto contém "Sugestão" / "Sugestões da IA".
4. Aba Documentos → conferir que os 4 KPIs e a tríade têm fonte e peso idênticos.
5. Biblioteca de Evidências e drawer/diálogo de requisito → confirmar substituições.

## O que NÃO faz parte

- Não toca em backend, RLS, edge functions, schema.
- Não muda lógica de score, prioridade, cálculo de aderência.
- Não adiciona novas features — somente equalização visual e textual.
