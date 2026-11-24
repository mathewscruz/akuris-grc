# Área de parceiros e revendedores na landing

## O que muda
- Nova seção "Parceiros e revendedores" na landing, entre "Para quem é" e o FAQ, no mesmo estilo editorial do site (título grande, linha fina, sem cartões).
- Logos lado a lado, em branco, discretos (opacidade reduzida) e ganhando brilho ao passar o mouse; em celular ficam empilhados e centralizados.
- Logos: **CyberME** e **Mercurius**.
- Abaixo dos logos, um convite curto "Quer revender o Akuris?" com link para o formulário de contato já existente.
- Textos em pt-BR, pt-PT e inglês.

## Logo da CyberME
O arquivo enviado tem fundo preto. Removo o fundo, mantendo só as linhas brancas e o nome, com fundo transparente, para o logo se integrar ao fundo marinho do site. O da Mercurius já vem transparente.

## Detalhes técnicos
- Fundo removido por luminância (preto → alfa 0, mantendo bordas suaves), recortado ao conteúdo; os dois logos vão como assets de CDN (`.asset.json`).
- Novo componente `PartnersStrip` em `CinematicSections.tsx`, usado em `LandingPage.tsx`; chaves i18n novas no dicionário da landing.
- Verificação visual em 1280 px e 390 px.
