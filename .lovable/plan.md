# Plano SEO + Busca por IA — Akuris

## Diagnóstico (dados Semrush, mercado BR)

- "plataforma GRC" → 70 buscas/mês (muito baixo)
- "software compliance" → 110/mês
- **"ISO 27001" → 8.100/mês** ← oportunidade real
- "iso 27001 certificação" → 390/mês
- "LGPD software" → 40/mês (KDI 0 — fácil de ranquear)
- Domínio `akuris.com.br` ainda não tem dados Semrush — site novo, janela de oportunidade aberta.

**Conclusão:** ranquear para "plataforma GRC" não traz tráfego. O caminho é capturar buscas informativas pesadas ("o que é ISO 27001", "como implementar LGPD", "diferença SOC 2 e ISO 27001") com páginas de framework e conteúdo educativo, e deixar a marca aparecer ali.

## O que será feito

### 1. Infraestrutura SEO técnica

- Instalar `react-helmet-async` e envolver `App.tsx` com `<HelmetProvider>`.
- Remover `<link rel="canonical">` do `index.html` (cada rota terá o seu via Helmet).
- Criar componente `<SEO />` reutilizável que injeta title, description, canonical, og:*, twitter:* e JSON-LD por rota.
- Aplicar `<SEO />` em: LandingPage, PoliticaPrivacidade, novas páginas de framework e novos posts do blog.
- Criar `scripts/generate-sitemap.ts` rodando em `predev`/`prebuild` para gerar `public/sitemap.xml` automaticamente com todas as rotas públicas + páginas de framework + posts do blog.
- Atualizar `public/robots.txt` para liberar bots de IA modernos (PerplexityBot, OAI-SearchBot, Applebot-Extended) e manter o `Sitemap:` válido.
- Adicionar `llms.txt` em `public/llms.txt` (índice estruturado pensado para LLMs — padrão emergente que Perplexity/Claude/ChatGPT começam a respeitar).

### 2. Páginas por framework (alta intenção de busca)

Criar rotas públicas com URL amigável:
- `/frameworks/iso-27001`
- `/frameworks/lgpd`
- `/frameworks/soc-2`
- `/frameworks/nist-csf`
- `/frameworks/pci-dss`
- `/frameworks/gdpr`
- `/frameworks/iso-27701`

Cada página tem:
- H1 com a keyword principal
- Seções: o que é, requisitos, como o Akuris ajuda, FAQ
- Schema.org `Article` + `FAQPage` + `BreadcrumbList`
- Link interno para módulos relacionados e CTA "Solicitar demo"

Conteúdo curado por framework (template único, dados em arquivo TS).

### 3. Blog técnico (educacional)

- Nova rota `/blog` (lista) e `/blog/:slug` (post).
- Tabela `blog_posts` no Lovable Cloud com RLS pública de leitura para `published = true`. Campos: slug, titulo, resumo, conteudo (markdown), capa, autor, publicado_em, updated_at, tags, framework_relacionado.
- Editor simples no `/configuracoes` (super-admin) para criar/editar posts.
- Sitemap inclui todos os posts publicados.
- Cada post: schema `Article`, canonical, og:image, breadcrumb.
- 5 posts iniciais sugeridos (você revisa e publica): "Guia LGPD para empresas", "ISO 27001 em 7 passos", "SOC 2 vs ISO 27001", "Como fazer Gap Analysis", "ROPA na prática".

### 4. Otimização para IA (GEO — Generative Engine Optimization)

Diferente de SEO clássico — o que faz LLMs citarem você:
- Conteúdo em **formato direto, factual, com listas e tabelas** (LLMs extraem melhor).
- **FAQs estruturadas** em cada página (já tem JSON-LD `FAQPage`, vai ser ampliado).
- **Schema `Organization` + `Product`** com claims verificáveis (frameworks suportados, módulos).
- **`llms.txt`** apontando para as páginas mais importantes em formato markdown limpo.
- Citações e fontes em cada artigo (LLMs valorizam autoridade).
- Manter `robots.txt` permissivo para `GPTBot`, `ChatGPT-User`, `PerplexityBot`, `OAI-SearchBot`, `anthropic-ai`, `Claude-Web`, `Google-Extended` (já parcialmente feito — vai ser completado).

### 5. Performance (sinal de ranking)

- Verificar `loading="lazy"` em todas as imagens da landing.
- Validar que `akuris-logo.png` tem versão otimizada (WebP).
- Garantir que fontes não bloqueiam o render (já está com `media="print" onload=...`).

### 6. Google Search Console

- Após implementação, gerar token de verificação Google e injetar a meta tag.
- Submeter o `sitemap.xml` no Search Console para indexação acelerada.

---

## Detalhes técnicos

**Estrutura de arquivos novos:**
```
src/
  components/SEO.tsx                    # Helmet wrapper reutilizável
  data/frameworks-seo.ts                # conteúdo de cada framework
  pages/FrameworkSEO.tsx                # template de página /frameworks/:slug
  pages/Blog.tsx                        # lista de posts
  pages/BlogPost.tsx                    # post individual
scripts/
  generate-sitemap.ts                   # gera sitemap.xml dinâmico
public/
  llms.txt                              # índice para LLMs
  robots.txt                            # atualizado
```

**Banco (migration):**
- Tabela `blog_posts` (id uuid, slug text unique, titulo, resumo, conteudo_md, capa_url, autor, published boolean, published_at, updated_at, tags text[], framework_slug text)
- RLS: `select` público quando `published = true`; `insert/update/delete` apenas para super-admin.

**Rotas adicionadas em `App.tsx`:**
- `/frameworks/:slug`
- `/blog`
- `/blog/:slug`

**Limitação honesta (SSR):** Vite SPA renderiza meta tags no client-side via Helmet. Googlebot executa JS e enxerga tudo. **Crawlers de redes sociais (LinkedIn, Slack, WhatsApp) NÃO executam JS** — eles só veem o `index.html` estático. Para previews de link sociais perfeitos por página seria necessário SSR (Next.js), o que fugiria do stack atual. Solução pragmática: manter um `og:image` e `og:description` genéricos no `index.html` como fallback. Para SEO no Google e citação por IA isso não é problema.

---

## Ordem de execução

1. Migration `blog_posts` + RLS
2. Instalar `react-helmet-async`, criar `<SEO />`, plugar em `App.tsx`
3. Sitemap dinâmico + `llms.txt` + `robots.txt` ampliado
4. Páginas `/frameworks/:slug` (ISO 27001, LGPD, SOC 2, NIST, PCI DSS, GDPR, ISO 27701)
5. Blog: lista, post, editor admin em `/configuracoes`
6. 5 posts iniciais (placeholder/seed para você editar)
7. Linkagem interna na landing (seção "Recursos" → frameworks + blog)
8. Instruções para você verificar o site no Google Search Console

Estimativa: tudo em uma rodada de implementação. Posso começar quando você aprovar.
