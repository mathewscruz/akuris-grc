# Auditoria de paridade — Score de Conformidade do Gap Analysis

Data: 2026-07-24

## Objetivo

Garantir que todas as telas do Akuris que exibem "% de conformidade" de um
framework do Gap Analysis usam a **mesma** fórmula canônica:

```
conforme     = 100
parcial      =  50
nao_conforme =   0
nao_aplicavel → fora do denominador
não avaliado → 0 no numerador, mas continua no denominador
score        = round(soma / requisitos_aplicaveis)
```

Fonte da verdade: [`src/lib/gap-analysis-scoring.ts`](../../src/lib/gap-analysis-scoring.ts).

## Call sites auditados

| Componente / Hook | Arquivo | Como calcula | Bate com o canônico? |
| --- | --- | --- | --- |
| Score canônico | `src/lib/gap-analysis-scoring.ts` | `computeConformityScore` | ✅ Fonte |
| Frameworks Overview (Dashboard + Frameworks list) | `src/hooks/useFrameworksOverview.ts` | Fórmula inline com `SCORE_OF={conforme:100,parcial:50,nao_conforme:0}`, `naCount` fora do denominador, evaluated soma sobre `aplicaveis = total - naCount` | ✅ Aritmeticamente idêntica (travada em teste — `src/lib/__tests__/gap-analysis-scoring.test.ts::"Paridade com useFrameworksOverview…"`) |
| Cards de framework do dashboard | `src/hooks/useGapAnalysisStats.tsx` | Loop equivalente: `s = conforme?100:parcial?50:0` + `naByFw` fora do denominador | ✅ Aritmeticamente idêntica |
| Detalhe de framework (Pilares/Áreas/Seções/Domínios) | `src/hooks/useFrameworkScore.tsx` | Soma **ponderada** por `req.peso` (default 1) usando `config.statusScores` (também 100/50/0 para o Gap Analysis padrão) | ✅ Quando todos os pesos = 1 é idêntica; quando há pesos, o número muda **de propósito** (é a definição do framework) |
| Analisador de aderência (Edge) | `supabase/functions/_shared/compliance-score.ts::computeAnalyzedScore` | Mesma fórmula 100/50/0, N/A fora, silentlyMissing como 0 | ✅ Trava travada em `supabase/functions/_shared/gap-scoring-parity_test.ts` |
| DocGen quick_adherence | `supabase/functions/docgen-chat/index.ts` | Usa `computeAnalyzedScore` do módulo compartilhado | ✅ |

## Divergências encontradas

Nenhuma. As 3 implementações do frontend (`gap-analysis-scoring.ts`,
`useFrameworksOverview.ts`, `useGapAnalysisStats.tsx`) são aritmeticamente
equivalentes sob os mesmos dados — comprovado pelo teste
`"Paridade com useFrameworksOverview e useGapAnalysisStats"` em
`src/lib/__tests__/gap-analysis-scoring.test.ts`.

## Por que 3 implementações e não uma?

Cada hook faz agregações diferentes em cima do mesmo cálculo (por framework, por
pilar, por área, para o dashboard etc.). Consolidar em uma única função exigiria
refatorar todos os hooks para o mesmo shape de entrada, o que já foi tentado e
gerou regressões piores. O compromisso atual é:

1. **Um único módulo canônico** (`gap-analysis-scoring.ts`) que documenta a fórmula.
2. **Um teste de paridade** que quebra o CI se qualquer hook divergir.
3. **Comentários em cada hook** apontando para a fórmula canônica.

## Suite de regressão

- `src/lib/__tests__/gap-analysis-scoring.test.ts` — 12 testes vitest
- `supabase/functions/_shared/gap-scoring-parity_test.ts` — 6 testes deno
- Testes de contrato das Edge Functions (auth guards):
  - `supabase/functions/gap-analysis-ai-diagnostic/index_test.ts`
  - `supabase/functions/calculate-assessment-score/index_test.ts`
  - `supabase/functions/evidence-cross-match/index_test.ts`
  - `supabase/functions/analyze-evidence-against-requirement/index_test.ts`
- Testes já existentes do DocGen ⇄ analisador continuam válidos:
  - `supabase/functions/docgen-chat/compliance_test.ts`
  - `supabase/functions/analyze-document-adherence/compliance_test.ts`

## Ação recomendada em futuras alterações

Antes de alterar qualquer fórmula de score:

1. Rodar os testes acima (`bunx vitest run src/lib/__tests__/gap-analysis-scoring.test.ts` + `supabase--test_edge_functions`).
2. Se um teste de paridade quebrar, isso é **intencional** apenas se a fórmula
   canônica de fato mudou — nesse caso, atualizar `gap-analysis-scoring.ts`
   PRIMEIRO e os hooks depois.
3. Nunca introduzir uma quarta cópia da fórmula em componente de UI. Se
   precisar, chamar `computeConformityScore`.
