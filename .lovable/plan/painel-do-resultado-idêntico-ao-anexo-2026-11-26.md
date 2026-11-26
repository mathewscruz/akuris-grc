# Painel do resultado idêntico ao anexo

## O que muda na tela
1. **Cabeçalho**: caminho "Avaliações › IdVerify KYC Ltda" acima do título grande "Resultado da Avaliação — IdVerify KYC Ltda". À direita, um botão roxo cheio, "Baixar relatório". "Reavaliar" vira um botão discreto ao lado, porque continua necessário.
2. **Faixa de 5 blocos**, como no anexo: rótulo pequeno em cima e valor grande embaixo ("81/100" com o selo "Excelente", bolinha de cor + "Baixo", "6", "72%", "23 set 2024"). Os números ficam em preto, sem cor.
3. **Desempenho por seção**: nome, barra grossa arredondada e "33/100" em cinza.
4. **Leitura da IA**: ícone de brilho num círculo lilás à esquerda e o texto ao lado.
5. **Respostas que custaram pontos**: colunas Pergunta · Resposta (selo vermelho "Não") · Pontuação "0/10" · Peso "3" · Seção (selo vermelho com o nome). Os filtros por seção saem.
6. A leitura da IA por seção e o plano de ação saem desta tela e continuam no relatório baixado (PDF), para a tela ficar igual ao anexo.

## Detalhes técnicos
- `AssessmentsManagerEnhanced.tsx`: o diálogo de resultado passa a ter título próprio (breadcrumb + h2), sem o ícone de troféu, e os botões vão para a direita do cabeçalho (o primário "Baixar relatório" com `variant="default"`).
- `RelatorioDoFornecedor.tsx`: ajusta tipografia (rótulos `text-sm text-muted-foreground`, valores `text-3xl font-semibold`), barras `h-2.5 rounded-full`, ícone `IconSparkles` em `bg-primary/10`, selos com `Chip` no tom destrutivo. Remove os filtros, os blocos por seção e o plano de ação.
- Cores só por tokens; a regra de classe pela nota não muda.
