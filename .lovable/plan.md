# Gantt: cor do texto da % nas barras

## Avaliação
O preto atual funciona nas barras claras (0%), mas fica difícil de ler sobre as partes escuras (vermelho, verde-petróleo e cinza-escuro, em 50% e 100%). A melhor regra é a cor depender do fundo logo atrás do número:
- **Sobre a parte preenchida (escura):** texto branco.
- **Sobre a parte vazia (clara):** texto escuro, como hoje.

Branco em todas as barras seria ruim: em 0% o número sumiria no fundo claro.

## O que muda
- O número da % fica branco sempre que a parte colorida da barra cobre o número inteiro. Fica escuro quando a barra está vazia ou com tão pouco preenchimento que o número cairia sobre o fundo claro.
- No modo escuro do sistema a mesma regra vale, com as cores do tema.
- As barras de fase e domínio seguem a mesma lógica.

## Detalhes técnicos
- `GanttChart.tsx` linha ~303: calcular `larguraPreenchida = (x(fim) - x(ini)) * pct / 100`. Se `>= 40px`, usar `text-primary-foreground`; senão `text-foreground/80`.
- Sem cores fixas; só tokens do tema.
