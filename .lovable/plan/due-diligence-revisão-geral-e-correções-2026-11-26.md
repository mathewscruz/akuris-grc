# Due Diligence: revisão geral e correções

## O que a revisão encontrou

**1. Notas por pergunta erradas (grave).** A base hoje mistura dois formatos de nota. Respostas antigas guardam nota × peso (ex.: 20 com peso 2, 30 com peso 3) e as novas guardam a nota pura de 0 a 10 (ex.: 10 com peso 3). A tela e o PDF dividem sempre pelo peso. Assim, uma resposta nova perfeita com peso 3 aparece com nota 3,3 e como "lacuna crítica". Isso gera falsos alertas no relatório.

**2. Avaliação sem respostas mensuráveis.** A nota final fica vazia, mas o relatório mostra 0% "Ruim" e o painel ignora a avaliação. Os três lugares discordam.

**3. "Não se aplica" conta como nota.** Escolher essa opção dá nota pela posição da opção (geralmente 0), o que derruba a nota injustamente. Perguntas opcionais não respondidas também somem do cálculo sem aviso.

**4. Duas escalas de risco.** A nota usa baixo/moderado/elevado/crítico e a IA usa baixo/médio/alto/crítico. As mesmas palavras aparecem na mesma tela com sentidos diferentes.

**5. A leitura da IA não lê os comprovantes.** Ela só sabe se existe um arquivo e o nome dele. Também não recebe as perguntas sem resposta, e o crédito é cobrado antes de a resposta ser validada e salva. O fornecedor espera até cerca de 3 minutos no "Enviar" enquanto a IA roda. Dois envios ao mesmo tempo podem cobrar duas vezes.

**6. Formulário do fornecedor.** O salvamento automático perde a resposta anterior quando o fornecedor muda de pergunta em menos de 1 segundo. Erros ao salvar não aparecem. Trocar um anexo deixa o arquivo antigo guardado.

**7. Telas internas.** Nota 0 não aparece no visualizador de respostas. "Lembrete enviado" aparece mesmo quando o envio falha. A validade do link é calculada de um jeito na lista e de outro no link público.

**8. Integridade.** Pela tela interna é possível gravar uma resposta ligada a uma pergunta de outro questionário. O link público já bloqueia isso.

## O que será feito

### Fase 1: notas corretas (prioridade)
- Converter as notas antigas para o formato 0–10 e recalcular as avaliações afetadas.
- A tela e o PDF passam a ler a nota direto, sem dividir pelo peso.
- A opção "Não se aplica" fica fora do cálculo, e a tela mostra "N perguntas não aplicáveis / não respondidas".
- Avaliação sem dados mensuráveis aparece como "Sem nota" na tela, no PDF e no painel.
- Uma escala única para a nota (Excelente/Bom/Regular/Ruim) e a escala da IA identificada como "Parecer da IA".

### Fase 2: IA confiável
- O envio do fornecedor termina na hora e a IA roda em segundo plano, com a mensagem "Análise em andamento" na tela.
- Uma única análise por avaliação, com o crédito cobrado só depois de o parecer ser salvo.
- A IA passa a ler o texto dos comprovantes (PDF e imagens, com limite de tamanho) e recebe as perguntas sem resposta.
- O sino avisa quando o parecer fica pronto.

### Fase 3: formulário do fornecedor
- Salvamento separado por pergunta, com o indicador "Salvo / erro ao salvar".
- O progresso conta só as obrigatórias.
- Ao trocar um anexo, o antigo é apagado.

### Fase 4: telas internas
- Nota 0 visível, lembrete com erro real, validade do link igual em todo lugar.

### Fase 5 (já no roadmap)
- Decisão formal, pedido de evidências só das perguntas fracas, comparação com a avaliação anterior e painel de vencidas/a vencer.

## Detalhes técnicos
- Migração: `UPDATE due_diligence_responses r SET pontuacao = r.pontuacao / q.peso` apenas onde `pontuacao > 10` (formato antigo inequívoco); casos ≤10 com peso >1 já estão no formato puro. Depois, `calculate_due_diligence_score` para cada avaliação concluída.
- `avaliacao-regras.ts`: `notaDe` = `pontuacao` puro; testes atualizados (peso 3 + nota 10 ≠ lacuna).
- `dd_nota_da_resposta`: retorna NULL para opções marcadas como N/A (`configuracoes.na_opcoes` ou texto "não se aplica"/"n/a").
- Agregação a partir das perguntas do template para contar ausentes; wrapper deixa de converter classificação nula em "ruim".
- `public-assessment`: claim atômico de conclusão (`UPDATE ... WHERE status<>'concluido' RETURNING`), remove o RPC duplicado, IA disparada sem await (EdgeRuntime.waitUntil).
- `avaliar-fornecedor-ia`: `consume_ai_credit_idempotente` após salvar; guard de status concluído e de parecer em andamento; extração de texto dos anexos; registro do modelo real usado (fallback).
- Trigger em `due_diligence_responses` validando `question_id` ∈ template da avaliação.
- `Assessment.tsx`: timers por pergunta + fila; `AssessmentResponsesViewer` usa `!= null`.
- Testes: regras de nota/N/A/sem nota; regra de claim único.
