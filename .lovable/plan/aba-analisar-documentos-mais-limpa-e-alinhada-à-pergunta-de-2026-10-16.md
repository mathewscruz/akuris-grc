# Aba "Analisar documentos" — mais limpa e alinhada à pergunta de compliance

Hoje a aba mistura duas propostas: o texto diz "a IA mapeia o documento em qualquer requisito", mas a análise agora responde "esta política está em compliance com a norma?". Há também quatro números soltos com cores fortes e uma lista de avaliações com muito espaço vazio.

## Nova estrutura (de cima para baixo)

**1. Convite (cartão principal, mais compacto)**
- Título: "Sua política está em compliance com a ISO/IEC 27001?" (com o nome do framework atual).
- Uma linha: "Envie o documento e o Akuris responde, mostra o que já atende e o que ajustar — com texto sugerido."
- Área de soltar arquivo (arrastar e soltar ou clicar), com os formatos aceitos (PDF, Word). O botão "Gerar com IA" fica como ação secundária discreta.
- Mantém o detalhe de canto da identidade Akuris.

**2. Faixa de indicadores única** (componente de números padrão do sistema, sem as quatro listras coloridas)
- Políticas analisadas · Nota média · Requisitos com documento (ex.: 1 de 121) · Sem documento.
- Cor só quando há alerta (sem documento > 0); o resto neutro.

**3. Documentos que faltam** (sai da lateral e vira uma linha de chips abaixo dos números)
- Ex.: "Segurança · ~36 requisitos", "Tecnologia · ~34"... Cada chip abre "Gerar com IA" para aquele tema.
- Some quando não houver lacunas.

**4. Análises recentes — lista enxuta, uma linha por política**
- Anel pequeno com a nota (cor do veredito) · nome da política e do arquivo · veredito ("Em compliance com ressalvas") · nº de ajustes essenciais · data.
- Linha inteira clicável para abrir o resultado; excluir fica num menu de três pontos.
- Em andamento: loader Akuris com "Analisando…".
- Remove o selo duplicado ("Concluído" + "Parcial"), o rótulo "Framework:" repetido e a barra que ocupa a tela toda.
- Vazio: ilustração padrão com "Envie sua primeira política".

**Animações**: entrada em cascata suave dos cartões e linhas; anel da nota contando ao aparecer; respeita "reduzir movimento".

## Detalhes técnicos
- Arquivos: `v2/DocumentsHero.tsx` (convite, área de arraste reaproveitando `onUploadClick`/abertura do diálogo, StatStrip no lugar de KpiTiny, chips de lacunas → `onAIGenerate`), `adherence/AdherenceAssessmentView.tsx` (lista compacta; lê `metadados_analise.veredito` e conta `acoes` essenciais com `agruparAjustes`; fallback para análises antigas usando `resultado_geral`).
- Arrastar arquivo: entrega o arquivo ao diálogo existente (nova prop opcional `initialFile` em `AdherenceAssessmentDialog`) — mesma análise, sem mudanças no servidor.
- Usa StatusBadge, Chip, StatStrip, AkurisPulse, EmptyState, tokens de cor; roxo só para ação.
- Chaves PT/EN novas em `gap-analysis.ts`; cálculo dos números não muda.
