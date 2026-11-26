# Resultado da avaliação no formato "Painel executivo" (mockup A)

## O que muda na tela
1. **Faixa executiva no topo**, com 5 blocos: pontuação geral (nota/100 + classe), risco segundo a IA, lacunas críticas, evidências entregues (%) e data da resposta. Os botões "Relatório gerencial" e "Reavaliar" ficam no cabeçalho, à direita.
2. **Duas colunas abaixo**: à esquerda "Desempenho por seção", com barras finas e nota por seção (da pior para a melhor); à direita "Leitura da IA", com o resumo do parecer.
3. **Uma lista única "Respostas que custaram pontos"**: pergunta, resposta, nota/10, peso e seção, ordenada pelo maior impacto. Ela substitui os vários cartões por seção com tabelas repetidas. Um filtro por seção, opcional, aparece acima da lista.
4. O plano de ação, os achados e as evidências em falta continuam abaixo, como hoje.
5. **Correção:** a classe (Excelente/Bom/Regular/Ruim) passa a vir da nota exibida, com a mesma régua do PDF. Assim a nota 81 deixa de aparecer como "Ruim".

## Detalhes técnicos
- `RelatorioDoFornecedor.tsx`: troca a grade `aside + main` por faixa de KPIs, grid de 2 colunas e lista de lacunas; reaproveita `StatusBadge`, `Chip`, `chart-tokens` e os tokens de superfície. Sem cores cruas e sem roxo fora das ações.
- A classe é derivada da nota por uma função pura em `avaliacao-regras.ts` (`classeDaNota`), usada também em `relatorio-fornecedor.ts`, em vez do `classificacao` gravado, que pode estar desatualizado ou ter valor fora do esperado e cair no "Bad".
- Lacunas: usa as funções `ehLacuna` e `pontosPerdidos` que já existem, ordenadas por impacto.
- Novas chaves de texto em PT/EN.
- Testes: `classeDaNota` nos limites (80/60/40), incluindo 81 → excelente.
- Responsivo: no celular, a faixa vira grade de 2 colunas e as colunas se empilham.
