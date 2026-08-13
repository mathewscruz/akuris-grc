# Corrigir chaves de tradução aparecendo cruas no Gap Analysis

## O que está acontecendo

Na tela de Gap Analysis aparecem textos como `gapAnalysis.v2.aiRecommendedTile.estimatedReuse` e `GAPANALYSIS.V2.ACTIVEFRAMEWORKROW.DISTRIBUTION` no lugar do texto real. Isso acontece tanto em português quanto em inglês.

## Causa confirmada

No dicionário `src/i18n/modules/gap-analysis.ts` falta o fechamento do bloco `audit` (um `},`), nos dois idiomas:

```text
      audit: {
        user: 'Usuário', system: 'Sistema', noChanges: 'Nenhuma alteração registrada',
                                   <-- falta "},"
      pdfExport: { ...
```

Com isso, tudo que vem depois (`pdfExport`, `historyTab`, `scoreChart`, `evidenceLibrary`, `adherenceUi`, `genericTable`, `reqDialog`, `evidenceReuse`, `v2`, `onboarding`, `status`) ficou aninhado dentro de `audit`. Verificado em execução: `gapAnalysis.v2` não existe no dicionário final, mas `gapAnalysis.audit.v2` existe. Como a função `t()` devolve a própria chave quando não encontra tradução, a interface mostra a chave crua.

## Correção

1. Fechar o objeto `audit` no bloco `pt` e no bloco `en` de `src/i18n/modules/gap-analysis.ts`, restaurando `pdfExport` e os demais blocos ao nível correto de `gapAnalysis`.
2. Rodar uma verificação em memória confirmando que `gapAnalysis.v2.aiRecommendedTile`, `gapAnalysis.v2.activeFrameworkRow`, `gapAnalysis.pdfExport` e demais blocos resolvem nos dois idiomas.
3. Varredura preventiva: script temporário que extrai todas as chaves `t('...')` usadas em `src/` e compara com os dicionários pt/en, listando chaves que não resolvem. Corrigir os casos que forem do mesmo tipo (estrutura/chave faltando) nos módulos de i18n.
4. Typecheck do projeto.

## Detalhes técnicos

- Arquivo alterado: `src/i18n/modules/gap-analysis.ts` (indentação dos blocos afetados e fechamento do `audit`).
- Nenhuma mudança de componente, lógica ou banco de dados.
- Se a varredura apontar chaves faltantes em outros módulos, elas serão adicionadas nos respectivos arquivos de `src/i18n/modules/`, mantendo pt e en em paridade.
