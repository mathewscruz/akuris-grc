# Landing: ajustes para celular

## Objetivo
Deixar a landing impecável em celulares de 320 a 430 px e em tablet (768 px), sem mudar o visual do computador.

## Ajustes
1. **Ilustração do produto** — confirmar se ela some no celular ou se é só a animação de entrada que não dispara. Garantir que ela aparece sempre, ocupando a largura da tela com as bordas a dissolverem no fundo.
2. **Espaços vazios entre secções** — reduzir no celular os espaços grandes, sobretudo antes de "Do plano à prática" e de "Para quem é", mantendo o ar editorial.
3. **Números dos passos (01, 02, 03)** — diminuir no celular o tamanho dos números em contorno e aproximá-los do texto.
4. **Toque** — no celular, desligar o brilho que segue o cursor e garantir que perguntas, links e botões têm uma área de toque confortável.
5. **Celular deitado e letra aumentada** — garantir que a abertura cabe com o celular na horizontal e que os títulos não ficam cortados quando a letra do aparelho está aumentada.

## Verificação
Capturas de tela da página inteira a 320, 360, 390, 430 e 768 px, em português e inglês, conferindo que nada rola para os lados, que a ilustração aparece e que não sobram buracos entre as secções.

## Detalhes técnicos
- Arquivos: `src/styles/public-site.css` (media queries ≤ 640 px e `(hover: none)`, `padding-block` das secções `.ed-*`, `font-size` com `clamp()` nos números dos passos) e `src/components/landing/CinematicSections.tsx` (fallback de visibilidade da ilustração quando o IntersectionObserver não dispara ou `prefers-reduced-motion`).
- Usar `svh`/`dvh` na abertura para o celular na horizontal e com a barra do navegador.
- Testes com Playwright, mais as alturas das secções medidas antes e depois.
