# Gráficos de Métricas e janela "Nova sprint"

## 1. Gráficos da aba Métricas
Problemas: o semanal desenha "ondas" entre semanas (curva suavizada sugere valores fracionados como 0,75), o eixo mostra decimais para contagens, o burnup tem 12 semanas quase vazias e a linha de escopo cortada ("E" no canto), e as barras por prioridade são escuras, iguais e sem número.

Ajustes:
- **Concluídas por semana:** trocar a área ondulada por barras por semana com o número em cima; semana atual destacada; linha tracejada da média com rótulo dentro do gráfico.
- **Burnup:** linha em degraus (concluídas acumuladas) começando na primeira semana com atividade; linha de escopo com rótulo legível à direita ("Escopo 8"); linha pontilhada do ritmo ideal até a data prevista do projeto (quando houver); ponto marcando "hoje".
- **Por prioridade:** barras horizontais com cor por severidade (Crítica, Alta, Média, Baixa sempre aparecem, mesmo com 0), número no fim da barra.
- **Eixos:** apenas números inteiros em contagens; tooltip "21/10 · 2 concluídas".
- **Previsão de término:** quando não há conclusões recentes, mostrar mensagem clara em vez de "—", e o tempo médio por prioridade com mini-barras em vez de lista vazia.

## 2. Janela "Nova sprint" no padrão Akuris
- Seções iguais à janela de Projeto: "Identificação" (Nome obrigatório com contador, Objetivo) e "Período" (Início/Fim + duração calculada "14 dias", atalhos 1 / 2 / 3 semanas).
- Trocar as caixinhas "Ativa / Concluída" (que podem ser marcadas juntas) por um seletor único de estado em pílulas: Planejada · Ativa · Concluída.
- Validações com destaque no campo: nome vazio, fim antes do início.
- Rodapé padrão: Cancelar (fantasma) e Salvar; ao editar, Excluir à esquerda.
- Textos novos em PT/EN.

## Detalhes técnicos
- `AkurisCharts.tsx`: `AkurisArea` ganha `curve` ("step"/"linear"), `integer` (allowDecimals=false), `secondaryLine` (ideal) e `referenceX` (hoje); `AkurisBars` ganha `layout="vertical"`, `colors` por item e `LabelList`; cores de severidade via `chart-tokens.ts`.
- `MetricasPanel.tsx`: usa as novas opções; burnup recortado a partir da primeira atividade; função pura `trajetoriaIdeal` em `projeto-acompanhamento.ts` com teste.
- `SprintsPanel.tsx` (SprintDialog): estado derivado ativa/concluida a partir do seletor único (sem mudança no banco); usa Chip/ToggleGroup existentes.
