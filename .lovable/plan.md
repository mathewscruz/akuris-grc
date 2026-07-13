## Resumo da validação

Os 24 frameworks globais (`empresa_id IS NULL`, `is_template = true`) estão presentes e populados. Comparando com os padrões oficiais, todos estão em faixa aceitável (últimos ajustes fizeram PCI DSS/CIS/DORA/CCPA baterem números oficiais). O que **precisa correção** é o idioma: parte relevante dos requisitos ainda está em **inglês**, em desacordo com a identidade do sistema (PT-BR nativo).

### Requisitos em inglês encontrados

| Framework | Títulos EN | Descrições EN |
|---|---:|---:|
| GDPR | 59 | 97 (quase todos os 97 registros) |
| CIS Controls v8 | 25 | 53 |
| PCI DSS 4.0 | 29 | 58 |
| DORA | 0 | 1 |
| ISO/IEC 27701 | 0 | 1 |
| NIST SP 800-82 | 1 | 0 |

Total: ~150 títulos e ~210 descrições a traduzir.

### Tela `Gap Analysis › Frameworks` (`src/pages/GapAnalysisFrameworks.tsx`)

A tela carrega corretamente:
- Filtra `empresa_id IS NULL` + `is_template = true` (bate com os 24 globais).
- Conta requisitos por framework via `gap_analysis_requirements`.
- Agrega avaliações por `empresa_id` (isolamento multi-tenant ok).
- Segmentos e score médio usam a mesma escala do resto do sistema (100/50/0, exclui N/A).

**Um ponto de atenção lógico** (não pedido, mas relevante): em `frameworkProgress`, `evaluatedRequirements` inclui `nao_aplicavel`, enquanto o denominador do `averageScore` é `totalReqs - nao_aplicavel`. Isso é consistente com a política do sistema (N/A conta como avaliado, mas fora do denominador de score). Nenhuma correção proposta aqui — apenas confirmação de que está correto.

Conclusão da tela: **exibindo dados corretamente**.

## Plano de ação

### 1. Migration única de tradução PT-BR

Uma migration idempotente (`UPDATE ... WHERE`) traduzindo os campos `titulo`, `descricao` (e `orientacao_implementacao`/`exemplos_evidencias` quando também estiverem em EN) apenas nos requisitos globais dos 5 frameworks afetados:

- **GDPR (2018)** — traduzir os 97 artigos: títulos, descrições e (quando aplicável) orientação/evidências. Manter o `codigo` (`Art. 1`, `Art. 2`, ...). Ex.: `Right of Access` → `Direito de Acesso`; `Records of Processing Activities` → `Registros das Atividades de Tratamento`.
- **CIS Controls v8** — traduzir os 25 títulos e 53 descrições ainda em inglês (Controls 3–18 e Safeguards correspondentes). Ex.: `Securely Dispose of Data` → `Descartar Dados de Forma Segura`; `Require MFA for Remote Access` → `Exigir MFA para Acesso Remoto`.
- **PCI DSS 4.0** — traduzir 29 títulos e 58 descrições dos sub-requisitos (principalmente Requirements 11 e 12 recém-adicionados). Manter numeração oficial `1.1.1`, `11.4.2`, etc.
- **DORA** — traduzir 1 descrição remanescente.
- **ISO/IEC 27701** — traduzir 1 descrição remanescente.
- **NIST SP 800-82 Rev. 3** — traduzir 1 título remanescente.

Regras da migration:
- Escopo: `WHERE framework_id IN (...) AND empresa_id IS NULL` (via join com `gap_analysis_frameworks`).
- Idempotência: cada `UPDATE` casa por `(framework_id, codigo)`, então re-executar não gera efeito colateral.
- Preservar `peso`, `categoria`, `ordem`, `nivel_criticidade`, `is_template`.
- Nenhuma alteração de schema; nenhum requisito criado/removido.

### 2. Validação pós-migration

Rodar novamente a heurística de detecção de inglês nos 24 frameworks e confirmar que os 5 frameworks acima ficam com `possibly_english = 0` (títulos e descrições).

### 3. Sem alterações na UI

`GapAnalysisFrameworks.tsx`, `useFrameworksOverview.ts` e demais componentes de Gap Analysis já leem os campos corretos — não é necessário alterar nada no frontend. A tela refletirá automaticamente os textos traduzidos.

## Fora de escopo

- Não modificar frameworks de outras empresas (`empresa_id IS NOT NULL`).
- Não alterar cálculos, RLS ou schema.
- Não “retraduzir” requisitos já em PT-BR — o `UPDATE` toca apenas linhas em inglês.

## Detalhes técnicos

- Toda a operação é uma migration SQL (uma chamada de `migration`) com blocos `UPDATE public.gap_analysis_requirements SET titulo = ..., descricao = ... WHERE framework_id = (SELECT id FROM gap_analysis_frameworks WHERE nome = 'X' AND empresa_id IS NULL) AND codigo = 'Y';`.
- Sem impacto em `gap_analysis_evaluations`, `gap_analysis_adherence_details` etc. — o `id` dos requisitos permanece.
- Estimativa: ~370 linhas de UPDATE (uma por registro afetado).
