# Redesenho da tela de análise e do resultado de compliance

## 1. Tela "Analisando documento" (durante a análise)
- Remover o título duplicado (aparece duas vezes hoje).
- Topo: nome do arquivo e norma avaliada ("ISO/IEC 27001:2022"), com o loader Akuris.
- Anel de progresso grande com % real ao centro, tempo decorrido e estimativa de quanto falta.
- Etapas reduzidas a 4 com nomes claros: Lendo o documento → Entendendo o tema da política → Avaliando contra a norma → Montando o resultado.
  - Etapa atual destacada com pulso suave; concluídas ganham marca animada; futuras ficam esmaecidas.
  - Remover os percentuais fixos à direita (15%, 25%...), que confundem.
- Linha de "o que está acontecendo agora" trocando suavemente (ex.: "Lendo parte 3 de 8", "Avaliando ponto 4 de 10"). Corrigir o "0 de 1", que aparece antes da contagem real.
- Aviso discreto: "Pode fechar esta janela — avisamos pelo sino quando terminar."

## 2. Resultado
**Cabeçalho do veredito (cartão principal)**
- À esquerda: anel de nota animado (conta de 0 até 85%) com cor do veredito.
- Ao centro: a pergunta, veredito em destaque, explicação curta.
- Faixa de números: pontos avaliados · ajustes necessários (por prioridade) · pontos já atendidos · fora do escopo.
- Ações: "Corrigir com o DocGen", "Enviar nova versão", "Exportar PDF".

**O que precisa fazer**
- Agrupado por prioridade (Alta / Média / Baixa), com contagem.
- Cada ajuste em cartão: acento lateral pela prioridade, título, o que fazer, requisito da norma como chip e botão "Criar plano de ação" visível (não texto pequeno no canto). Ao criar, o cartão mostra "Plano criado" com link.
- Barra de progresso: "1 de 3 ajustes já com plano de ação".

**O que já está bom**
- Grade em duas colunas de cartões compactos, com o trecho citado da política em bloco de citação; recolhida após 4 itens com "Ver todos".

**Fora do escopo**
- Lista recolhida por padrão.

**Animações**
- Entrada em cascata dos cartões, contagem do anel, transições suaves ao expandir/recolher; respeita "reduzir movimento" do sistema.

## Detalhes técnicos
- Arquivos: `AdherenceAnalysisProgress.tsx`, `AdherenceResultView.tsx`, chaves PT/EN em `src/i18n/modules/gap-analysis.ts`.
- Somente visual: sem mudança em análise, banco ou funções.
- Seguir identidade: AkurisPulse, StatusBadge/Chip, StatStrip, cores por tokens, roxo só em ação.
- Teste de paridade das chaves PT/EN.
