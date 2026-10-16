# Análise sem seleção de requisitos

## O que muda para o usuário
- Envia a política e pronto. Não aparece mais a tela pedindo para marcar ou desmarcar requisitos.
- Por trás, a análise faz uma única pergunta: "De acordo com a [norma do framework aberto], esta política está em compliance?" A IA decide sozinha quais pontos da norma se aplicam ao tema da política, avalia e responde.
- O resultado continua igual: veredito, o que precisa fazer, o que já está bom e a lista "fora do escopo" (só para informar quais pontos da norma essa política não precisa cobrir).
- A tela de progresso mostra "Entendendo a política" e depois segue direto para "Avaliando".

## Detalhes técnicos
- `analyze-document-adherence`: ao terminar a etapa de classificação, já monta os lotes com os requisitos sugeridos e continua a análise (status `processando`, etapa `resumindo`/`avaliando`), sem parar em `aguardando_escopo`. A lógica de confirmação vira uma função interna reaproveitada; a ação `confirmar_escopo` sai.
- `AdherenceAssessmentDialog.tsx`: remove o passo de escopo (estado, confirmação automática ao fechar e renderização). Progresso mostra a etapa de classificação.
- Remove `AdherenceScopeConfirm.tsx` e as chaves de texto do passo de escopo que ficarem sem uso (mantém o aviso de PDF escaneado).
- Testes da função e de paridade de idiomas rodam de novo; redeploy da função.
