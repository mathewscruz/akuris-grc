
## Objetivo

Refazer `src/pages/LandingPage.tsx` reproduzindo fielmente a estrutura, ritmo tipográfico e composição editorial do HTML enviado (Claude), trocando apenas:
- paleta para Navy oficial Akuris (`#0a1628`) + Purple `#7552FF`,
- logo SVG genérico pelo logotipo oficial (`src/assets/akuris-logo.png`),
- tipografia serif do template (Instrument Serif/Poppins) por **DM Serif Display** (headings) + **DM Sans** (já é a fonte do projeto) + **JetBrains Mono** (eyebrows/labels), mantendo a estética "editorial" (não-IA).

Tudo o que envolve dados (form de contato, links de auth) continua usando a infra atual: `supabase.functions.invoke("send-contact-email", …)`, rota `/auth`, etc.

## Por que esta abordagem

O HTML do anexo tem três traços de design que removem o "cheiro de IA" da versão atual:
1. Layout com **bordas/grid editorial** (linhas finas separando blocos, módulos em lista numerada `M.01…M.07`, frameworks em grid de células com 1px de gap).
2. **Hierarquia tipográfica forte**: serif leve (weight 300) em tamanhos grandes, com itálico colorido para dar "voz", e mono em uppercase com tracking largo nos rótulos.
3. **Composição assimétrica do hero** (3 cards posicionados em absolute) em vez de mockup centralizado.

A versão atual perde isso porque usa cards genéricos de Tailwind, copy genérico e o mockup central.

## Mudanças

### 1. Tipografia (novo)
Adicionar em `index.html` o `<link>` do Google Fonts para **DM Serif Display** (já carrega DM Sans). Adicionar em `tailwind.config.ts` a família `serif: ['DM Serif Display', 'serif']` e `mono: ['JetBrains Mono', 'monospace']` (carregar JetBrains Mono também).

### 2. Tokens CSS (novo bloco em `src/index.css`)
Criar uma camada `@layer components` com classes utilitárias `.lp-*` que espelham as variáveis do template:

```text
--lp-ink-0: #0a1628   (bg principal — Navy Akuris)
--lp-ink-1: #0f1d33   (surface)
--lp-ink-2: #16243d
--lp-line:  #1e2d45
--lp-line-2:#2a3a5a
--lp-text:  #e7e5e0
--lp-text-2:#a9a8a3
--lp-text-3:#71706c
--lp-accent:    #7552FF   (Purple Akuris)
--lp-accent-2:  #b9b0fa   (variante clara para itálicos)
```

E classes: `.lp-eyebrow`, `.lp-btn-primary`, `.lp-btn-ghost`, `.lp-section-head`, `.lp-module`, `.lp-fw-grid`, `.lp-metric`, `.lp-quote`, `.lp-faq`, `.lp-cta`, `.lp-bigmark`, etc., copiadas 1-para-1 do CSS do anexo, apenas substituindo `var(--accent)` pelo Purple.

### 3. `src/pages/LandingPage.tsx` — reescrita completa
Estrutura em sections idênticas ao anexo:

```text
NAV         logo Akuris (img) + links Produto/Módulos/Frameworks/Clientes/Contato + CTAs
HERO        copy + 3 cards absolute (Posture 87/100, Matriz 5×5, Timeline)
PROBLEMA    3 colunas numeradas 01/02/03
MÓDULOS     lista M.01…M.08 (8 módulos reais do Akuris) com tags
COMO FUNC.  4 passos com timeline horizontal
FRAMEWORKS  grid de células com 21 frameworks reais do projeto
MÉTRICAS    4 métricas grandes (−64%, 3,8×, +42%, 12s)
CLIENTES    grid 6×2 placeholder (mantém para preencher quando houver)
DEPOIMENTOS 2 quotes editoriais (texto neutro até ter cliente real)
SEGURANÇA   3 cards (ISO 27001, dados Brasil, LGPD by design)
FAQ         <details> com 6 perguntas
CTA + form  reaproveita form existente (envia para send-contact-email)
WORDMARK    "AKURIS" gigante em serif como fechamento
FOOTER      4 colunas + selos LGPD/ISO/SOC2
```

**Conteúdo dos módulos**: usar os 8 módulos reais do Akuris (Riscos, Gap Analysis, Controles, Contas Privilegiadas, Privacidade & LGPD, Auditoria, Due Diligence, Continuidade) — não os 7 genéricos do template.

**Frameworks**: usar a lista real já presente em `src/lib/framework-configs.ts` (LGPD, GDPR, ISO 27001, ISO 27701, SOC 2, PCI DSS, NIST CSF 2.0, CIS v8, COBIT, COSO ERM, ISO 31000, ISO 9001, ISO 14001, ISO 37001, etc.).

**Logo**: substituir o `<svg>` genérico do anexo por `<img src={akurisLogo} className="h-8 w-auto" />`.

**Form de contato**: manter `handleSubmit` atual (chama `send-contact-email`); só re-estilar inputs com classes `.lp-input` (border-bottom único, sem rounded, sem placeholder fofinho — estilo editorial).

### 4. `DashboardMockup.tsx` — remover do hero
O hero do anexo não usa mockup central; usa 3 cards menores posicionados. Componente fica órfão — pode permanecer no repo (não é importado por mais ninguém após a reescrita) ou ser excluído. **Decisão: excluir** para evitar dead code.

### 5. Acessibilidade e responsivo
- Manter todos os `aria-label` do anexo.
- Adicionar breakpoints: abaixo de `lg`, hero vira 1 coluna (cards em stack), módulos viram cards verticais, frameworks vão para grid 2 colunas, métricas para 2×2.

## Arquivos afetados

- `index.html` — adicionar fontes (DM Serif Display, JetBrains Mono)
- `tailwind.config.ts` — registrar famílias `serif` e `mono`
- `src/index.css` — bloco novo `@layer components` com tokens e classes `.lp-*`
- `src/pages/LandingPage.tsx` — reescrita completa
- `src/components/landing/DashboardMockup.tsx` — remover

## Riscos / observações

- **Não toca em `/auth`, AuthProvider, rotas, RLS ou Edge Functions** — apenas a página pública de marketing. O form de contato continua chamando a mesma Edge Function já existente.
- O CSS do anexo é todo escopado em classes `.lp-*` — não impacta o resto do app (dashboard, módulos internos, etc.).
- Depoimentos ficam com placeholder (`[Nome do cliente]`) até que você forneça nomes/cargos reais — ou posso remover a seção até lá. **Confirmar na implementação se prefere remover ou manter placeholder.**
