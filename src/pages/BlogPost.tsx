import { useEffect, useState } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { SEO } from '@/components/SEO';
import { PublicShell } from '@/components/public/PublicShell';
import { supabase } from '@/integrations/supabase/client';

interface PostFull {
  id: string;
  slug: string;
  titulo: string;
  resumo: string;
  conteudo_md: string;
  capa_url: string | null;
  autor: string;
  published: boolean;
  published_at: string | null;
  updated_at: string;
  tags: string[];
  seo_title: string | null;
  seo_description: string | null;
}

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<PostFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      const { data, error } = await supabase
        .from('blog_posts')
        .select('*')
        .eq('slug', slug)
        .eq('published', true)
        .maybeSingle();
      if (error || !data) setNotFound(true);
      else setPost(data as PostFull);
      setLoading(false);
    })();
  }, [slug]);

  if (notFound) return <Navigate to="/404" replace />;

  if (loading || !post) {
    return (
      <PublicShell>
        <div className="max-w-3xl mx-auto px-6 py-20 text-white/50">Carregando…</div>
      </PublicShell>
    );
  }

  const url = `/blog/${post.slug}`;
  const title = post.seo_title || `${post.titulo} | Blog Akuris`;
  const description = post.seo_description || post.resumo;

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: post.titulo,
      description: post.resumo,
      image: post.capa_url ? [post.capa_url] : undefined,
      datePublished: post.published_at,
      dateModified: post.updated_at,
      author: { '@type': 'Person', name: post.autor },
      publisher: {
        '@type': 'Organization',
        name: 'Akuris',
        logo: { '@type': 'ImageObject', url: 'https://akuris.com.br/akuris-logo.png' },
      },
      mainEntityOfPage: `https://akuris.com.br${url}`,
      inLanguage: 'pt-BR',
      keywords: post.tags?.join(', '),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://akuris.com.br/' },
        { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://akuris.com.br/blog' },
        { '@type': 'ListItem', position: 3, name: post.titulo, item: `https://akuris.com.br${url}` },
      ],
    },
  ];

  return (
    <PublicShell>
      <SEO
        title={title}
        description={description}
        canonical={url}
        ogType="article"
        ogImage={post.capa_url ?? undefined}
        jsonLd={jsonLd}
      />

      <article className="max-w-3xl mx-auto px-6 py-16">
        <nav className="text-xs text-white/50 mb-6 flex items-center gap-2">
          <Link to="/" className="hover:text-white">Home</Link>
          <span>/</span>
          <Link to="/blog" className="hover:text-white">Blog</Link>
        </nav>

        {post.tags?.[0] && (
          <span className="text-xs text-[hsl(252,100%,75%)] uppercase tracking-wide">{post.tags[0]}</span>
        )}
        <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight mb-5 mt-2 leading-tight">{post.titulo}</h1>
        <div className="text-sm text-white/55 mb-8 flex items-center gap-3">
          <span>{post.autor}</span>
          <span>•</span>
          {post.published_at && (
            <time dateTime={post.published_at}>{format(new Date(post.published_at), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}</time>
          )}
        </div>

        {post.capa_url && (
          <img src={post.capa_url} alt={post.titulo} className="w-full rounded-2xl mb-10 border border-white/10" />
        )}

        <div className="prose prose-invert prose-lg max-w-none prose-headings:font-semibold prose-headings:tracking-tight prose-a:text-[hsl(252,100%,75%)] prose-strong:text-white prose-code:text-[hsl(252,100%,80%)]">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.conteudo_md}</ReactMarkdown>
        </div>

        <div className="mt-16 pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link to="/blog" className="text-sm text-white/60 hover:text-white">← Voltar ao blog</Link>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[hsl(252,100%,66%)] hover:bg-[hsl(252,100%,60%)] text-white text-sm font-medium transition"
          >
            Solicitar demonstração
          </Link>
        </div>
      </article>
    </PublicShell>
  );
}
