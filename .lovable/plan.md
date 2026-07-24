## Diagnóstico

Hoje o DocGen e o Analisador **não medem a mesma coisa**, por isso o mesmo documento gerado como "100% em compliance" cai para "parcial/0%" quando o próprio Akuris reanalisa:

1. **Universos diferentes**
   - Geração (`computeCoverageScore`): denominador = só o que a IA voluntariamente declarou no `coverage_map` + o que ela listou em `requisitos_nao_cobertos_justificativa`. Se a IA "esquece" de listar um requisito, ele some do denominador e o score infla.
   - Analisador (`computeAnalyzedScore`): denominador = **todos** os requisitos do framework (até 150), incluindo `silentlyMissing` como `nao_conforme`. O que não for `conforme` derruba o score.

2. **Juízes diferentes**
   - Geração usa `MODEL_QUALITY` (Gemini Pro).
   - `analyze-document-adherence` usa `google/gemini-3-flash-preview` — modelo mais barato e mais rígido, tende a marcar `parcial`.

3. **Corte de 150 requisitos**
   - Analisador ignora silenciosamente do req. 151 em diante em PCI DSS (288), CIS v8 (153), etc. — o score reflete apenas o topo do catálogo.

4. **Não há self-audit antes de devolver o documento**
   - A geração confia no `coverage_map` que a própria IA declarou. Ninguém, do lado do servidor, valida se o texto real cobre o requisito. Quando o auditor roda depois, encontra as lacunas pela primeira vez.

5. **Quality gate só reescreve seções curtas**
   - Detecta placeholders/tamanho, mas não detecta "requisito X do framework não aparece em nenhuma seção".

## Objetivo

Garantir que **todo documento devolvido pelo DocGen já passou por uma auditoria interna equivalente à do `analyze-document-adherence`**, e que os dois lados usem o **mesmo universo, o mesmo juízo e a mesma fórmula**. Se o documento não atingir o limiar mínimo, o próprio DocGen refina antes de entregar.

## Escopo das mudanças

### Onda 1 — Universo simétrico (gerador == analisador)
- Em `supabase/functions/docgen-chat/index.ts`, no bloco `generate_document`:
  - Após parsear o JSON, cruzar o `coverage_map` contra a lista completa de requisitos do(s) framework(s) buscada em `fetchFrameworkRequirements`.
  - Auto-injetar em `requisitos_nao_cobertos_justificativa` **todo** código do catálogo que não aparecer no `coverage_map`, com `motivo="não endereçado"` (in-scope, entra no denominador).
  - Recalcular `_initial_score` sobre esse denominador expandido. O score deixa de depender da honestidade da IA.
- Fixar o mesmo teto (`MAX_REQS`) na geração e no analisador para que ambos falem do mesmo N. Constante nova em `supabase/functions/_shared/compliance-score.ts` (`FRAMEWORK_REQ_CAP`).

### Onda 2 — Self-audit obrigatório antes de devolver o documento
- Ainda em `generate_document`, após computar `_initial_score`, chamar internamente a mesma rotina do `quick_adherence` (extraída para helper puro em `_shared/`), sem exigir um novo request do frontend:
  - Reaproveita o `LOVABLE_API_KEY` já obtido.
  - Reusa `chargeAiCredit()` uma única vez (evita duplo débito).
  - Produz `_audited_score`, `_audited_contagem`, `_audited_gaps[]` no payload devolvido.
- Se `_audited_score < THRESHOLD` (padrão 80) e ainda há orçamento (`refine_attempts < 2`):
  - Para cada `nao_conforme`/`parcial`, gerar um patch de parágrafo e injetar via `applyRefineCoverage` na seção adequada.
  - Rodar novo self-audit. Parar assim que atingir o limiar ou esgotar o orçamento.
- Devolver ao frontend `_initial_score`, `_audited_score` e `_gaps_restantes`. O `_audited_score` passa a ser a **fonte de verdade** exibida no chip de compliance do `DocGenDialog`.

### Onda 3 — Um único juiz
- Migrar `analyze-document-adherence` e `quick_adherence` para o mesmo modelo da geração (`MODEL_QUALITY`), removendo a assimetria Pro-vs-Flash.
- Remover o corte fixo de 150 requisitos no analisador: paginar o framework em lotes de 60, chamar a IA em sequência, mesclar `requisitos_analisados` antes de aplicar `computeAnalyzedScore`. Aplica-se a PCI DSS (288), CIS v8 (153) e DORA (64+).

### Onda 4 — Frontend
- `src/components/documentos/DocGenDialog.tsx`:
  - `currentScore` passa a preferir `_audited_score` sobre `_initial_score` (fallback só se o self-audit falhar).
  - Nova linha no toolbar: "Auditoria interna: X% (Y gaps residuais)". Quando `Y > 0`, mostrar botão "Refinar gaps" que dispara `refine_document` já com a lista de códigos.
  - Confirmação `publishConfirmOpen` passa a checar `_audited_score`.

### Onda 5 — Testes de contrato
- `supabase/functions/_shared/compliance-score_test.ts`: casos para o novo expansor de denominador (cenário: IA declara 3 conformes num framework de 20 → score = 15%, não 100%).
- `supabase/functions/docgen-chat/compliance_test.ts`: mock que injeta um `coverage_map` incompleto e valida:
  - `_initial_score` calcula sobre o catálogo inteiro.
  - `_audited_score` e `_initial_score` ficam dentro de ±10 pontos.
- `supabase/functions/analyze-document-adherence/compliance_test.ts`: cenário com framework de 200 requisitos, valida que a paginação retorna score sobre os 200 (não sobre 150).

### Fora do escopo
- Trocar o gateway de IA, mudar RLS, mexer em créditos/faturamento, mexer em UI fora do `DocGenDialog`. Nenhuma migração de banco.

## Impacto e riscos

- **Custo**: cada `generate_document` passa a gastar 1 crédito adicional pelo self-audit (e mais 1 por rodada de refino, no máximo 2). Vale a pena — o usuário hoje paga isso implicitamente refinando manualmente depois.
- **Latência**: geração fica ~40-70% mais lenta em frameworks grandes. Mitigado pela paginação em paralelo dos lotes do analisador.
- **Compatibilidade**: `_initial_score` continua sendo emitido — nada quebra no frontend antigo. `_audited_score` é aditivo.

## Detalhes técnicos

- Fórmula do novo denominador de geração:
  ```text
  score = cobertos / (cobertos + naoCobertos_in_scope + faltantes_do_catalogo)
  ```
- `THRESHOLD` e `MAX_REFINE_ATTEMPTS` ficam em `_shared/compliance-score.ts` para os testes cobrirem.
- Self-audit interno reutiliza a mesma função pura extraída de `quick_adherence` para eliminar drift entre os dois caminhos.
- Paginação do analisador: lotes de 60 rodam com `Promise.all` respeitando um limite de concorrência 2 para não estourar rate-limit.
