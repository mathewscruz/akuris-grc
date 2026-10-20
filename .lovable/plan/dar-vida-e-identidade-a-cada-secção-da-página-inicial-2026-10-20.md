# Dar vida e identidade a cada secção da página inicial

Hoje todas as secções têm o mesmo fundo, o mesmo cartão e nenhum movimento. Por isso parece "um papel só". A ideia é que cada secção tenha um fundo próprio e um movimento próprio, no mesmo espírito da demonstração do topo.

## O que muda em cada secção

1. **Faixa de confiança:** os selos dos frameworks passam a deslizar em fita contínua, que pára quando se passa o rato por cima. Os números (29, 82, 22) contam desde zero quando aparecem no ecrã.
2. **Como funciona:** passa a ser uma pequena demonstração interativa. Uma linha roxa avança de passo em passo, e ao lado aparece uma mini tela real do sistema que muda conforme o passo (requisito → controlo → evidência → avaliação). Clicar num passo salta para ele. Fundo um pouco mais claro, com um brilho roxo suave.
3. **Plataforma (4 grupos):** cartões com o ícone do grupo animado e uma borda de luz que segue o rato. Ao abrir "Ver capacidades", os módulos entram em cascata. Fundo com uma grelha de pontos discreta.
4. **Guias de frameworks:** cada cartão levanta ligeiramente e o selo acende ao passar o rato. Fundo escuro liso, para contrastar com a secção anterior.
5. **Segurança e confiança:** um escudo animado com o traço a desenhar-se, ao lado dos links.
6. **Perguntas frequentes:** a resposta abre com deslize suave e o "+" roda para "×".
7. **Chamada final:** o brilho roxo do cartão respira devagar e o "A" do Akuris desenha-se no fundo.
8. **Em toda a página:** cada secção entra com um leve deslize ao rolar, e há uma linha de separação com gradiente entre secções.

Quem tiver "reduzir movimento" ligado vê tudo parado, sem animações. Os textos e as línguas mantêm-se.

## Detalhes técnicos
- `LandingProof.tsx`: marquee CSS, contador com IntersectionObserver; `HowItWorks` reutiliza `useDemoPlayback` e `ProductScreens` (cena por passo, compacta).
- `ModuleCatalog`: spotlight via variáveis CSS `--mx/--my` em pointermove; cascata com `animation-delay`.
- Fundos alternados por classe de secção em `public-site.css` (sem cores novas fora da paleta pública atual).
- Reutilizar `useLandingReveal` para entradas; todas as animações dentro de `@media (prefers-reduced-motion: no-preference)` e da preferência `useMotionPreference`.
- Validar com capturas em computador e telemóvel e correr os testes da landing.
