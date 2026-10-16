# Fechar as diferenças que ainda aparecem nos módulos

Pelas capturas (Riscos e Controles), estas partes da proposta aprovada ainda não chegaram às telas. Como são peças comuns, cada correção vale para todos os módulos.

## 1. Cartões de número do topo
- Tirar todos os textos "— vs mês ant.: sem dados" e "Sem dados" repetidos. A variação (seta + %) só aparece quando houver comparação real.
- Mesma altura e o número sempre na mesma posição em todos os cartões. Hoje, em Controles, os números ficam em alturas diferentes.
- Mini gráfico de área com degradê (não a linha reta roxa): aparece só quando o histórico tem variação. Se a série for plana, o cartão fica limpo.
- Riscos: cada cartão de gravidade (Críticos, Altos, Médios, Baixos) ganha o seu próprio histórico real e mini gráfico.
- Cartões com meta (cobertura, preventivos): barra de progresso fina e arredondada, sem a linha preta grossa.

## 2. Linhas em cartão
- Faixa colorida à esquerda com a altura toda do cartão, colada à borda arredondada (hoje aparece cortada e só no meio).
- Espaço entre os cartões e fundo do cartão um pouco destacado do fundo da tabela, para que pareçam cartões separados.
- Responsável sempre com avatar redondo e nome em todos os módulos; "Não atribuído" com avatar vazio tracejado.
- Coluna "Tend." em Riscos: tirar a linha reta sem dados; mostrar seta ↑/↓ quando houver mudança, ou um traço discreto.
- Selos de gravidade sem o ícone de barrinhas cortado, só o ponto + texto, igual aos de status.
- Ações "..." em botão quadrado que se destaca ao passar o mouse.

## 3. Sub-barra fixa
- Na linha das abas do módulo: caminho à esquerda (ex.: Riscos › Matriz), abas com contador (Matriz, Aceite, Auditorias também com número), e busca rápida da lista à direita no desktop.
- A linha sublinhada das abas ocupa a largura toda (hoje para no meio em Controles).

## 4. Barra de filtros
- Rótulos dos filtros dentro do próprio campo ("Status: Todos") para a barra ficar numa linha só e alinhada com a busca.
- "Colunas" e "Atualizar" como botões de ícone quadrados.

## 5. Verificação
- Entrar no sistema pelo preview e tirar capturas de todos os módulos de lista, claro e escuro, comparando com a proposta. Corrigir os testes de layout que estavam falhando.

## Detalhes técnicos
- `StatStrip`: remover `context` de fallback, `items-start` com altura mínima fixa; sparkline só se `max>min`; `useSerieSemanal` aceita filtro (ex.: nível do risco) para Riscos.
- CSS `.akuris-table`: `border-separate border-spacing-y-2`, faixa via `td:first-child` com `box-shadow inset 3px` + raio.
- `DataTable`: célula de responsável padronizada com `Avatar`; `Chip` de severidade sem ícone de barras.
- `ModuleSubbar` em `PageHeader` com breadcrumb, `count` nas abas e busca ligada ao filtro da lista.
- `ModuleToolbar`: `ToolbarField` com rótulo inline.
- Sem mudança de dados ou permissões; textos novos PT/EN.
