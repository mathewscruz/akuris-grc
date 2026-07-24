## Objetivo

Replicar no Gap Analysis a mesma bateria de garantia que fizemos no DocGen: testes determinísticos do scoring canônico, testes E2E das Edge Functions de IA, simulação Playwright do fluxo do usuário e auditoria de consistência de score entre as telas. Cobrir tudo com créditos reais no gateway (autorizado).

---

## Onda 1 — Testes determinísticos do scoring canônico

Novo arquivo: `src/lib/__tests__/gap-analysis-scoring.test.ts` (Vitest — já configurado no projeto).

Cobre `src/lib/gap-analysis-scoring.ts`:
- Fórmula 100/50/0 com mix de status → score correto arredondado.
- `nao_aplicavel` sai do denominador.
- Requisitos sem avaliação contam como 0 no numerador mas permanecem no denominador (parity com `useFrameworkScore`).
- `totalRequirements = 0` → score 0 sem divisão por zero.
- `countEvaluated` ignora `nao_avaliado` e vazio, aceita N/A.
- Regressão do bug "50% vs 48%": simula 10 conformes, 5 parciais, 5 não avaliados, 2 N/A e trava o número exato.

Novo arquivo: `supabase/functions/_shared/gap-scoring-parity_test.ts`.
- Garante que `computeConformityScore` (frontend) e a fórmula usada em `computeAnalyzedScore` (`_shared/compliance-score.ts`) devolvem o MESMO score para o mesmo conjunto de status. Isso trava o contrato compartilhado entre Gap Analysis, DocGen e o analisador.

---

## Onda 2 — Testes E2E das Edge Functions de IA

Novos arquivos Deno test (`--allow-net --allow-env`, seguindo a convenção `*_test.ts`):

1. `supabase/functions/gap-analysis-ai-diagnostic/index_test.ts`
   - Sem JWT → 401.
   - JWT válido sem empresa_id no framework do usuário → 403.
   - Payload válido → 200, resposta contém `diagnostico`, `pontos_fortes`, `gaps`, `recomendacoes`, `roadmap`. Consome crédito real.
   - Sem créditos → 402 (verifica o wrapper `_shared/ai.ts`).
   - Framework de outra empresa → 403 (multi-tenant).

2. `supabase/functions/calculate-assessment-score/index_test.ts`
   - Score determinístico bate com `computeConformityScore` do frontend para o mesmo dataset (mocka 20 avaliações mistas via seed no banco de teste).
   - N/A fora do denominador.
   - Framework sem requisitos → score 0.

3. `supabase/functions/evidence-cross-match/index_test.ts`
   - Requisito de uma empresa X não recebe evidence match de empresa Y (regressão do bug de framework lookup que corrigimos).
   - Retorna 402 quando sem crédito.

4. `supabase/functions/analyze-evidence-against-requirement/index_test.ts`
   - Evidência claramente aderente → status `conforme` com justificativa.
   - Evidência claramente vazia → `nao_conforme`.
   - Reconciliação: se IA responder inconsistente com o texto, o wrapper prevalece.

Todos usam `dotenv/load.ts` e `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY` do `.env` local (padrão já documentado). Consomem sempre `await response.text()` para evitar leak.

---

## Onda 3 — Simulação Playwright do fluxo do usuário

Script `/tmp/browser/gap-analysis/run.py` (headless chromium, viewport 1280x1800, sessão Supabase injetada pelo sandbox).

Passos:
1. Autenticar via `LOVABLE_BROWSER_SUPABASE_*` → abrir `/gap-analysis`.
2. Screenshot da lista de frameworks. Ler contadores de requisitos e conferir contra o banco via `supabase--read_query` (regressão do bug de paginação de 1000).
3. Abrir 1 framework (ex.: ISO 27001). Screenshot.
4. Editar 3 requisitos: 1 conforme, 1 parcial, 1 N/A. Salvar cada um pelo `RequirementDetailDialog`.
5. Anexar uma evidência PDF pequena a 1 requisito. Validar upload multi-tenant.
6. Rodar diagnóstico IA (`gap-analysis-ai-diagnostic`). Screenshot da resposta.
7. Ir para o Dashboard (`/`) e confirmar que o "GRC Maturity" e o card do framework refletem o score novo.
8. Ir para SoA e confirmar que N/A sai do denominador.

Cada passo gera screenshot inspecionado com `code--view`. Falha se qualquer score divergir entre tela e recomputação determinística.

---

## Onda 4 — Auditoria de consistência de score entre telas

Novo arquivo `docs/audits/gap-analysis-score-parity.md` gerado a partir de:
- Grep de todos os call sites que calculam score de conformidade (Dashboard, GapAnalysisFrameworks, GapAnalysisFrameworkDetail, SoA, useGrcMaturityScore, useAdherenceStats, useFrameworksOverview, useGapAnalysisStats).
- Confirmar que todos usam `computeConformityScore`/`gap-analysis-scoring.ts` ou a mesma fórmula do `_shared/compliance-score.ts`.
- Qualquer implementação divergente → refatorar para o módulo canônico na mesma onda.

Se detectar um segundo cálculo paralelo, ele é substituído pelo canônico (mesmo padrão do fix "50% vs 48%").

---

## Onda 5 — Rodar, corrigir, revalidar

- `bunx vitest run src/lib/__tests__/gap-analysis-scoring.test.ts`.
- `supabase--test_edge_functions` para as 4 funções da Onda 2.
- Rodar Playwright da Onda 3.
- Se algum teste falhar, corrigir na fonte (nunca afrouxar a asserção) e rodar de novo até 100%.
- Relatório final: quantos testes passaram, quais bugs a bateria capturou, quais foram corrigidos.

---

## Detalhes técnicos

**Arquivos criados:**
- `src/lib/__tests__/gap-analysis-scoring.test.ts`
- `supabase/functions/_shared/gap-scoring-parity_test.ts`
- `supabase/functions/gap-analysis-ai-diagnostic/index_test.ts`
- `supabase/functions/calculate-assessment-score/index_test.ts`
- `supabase/functions/evidence-cross-match/index_test.ts`
- `supabase/functions/analyze-evidence-against-requirement/index_test.ts`
- `/tmp/browser/gap-analysis/run.py` (fora do repo — apenas para a simulação)
- `docs/audits/gap-analysis-score-parity.md`

**Arquivos possivelmente alterados (só se a auditoria da Onda 4 achar divergência):**
- Qualquer hook/página que ainda calcule score fora do módulo canônico.

**Sem migrations. Sem alteração de RLS.** Custo IA: ~10-20 créditos entre Onda 2 e Onda 3.
