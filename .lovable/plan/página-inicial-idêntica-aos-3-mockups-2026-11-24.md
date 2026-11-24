# Página inicial idêntica aos 3 mockups

Refazer a página inicial para reproduzir os mockups aprovados, secção a secção. Única diferença intencional: no rodapé o nome é "Akuris" (o mockup trazia "compliancehub" por erro de geração).

## Secções (ordem dos mockups)
1. **Topo**: logótipo Akuris à esquerda, menu centrado "Produto · Frameworks · Recursos · Contato", seletor de idioma em caixa arredondada com globo à direita; fundo transparente sobre a abertura.
2. **Abertura** (mockup 1): foto da cidade com ponte em roxo; rótulo espaçado "GOVERNANÇA • RISCO • COMPLIANCE"; título em 3 linhas; frase "Mais visibilidade. Mais controle. Mais confiança. Para um futuro mais seguro."; botão com contorno luminoso "Pedir demonstração →"; escudo grande em neon roxo no canto inferior direito com rastos de luz curvos; pequenos textos verticais espaçados (centro, canto superior direito e inferior direito); linha inferior com 3 benefícios com ícone: "Reduza riscos", "Fortaleça a conformidade", "Impulsione decisões melhores".
3. **Sobre o Akuris** (mockup 2): rótulo com traços laterais, título com "auditorias reais" em roxo, parágrafo, 4 números animados com divisórias (29+ frameworks, 15 módulos GRC, 82 cenários de risco, 3 idiomas), grelha 3×2 de cartões (Riscos, Controles, Gap Analysis, Privacidade, Auditorias, Continuidade) com ícone, texto e seta circular; o cartão sob o rato acende em roxo; frase final "CONFORMIDADE HOJE. UM AMANHÃ MAIS SEGURO." entre linhas.
4. **Faixa de frameworks** (mockup 3): texto à esquerda "Conforme os principais frameworks do mercado", setas, ícones + nomes (ISO 27001, SOC 2, LGPD, RGPD, NIS2, DORA, NIST CSF) a deslizar, texto à direita "Segurança em qualquer realidade".
5. **Como funciona**: rótulo "DO PLANO À PRÁTICA", 3 círculos numerados ligados por linha luminosa, com títulos e textos do mockup.
6. **Chamada final**: cartão grande com borda roxa; à esquerda rótulo, título "Pronto para simplificar o seu compliance?" com "compliance" em roxo, texto e botão roxo cheio; ao centro escudo luminoso com visto e ondas de luz; à direita 3 benefícios (Mais eficiência, Mais visibilidade, Mais confiança).
7. **Rodapé**: Akuris + "Conformidade hoje. Um amanhã mais seguro.", colunas Produto / Recursos / Empresa, ícones LinkedIn, YouTube, X, seletor de idioma, linha inferior com © e Privacidade / Termos / Cookies.

As secções atuais que não estão nos mockups (telas do produto, guias, segurança, perguntas frequentes) saem da página inicial; as páginas próprias delas continuam a existir.

## Detalhes técnicos
- Reescrever `LandingPage.tsx` e `CinematicSections.tsx` (HeroCinematic, AboutModules, FrameworkMarquee, GlowSteps, CtaShield, LandingFooter); variante do `PublicShell` com cabeçalho transparente e rodapé novo só na página inicial.
- Escudo e ondas em SVG desenhado (sem imagem), com brilho via drop-shadow e animação de traço; ícones Hugeicons já usados no app.
- Contador com IntersectionObserver; faixa em loop CSS; tudo parado em movimento reduzido; layout em coluna no telemóvel.
- Textos PT/EN em `site.ts`; links do rodapé apontam para rotas existentes (/frameworks, /seguranca, /politica-privacidade, contato abre o pedido de demonstração).
- Comparar screenshots lado a lado com os mockups antes de concluir.
