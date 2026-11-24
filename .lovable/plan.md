# Abertura mais sutil e integrada ao resto do site

## O que muda
- **Foto da cidade mais discreta**: menos brilho e contraste, cores puxadas para o mesmo azul-marinho das secções seguintes, e mais escurecida no lado do texto.
- **Transição suave para baixo**: o fundo da abertura vai desaparecendo aos poucos até virar exatamente a cor do bloco seguinte ("Uma plataforma GRC completa"), sem linha de corte visível.
- **Brilhos reduzidos**: o escudo roxo e as linhas de luz ficam mais transparentes, apenas como detalhe.
- **Mesma textura em toda a página**: o granulado passa a cobrir o site inteiro, e não só a abertura, para os blocos parecerem um único fundo.
- **Faixa de frameworks** recebe uma linha fina superior igual às divisórias das outras secções.

## Detalhes técnicos
- `public-site.css`: `.cine-hero-photo` com `opacity ~.55` e `filter: saturate(.6) brightness(.75)`; `.cine-hero-tint` com gradiente inferior terminando na cor de fundo das secções (`#0a1124`) em ~35% da altura; reduzir opacidade de `.cine-hero-shield` (~.5) e `.cine-trails` (~.25).
- Mover `.cine-grain` para um pseudo-elemento fixo em `.public-site` (pointer-events none) e removê-lo do hero.
- `.cine-marquee` com `border-top:1px solid #ffffff0f`.
- Validar desktop e mobile com Playwright, comparando a junção hero → secção seguinte.
