# Dashboard: revisão final para ficar idêntico ao modelo

## 1. Índice operacional — anel com degradê real
- Anel com degradê visível de **verde-água/ciano (início) → verde (fim)**, como no modelo. Hoje as duas cores são quase iguais, por isso parece chapado.
- Traço um pouco mais fino, ponta arredondada e trilho escuro e discreto (no tema claro, um cinza suave).
- Número "67" grande e branco/escuro, com "de 100" logo abaixo. A seta "+X%" e o texto "em relação ao mês anterior" ficam em duas linhas, como no modelo.

## 2. Índice operacional — gráfico de linha igual ao modelo
- Linha contínua com vários pontos (um por semana), em vez de 2 pontos soltos. Começa no primeiro registro real e ocupa toda a largura do cartão.
- Área abaixo da linha com degradê verde que desaparece para baixo, pontos pequenos em cada medição e o último ponto destacado, maior e com halo.
- Meses no eixo de baixo (Jan, Fev...) distribuídos por igual.
- Gráfico encostado na base do cartão, sem o espaço vazio que existe hoje.

## 3. Remover "Buscar no sistema"
- Sai do topo do Dashboard, porque já existe busca no cabeçalho. Fica só o filtro "Últimos 30 dias" à direita.

## 4. Planos de ação — rosca igual ao modelo
- Rosca **grossa**, maior e com espaço pequeno entre as fatias: verde-água (no prazo), vermelho (em atraso) e cinza (concluídos).
- Total grande no centro e "planos" embaixo.
- Legenda com bolinha, nome, número e % alinhados em colunas próximas, como no modelo.
- Sem planos, a rosca grossa aparece no mesmo tamanho, em cinza.

## 5. Revisão geral dos demais blocos
- **Incidentes:** texto "incidentes em tratamento" ao lado do número, como no modelo, e etiquetas mais compactas.
- **Riscos:** tons mais próximos do modelo. As células baixas ficam em cinza neutro com pouca variação, e o roxo vai ficando forte só na diagonal superior direita. Os rótulos do eixo de baixo ficam mais juntos, e a legenda mostra Baixo (cinza claro), Médio (cinza escuro), Alto (roxo) e Crítico (roxo forte).
- **Cartões:** título, descrição e espaços internos com as mesmas proporções da imagem. O cartão do Índice ganha o ícone de informação no canto superior direito.
- **Atividade recente:** volta o link "Ver toda a atividade" no rodapé, levando para a central de notificações (sino).

## Detalhes técnicos
- Cores do anel e da área: novos tokens `--chart-teal` e `--chart-green` em `index.css`, nos temas claro e escuro. O degradê usa `linearGradient` com um id único por instância.
- Série do índice: média semanal de `gap_analysis_score_history` (tenant), cortada a partir do primeiro registro, com `XAxis` por mês e um `dot` customizado no último ponto.
- Rosca: `innerRadius 58%`, `paddingAngle 3`, `cornerRadius 4`, tamanho 140px.
- Remover o botão de busca do `DashboardGreetingHeader`.
- O link de atividade abre o painel do sino pelo evento já usado pelo NotificationCenter. Se esse evento não existir, o link é omitido.
