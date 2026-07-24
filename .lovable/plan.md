# Validação: DocGen gera documentos com 100% de compliance no Analyzer?

## Objetivo
Provar (com evidência automatizada e execução real) que todo documento gerado pelo DocGen, quando submetido ao `analyze-document-adherence`, retorna 100% de conformidade — ou identificar exatamente onde ainda existe drift.

## Estado atual conhecido
- Onda 5 unificou universo (catálogo completo), juiz (Gemini 3.1 Pro) e constantes (`FRAMEWORK_REQ_CAP=300`, `AUDIT_THRESHOLD=80`, `ANALYZER_BATCH_SIZE=60`) em `_shared/compliance-score.ts`.
- 20/20 testes unitários passam, mas cobrem lógica de score — não o loop real DocGen → Analyzer com LLM.
- Nenhum teste E2E prova hoje que o texto gerado pelo LLM cobre 100% dos requisitos que o Analyzer vai cobrar.

## Plano de validação (4 ondas, sem alterar comportamento em produção sem evidência)

### Onda 1 — Auditoria estática do contrato
1. Reler `docgen-chat/index.ts` e `analyze-document-adherence/index.ts` lado a lado e confirmar:
   - Mesma fonte de requisitos (mesma query, mesmo `FRAMEWORK_REQ_CAP`, mesma ordenação).
   - Mesmo modelo de julgamento e mesmos rótulos (`conforme|parcial|nao_conforme|nao_aplicavel`).
   - Mesma fórmula de score (`computeComplianceScore` chamado com o mesmo shape).
2. Documentar qualquer divergência residual em `docs/audits/docgen-analyzer-contract.md`.

### Onda 2 — Harness E2E real (gera → analisa)
1. Criar `supabase/functions/_tests/docgen_to_analyzer_e2e_test.ts` (Deno test, `--allow-net --allow-env`) que:
   - Seleciona 3 frameworks representativos: um pequeno (ex.: LGPD), um médio (ex.: ISO 27001) e o mais crítico do drift antigo (PCI DSS 4.0.1, 288 sub-reqs).
   - Chama `docgen-chat` action `generate_document` com briefing mínimo padronizado.
   - Encaminha o `document.content` retornado para `analyze-document-adherence`.
   - Asserta `score >= AUDIT_THRESHOLD` (piso) e coleta `score` real, `catalog_size`, `residual_gaps`, itens `parcial`/`nao_conforme`.
2. Rodar via `supabase--test_edge_functions` com timeout 300s e capturar métricas por framework.

### Onda 3 — Diagnóstico do gap (se score < 100)
Para cada requisito marcado `parcial` ou `nao_conforme` pelo Analyzer:
- Registrar `codigo`, veredito, trecho de evidência retornado.
- Classificar a causa em uma de três categorias:
  a. **Omissão do gerador** — requisito não foi endereçado no texto → ajustar prompt do DocGen para forçar cobertura seção-a-seção.
  b. **Divergência de julgamento** — texto cobre mas juiz discorda → ajustar rubrica compartilhada em `_shared/compliance-score.ts` (definições de conforme/parcial).
  c. **Requisito fora de escopo legítimo** — deve virar `nao_aplicavel` com justificativa → gerador deve emitir declaração explícita de N/A.
- Consolidar em `docs/audits/docgen-analyzer-e2e-run.md` com tabela por framework.

### Onda 4 — Correções mínimas e re-validação
- Aplicar somente os ajustes indicados pelo diagnóstico (prompt, rubrica ou schema de N/A) — nada de refator amplo.
- Re-rodar o harness E2E até que todos os 3 frameworks atinjam `score = 100` (ou documentar formalmente por que 100 é inatingível para um framework específico e propor novo piso).
- Adicionar o harness ao conjunto padrão de testes de regressão.

## Detalhes técnicos
- Custo: cada execução E2E consome créditos de IA reais (Gemini 3.1 Pro em generate + judge). Rodar 3 frameworks x 1 iteração ≈ 6 chamadas Pro. Aceitável para validação pontual; harness fica opt-in (não roda em cada save).
- Autenticação: harness usa `SUPABASE_SERVICE_ROLE_KEY` via env, sem tocar em sessão de usuário.
- Isolamento multi-tenant: usar `empresa_id` de teste dedicado; não persistir documentos gerados no banco de produção (chamar com flag `dryRun` — adicionar se não existir).

## Entregáveis
- `docs/audits/docgen-analyzer-contract.md` — auditoria estática.
- `supabase/functions/_tests/docgen_to_analyzer_e2e_test.ts` — harness E2E.
- `docs/audits/docgen-analyzer-e2e-run.md` — resultado da execução real com score por framework.
- Ajustes cirúrgicos em prompt/rubrica somente se o E2E provar drift.

## O que NÃO será feito
- Nenhuma mudança em UI.
- Nenhuma refatoração de módulos fora de DocGen/Analyzer.
- Nenhuma alteração no fluxo de produção antes de o E2E rodar e apontar gap concreto.
