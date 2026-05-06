
## Mudanças

### 1. Tipografia unificada (DM Sans em tudo)
Em `src/index.css`, trocar o token `--lp-serif` para usar **DM Sans** (a fonte oficial do Akuris) em vez de DM Serif Display:

```text
--lp-serif: 'DM Sans', system-ui, sans-serif;
```

Para preservar o ritmo editorial (títulos com peso leve e tracking apertado), os headings que usavam serif continuam usando `var(--lp-serif)`, mas agora renderizam em DM Sans com `font-weight: 300` e `letter-spacing: -0.025em`. Os itálicos (`<em>`) seguem como itálico do DM Sans em `var(--lp-accent-2)`.

Ajustes pontuais:
- `.lp-hero h1`, `.lp-section-head h2`, `.lp-cta h2`, `.lp-bigmark` → `font-weight: 300` (em vez de 400) para manter a sensação leve/editorial sem precisar de serif.
- `.lp-module h3`, `.lp-step h4`, `.lp-faq summary`, `.lp-sec-card h4`, `.lp-problem-cell h3`, `.lp-fw .nm`, `.lp-metric .v`, `.lp-posture .score`, `.lp-hero-meta .k` → `font-weight: 400`.

### 2. Index.html
Remover o `&family=DM+Serif+Display:ital@0;1` do `<link>` do Google Fonts (mantendo DM Sans e JetBrains Mono).

### 3. LandingPage.tsx — remover dois itens
- **Eyebrow do hero**: remover `<span className="lp-eyebrow">Plataforma GRC · Edição 2026</span>` (acima do h1).
- **Seção "O problema"**: remover por completo o `<section>` que contém o eyebrow "O problema" e o `lp-problem-grid` (3 colunas Operação/Visibilidade/Escala). A próxima seção (Módulos) passa a vir logo após o Hero.

## Arquivos afetados
- `index.html` — remover família DM Serif Display do link de fontes
- `src/index.css` — token `--lp-serif` apontando para DM Sans + ajuste de pesos nos headings
- `src/pages/LandingPage.tsx` — remover eyebrow do hero e a seção `Problema`
