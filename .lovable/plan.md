# Geografia dos parceiros na landing

Trocar a legenda "Revende o Akuris na Europa / no Brasil e no Chile" por uma assinatura geográfica editorial embaixo de cada logotipo.

## O que o visitante vê
- Embaixo de cada logo, um mini-mapa em pontos (estilo pontilhado, sem contornos de países), discreto em branco translúcido, com a região de atuação acesa:
  - CyberME: Europa acesa em ciano, com um pulso suave sobre Portugal.
  - Mercurius: Brasil e Chile acesos em âmbar, com pulsos suaves sobre cada país.
- Abaixo do mapa, uma linha curta em letras pequenas espaçadas: "EUROPA" e "BRASIL · CHILE", com o rótulo "Revenda oficial" em cinza suave.
- Ao passar o mouse sobre o parceiro, o mapa ganha brilho e o logo fica com opacidade total.
- Animação dos pontos aparece ao rolar até a seção; respeita "reduzir movimento".
- No celular, cada parceiro empilhado com seu mapa embaixo, centralizado.

## Detalhes técnicos
- Novo componente `PartnerGeo` em `CinematicSections.tsx`: SVG inline com grade de pontos gerada a partir de uma máscara simplificada de continentes (array estático de coordenadas), sem biblioteca nova e sem imagem externa.
- Cores via tokens já usados no site (ciano/âmbar do public-site.css).
- Chaves i18n PT/EN: substituir `partnersRegionCyberme/Mercurius` por `partnersGeoEurope`, `partnersGeoBrChile`, `partnersOfficialReseller`.
- Estilos em `src/styles/public-site.css` (`.ed-partners-geo`), incluindo media query mobile e reduced-motion.
- Verificar em 1280px e 390px com Playwright.
