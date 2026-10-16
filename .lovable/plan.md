# Popup "Analisando documento" — progresso real e mais informativo

## O que muda para o usuário
1. **Sai o "Restante"**. Fica só o tempo decorrido, discreto.
2. **A porcentagem passa a refletir o trabalho real**, por fases com peso proporcional:
   - Preparando o arquivo (leitura, envio) → 0–10%
   - Entendendo a política (tema e pontos da norma que se aplicam) → 10–20%
   - Lendo o documento, parte a parte → 20–45% (avança a cada parte lida)
   - Avaliando contra a norma, lote a lote → 45–90% (avança a cada lote concluído)
   - Montando o resultado (veredito, ajustes, textos sugeridos) → 90–100%
   Documentos curtos pulam a leitura por partes e a faixa é redistribuída — nada fica "parado em 35%".
3. **Animação suave**: o número conta até o novo valor em vez de saltar; o anel desliza junto. Enquanto uma fase trabalha, avança devagar dentro dela (sem nunca passar do limite da fase nem voltar). Um brilho leve percorre o anel enquanto está ativo; ao concluir, o anel fica verde e aparece o visto.
4. **"O que o Akuris já descobriu"** — pequeno quadro que vai se preenchendo durante a análise:
   - Tema identificado: "Política de Segurança da Informação"
   - Pontos da norma que se aplicam: "38 de 121"
   - Partes lidas: "3 de 8"
   - Pontos avaliados: "20 de 38"
   Cada linha aparece com animação quando a informação fica disponível.
5. **Etapas** passam a ter cinco itens alinhados às fases acima, cada uma mostrando sua contagem real quando ativa (ex.: "Lendo parte 3 de 8").
6. **Cabeçalho mais limpo**: remove a frase "Aguarde enquanto processamos a análise de aderência"; fica o título com norma e nome do arquivo.
7. **Se travar**: quando nada avança por mais de 1 minuto, mostra "Ainda trabalhando — documentos grandes levam mais tempo" (em vez de parecer congelado). Ao concluir, mostra "Análise concluída" com o veredito por 2 segundos antes de fechar.
8. Mantém o aviso "Pode fechar esta janela — avisamos pelo sino".

## Detalhes técnicos
- Fonte do progresso: `analise_aderencia_jobs` (etapa, progresso, total, trechos, contexto.documento_tema, contexto.fora_escopo_ids) já consultada a cada 3s; mapear etapa→faixa e `progresso/total` dentro da faixa (separando trechos e lotes). Conclusão lê `metadados_analise.veredito`.
- Nova função pura `calcularProgresso(job)` em `adherence/progresso.ts` com teste (faixas, documentos de uma parte, nunca regredir).
- `AdherenceAnalysisProgress.tsx`: número animado via requestAnimationFrame com easing e "creep" limitado à fase; quadro de descobertas; 5 etapas; remoção do restante; respeita reduzir movimento.
- `AdherenceAssessmentDialog.tsx`: passa job/descobertas para o componente; descrição do cabeçalho vazia durante a análise.
- Chaves PT/EN novas; sem mudanças no servidor.
