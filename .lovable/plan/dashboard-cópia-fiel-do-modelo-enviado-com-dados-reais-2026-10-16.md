# Dashboard: cópia fiel do modelo enviado, com dados reais

Reproduzir a imagem bloco a bloco, mantendo o menu lateral atual do Akuris (já no formato rail).

## Topo
- Saudação "Olá, {primeiro nome}" + subtítulo "Visão geral da governança, riscos e conformidade da sua organização."
- À direita: busca (abre o Cmd+K existente), seletor de usuário e filtro de período "Últimos 30 dias" (7 / 30 / 90 dias) que filtra atividade e variação.

## Grade 3 colunas (2 linhas)
1. **Índice operacional** — anel com degradê verde-água, número grande "de 100", seta "+X% em relação ao mês anterior" e gráfico de área com pontos (últimos 6 meses) por baixo. Dados: índice atual + histórico mensal real.
2. **Riscos** — mapa de calor 5x5 em tons de roxo (intensidade = quantidade), rótulos Muito baixa…Muito alta nos dois eixos, legenda Baixo/Médio/Alto/Crítico com contagens. Clique na célula abre Riscos filtrado.
3. **Planos de ação** (coluna direita, em cima) — rosca com total no centro e legenda No prazo / Em atraso / Concluídos com número e %.
4. **Incidentes abertos** (coluna direita, embaixo) — número grande + 4 chips Crítica/Alta/Média/Baixa com bolinha colorida; "Ver todos".
5. **Conformidade** — barras roxas por framework (top 3 ativos da empresa) com %; link "Ver detalhes de conformidade".
6. **Contratos a vencer** — linha do tempo vertical (próximos 90 dias) com data colorida por urgência, fornecedor + objeto, selo "Em N dias" (vermelho ≤15, laranja ≤30, neutro). Link "Ver todos os contratos".
7. **Atividade recente** — 5 últimos eventos com ícone do módulo, título, descrição e "há X horas"; link "Ver toda a atividade".

## Animações
- Anel e rosca desenham-se ao abrir; números contam até o valor; área do gráfico revela da esquerda; barras crescem; células do mapa e itens das listas aparecem em sequência.

## Regras mantidas
- Todos os dados filtrados pela empresa; blocos escondidos se o usuário não tem acesso ao módulo.
- Textos em PT/EN; cores via tokens do sistema (sem cores fixas); loader AkurisPulse.

## Detalhes técnicos
- Reescrever `src/pages/Dashboard.tsx` e `bento/tiles.tsx`; novos tiles `ConformidadeTile` e `AtividadeTile`; nova `DashboardGreetingHeader`.
- Histórico do índice: usar snapshots existentes se houver; caso contrário, calcular por mês a partir de dados com data (sem inventar valores; meses sem dado ficam vazios).
- Período via estado na página repassado aos hooks de atividade.
- Recharts para área/rosca; framer-motion/CSS para entradas.
- Validar com Playwright logado como henrique.mathews@gmail.com e comparar com a imagem.
