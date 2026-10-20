# Modelos de IA no Akuris: situação e melhorias

## O que usamos hoje

| Nível | Modelo | Onde |
| --- | --- | --- |
| Análise (topo) | Gemini 4 Argon | Evidências, verificação de itens, cruzamento de evidências, aderência de documentos, diagnóstico do Gap Analysis, questionário de segurança, avaliação de fornecedor, sugestão de tratamento de risco, DocGen (geração) |
| Padrão | Gemini 3.6 Flash | AkurIA (chat), assistente dos módulos, orientação dos requisitos, relatório de status e sugestão de tarefas de projetos, e-mails |
| Mecânico | Gemini 3.1 Flash Lite | Tradução de frameworks, tarefas leves do DocGen e e-mails |
| Imagem | Gemini 2.5 Flash Image | Imagens de campanhas |
| Reserva | GPT-5.4 mini | Só no DocGen, quando o Gemini falha |

## O que dá para melhorar

1. **Reserva em todas as análises de topo.** Hoje só o DocGen tem plano B. Se o Gemini 4 cair, evidências, documentos e diagnóstico falham. Passar a tentar o modelo de reserva automaticamente, com o aviso "resultado simplificado".
2. **Orientação dos requisitos no modelo de topo.** É o texto que fica guardado e todo cliente lê; é gerado uma vez só, então o custo extra é pequeno e a qualidade fica permanente.
3. **Imagem de campanhas:** trocar o modelo de 2.5 (geração antiga) pelo atual de imagem, com texto legível nas artes.
4. **Respostas no mesmo formato** (veredito, motivo, o que falta, próxima ação) em todas as análises, para o resultado vir completo e comparável.
5. **Sem mudança** no chat, projetos e tradução: o modelo rápido já entrega bem e responde mais depressa.

## Detalhes técnicos

- Criar em `_shared/ai.ts` um `chamarComReserva(payload)` que tenta `MODELOS.ANALISE` e, em 5xx/timeout, `MODELOS.RESERVA` (usando `max_completion_tokens`, sem temperatura); devolve `simplificado: true`. Aplicar nas 9 funções de ANALISE.
- `populate-requirement-guidance`: `PADRAO` → `ANALISE`.
- `MODELOS.IMAGEM`: confirmar o slug atual disponível no gateway e atualizar.
- Crédito continua cobrado só após sucesso; atualizar o teste `analises-usam-modelo-de-topo` e adicionar teste da reserva. Redeploy das funções alteradas.
