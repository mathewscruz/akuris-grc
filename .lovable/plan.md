## Diagnóstico — o que dá "cara de IA" hoje

Lendo `src/pages/LandingPage.tsx` e `DashboardMockup.tsx`, identifiquei sete sinais clássicos de landing gerada por IA:

1. **Hero genérico** — três palavras coloridas em roxo ("Riscos / Compliance / Governança") é o padrão visto em centenas de SaaS gerados. Soa template.
2. **Mockup 3D rotacionado** com glow roxo atrás — efeito "AI demo" clichê. Pior: ele encolhe e desaparece no scroll (`scale + opacity`), o que é gratuito e quebra a percepção de produto real.
3. **Strip de frameworks rolando infinito** com 20 pílulas iguais — visual "marketing wall" que diz "olha quantas siglas eu sei".
4. **Alternância dark/light/dark/light** entre seções (Hero dark → Módulos light → Como funciona dark → Testimonials light → Gap dark → Contato light) cria efeito zebra cansativo e quebra continuidade da marca dark Navy.
5. **Copy do bloco Gap Analysis** ("Sem depender de ninguém", "sem cobrar hora extra", "qualquer pessoa do time consegue seguir") tem tom informal/vendedor que destoa do resto. Parece prompt de marketing colado.
6. **Depoimentos anônimos** ("Ana C. — Empresa do setor financeiro") gritam "fake testimonial". Em B2B sério, é melhor remover do que manter genéricos.
7. **Cards de módulos** com ícone Lucide dentro de quadrado roxo claro — exatamente o padrão de toda landing v0/Lovable. Sem hierarquia, sem editorialização.

Outros pontos menores: header com logo gigante (h-20), gradiente grid no hero muito visível, labels de campos de formulário misturando `text-gray-700` e `text-gray-500` sem motivo, footer com 2 links por coluna (parece vazio).

---

## Plano de melhorias

### 1. Hero — reescrever com hierarquia editorial
- Trocar headline por uma promessa específica e menos genérica, ex.:  
  **"A plataforma única de Governança, Riscos e Compliance para empresas que levam conformidade a sério."**  
  (sem destacar palavras soltas em roxo — usar **um** highlight só, na palavra-chave)
- Subhead: encurtar para 1 frase de até 140 caracteres.
- Eyebrow tag acima do H1: pequeno chip "GRC Platform · ISO 27001 · LGPD · SOC 2" em texto, não pílulas coloridas.
- Adicionar segunda CTA secundária discreta ao lado da principal: "Ver módulos" (scroll suave para `#modulos`).
- Remover o efeito de scale+fade no mockup (`mockupProgress`). Manter o mockup estático e levemente inclinado, ou substituir por screenshot real do dashboard se disponível.

### 2. Mockup — desinflacionar
- Remover rotação 3D (`rotateY -6deg / rotateX 2deg`) e o glow roxo de fundo.
- Manter mockup reto, com sombra suave (`shadow-2xl shadow-black/40`) e borda sutil.
- Reduzir saturação do roxo dentro do mockup (usar `#7552FF` apenas em 1-2 pontos focais, não em 5).

### 3. Frameworks strip — substituir carrossel por grid estático
- Remover animação `animate-scroll-left` (efeito "ticker de notícias" passa pouca seriedade).
- Mostrar **8-10 frameworks principais** num grid de pílulas estático centralizado, com texto monocromático cinza claro. Mais sóbrio.
- Eyebrow: "Frameworks suportados nativamente".

### 4. Unificar paleta — eliminar zebra dark/light
- Manter **tudo dark** (Navy `#0A1628` / `#0D1F37`) com variações de superfície (`#0F1B33`, `#111B2E`).  
  A landing atual da marca é dark; quebrar para `#F1F5F9` em duas seções enfraquece a identidade premium.
- Cards de módulos: superfície `#111B2E` com borda `#1E2D45`, hover `#7552FF/30`. Ícones em traço fino (`strokeWidth={1.5}`, padrão Akuris).

### 5. Seção Módulos — editorializar
- Reduzir grid para 4 colunas em desktop mantendo, mas:
  - Numerar os módulos discretamente (`01`, `02`...) em cinza no canto superior direito do card.
  - Remover o caixote roxo claro atrás do ícone — ícone Lucide direto, `text-primary stroke-1.5`.
  - Tipografia: título mais firme (`font-semibold text-base tracking-tight`), descrição em `text-sm text-white/60 leading-relaxed`.
  - "Saiba mais" vira um link minimalista com `→` apenas (sem chevron duplo).

### 6. Seção "Como Funciona" — passos editoriais
- Remover bolinhas roxas com número sobrepostas no topo (visual de tutorial Notion).
- Layout horizontal com **número grande em outline** (`text-7xl font-bold text-primary/20`) atrás do título de cada passo. Dá ar de revista/editorial.
- Conector sutil entre os 3 cards (linha tracejada horizontal em desktop).

### 7. Reescrever bloco Gap Analysis
- Tom hoje é coloquial demais. Reescrever em registro corporativo enxuto:
  - Headline: "Avalie a aderência da sua empresa a 21 frameworks. Sem consultoria externa."
  - Subhead: "Da ISO 27001 à LGPD, conduza internamente o seu programa de conformidade com guidance estruturada por requisito e artefatos prontos para auditoria."
  - 3 bullets: títulos firmes, descrições objetivas (≤120 caracteres cada), sem expressões como "sem cobrar hora extra".

### 8. Depoimentos — duas opções
- **Opção A (recomendada):** remover a seção inteira. Em B2B, depoimentos anônimos contam negativamente.
- **Opção B:** transformar em uma única citação destaque em tipografia grande (estilo editorial, font-serif ou DM Sans light), sem fotos falsas, com atribuição honesta tipo "Cliente do setor financeiro — sob NDA".

### 9. Formulário de contato
- Padronizar todas as labels em `text-white/70` (já que a seção será dark agora).
- Remover asterisco `*` vermelho — usar apenas "(opcional)" nos não-obrigatórios. Mais limpo.
- Botão: "Falar com especialista" (mais B2B) em vez de "Enviar Mensagem".
- Adicionar microcopy abaixo do form: "Resposta em até 1 dia útil. Seus dados ficam protegidos conforme LGPD."

### 10. Header & Footer
- Logo: reduzir para `h-10 sm:h-12` (h-20 atual está desproporcional).
- Header com `backdrop-blur` suave quando rolar (em vez de `bg-[#0A1628]/95`).
- Footer: adicionar mais 2-3 links por coluna (ou consolidar em 3 colunas para não parecer vazio). Incluir badges discretos de "Hospedado no Brasil/UE", "LGPD Ready", "Em conformidade com ISO 27001" — cria credibilidade real sem parecer marketing.

### 11. Microdetalhes anti-IA
- Remover gradiente grid muito visível no hero (deixar apenas o radial gradient sutil).
- Substituir todos os `text-gray-400/500` soltos por escala consistente: `text-white/55` (body), `text-white/40` (meta), `text-white/85` (títulos secundários).
- Substituir `text-[#7552FF]` hardcoded por token `text-primary` (usa as cores do design system).

---

## Arquivos a editar

- `src/pages/LandingPage.tsx` — refatoração de copy, layout das seções, paleta unificada dark, remoção do scroll-effect do mockup, novo formulário e footer.
- `src/components/landing/DashboardMockup.tsx` — remover rotação 3D e glow, reduzir saturação interna.
- (opcional) criar `src/components/landing/SectionEyebrow.tsx` para padronizar o chip uppercase usado em cada seção.

Sem mudanças em rotas, banco, edge functions ou autenticação. Apenas marketing/visual.

---

## Pergunta antes de implementar

Quer que eu execute **todas** as 11 mudanças acima, ou prefere priorizar um subconjunto (por exemplo: 1, 2, 4, 7, 8 — que são os que mais reduzem "cara de IA")? Também: prefere **remover** a seção de depoimentos (Opção A) ou **manter editorializada** (Opção B)?
