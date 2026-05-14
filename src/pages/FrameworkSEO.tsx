import { useParams, Navigate, Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { SEO } from '@/components/SEO';
import { PublicShell } from '@/components/public/PublicShell';
import { frameworksSeoMap, frameworksSeo } from '@/data/frameworks-seo';

export default function FrameworkSEO() {
  const { slug } = useParams<{ slug: string }>();
  const fw = slug ? frameworksSeoMap[slug] : undefined;

  if (!fw) return <Navigate to="/404" replace />;

  const url = `/frameworks/${fw.slug}`;
  const title = `${fw.nome} — Guia completo e plataforma | Akuris`;
  const description = `${fw.tagline} Entenda requisitos, controles e como o Akuris automatiza a conformidade com ${fw.nome}.`;

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: `${fw.nome} — Guia completo`,
      description,
      author: { '@type': 'Organization', name: 'Akuris' },
      publisher: {
        '@type': 'Organization',
        name: 'Akuris',
        logo: { '@type': 'ImageObject', url: 'https://akuris.com.br/akuris-logo.png' },
      },
      mainEntityOfPage: `https://akuris.com.br${url}`,
      inLanguage: 'pt-BR',
      about: { '@type': 'Thing', name: fw.nome },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: fw.faq.map((f) => ({
        '@type': 'Question',
        name: f.pergunta,
        acceptedAnswer: { '@type': 'Answer', text: f.resposta },
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://akuris.com.br/' },
        { '@type': 'ListItem', position: 2, name: 'Frameworks', item: 'https://akuris.com.br/frameworks' },
        { '@type': 'ListItem', position: 3, name: fw.nome, item: `https://akuris.com.br${url}` },
      ],
    },
  ];

  return (
    <PublicShell>
      <SEO title={title} description={description} canonical={url} ogType="article" jsonLd={jsonLd} />

      <article className="max-w-4xl mx-auto px-6 py-16">
        <nav className="text-xs text-white/50 mb-6 flex items-center gap-2" aria-label="Breadcrumb">
          <Link to="/" className="hover:text-white">Home</Link>
          <span>/</span>
          <span className="text-white/40">Frameworks</span>
          <span>/</span>
          <span className="text-white/80">{fw.nome}</span>
        </nav>

        <div className="inline-flex items-center px-3 py-1 rounded-full bg-[hsl(252,100%,66%)]/15 border border-[hsl(252,100%,66%)]/30 text-xs text-[hsl(252,100%,80%)] mb-4">
          {fw.categoria}
        </div>

        <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight mb-4 leading-tight">
          {fw.nome}
        </h1>
        <p className="text-xl text-white/70 mb-10 leading-relaxed">{fw.tagline}</p>

        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4">O que é a {fw.nome}</h2>
          <p className="text-white/75 leading-relaxed mb-4">{fw.oQueE}</p>
          <p className="text-white/75 leading-relaxed">{fw.resumo}</p>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4">Por que importa</h2>
          <ul className="space-y-3">
            {fw.porQueImporta.map((p, i) => (
              <li key={i} className="flex gap-3 text-white/80">
                <CheckCircle2 className="w-5 h-5 text-[hsl(252,100%,70%)] flex-shrink-0 mt-0.5" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-6">Requisitos principais</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {fw.requisitosPrincipais.map((r, i) => (
              <div key={i} className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
                <h3 className="font-semibold mb-2">{r.titulo}</h3>
                <p className="text-sm text-white/65 leading-relaxed">{r.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-12 rounded-2xl border border-[hsl(252,100%,66%)]/30 bg-gradient-to-br from-[hsl(252,100%,66%)]/10 to-transparent p-8">
          <h2 className="text-2xl font-semibold mb-4">Como o Akuris ajuda na {fw.nome}</h2>
          <ul className="space-y-2 mb-6">
            {fw.comoAkurisAjuda.map((c, i) => (
              <li key={i} className="flex gap-3 text-white/85">
                <span className="text-[hsl(252,100%,70%)] mt-1">→</span>
                <span>{c}</span>
              </li>
            ))}
          </ul>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-[hsl(252,100%,66%)] hover:bg-[hsl(252,100%,60%)] text-white font-medium transition"
          >
            Solicitar demonstração <ArrowRight className="w-4 h-4" />
          </Link>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-6">Perguntas frequentes</h2>
          <div className="space-y-4">
            {fw.faq.map((f, i) => (
              <details key={i} className="rounded-xl border border-white/10 bg-white/[0.03] p-5 group">
                <summary className="font-medium cursor-pointer list-none flex items-center justify-between">
                  <span>{f.pergunta}</span>
                  <span className="text-white/40 group-open:rotate-45 transition">+</span>
                </summary>
                <p className="text-white/70 mt-3 leading-relaxed">{f.resposta}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4">Outros frameworks</h2>
          <div className="flex flex-wrap gap-2">
            {frameworksSeo.filter((f) => f.slug !== fw.slug).map((f) => (
              <Link
                key={f.slug}
                to={`/frameworks/${f.slug}`}
                className="px-3 py-1.5 rounded-lg border border-white/10 bg-white/[0.03] text-sm text-white/70 hover:text-white hover:border-white/30 transition"
              >
                {f.nome}
              </Link>
            ))}
          </div>
        </section>
      </article>
    </PublicShell>
  );
}
