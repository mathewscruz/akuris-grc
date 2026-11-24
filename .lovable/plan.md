# Landing: limpar textos soltos e enriquecer o visual

## 1. Retirar os elementos marcados
Remover da abertura os três blocos de texto em letras espaçadas:
- "Segurança / Transforma / Possibilidades" (ao lado do botão "Ver como funciona")
- "Pessoas / Processos / Tecnologia / Um futuro mais seguro" (canto superior direito)
- "Inteligência / em governança / para o que vem a seguir" (canto inferior direito, sobre o escudo)

Também saem os pequenos traços verticais decorativos espalhados pela foto, que só faziam sentido junto a esses textos.

## 2. Elementos inspirados na Oplium que fazem sentido no Akuris
- **Granulado de filme suave** sobre as áreas escuras, dando textura cinematográfica em vez de cor chapada.
- **Brilho de luz que acompanha o rato** nos cartões de módulos e perfis (efeito "spotlight"), discreto.
- **Títulos que surgem palavra a palavra** ao rolar a página, com versão estática para quem prefere menos movimento.
- **Faixa de frameworks em movimento contínuo** (rolagem infinita lenta, pausa ao passar o rato).
- **Números grandes contando até o valor** quando entram na tela.
- **Linhas finas de grelha** separando secções, no lugar de fundos diferentes, para tudo parecer uma página só.

## 3. Mistura de tons (menos roxo)
O roxo continua como cor de ação (botões, links ativos). O resto ganha uma paleta de apoio:
- **Ciano/azul-petróleo frio** para brilhos e gradientes de fundo (combina com a foto noturna).
- **Âmbar suave** em pequenos destaques (números, selos "pronto para auditoria").
- **Branco quente e cinza-azulado** nos textos secundários.
- A foto da abertura recebe um tom mais azul-noite com reflexos ciano, mantendo o escudo roxo como único ponto forte de cor.

Resultado: abertura mais limpa, foco no título, subtítulo e botões.

## Detalhes técnicos
- `CinematicSections.tsx`: apagar as três chamadas `<Vertical>` e o componente se ficar sem uso; remover chaves `cineVMid/cineVTop/cineVBottom` de `src/i18n/modules/site.ts`; limpar CSS `.cine-v-*` e traços em `public-site.css`.
- Novos tokens HSL em `index.css`/`tailwind.config.ts`: `--site-cyan`, `--site-amber`, `--site-grain`; usados só no site público.
- Efeitos com CSS + IntersectionObserver, respeitando `prefers-reduced-motion`; sem nova biblioteca.
- Validar desktop e mobile com Playwright após as mudanças.
