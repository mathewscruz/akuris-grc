# Favicon e título da aba

## Situação atual
- A aba mostra "Akuris | Gap Analysis, riscos, privacidade e governança": longo, corta no navegador e soa como lista de palavras-chave.
- O favicon é o "A" roxo em PNG com fundo transparente; numa aba escura o roxo fica com pouco contraste e em tamanho pequeno o traço perde nitidez. Há ainda um `favicon.ico` antigo que alguns navegadores priorizam.

## O que muda
1. **Novo favicon**: o mesmo "A" do Akuris, branco/roxo sobre um quadrado arredondado azul-marinho (#0a1628) com um leve brilho roxo, legível em abas claras e escuras e nos ícones do celular. Versão vetorial para ficar nítida em qualquer tamanho, mais PNGs 32/192/512 e ícone Apple a partir dela.
2. **Título da aba**, curto e claro:
   - PT-BR: "Akuris — Compliance sem planilhas"
   - PT-PT: "Akuris — Compliance sem folhas de cálculo"
   - EN: "Akuris — Compliance without spreadsheets"
3. **Descrição** (Google e partilhas):
   - PT: "Gap Analysis com IA, riscos, controlos, evidências e auditorias numa só plataforma. Uma evidência serve todos os frameworks."
   - EN equivalente.
   - Atualizada também no `index.html` (o que redes sociais leem).

## Detalhes técnicos
- `public/favicon.svg` desenhado com o path do "A" existente; `magick` gera `favicon-32.png`, `icons/akuris-192.png`, `icons/akuris-512.png`, `apple-touch-icon-180.png` (manifest PWA continua a apontar para os mesmos nomes).
- `index.html`: `<link rel="icon" type="image/svg+xml" href="/favicon.svg">` + fallback PNG; remover `public/favicon.ico`.
- `site.ts`: `seoTitle`/`seoDescription` (PT/EN; PT-PT via variante regional se existir).
- A mudança chega ao site publicado após publicar.
