# Refinamentos visuais do Akuris (rodada de polimento)

Itens que o usuário percebe no dia a dia. Todos seguem a identidade já definida: roxo só para ação, superfícies page→card→elevated, AkurisPulse como único loader, Chip/StatusBadge.

## 1. Painel inicial (o que aparece ao entrar)
- Hierarquia: saudação + "o que precisa de você hoje" (pendências reais atribuídas ao usuário: tarefas vencendo, aprovações, revisões) no topo, antes dos indicadores gerais.
- Gráficos de tendência: corrigir o ponto de destaque que hoje gera aviso e pisca ao passar o mouse; tooltip único e consistente em todos os gráficos.
- Estados vazios com uma ação clara ("Importar riscos da biblioteca", "Criar primeiro projeto") em vez de só "sem dados".

## 2. Consistência que ainda escapa
- Questionário de avaliação (Assessment): trocar cores cruas (amarelo/verde claros) e fundos brancos pelos tons padrão — hoje é a tela que mais destoa no tema escuro.
- Análise de aderência: substituir o anel girando pelo AkurisPulse com %.
- Telas públicas (login, definir senha, blog, política): alinhar à nova linguagem editorial do site (tipografia, fundo marinho, sem branco puro).

## 3. Navegação e leitura
- Rail lateral: rótulo ao passar o mouse com atraso curto e indicação do módulo ativo mais visível; atalho ⌘K mostrado no topo.
- Tabelas: cabeçalho fixo ao rolar, primeira coluna fixa no celular, linha selecionada destacada ao voltar de um registro.
- Números e datas: formato regional (pt-BR / pt-PT / en) uniforme em KPIs, tabelas e PDFs.

## 4. Microinterações
- Feedback imediato ao salvar (estado no próprio botão: salvando → salvo ✓) em vez de só toast.
- Transição suave ao abrir/fechar painéis laterais e ao trocar de aba de módulo; respeitar "reduzir movimento".

## Verificação
- Inspecionar logado em desktop (1280) e celular (390) cada tela tocada, tema escuro e claro.
- Conferir console sem avisos nos gráficos.

## Detalhes técnicos
- Aviso do console: `activeDot={{...}}` com key espalhada no `Area` do Recharts — em `ui/trend-area-chart.tsx`, `charts/ScoreGradient.tsx`, `charts/AkurisCharts.tsx`, `projetos/metricas-graficos.tsx`; trocar por função render com key explícita.
- `pages/Assessment.tsx` usa `bg-amber-100`/`bg-white` (34 ocorrências) → status-tone + tokens de superfície.
- `AdherenceAnalysisProgress.tsx` usa `animate-spin` → AkurisPulse.
- "O que precisa de você": consultas por `empresa_id` + usuário, reutilizando hooks existentes de tarefas/aprovações; sem tabela nova.
- Textos novos via t() em pt-BR, pt-PT e en.
