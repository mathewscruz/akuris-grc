## Objetivo

Aproveitar a sessão autenticada para (1) validar de ponta a ponta os fluxos reais do **Gap Analysis** e do **DocGen** com Playwright e (2) entregar melhorias de UX de baixo risco, sem tocar em fórmula de score, RLS, créditos IA ou contratos das Edge Functions já testados.

---

## Onda 1 — Simulação Playwright autenticada (diagnóstico)

Rodar headless contra `http://localhost:8080` reusando a sessão Supabase injetada no sandbox. Cada passo gera screenshot em `/tmp/browser/pente-fino/screenshots/` + log de console/rede. O relatório vira a lista final de bugs.

**Gap Analysis**
1. `/gap-analysis` → conferir que os cards batem com `useGapAnalysisStats` (nº requisitos, % conformidade, pendentes).
2. Abrir 1 framework → conferir score do donut, aba **Requisitos**, filtros e paginação (`GenericRequirementsTable`).
3. Editar 1 requisito para `conforme`, 1 para `parcial`, 1 para `nao_aplicavel` → conferir se o score recalcula igual à fórmula canônica (`computeConformityScore`).
4. Rodar **Diagnóstico IA** (`gap-analysis-ai-diagnostic`) e conferir consumo de crédito + render do resultado.
5. Upload de evidência num requisito → `analyze-evidence-against-requirement` → conferir status pós-análise.
6. Voltar para o dashboard e conferir se o número global bateu com a soma dos frameworks (paridade UI).

**DocGen**
1. `/documentos` → abrir DocGen → briefing curto para uma **Política de Mesa Limpa (ISO 27001)**.
2. Gerar documento → capturar `initial_score`, `coverage_map`, warnings, quality-gate retry.
3. Chat de refino ("adicione responsabilidades do DPO") → conferir `refine_document` e `compliance_impact`.
4. Refinar 1 seção → conferir `refine_section`.
5. Análise rápida de aderência → comparar com `initial_score` (esperado ≥ 80% e paridade).
6. Publicar em Documentos → conferir se o registro aparece em `/documentos` com framework/coverage vinculados.
7. Exportar PDF e DOCX → renderizar 1ª página com PIL e inspecionar visualmente capa/sumário/rodapé.

Saída: `docs/audits/pente-fino-simulacao-2026-07.md` com screenshots, achados e severidade.

---

## Onda 2 — Melhorias de UX no Gap Analysis (sem mexer em fórmula)

Apenas camada visual/interação. Nenhuma mudança em `gap-analysis-scoring.ts`, RLS ou Edge Functions testados.

1. **Empty state editorial** na tabela de requisitos quando filtros não retornam nada (hoje mostra área em branco). Componente `EmptyState` já existe (`design/foundations/visual-evolution-onda2`).
2. **Feedback otimista** ao trocar status de um requisito: badge muda antes do round-trip, com rollback em erro (Sonner). Já usamos o padrão em outros módulos.
3. **Atalhos de teclado** no `RequirementDrawer`: `←/→` navega entre requisitos, `1/2/3/4` seta status (`conforme/parcial/nao_conforme/nao_aplicavel`), `Esc` fecha. Reaproveita `useWizardShortcuts`.
4. **Filtros persistentes** por framework em `sessionStorage` (status, categoria, busca) — hoje resetam ao trocar de aba.
5. **Indicador de "não avaliados"** no topo da tabela: chip contando quantos ainda estão em `nao_avaliado`, com clique aplicando filtro. Reduz confusão do "porque o score não subiu".
6. **Toast pós-diagnóstico IA** com CTA "Ver plano de ação" que abre o drawer direto na aba correta.

---

## Onda 3 — Melhorias de UX no DocGen (sem mexer em prompt/modelo)

Nada em `docgen-chat/index.ts` (prompts, modelo, quality gate) — só UI/UX.

1. **Barra de progresso da geração** com etapas nomeadas (`Coletando requisitos → Redigindo → Validando qualidade → Calculando aderência`), substituindo o spinner atual. Estados vêm dos eventos que a função já emite.
2. **Chip de score ao vivo** no header do `DocGenDialog` mostrando `initial_score` + delta após cada refino (verde/vermelho, com tooltip explicando).
3. **Confirmação antes de publicar** quando `initial_score < 80` ou há seções fracas marcadas pelo quality gate — evita salvar um doc capenga por acidente.
4. **Copiar link do documento** após publicar (Sonner com botão "Copiar link" que aponta para `/documentos?doc=<id>`).
5. **Histórico de refinos visível** no chat (hoje mistura briefing e refino): agrupar por rodada com selo `Refino #1`, `Refino #2` e o delta de score de cada um.
6. **Botão "Restaurar versão anterior"** no header quando um refino piora o score em ≥ 10 pontos — usa o snapshot já persistido em `docgen_generated_docs`.
7. **Placeholder no chat** contextualizando: "Peça ajustes específicos: adicionar cláusula, remover trecho, reforçar responsabilidades…" — reduz mensagens genéricas que consomem crédito à toa.

---

## Onda 4 — Re-simulação e relatório

Rodar novamente a bateria da Onda 1 comparando *antes/depois*:
- Screenshots do fluxo Gap com atalhos + filtros persistentes.
- Screenshots do DocGen com progresso nomeado + chip de score.
- Confirmar que os 33 testes automatizados (13 Vitest + 20 Deno) continuam verdes.
- Atualizar `docs/audits/pente-fino-simulacao-2026-07.md` com seção "Depois".

---

## Detalhes técnicos (para a equipe)

**Arquivos que serão editados (frontend, presentation apenas):**
- `src/components/gap-analysis/v2/RequirementDrawer.tsx`, `RequirementsTableToolbar.tsx`, `GenericRequirementsTable`
- `src/hooks/useGapAnalysisFilters.ts` (novo, `sessionStorage`)
- `src/components/documentos/DocGenDialog.tsx` (progresso, chip de score, confirmação, histórico agrupado)
- `src/contexts/DocGenContext.tsx` (expor snapshots já persistidos para restore)

**Não muda:**
- `supabase/functions/docgen-chat/`, `analyze-document-adherence/`, `gap-analysis-ai-diagnostic/`, `calculate-assessment-score/`, `evidence-cross-match/`, `analyze-evidence-against-requirement/`
- `_shared/compliance-score.ts`, `src/lib/gap-analysis-scoring.ts`
- Fluxo de créditos IA, RLS, migrations
- Testes existentes (devem continuar passando sem alteração)

**Nenhuma migration.** **Nenhum novo consumo de crédito IA** (o botão "Restaurar" usa snapshot local).

**Risco:** baixo — todas as mudanças são aditivas na UI. Feature flags não são necessárias porque cada melhoria degrada com graça se falhar (ex.: filtro persistente cai para default se `sessionStorage` bloqueado).
