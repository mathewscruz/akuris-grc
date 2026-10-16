# O que falta das mudanças visuais aprovadas

## Por que ainda não está tudo aplicado
- Fui aplicando por partes e priorizei as peças comuns (cartões de número, linhas em cartão, selos, abas, telas vazias). Os itens abaixo exigem mexer módulo a módulo e ficaram para depois. Eu devia ter avisado isso com mais clareza a cada entrega.
- Não entrei no sistema pela pré-visualização (ela pede login), então não conferi as telas por dentro. Por isso algumas diferenças só apareceram nas suas capturas.

## O que falta (vai valer para todos os módulos)

### Tabelas (proposta B)
1. Avatar redondo do responsável em todos os módulos; "Não atribuído" com avatar tracejado.
2. Barra de progresso nas linhas dos módulos que têm progresso (Planos de Ação, Projetos, Auditorias, Continuidade).
3. Data com ícone e botão "..." quadrado que se destaca ao passar o mouse.
4. Alternância lista/grade e ordenação no topo da tabela.

### Topo e navegação
5. Linha das abas fixa com caminho (ex.: Riscos › Matriz) à esquerda e busca rápida da lista à direita; sublinhado na largura toda.
6. Contador em todas as abas (Matriz, Aceite, Auditorias etc.).
7. Mini gráfico próprio em cada cartão de gravidade de Riscos (Críticos, Altos, Médios, Baixos).
8. Filtros com o rótulo dentro do campo ("Status: Todos"); Colunas e Atualizar como botões de ícone.

### Gráficos
9. Trocar os gráficos atuais dos módulos e relatórios pelos quatro padrões aprovados: evolução em área, volume em barras, distribuição em donut e conformidade em barras com selo.

### Popups
10. Cabeçalho com ícone, título e subtítulo; etapas nos formulários longos; seções com título; rodapé fixo com Cancelar e Salvar em todos os formulários de cadastro.

### Verificação
11. Entrar no sistema pela pré-visualização e tirar capturas de todos os módulos (claro, escuro, celular), comparar com as propostas e corrigir o que destoar.
12. Corrigir os testes de layout que falharam (folga das abas e exportação de Incidentes).

## Ordem
Tabelas → topo e navegação → popups → gráficos → verificação com capturas. Ao final, mando a lista do que foi conferido em cada tela.

## Detalhes técnicos
- `DataTable`: célula `owner` padrão com `Avatar`; coluna `progress`; toggle lista/grade.
- `PageHeader`/`ModuleSubbar`: breadcrumb + busca ligada ao filtro; `count` nas `Tabs`.
- `useSerieSemanal` com filtro opcional (ex.: `nivel_risco_inicial`), sempre por `empresa_id`.
- `ToolbarField` com rótulo inline; botões `icon-square`.
- `DialogHeader` com ícone/subtítulo, `DialogSteps`, rodapé sticky já existente aplicado aos formulários.
- Gráficos via `src/components/charts/AkurisCharts.tsx`.
- Sessão do preview via `lovable auth-session` para capturas Playwright. Sem mudança de dados ou permissões; textos PT/EN.
