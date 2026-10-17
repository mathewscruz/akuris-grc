# Evidências esperadas: marcar itens e verificação pelo Akuris

## Como funciona hoje
- O usuário não consegue marcar os itens manualmente. O círculo só fica marcado sozinho quando o **nome de um arquivo** enviado como evidência tem palavras parecidas com o texto do item.
- O documento ligado em "Documentos que provam este requisito" (ex.: Plano de Continuidade) **não é considerado** para marcar os itens. Por isso aparece "0 de 7" mesmo com um documento ligado.
- O Akuris não lê o conteúdo para confirmar se o item está atendido.

## O que propomos
1. **Marcar à mão**: clicar no círculo marca o item como "Atendido". Ao marcar, o usuário pode escolher qual arquivo ou documento comprova o item (opcional) e escrever uma nota curta. Clicar de novo desmarca.
2. **"Verificar com o Akuris"** (um botão no topo da lista): o Akuris lê os documentos e arquivos ligados e responde, para cada item:
   - **Atendido**: com o trecho do documento que comprova o item;
   - **Parcial**: o que falta;
   - **Não encontrado**: o que o documento precisaria ter.
   Exemplo: o Plano de Continuidade ligado a um requisito de privacidade seria apontado como "não comprova".
3. **Sugestão, não decisão**: o resultado do Akuris aparece como sugestão com botão "Aceitar". O usuário continua dono da decisão final.
4. **Salvo e reaproveitado**: o resultado fica guardado por empresa. Abrir de novo não gasta créditos. Só uma nova verificação gasta créditos (1 por verificação), e um aviso aparece quando o documento muda de versão.
5. **Ligação com a decisão**: a contagem "X de 7" e a sugestão de status (Conforme/Parcial) passam a usar essas marcações.

## Detalhes técnicos
- Nova tabela `gap_evidencia_itens` (empresa_id, requirement_id, item_index, item_texto, status manual|ia, ia_status, ia_trecho, ia_motivo, documento_id/evidence_link_id, versão do documento, marcado_por, timestamps), com GRANTs e RLS por empresa.
- Reaproveitar a função `analyze-evidence-against-requirement`, retornando JSON por item; texto do documento vindo do conteúdo já extraído; `consume_ai_credit_idempotente` e tratamento de 402 via `invokeEdgeFunction`.
- `RequirementDrawer`: círculos clicáveis, popover para escolher a prova, chips Atendido/Parcial/Não encontrado com trecho, botão de verificação com AkurisPulse; `sugerir-status` considera as marcações; textos PT/EN.
- Testes: contagem e sugestão de status a partir das marcações; isolamento por empresa.
