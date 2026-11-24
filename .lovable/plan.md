# Refinamentos visuais do Akuris (rodada de polimento)

Itens que o usuário percebe no dia a dia. Todos seguem a identidade já definida: roxo só para ação, superfícies page→card→elevated, AkurisPulse como único loader, Chip/StatusBadge.

## 1. Consistência que ainda escapa
- Questionário de avaliação (Assessment): trocar cores cruas (amarelo/verde claros) e fundos brancos pelos tons padrão — hoje é a tela que mais destoa no tema escuro.
- Análise de aderência: substituir o anel girando pelo AkurisPulse com %.
- Telas públicas (login, definir senha, blog, política): alinhar à nova linguagem editorial do site (tipografia, fundo marinho, sem branco puro).

## 2. Navegação e leitura
- Rail lateral: rótulo ao passar o mouse com atraso curto e indicação do módulo ativo mais visível; atalho ⌘K mostrado no topo.
- Tabelas: cabeçalho fixo ao rolar, primeira coluna fixa no celular, linha selecionada destacada ao voltar de um registro.
- Números e datas: formato regional (pt-BR / pt-PT / en) uniforme em KPIs, tabelas e PDFs.

## 3. Microinterações
- Feedback imediato ao salvar (estado no próprio botão: salvando → salvo ✓) em vez de só toast.
- Transição suave ao abrir/fechar painéis laterais e ao trocar de aba de módulo; respeitar "reduzir movimento".

## Verificação
- Inspecionar logado em desktop (1280) e celular (390) cada tela tocada, tema escuro e claro.

## Detalhes técnicos
- `pages/Assessment.tsx` usa `bg-amber-100`/`bg-white` (34 ocorrências) → status-tone + tokens de superfície.
- `AdherenceAnalysisProgress.tsx` usa `animate-spin` → AkurisPulse.
- Textos novos via t() em pt-BR, pt-PT e en.
