# Correção: contagens erradas/zeradas na tela de Frameworks

## Causa raiz
Em `src/pages/GapAnalysisFrameworks.tsx` (linhas ~114-118) a busca de requisitos usa:

```ts
supabase.from('gap_analysis_requirements')
  .select('id, framework_id')
  .in('framework_id', frameworkIds);
```

O banco tem ~1.573 requisitos globais (PCI DSS 288, CIS 153, ISO 27001 121, NIST CSF 116, GDPR 97, DORA 64, SOC2 63, LGPD 56, ISO 62443 55, HIPAA 54 etc.). O PostgREST retorna no máximo **1000 linhas por request**, então vários frameworks ficam com contagem parcial e alguns aparecem com 0/1 requisito na UI (COSO=0, ISO/IEC 20000=0, GDPR=1, LGPD=1, COBIT=1, ITIL=1, HIPAA=2, etc.), embora o dado no banco esteja correto.

O mesmo padrão pode afetar `gap_analysis_evaluations` conforme o volume por empresa cresce.

## Correção (frontend apenas, sem mudança de schema)

Trocar a busca única por **paginação em lotes de 1000** usando `.range()` até esgotar as linhas, dentro de `src/pages/GapAnalysisFrameworks.tsx`:

1. Extrair um helper `fetchAllPaginated(table, select, filter)` que itera `range(from, from+999)` enquanto o batch retornar 1000 linhas.
2. Aplicar em:
   - `gap_analysis_requirements` (linhas 115-118) — resolve os cards zerados.
   - `gap_analysis_evaluations` (linhas 126-130) — evita o mesmo bug futuro quando a empresa acumular avaliações.
3. Manter toda a lógica de agregação (`counts`, `progress`, `statusCountsMap`, cálculo de score 100/50/0 com exclusão de N/A) exatamente como está — só a fonte de dados muda.

## Validação
- Recarregar a rota `/gap-analysis` (ou equivalente) e conferir que os cards refletem os valores do banco (ex.: GDPR 97, PCI DSS 288, CCPA 40, ISO 27701 49, COBIT 40, ISO/IEC 20000 40, HIPAA 54, LGPD 56, ITIL 34, COSO Internal Control 17).
- Conferir que frameworks sem avaliação continuam mostrando `X requisitos` (fallback) e que os com avaliação mostram `Y de X requisitos avaliados`.
- Nenhuma migration ou alteração em edge functions.

## Fora de escopo
- Não mexer em RLS, schema, ou em outros módulos.
- Não alterar a lógica de score, N/A ou heatmap.
