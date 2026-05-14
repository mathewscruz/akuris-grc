import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowRight } from 'lucide-react';
import { SEO } from '@/components/SEO';
import { PublicShell } from '@/components/public/PublicShell';
import { supabase } from '@/integrations/supabase/client';
import { frameworksSeo } from '@/data/frameworks-seo';

interface Post {
  id: string;
  slug: string;
  titulo: string;
  resumo: string;
  capa_url: string | null;
  autor: string;
  published_at: string | null;
  tags: string[];
}

export default function Blog() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('blog_posts')
        .select('id, slug, titulo, resumo, capa_url, autor, published_at, tags')
        .eq('published', true)
        .order('published_at', { ascending: false });
      setPosts((data ?? []) as Post[]);
      setLoading(false);
    })();
  }, []);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: 'Blog Akuris',
    description: 'Guias práticos de GRC, LGPD, ISO 27001, SOC 2, gestão de riscos e auditoria interna.',
    url: 'https://akuris.com.br/blog',
    inLanguage: 'pt-BR',
  };

  return (
    <PublicShell>
      <SEO
        title="Blog Akuris — GRC, LGPD, ISO 27001 e Compliance"
        description="Guias práticos de Governança, Riscos e Conformidade: LGPD, ISO 27001, SOC 2, NIST CSF, auditoria interna e gestão de riscos para empresas brasileiras."
        canonical="/blog"
        jsonLd={jsonLd}
      />

      <section className="max-w-5xl mx-auto px-6 py-16">
        <header className="mb-12 text-center">
          <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight mb-4">
            Blog Akuris
          </h1>
          <p className="text-lg text-white/65 max-w-2xl mx-auto">
            Guias e análises sobre Governança, Riscos e Conformidade — escritos por quem
            opera o dia a dia de compliance, segurança e privacidade.
          </p>
        </header>

        {loading ? (
          <p className="text-center text-white/50 py-20">Carregando…</p>
        ) : posts.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-white/60 mb-8">Em breve novos conteúdos. Enquanto isso, conheça nossas páginas de framework:</p>
            <div className="flex flex-wrap justify-center gap-2 max-w-2xl mx-auto">
              {frameworksSeo.map((f) => (
                <Link
                  key={f.slug}
                  to={`/frameworks/${f.slug}`}
                  className="px-4 py-2 rounded-lg border border-white/10 bg-white/[0.03] text-sm text-white/75 hover:text-white hover:border-white/30 transition"
                >
                  {f.nome}
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map((post) => (
              <Link
                key={post.id}
                to={`/blog/${post.slug}`}
                className="group rounded-2xl border border-white/10 bg-white/[0.03] hover:border-white/30 transition overflow-hidden flex flex-col"
              >
                {post.capa_url && (
                  <div className="aspect-[16/9] bg-white/5 overflow-hidden">
                    <img src={post.capa_url} alt={post.titulo} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition" />
                  </div>
                )}
                <div className="p-5 flex-1 flex flex-col">
                  {post.tags?.[0] && (
                    <span className="text-xs text-[hsl(252,100%,75%)] uppercase tracking-wide mb-2">{post.tags[0]}</span>
                  )}
                  <h2 className="text-lg font-semibold mb-2 group-hover:text-[hsl(252,100%,80%)] transition">{post.titulo}</h2>
                  <p className="text-sm text-white/65 mb-4 flex-1 line-clamp-3">{post.resumo}</p>
                  <div className="flex items-center justify-between text-xs text-white/45">
                    <span>{post.autor}</span>
                    {post.published_at && (
                      <time dateTime={post.published_at}>{format(new Date(post.published_at), "d 'de' MMM yyyy", { locale: ptBR })}</time>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="max-w-5xl mx-auto px-6 pb-20">
        <div className="rounded-2xl border border-[hsl(252,100%,66%)]/30 bg-gradient-to-br from-[hsl(252,100%,66%)]/10 to-transparent p-8 text-center">
          <h2 className="text-2xl font-semibold mb-2">Pronto para automatizar seu programa de GRC?</h2>
          <p className="text-white/70 mb-6 max-w-xl mx-auto">
            Veja como o Akuris reúne controles, frameworks, evidências e indicadores em um único lugar.
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-[hsl(252,100%,66%)] hover:bg-[hsl(252,100%,60%)] text-white font-medium transition"
          >
            Solicitar demonstração <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </PublicShell>
  );
}
