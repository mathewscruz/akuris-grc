# Plano — Correção do Módulo Gap Analysis

Auditoria completa identificou 15 problemas reais que impedem o usuário de usar a ferramenta com confiança. Plano abaixo prioriza correções por impacto no usuário e integridade do produto.

## Wave 1 — Críticos (bloqueiam uso correto da ferramenta)

### 1. SoA desconectada do score real
Hoje o usuário marca 30 controles como "não aplicáveis" na aba SoA (ISO 27001 Anexo A), salva, gera o PDF do Statement of Applicability — mas o score do framework continua penalizando esses controles. Quebra o propósito da SoA.

**Fix em `src/components/gap-analysis/v2/SoATabV2.tsx` (`handleSave`):** ao gravar em `gap_analysis_soa`, fazer upsert paralelo em `gap_analysis_evaluations` setando `conformity_status='nao_aplicavel'` para itens marcados não-aplicáveis, e revertendo para `nao_avaliado` quando o usuário voltar a marcar como aplicável (preservando status "conforme/parcial/nao_conforme" pré-existentes quando havia avaliação real).

### 2. `evidence-cross-match` inoperante em produção
A função consulta `gap_analysis_assessments` para descobrir frameworks ativos, mas nenhuma tela do produto grava nessa tabela — o fluxo real usa `gap_analysis_evaluations`. Sempre retorna "nenhum framework ativo".

**Fix em `supabase/functions/evidence-cross-match/index.ts`:** trocar a fonte de frameworks ativos para `SELECT DISTINCT framework_id FROM gap_analysis_evaluations WHERE empresa_id = ?`, mesmo padrão de `GapAnalysisFrameworks.tsx`.

### 3–4. Crédito de IA consumido antes de validação/entrega
`populate-requirement-guidance` e `analyze-evidence-against-requirement` debitam crédito antes da chamada ao gateway. Se o payload for inválido ou o gateway devolver 429/500, o usuário paga sem receber nada. Padrão já corrigido em `gap-analysis-ai-diagnostic` mas não replicado.

**Fix:** mover `consume_ai_credit` para depois de validar payload e confirmar `aiResp.ok`, replicando exatamente o padrão de `gap-analysis-ai-diagnostic/index.ts`. Aplicar em ambas as funções (inclusive no loop batch de `populate-requirement-guidance`).

## Wave 2 — Alto impacto

### 5. Hooks de dashboard sem filtro `empresa_id`/`is_template` em `gap_analysis_frameworks`
`useFrameworksOverview.ts`, `useGapAnalysisStats.tsx`, `useFrameworkRequirementCount.ts` fazem `select` sem filtro, contrariando o padrão de `GapAnalysisFrameworks.tsx`. Risco de defesa-em-profundidade quebrada + contagens incorretas quando existirem frameworks customizados por empresa.

**Fix:** padronizar os três hooks com `.or('empresa_id.is.null,empresa_id.eq.<id>')` + `.eq('is_template', true)` conforme aplicável.

### 6. `AdherenceAssessmentView` sem `.eq('empresa_id')`
Depende só de RLS. Adicionar filtro explícito por empresa em `src/components/gap-analysis/adherence/AdherenceAssessmentView.tsx` (query de listagem).

### 7. Metadado de modelo/provider incorreto em `analyze-document-adherence`
Grava `claude-sonnet-4` / `anthropic`, mas chama `google/gemini-3-flash-preview`. Problema de integridade para trilha de auditoria — o produto vende evidência de compliance.

**Fix:** atualizar `metadados_analise` para refletir modelo real usado (`google/gemini-3-flash-preview`, provider `lovable-ai-gateway`).

### 8. Corte silencioso de 150 requisitos em análises de aderência
Frameworks grandes (PCI DSS ~288) são analisados apenas sobre a primeira metade sem qualquer aviso ao usuário — score exibido é enganoso.

**Fix:** incluir `total_requisitos_analisados` e `total_requisitos_framework` no payload de resposta e exibir aviso na UI (`AdherenceResultView`) quando houver truncamento. Idealmente processar em batches, mas para escopo curto: pelo menos avisar.

## Wave 3 — Médio

### 9. `GenericRequirementsTable.loadRequirements` sem paginação
Aplicar `fetchAllPaginated` (helper já criado no projeto conforme memória) na query de `gap_analysis_requirements` por `framework_id`.

### 10. Extrair função pura `computeConformityScore`
Consolidar 3 implementações duplicadas do cálculo de score em `src/lib/gap-analysis-scoring.ts` e reutilizar em `useFrameworkScore`, `useFrameworksOverview`, `useGapAnalysisStats`, `GenericRequirementsTable`.

### 11. Concorrência otimista em `RequirementDetailDialog.handleSave`
Adicionar comparação por `updated_at` no `.update(...)` e, em conflito, mostrar toast "Este requisito foi atualizado por outro usuário. Recarregue para ver as mudanças." antes de sobrescrever `observacoes`/`plano_acao`/`evidence_files`.

### 12–13. Upload de evidências
- Validar `file.size` (limite 20MB) e `file.type` (whitelist: pdf/docx/xlsx/png/jpg/zip) antes do upload.
- Trocar `getPublicUrl` por `createSignedUrl` (bucket privado por padrão para evidências de compliance) e salvar path + gerar signed URL on-demand na visualização.
- Coletar sucessos/falhas do loop de upload e reportar resumo em vez de abortar no primeiro erro.

## Wave 4 — Baixo (crash-prevention)

### 14. Fallback seguro em `getStatusBadge`
`GenericRequirementsTable.tsx`: `const s = statusMap[status] ?? statusMap.nao_avaliado;`

### 15. Log + toast em `loadCategoryData` do `GapAnalysisFrameworkDetail`
Remover `catch { /* silent */ }` e usar `logger.error` + toast discreto.

## Detalhes técnicos

```text
Ordem de execução (uma migration não é necessária; tudo é código):

Wave 1 → 4 edge functions + 1 componente frontend (SoATabV2)
Wave 2 → 3 hooks + 1 view + 1 edge function
Wave 3 → 1 lib nova + 4 arquivos refatorados + 1 componente (RequirementDetailDialog)
Wave 4 → 2 arquivos, patches pequenos

Redeploy das edge functions afetadas:
- evidence-cross-match
- populate-requirement-guidance
- analyze-evidence-against-requirement
- analyze-document-adherence
```

## Validação após implementação

1. SoA: marcar 5 controles como não-aplicáveis, salvar, conferir que score subiu (ou pelo menos denominador diminuiu) no card do framework e no dashboard.
2. Evidence cross-match: chamar a função com uma empresa que tenha avaliações reais e conferir que retorna sugestões.
3. Crédito IA: chamar `populate-requirement-guidance` com `requirementId` inválido e conferir via `creditos_consumo` que nada foi debitado.
4. Hooks: contagens do dashboard batem com a página de frameworks para uma empresa com dados reais.
5. Aderência: rodar contra PCI DSS 4.0 e conferir aviso de truncamento + metadados corretos do modelo.
6. Upload: tentar enviar `.exe` de 100MB e conferir bloqueio com toast claro.

Fora do escopo: mudanças de RLS/policies, mudança de bucket público→privado (requer migração de arquivos existentes — apenas sinalizar ao usuário se optar por privatizar).
