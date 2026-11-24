# Abertura autoral e minimalista

Concordo: o escudo neon, as linhas de luz e a foto de banco de imagens são clichês de "site feito por IA" e competem com o título. A proposta é trocar tudo por um único elemento visual próprio do Akuris.

## O que sai
- Foto da cidade/ponte.
- Escudo roxo em contorno duplo.
- Linhas de luz ciano cruzando a tela.

## O que entra
- **Fundo liso azul-marinho**, igual ao resto do site, com o granulado sutil já existente.
- **O "A" da marca Akuris como peça central**, grande, à direita, desenhado em traço fino (1,5 px, o mesmo traço dos ícones do sistema). Ele se desenha sozinho ao abrir a página e depois um feixe de luz percorre o contorno devagar, como uma assinatura.
- **Malha de pontos discreta** só atrás do "A", que se ilumina levemente perto do cursor (efeito elegante, quase invisível em repouso).
- **Um único brilho difuso** atrás da marca, em roxo misturado com azul-petróleo, sem neon.
- **Título com uma palavra em destaque** (ex.: "compliance") em degradê suave, e o resto em branco. Benefícios e faixa de frameworks continuam, mais espaçados.
- No celular, o "A" fica atrás do título, bem apagado, como marca d'água.

Resultado: muito espaço livre, um ponto de atenção forte e reconhecível, e identidade que só o Akuris tem.

## Detalhes técnicos
- `CinematicSections.tsx` (HeroCinematic): remover `<img heroSkyline>`, `NeonShield` e `LightTrails` do hero (manter no CTA final); criar `BrandMark` em SVG com o caminho do logótipo, `pathLength=1`, animação de desenho + `stroke-dasharray` em loop para o feixe.
- Malha de pontos via `radial-gradient` em CSS com máscara que usa `--mx/--my` do ponteiro (reaproveita o hook de spotlight).
- `public-site.css`: novas classes `.cine-mark`, `.cine-dots`, `.cine-glow`; remover regras de `.cine-hero-photo/.cine-hero-tint/.cine-hero-shield/.cine-trails` não usadas; respeitar `prefers-reduced-motion`.
- Verificar se `landing-hero-skyline.jpg` deixa de ser usado e remover o import.
- Validar em desktop e mobile com Playwright.
