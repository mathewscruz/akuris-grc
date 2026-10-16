# Dashboard idêntico ao modelo (seguindo o tema claro/escuro)

## O que está errado hoje
- Mapa de riscos: os quadrados não aparecem e a legenda mostra 0 em tudo, porque os nomes de severidade não batiam. Só os números ficam soltos na tela.
- Anel do índice: cor única e chapada, sem o degradê verde-água do modelo.
- Gráfico do índice: só 2 pontos, flutuando no meio do cartão e sem preencher a largura.
- Cartões vazios (Planos, Incidentes, Contratos, Atividade) ficam como uma frase cinza solta e não parecem com o modelo.
- Alturas desalinhadas: Planos e Incidentes não completam a altura da linha, e sobra um buraco embaixo.

## O que será feito
1. **Mapa de riscos:** corrigir os nomes. Os 25 quadrados ficam sempre visíveis, com uma grade de tons: cinza nas células baixas e roxo cada vez mais forte nas altas, como no modelo. O número aparece só onde há risco. A legenda mostra as contagens reais, e "Impacto" fica na vertical ao lado da grade.
2. **Índice:** anel mais grosso com degradê verde-água, número grande e "de 100". O gráfico de área ocupa toda a largura embaixo, com pontos, a linha que se desenha e meses vazios mantidos no eixo.
3. **Planos e Incidentes:** os dois juntos ocupam exatamente a altura do Índice e do Riscos. Quando não há dados, mostram o anel ou a contagem zerados no mesmo formato do modelo (rosca cinza com "0 planos"; "0 incidentes em tratamento" com as 4 etiquetas em 0), em vez de uma frase solta.
4. **Contratos e Atividade sem dados:** um ícone discreto e um texto curto, centralizados, no mesmo estilo dos cartões.
5. **Medidas do modelo:** cartões com cantos mais arredondados e mais espaço interno, títulos maiores, linhas de mesma altura e grade alinhada até o fim da página.
6. **Tema:** no escuro fica idêntico à imagem; no claro, o mesmo desenho com fundo claro. As cores vêm dos padrões do sistema.

## Detalhes técnicos
- `tiles.tsx`: o mapa SEV_FILL passa a usar as chaves `low|medium|high|critical`, retornadas por `severidadeCelula`, e a legenda usa as mesmas chaves. As células usam `color-mix` com `--primary` e `--muted-foreground` sobre `--card`, com a intensidade escalada por P×I.
- O anel recebe um id de degradê único, um traço maior e paradas `--good` → `--success`, com tom mais saturado no tema escuro.
- O gráfico de área ocupa a largura total (`margin` 0) e usa altura fixa no rodapé do cartão.
- Estados zerados de Planos e Incidentes renderizam o componente normal com zeros.
- Grade: `xl:grid-rows-[auto_auto]`, `h-full` nos tiles e `flex-1` nos dois tiles empilhados.
- Validar com captura de tela no tema claro e no escuro, com dados de demonstração.
