# Teste completo do Due Diligence

Testar no navegador, com a sua sessão, todo o caminho de uma avaliação de fornecedor. Os dados de teste ficam marcados como "TESTE" e são removidos no fim.

## Roteiro
1. **Questionário:** abrir Due Diligence › Questionários e criar "TESTE – Fluxo completo" com perguntas de cada tipo: sim/parcial/não com a opção "Não se aplica", múltipla escolha, nota 0–10, anexo, texto e uma pergunta obrigatória de peso 3.
2. **Fornecedor e envio:** criar o fornecedor "TESTE Fornecedor" e enviar a avaliação. O link deve ser gerado. O e-mail vai para um endereço seu; o envio real fica a confirmar.
3. **Formulário do fornecedor:** abrir o link público numa janela sem sessão e conferir:
   - salvamento ao trocar de pergunta rapidamente;
   - progresso contando só as obrigatórias;
   - envio de um PDF e troca do anexo;
   - bloqueio do envio com obrigatória em branco;
   - envio terminando na hora.
4. **Nota:** conferir a nota calculada à mão:
   - "Não se aplica" fica fora da conta;
   - nota 10 com peso 3 não aparece como lacuna;
   - nota 0 aparece no visualizador de respostas.
5. **IA:** conferir o aviso "Análise em andamento", depois o parecer gravado citando o PDF, a notificação no sino e um único débito de crédito.
6. **Relatório:** abrir o relatório na tela e baixar o PDF. Conferir as notas por pergunta (x/10), a escala Excelente/Bom/Regular/Ruim e as lacunas.
7. **Telas internas:** reenvio, lembrete, validade do link e painel.
8. **Caso "Sem nota":** uma avaliação só com texto livre deve mostrar "Sem nota".
9. **Limpeza:** apagar o questionário, o fornecedor, a avaliação e os anexos de teste.

Tudo o que falhar é corrigido na mesma rodada e testado de novo.

## Detalhes técnicos
- Playwright headless em localhost:8080 com a sessão do preview. O link público é aberto em um contexto anônimo.
- Conferência da nota via read_query em due_diligence_responses e due_diligence_scores.
- Logs de avaliar-fornecedor-ia e public-assessment e AI Gateway logs para modelo, tempo e anexos.
- Débito conferido em creditos_consumo; notificação em notifications.
- Limpeza filtrada pelos ids criados, sempre com empresa_id.
