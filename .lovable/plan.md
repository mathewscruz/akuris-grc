# Tamanhos proporcionais à tela

## O que muda
- Todo o sistema passa a crescer ou encolher junto com a largura da tela, mantendo a proporção:
  - em notebooks pequenos (cerca de 1280px), textos, cartões, ícones e espaços ficam um pouco menores;
  - em monitores grandes e telas 2K/4K, ficam maiores, sem deixar áreas vazias nem elementos minúsculos.
- Há limites mínimo e máximo, para nada ficar ilegível nem exagerado. No celular e no tablet o tamanho atual é mantido.
- No painel inicial, os gráficos (índice operacional, matriz de riscos, rosca dos planos, linha de tendência) deixam de ter tamanho fixo e acompanham o tamanho do cartão. Isso corrige o anel grande demais e o gráfico encolhido do print.
- Os cartões do painel de uma mesma linha passam a ter a mesma altura, e o conteúdo fica centralizado na proporção do modelo.

## Detalhes técnicos
- Tamanho base fluido em `src/index.css` no `html`, apenas a partir de 1024px. Hoje está fixo em 16px; passa a escalar de cerca de 14px até 18px conforme a largura (de 1280 a 2560px). Isso reescala tudo o que usa `rem`: textos, espaçamentos, ícones e raios do Tailwind.
- Revisar os 13 tamanhos fixos em px no painel (anel, rosca, alturas dos gráficos, células do heatmap) e trocar por `rem`/`clamp()` ou por SVG com `viewBox` e largura 100%.
- Ajustar o cálculo de ajuste da barra lateral (`useSidebarFit`) para usar o tamanho base atual, sem voltar a oscilar.
- Validar com Playwright em 1280, 1440, 1920 e 2560px de largura, além de tablet e celular: sem rolagem horizontal, sem textos cortados e proporção igual nas capturas.
