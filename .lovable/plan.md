# Nova landing page do Akuris inspirada na Oplium

## Objetivo
Recriar a página inicial (akuris.pt / akuris.com.br) com a estética cinematográfica da Oplium — fundo escuro imersivo, uma cor de marca dominante em brilho, foto de destaque monocromática, contornos luminosos do logótipo e números animados — mas com identidade, textos e cores do Akuris (navy #0a1628 + roxo #7552FF, fonte DM Sans). Nada é copiado: só a linguagem visual serve de referência.

## O que o visitante vai ver (de cima para baixo)
1. **Topo fixo translúcido**: logótipo Akuris, menu (Produto, Frameworks, Recursos, Contato), seletor de idioma em caixa com contorno, botão "Pedir demonstração".
2. **Abertura em tela cheia**: fundo navy com banho de luz roxa; imagem monocromática gerada (horizonte urbano/escudo abstrato, tingida de roxo); título grande "Fique um passo à frente em governança, risco e compliance"; botão com contorno; frase de apoio no canto inferior direito; o símbolo do Akuris desenhado em linha roxa luminosa a sair pelo canto, com partículas e traços digitais a cintilar.
3. **Sobre o Akuris**: rótulo pequeno, título, parágrafo e 4 números que contam a subir ao entrar na tela (frameworks suportados, módulos GRC, cenários de risco na biblioteca, idiomas). Só números reais do produto.
4. **Módulos**: grelha de cartões escuros com os ícones próprios do Akuris, borda que acende em roxo ao passar o rato.
5. **Produto em ação**: as telas animadas que já existem, numa moldura com brilho.
6. **Frameworks**: faixa a deslizar com ISO 27001, SOC 2, LGPD/RGPD, NIS2, DORA etc.
7. **Como funciona**: 3 passos ligados por uma linha luminosa.
8. **Chamada final**: cartão com o contorno do símbolo e "Pedir demonstração".
9. **Rodapé** escuro com links, redes e selos.

Mantém-se: sem preços públicos, contato em primeiro lugar, PT-BR / PT-PT / EN em todos os textos, modo de movimento reduzido e versão de telemóvel.

## Detalhes técnicos
- Reescrever `src/pages/LandingPage.tsx` com novas secções em `src/components/landing/oplium-style/` (HeroCinematic, AboutCounters, ModuleGlowGrid, FrameworkMarquee, GlowSteps); reaproveitar `PublicShell`, `DemoButton`, `ProductScreens`, `ModuleCatalog` (dados), `FrameworkGlyph`, `useLandingReveal`.
- Tokens novos em `index.css` (`--glow-primary`, `--gradient-hero`) e animações (contorno SVG com stroke-dashoffset, partículas CSS, contador com IntersectionObserver), todas desligadas com `prefers-reduced-motion`.
- Imagem de destaque gerada com a CLI de media, guardada como asset e tingida via CSS (mix-blend).
- Textos novos em `site.*` nos dicionários PT/EN; números vindos de `frameworksSeo` e catálogo de módulos.
- Verificar no navegador em desktop e telemóvel antes de concluir.
