# Assistente de escopo: uma pergunta por vez

## O que muda para o usuário
- **Topo enxuto:** título "Vamos encurtar a sua lista" + uma frase curta ("9 perguntas rápidas. Cada 'Não' remove controles que não se aplicam, com justificativa pronta para o auditor."). O texto longo sobre cláusulas 4–10 vira um "Saiba mais" recolhido.
- **Barra de progresso** fina em roxo com "Pergunta 3 de 9" e pontinhos clicáveis para voltar a qualquer pergunta já vista.
- **Uma pergunta grande no centro:** título curto em destaque, exemplo de uma linha abaixo e "Como responder?" recolhido com a ajuda completa.
- **Três botões grandes** Sim / Não / Não sei, com atalhos de teclado 1, 2 e 3 visíveis. Ao escolher, a tela passa sozinha para a próxima pergunta com uma transição suave (← e → também navegam).
- **Painel lateral ao vivo** (no celular, uma faixa abaixo): "121 controles → 104 no escopo", lista dos controles que saem agrupados por pergunta, e os avisos de trava quando uma resposta é ajustada automaticamente.
- **Etapa final de confirmação** mantida, com visual mais limpo: resumo em destaque, cada justificativa em cartão recolhível para editar e botão "Aplicar escopo".
- Avisos de "nunca excluir" e travas continuam visíveis na própria pergunta.

## Textos
- Cada pergunta ganha um **título curto** e um **exemplo de uma linha** (PT e EN); o texto atual de ajuda passa para "Como responder?". Nada da lógica de exclusão ou das justificativas muda.

## Detalhes técnicos
- Reescrever a etapa "perguntas" em `AssistenteDeEscopo.tsx` com índice atual, avanço automático, atalhos de teclado e layout `[1fr_300px]`; diálogo em tela cheia no celular.
- Adicionar campos opcionais `curta` e `exemplo` às perguntas em `gap-escopo.ts` / `gap-escopo-en.ts` (fallback para `pergunta`/`ajuda`), sem alterar `codigosExcluidos`, travas ou gravação no SoA.
- Novas chaves i18n PT/EN em `gap-escopo.ts` do dicionário; rodar os testes existentes de escopo (`escopo-*`, `ingles-nao-e-portugues`).
