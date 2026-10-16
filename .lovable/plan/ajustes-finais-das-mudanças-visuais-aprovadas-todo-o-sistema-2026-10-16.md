# Ajustes finais das mudanças visuais aprovadas (todo o sistema)

A base já entrou: cartões de número separados, abas com contador e linhas em cartão. Faltam os ajustes abaixo. Todos valem para o sistema inteiro, porque as peças são comuns: cada correção chega a todos os módulos (Riscos, Controles, Planos, Incidentes, Documentos, Ativos, Fornecedores, Contratos, Privacidade, Auditorias, Continuidade, Acessos etc.). No fim, um roteiro automático percorre todas as páginas de módulo para confirmar.

## 1. Corrigir a cor da faixa das linhas
- Hoje a faixa pega a cor do último status da linha: riscos "Alto" com revisão "No prazo" ficam com faixa verde.
- Correção: a gravidade sempre manda (Crítico vermelho, Alto laranja, Médio âmbar, Baixo verde). O status só conta quando a linha não tem gravidade.
- A faixa vira uma barra reta de 3px colada à esquerda, como na proposta.

## 2. Linhas em cartão mais próximas da proposta B
- Ícone do tipo de registro antes do título e descrição curta em cinza abaixo do nome, quando existir.
- Responsável com avatar redondo.
- Barra de progresso nos módulos que têm progresso.
- Ações "..." com mais destaque ao passar o mouse.

## 3. Cartões de número do topo
- Remover o "Sem histórico comparável" repetido; mostrar a variação só quando ela existir (seta + %).
- Mini gráfico de área com o histórico real das últimas 8 semanas, em todos os módulos que guardam datas. Sem histórico, o cartão fica limpo.

## 4. Sub-barra fixa completa (todos os módulos com abas)
- Junto das abas fixas: ícone e nome do módulo e caminho (ex.: Riscos › Matriz) à esquerda; busca rápida à direita no desktop.

## 5. Gráficos novos em todo o sistema
- Os gráficos existentes passam para os quatro padrões conforme o tipo: evolução vira área, volume vira barras, distribuição vira donut e conformidade vira barras com selo.

## 6. Telas vazias com atalhos (todos os módulos)
- Cada módulo mostra os atalhos que já tem: Cadastrar sempre; Importar da biblioteca/modelo e Importar planilha onde existirem.

## Detalhes técnicos
- CSS `.akuris-table`: regras de estado antes das de gravidade (`tr:has([data-chip-family=severity][data-chip-tone=...])`); faixa via `td:first-child::before` absoluta.
- `DataTable`: coluna primária aceita `icon`/`subtitle`; célula de responsável com `Avatar`.
- `StatStrip`: contexto "sem histórico" omitido sem `trend`; `series` vindo de contagens semanais por empresa.
- `ModuleSubbar` dentro de `PageHeader` quando houver abas; gráficos de `src/components/charts/AkurisCharts.tsx`.
- Validação com Playwright em todas as páginas de módulo. Sem mudança de permissões; textos em PT/EN.
