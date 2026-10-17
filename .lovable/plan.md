# Gap Analysis: tela inicial no modelo "B: Comparativo + tabela"

## O que muda para o usuário
1. **Topo:** o título e o cartão do CRA continuam como estão.
2. **Painel comparativo:** à esquerda, um anel grande com a aderência geral (média real, ex. 63%) e a faixa de maturidade. À direita, uma barra para cada framework ativo, lado a lado, com a nota real. Clicar numa barra abre o framework.
3. **Tabela de frameworks ativos:** substitui as linhas largas de hoje. Colunas:
   - Framework: selo pequeno, nome e categoria
   - Aderência: nota e barra
   - Não conformes
   - Críticos
   - Próximo marco: a data-alvo, ou "Definir" quando não houver
   - Responsável: avatar, ou "Não atribuído"
   - Tendência: mini gráfico com o histórico real de 8 semanas, ou um traço quando não houver histórico
   - Ações: "Ver detalhes"
   
   A tabela pode ser ordenada por aderência, gaps, críticos e prazo. A busca e os filtros de categoria ficam no topo da tabela.
4. **Coluna lateral "Recomendados":** a coluna fica à direita, com os frameworks sugeridos pela jurisdição. Cada item mostra o chip "X% pronto", calculado a partir dos requisitos herdados (só aparece quando o valor é real), uma descrição curta e o link "Iniciar". Em telas menores, a coluna desce para baixo da tabela.
5. **Celular:** a tabela vira uma lista de cartões, com selo, nota, gaps e prazo.
6. **Sem frameworks ativos:** aparece uma tela vazia que leva direto aos recomendados.

## Regras
- Só dados reais, sempre filtrados pela empresa. Nada de números fictícios: quando um dado não existe, aparece um traço.
- Mantém os selos, as cores e os chips do Akuris. Gráficos usam a paleta neutra; roxo só em ações.
- Todo texto novo terá versão em português e em inglês.

## Detalhes técnicos
- `src/pages/GapAnalysisFrameworks.tsx`: reorganizar em grid (conteúdo + coluna lateral de 320px). O novo `ComparativoFrameworks` usa `AkurisBars` e o anel existente.
- A tabela usa o `DataTable` compartilhado (ordenação, alternância lista/grade, `OwnerCell`, `RecordProgress`). Ela reaproveita os cálculos de score e distribuição que a página já usa.
- Tendência via `useSerieSemanal`, com escopo por empresa. Próximo marco e responsável vêm dos campos já usados por "Próximo marco".
- i18n em `src/i18n/modules/gap-analysis.ts` (PT/EN), com validação das chaves.
- Verificação: typecheck, testes existentes e captura autenticada em desktop e celular, quando houver sessão.
