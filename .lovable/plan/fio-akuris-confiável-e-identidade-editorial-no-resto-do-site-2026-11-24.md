# Fio Akuris confiável e identidade editorial no resto do site

## 1. Fio Akuris acompanha a rolagem nos dois sentidos
- O item em destaque passa a ser sempre o que estiver mais perto do meio da tela, recalculado a cada movimento de rolagem, para cima ou para baixo, mesmo rolando rápido.
- As descrições deixam de "empurrar" a lista ao abrir: o espaço já fica reservado e a frase apenas aparece/desaparece com suave deslizar. Assim nada salta e o destaque não oscila.
- O fio de luz e os pontos acompanham o mesmo item, também ao subir.

## 2. Mesma linguagem no resto da página
Regra geral: tipografia grande, linhas finas, luz ciano, muito espaço livre — sem cartões, sem grades de ícones.

**Telas do produto ("Veja o Akuris por dentro")**
- Título editorial à esquerda e a janela do produto à direita, sem moldura pesada: só uma aresta fina com reflexo de luz que percorre a borda, levemente inclinada em perspetiva que se endireita ao rolar.

**Como funciona (3 passos)**
- Vira uma linha do tempo horizontal: um fio fino atravessa a largura e se ilumina da esquerda para a direita ao rolar; cada passo é um número grande vazado ("01", "02", "03") com título e uma frase. No celular, fio vertical.

**Para quem é (3 perfis)**
- Em vez de 3 cartões, três frases grandes em sequência, estilo citação: "Para quem responde pela segurança.", "Para quem cuida da conformidade.", "Para quem precisa decidir." Ao passar o rato/rolar, a frase ativa fica branca e mostra a descrição; as outras ficam apagadas (mesma lógica do Fio).

**Perguntas frequentes**
- Lista editorial em duas colunas: título fixo à esquerda, perguntas à direita separadas por linhas finas; o "+" vira um traço que gira, e a resposta abre com deslizar suave.

**Chamada final (contato)**
- Sai o escudo neon e a lista com ícones. Entra uma frase enorme centrada ("Vamos tornar a sua próxima auditoria a mais tranquila.") com o "A" da marca desenhado em traço fino atrás, o feixe de luz percorrendo o contorno, e um único botão.

**Rodapé**
- Mais limpo: logo e uma frase à esquerda, links em colunas finas, e o nome "AKURIS" enorme em contorno fino ocupando a largura no fim da página como assinatura.

## Detalhes técnicos
- `CinematicSections.tsx`: `ModuleThread` troca IntersectionObserver por listener de scroll com rAF (item com centro mais próximo de `innerHeight/2`); `em` com `grid-template-rows` 0fr→1fr substituído por altura reservada + opacity/translate.
- Novo hook `useActiveByCenter(refs)` reutilizado em Fio e Audiência.
- Reescrever `ProductPeek`, `GlowSteps`, `Audience`, `FaqCompact`, `CtaShield`, `LandingFooter` com novas classes `.ed-*`; reaproveitar `BrandMark`; remover `NeonShield`/`LightTrails` se ficarem sem uso e CSS órfão (`.cine-cta*`, `.cine-aud-grid`, `.cine-steps ol` etc.).
- Novas chaves i18n PT/EN para frases da audiência e CTA; manter as existentes quando servirem.
- Animações por `animation-timeline:view()` com fallback estático e `prefers-reduced-motion`.
- Validar desktop e mobile com Playwright, incluindo rolar para baixo e depois para cima no Fio.
