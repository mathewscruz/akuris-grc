# Ajustes finais das mudanças visuais aprovadas

Pelo print de Riscos, a base já entrou (cartões de número separados, abas com contador, linhas em cartão). Faltam estes ajustes:

## 1. Corrigir a cor da faixa das linhas
- Hoje a faixa pega a cor do último status encontrado na linha: riscos "Alto" com revisão "No prazo" ficam com faixa verde (R-0003, R-0002).
- Correção: a gravidade sempre manda (Crítico vermelho, Alto laranja, Médio âmbar, Baixo verde); o status só vale quando a linha não tem gravidade.
- A faixa vira uma barra reta de 3px colada à esquerda (como na proposta), em vez da curva que acompanha o canto.

## 2. Linhas em cartão mais próximas da proposta B
- Ícone do tipo de registro antes do título e descrição curta em cinza abaixo do nome, quando existir.
- Responsável com avatar redondo (hoje só as iniciais em texto).
- Barra de progresso nos módulos que têm progresso (planos de ação, tratamentos).
- Ações "..." aparecem com mais destaque ao passar o mouse.

## 3. Cartões de número do topo
- Remover "Sem histórico comparável" repetido em todos; mostrar só quando houver variação real (seta + %).
- Mini gráfico de área ligado ao histórico real de Riscos, Incidentes, Controles e Planos de ação (últimas 8 semanas). Sem histórico, o cartão fica limpo, sem gráfico falso.
- Número em cor só quando exige ação (já é assim no "Altos").

## 4. Sub-barra fixa completa
- Junto às abas fixas: ícone e nome do módulo e caminho (ex.: Riscos › Matriz) à esquerda; busca rápida à direita no desktop.

## 5. Gráficos novos aplicados
- Riscos (aba Matriz/visão): donut segmentado por gravidade e área de evolução.
- Dashboard e Conformidade: barras de progresso com selo do framework.
- Controles e Planos: barras arredondadas por mês.

## 6. Telas vazias com atalhos
- Riscos: Cadastrar, Importar da biblioteca, Importar planilha.
- Controles, Documentos, Ativos, Fornecedores, Incidentes: atalhos que já existem em cada módulo.

## Detalhes técnicos
- CSS `.akuris-table`: regras de estado antes das de gravidade (`tr:has([data-chip-family=severity][data-chip-tone=...])`), faixa via `td:first-child::before` absoluta (largura 3px, altura 60%, centralizada).
- `DataTable`: coluna primária aceita `icon` e `subtitle`; célula de responsável usa `Avatar`.
- `StatStrip`: `context` "sem histórico" omitido quando não há `trend`; `series` alimentado por consultas por empresa já existentes em `src/lib/metrics/` (contagem por semana).
- `ModuleSubbar` dentro de `PageHeader` quando há `tabs`; gráficos de `src/components/charts/AkurisCharts.tsx`.
- Sem mudanças de permissões; textos PT/EN.
