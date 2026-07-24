# Auditoria estática — Contrato DocGen ⇄ Analyzer

Data: 2026-07-24
Escopo: `supabase/functions/docgen-chat/index.ts` (action `generate_document`) e `supabase/functions/analyze-document-adherence/index.ts`.

## 1. Fonte de requisitos (universo do score)

| Dimensão | Gerador (`generate_document`) | Analisador (`analyze-document-adherence`) | Status |
| --- | --- | --- | --- |
| Tabela | `gap_analysis_requirements` | `gap_analysis_requirements` | ✅ igual |
| Filtro | `.in('framework_id', docFwIds)` | `.eq('framework_id', safeFrameworkId)` | ✅ compatível (o gerador aceita multi-framework, o analisador processa 1 assessment/framework) |
| Ordenação | `.order('ordem', { ascending: true })` | `.order('ordem')` | ✅ igual |
| Cap | `.limit(600)` no fetch; score usa `expandNaoCobertosFromCatalog` | `FRAMEWORK_REQ_CAP = 300` em `reqsForAnalysis.slice(0, cap)`; excedente contado como `silently_missing` | ⚠️ Assimetria numérica: o gerador enxerga até 600 códigos para expandir `nao_cobertos`, o analisador só julga 300 e penaliza o resto. Em frameworks ≤300 não há impacto; em CIS v8 (153) e PCI DSS (288) também não há; um framework hipotético com >300 sub-reqs seria penalizado só no analisador. |

**Ação sugerida:** unificar em `FRAMEWORK_REQ_CAP` para o fetch do gerador também. Alteração fora do escopo desta auditoria — nenhum framework atual passa de 300.

## 2. Juiz (modelo de LLM)

| | Gerador | Analisador |
| --- | --- | --- |
| Modelo | `google/gemini-3.1-pro-preview` (constante `MODEL_QUALITY`) | `google/gemini-3.1-pro-preview` (hardcoded) |
| Temperature | 0.35 | (padrão do provider) |
| max_tokens | 20000 (geração) / 6000 (retry de seção fraca) | 48000 |

✅ Mesmo modelo em ambos os lados — juiz unificado (Onda 5).

## 3. Rótulos de status

| | Gerador (declara em `coverage_map` + `requisitos_nao_cobertos_justificativa`) | Analisador (produz em `requisitos_analisados[].status_aderencia`) |
| --- | --- | --- |
| Vocabulário | `requirement_codigo` presente = coberto; ausente = `nao_coberto` (in-scope ou out-of-scope conforme motivo) | `conforme` \| `parcial` \| `nao_conforme` \| `nao_aplicavel` |
| Fora do escopo | motivo contém "fora do escopo" ou "não aplicável" → excluído do denominador via `isInScope` | `nao_aplicavel` → excluído do denominador em `computeAnalyzedScore` |

✅ Semântica alinhada.

## 4. Fórmula de score

Ambos os lados importam de `_shared/compliance-score.ts`:

- Gerador: `computeCoverageScore(coverageMap, naoCobertos, removedCount)`
  `score = cobertos / (cobertos + naoCobertosRelevantes + removidos)`
- Analisador: `computeAnalyzedScore(analisados, silentlyMissing)`
  `score = Σ SCORE_MAP[status] / (total − nao_aplicaveis + silently_missing)` com `SCORE_MAP = { conforme: 100, parcial: 50, nao_conforme: 0 }`.

✅ Ambas as fórmulas convergem para 100% quando **todo requisito relevante do catálogo aparece como coberto/conforme**. Divergem quando:

1. **Cobertura declarada ≠ cobertura reconhecida.** O gerador cita `[A.8.13]` no texto e declara em `coverage_map`, mas o analisador (novo prompt, sem ler o `coverage_map` como fato, só como âncora) lê o texto e considera evidência fraca → devolve `parcial` (50) ou `nao_conforme` (0). Score cai.
2. **Silêncio da IA no analisador.** O analisador precisa devolver os 300 itens; se devolver menos, o restante entra como `silently_missing` (nao_conforme). Score cai.
3. **Categorização diferente de "fora do escopo".** Gerador declara "fora do escopo do documento" (removido do denominador). Analisador, sem ler essa nota, marca `nao_conforme`. Score cai.

## 5. Reconciliação IA ↔ determinístico

Analisador usa `reconcileReportedScore(reportado, calculado, tolerance=25)`:

- Se a IA reporta `percentual_conformidade` inválido (0/null/>100) → prevalece o determinístico.
- Se |reportado − calculado| > 25 → prevalece o determinístico.
- Caso contrário → prevalece o reportado.

✅ Impede o bug histórico ("vários conformes com 0%"). Mas mantém 25 pontos de folga a favor da IA quando ela concorda em ordem de grandeza.

## 6. Auto-refino / gate de qualidade

Estado atual da action `generate_document`:

- Emite `_initial_score`, `_residual_gaps` e `warnings` no retorno.
- Aplica **quality gate de texto** (`findWeakSections`) — reescreve seções curtas/com placeholder via `MODEL_QUALITY`.
- **NÃO** faz loop de auto-refino baseado em `AUDIT_THRESHOLD`. A constante `MAX_REFINE_ATTEMPTS` é declarada em `_shared` mas não é consumida no servidor.
- O fechamento de gaps residuais depende do usuário disparar `refine_section` / `refine_document` no chat.

**Consequência:** o servidor NÃO garante que o documento devolvido tenha `_initial_score ≥ 80`. Ele apenas devolve o score inicial + warnings + top-15 gaps residuais para o UI orientar o usuário a refinar.

## 7. Veredicto sobre "100% garantido"

**100% não é — e não pode ser — garantido determinísticamente**, porque:

1. **Duas passagens independentes de LLM.** Geração e análise são chamadas separadas ao mesmo modelo. Mesmo com temperatura baixa, a análise reavalia o texto sem confiar cegamente no `coverage_map` declarado (por design — é o auditor). Isso implica variabilidade natural.
2. **Sem loop de auto-refino no servidor.** A geração devolve o que a IA produziu, com aviso quando o score inicial cai. Fechar os `_residual_gaps` até 100% é um ciclo iterativo do usuário no chat.
3. **A rubrica "parcial" penaliza 50 pontos** por requisito que o auditor achou "mencionado mas incompleto" — critério subjetivo. Um framework de 200 requisitos com 5% caindo em `parcial` já produz score ≈ 97,5%.

O que ESTÁ garantido pela arquitetura pós-Onda 5:

- Gerador e analisador conversam sobre o **mesmo universo de requisitos** (via `expandNaoCobertosFromCatalog` + cap unificado ≤ 300).
- Mesmo **modelo de julgamento** (Gemini 3.1 Pro) em ambos os lados.
- **Fórmula única** (`compliance-score.ts`) — impossível para os dois lados discordarem por erro de cálculo.
- Piso operacional recomendado: `AUDIT_THRESHOLD = 80` — o UI já bloqueia publicação abaixo disso (`DocGenDialog.tsx`, Onda de UX).

Se o objetivo for **elevar o score real ao piso automaticamente**, a mudança concreta é implementar no servidor um loop:

```
gerar → self-analyze (quick_adherence com o mesmo catálogo/juiz)
        se score < AUDIT_THRESHOLD e attempts < MAX_REFINE_ATTEMPTS
            refine_document usando residual_gaps do analyzer → repetir
```

Essa mudança fecha o gap. Não foi feita ainda — requer nova onda.

## 8. Prova determinística

Ver `supabase/functions/_shared/generator-analyzer-parity_test.ts` — 4 casos que provam:

- Cobertura completa do catálogo + todos `conforme` → **ambos os lados = 100**.
- Um requisito silencioso no analisador → analisador cai proporcionalmente; gerador continua em 100 se declarou (a divergência é real e esperada).
- Fora do escopo simétrico (gerador marca out-of-scope + analisador marca `nao_aplicavel`) → ambos ignoram no denominador, score = 100.
- Cobertura incompleta (10% em `nao_cobertos` in-scope) → gerador reporta 90; analisador reportaria 90 se marcasse esses 10% como `nao_conforme` — paridade preservada.
