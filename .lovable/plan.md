# Aderência do DocGen: acabar com o "0% sem sentido"

## Diagnóstico

Investiguei os dois caminhos de análise que hoje existem para um documento vindo do DocGen e encontrei três causas concretas para o score zerar:

1. **`quick_adherence` (botão "Avaliar aderência" dentro do DocGen)** — `supabase/functions/docgen-chat/index.ts` §879–939:
   - Envia à IA só `codigo + titulo + categoria` dos requisitos (sem `descricao`, sem `orientacao_implementacao`, sem `exemplos_evidencias`). A IA não tem como decidir se a seção da política atende ao requisito e tende a marcar tudo como fraco/ausente.
   - Trunca cada seção em 1500 caracteres (`(s.conteudo || '').slice(0, 1500)`) — políticas geradas pelo DocGen frequentemente têm seções maiores, então o texto que provaria conformidade é cortado.
   - `score` vem 100% do JSON da IA. Se a IA não retornar JSON válido, o fallback grava `score: 0` (linha 933).

2. **Upload manual em Gap Analysis → Análise de Aderência** (`AdherenceAssessmentDialog.tsx` + `analyze-document-adherence`):
   - O usuário tem que **exportar** o documento do DocGen (PDF/DOCX via jsPDF/docx), fazer download, e depois re-upload. Nesse caminho a extração de texto do PDF gerado pelo jsPDF frequentemente perde formatação/quebra de seções → a IA recebe um blob "sujo" e não identifica as evidências.
   - `percentual_conformidade` também vem só do JSON da IA, sem fallback determinístico calculado a partir de `requisitos_analisados[].status_aderencia` (que existe no payload). Se a IA erra o campo mas acerta o detalhamento, o score gravado é 0.

3. **Refinos pós-geração não são reavaliados** — `DocGenDialog.tsx` L456 invalida `adherenceResult` quando o usuário refina, mas não há CTA claro para reanalisar; e mesmo reanalisando cai no mesmo `quick_adherence` fraco.

## Escopo

Corrigir os três pontos, sem tocar em outros módulos. Nenhuma migração de schema.

## Mudanças

### 1) `supabase/functions/docgen-chat/index.ts` — `quick_adherence` (Onda 3, ~L879–939)
- Buscar requisitos com `codigo, titulo, descricao, orientacao_implementacao, exemplos_evidencias, categoria`.
- Enviar o documento **completo** (sem `.slice(0,1500)`); apenas aplicar um teto global de ~28k chars para caber no contexto, iterando por seções inteiras.
- Reescrever o system/user prompt no mesmo espírito de `analyze-document-adherence`: auditor sênior avalia política corporativa contra requisitos, cita trechos como evidência, marca `nao_aplicavel` quando o escopo do documento não cobre aquele requisito.
- Pedir no JSON, além do score, um array `requisitos_analisados[]` com `status_aderencia` (conforme/parcial/nao_conforme/nao_aplicavel).
- **Fallback determinístico**: se `score` vier ausente/0 mas houver `requisitos_analisados`, recalcular via a fórmula canônica de `src/lib/gap-analysis-scoring.ts` (conforme=100, parcial=50, resto=0, excluir N/A do denominador). Assim o número gravado passa a refletir os detalhes, não um campo isolado.
- Log estruturado com contagens (`total`, `conformes`, `parciais`, `nao_conformes`, `n_a`) para facilitar diagnóstico futuro.

### 2) `supabase/functions/analyze-document-adherence/index.ts`
- Fallback determinístico igual ao acima: após parse do JSON, se `percentual_conformidade` for 0/ausente e `requisitos_analisados` tiver itens com score, recalcular a partir dos statuses e sobrescrever antes do `update`.
- Aceitar um novo modo `source: 'docgen'` no body: quando o front enviar `docgenDocument` (JSON `{ titulo, secoes: [{nome, conteudo}] }`), usar esse texto reconstruído (`## Seção X: nome\nconteudo`) em vez de baixar do storage. Elimina a rota lossy PDF→extract.
  - Guardas: quando `source === 'docgen'`, `storageFileName` continua opcional; o registro em `gap_analysis_adherence_assessments` grava `documento_nome` como "{titulo} (DocGen)" e `metadados_analise.origem = 'docgen'`.
  - Segurança: mantém `assessmentRow.empresa_id === empresaId`.

### 3) `src/components/documentos/DocGenDialog.tsx`
- `handleRunAdherence` continua chamando `quick_adherence` (rápido, inline), mas agora recebe payload correto graças ao item 1.
- Adicionar botão secundário "Análise completa (salvar no Gap Analysis)" que:
  - Cria assessment em `gap_analysis_adherence_assessments` com `status: 'processando'`, `framework_id`, `nome_analise = titulo do documento`.
  - Chama `analyze-document-adherence` com `source: 'docgen'` + `docgenDocument` (sem upload de arquivo).
  - Ao concluir, mostra o link para o assessment persistido.
- Após `refine_document` bem-sucedido: manter invalidação, mas destacar o botão "Reavaliar aderência" (já existe estado; só melhora affordance visual).

### 4) `src/components/gap-analysis/adherence/AdherenceAssessmentDialog.tsx`
- Nenhuma mudança funcional obrigatória. Apenas expor mensagem: "Para documentos gerados pelo DocGen, use o botão 'Análise completa' dentro do DocGen — evita perda de formatação na exportação/re-upload."

## Detalhes técnicos

- Fórmula do fallback (idêntica ao `computeConformityScore` já usado no front): `round( sum(score_por_status) / (total - naCount) )` com `conforme=100, parcial=50, nao_conforme=0`. Não avaliados contam 0 no numerador e permanecem no denominador (mesmo comportamento canônico do módulo).
- Limite de requisitos analisados por chamada permanece em 150 (mesmo do analyzer atual), para frameworks grandes cair em modo truncado com aviso — não é regressão.
- Sem alteração de tabelas/RLS/grants; sem novos secrets.

## Validação

1. Gerar uma política no DocGen com framework ISO 27001 → clicar "Avaliar aderência" → esperar score > 0 coerente com o conteúdo.
2. Refinar uma seção com dados adicionais → clicar "Reavaliar aderência" → score reflete o refino.
3. Clicar "Análise completa" → assessment aparece em Gap Analysis com o mesmo score sem precisar exportar/re-upload.
4. Upload manual de um PDF/DOCX real continua funcionando (regressão zero no fluxo existente).
5. Rodar um caso onde a IA volta `percentual_conformidade: 0` mas `requisitos_analisados` com maioria "conforme" — confirmar que o fallback grava o valor calculado, não 0.
