# Faixa de indicadores 20% menor

Reduzir a faixa para cerca de 80% do tamanho atual em todos os módulos, mantendo as proporções entre os elementos:

- Espaçamento interno e altura total: aprox. -20%.
- Número principal (56px → 45px), números das colunas (44px → 35px), legenda e rótulos proporcionalmente menores (16px → 13px, 14px → 12px).
- Barra colorida mais baixa (28px → 22px), bolinhas e ícone de relógio menores, espaços entre linhas das listas reduzidos.
- Desenho do módulo ao fundo reduzido na mesma proporção.
- Celular segue a mesma escala.

## Detalhes técnicos
Ajustes só em `src/components/ui/stat-strip.tsx` (classes de tamanho/padding do item, barra, listas e `StatBandArt`). Nada muda nas páginas. Testes da faixa reexecutados.
