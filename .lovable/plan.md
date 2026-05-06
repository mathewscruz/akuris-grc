## Objetivo

Tornar os títulos "eyebrow" das seções da landing page (ex.: `— MÓDULOS`, `— COMO FUNCIONA`, `— FRAMEWORKS & REGULAÇÕES`, `— RESULTADO`, `— PERGUNTAS FREQUENTES`, etc.) mais visíveis e contrastantes, em branco, conforme as imagens de referência enviadas.

## Mudanças

Arquivo único: `src/index.css` (classe `.lp-eyebrow`, linhas 514–529).

**Antes:**
- `font-size: 11px`
- `color: var(--lp-text-3)` (cinza apagado)
- barra (`::before`) `width: 22px`, cor `--lp-text-4` (cinza muito fraco)

**Depois:**
- `font-size: 12px`
- `letter-spacing: 0.18em`
- `font-weight: 600`
- `color: #ffffff` (branco puro p/ contraste contra o navy)
- barra (`::before`): `width: 32px`, `background: rgba(255,255,255,0.7)`, `height: 1px`

Como TODAS as seções usam a mesma classe `.lp-eyebrow`, a alteração se aplica uniformemente a todos os títulos equivalentes (Módulos, Como funciona, Frameworks & regulações, Resultado, A Akuris pela Akuris, Perguntas frequentes, Vamos conversar) — exatamente como pedido.

Nenhuma alteração em `LandingPage.tsx` é necessária.