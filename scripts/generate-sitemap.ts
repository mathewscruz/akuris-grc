// Gera public/sitemap.xml dinamicamente.
// Roda em predev e prebuild. Inclui rotas estáticas, páginas de framework e posts publicados do blog.

import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';
import { frameworksSeo } from '../src/data/frameworks-seo';

const BASE_URL = 'https://akuris.com.br';

interface SitemapEntry {
  path: string;
  lastmod?: string;
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: string;
}

const today = new Date().toISOString().split('T')[0];

const staticEntries: SitemapEntry[] = [
  { path: '/', changefreq: 'weekly', priority: '1.0', lastmod: today },
  { path: '/auth', changefreq: 'monthly', priority: '0.5', lastmod: today },
  { path: '/politica-privacidade', changefreq: 'monthly', priority: '0.4', lastmod: today },
  { path: '/blog', changefreq: 'weekly', priority: '0.8', lastmod: today },
];

const frameworkEntries: SitemapEntry[] = frameworksSeo.map((f) => ({
  path: `/frameworks/${f.slug}`,
  changefreq: 'monthly',
  priority: '0.9',
  lastmod: today,
}));

async function fetchPublishedPosts(): Promise<SitemapEntry[]> {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.warn('[sitemap] supabase env não disponível — pulando posts do blog.');
    return [];
  }
  try {
    const supabase = createClient(url, key);
    const { data, error } = await supabase
      .from('blog_posts')
      .select('slug, updated_at')
      .eq('published', true);
    if (error) {
      console.warn('[sitemap] erro ao buscar posts:', error.message);
      return [];
    }
    return (data ?? []).map((p) => ({
      path: `/blog/${p.slug}`,
      lastmod: (p.updated_at ?? today).split('T')[0],
      changefreq: 'monthly',
      priority: '0.7',
    }));
  } catch (e) {
    console.warn('[sitemap] falha ao consultar blog_posts:', e);
    return [];
  }
}

function generateSitemap(entries: SitemapEntry[]) {
  const urls = entries.map((e) =>
    [
      '  <url>',
      `    <loc>${BASE_URL}${e.path}</loc>`,
      e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
      e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
      e.priority ? `    <priority>${e.priority}</priority>` : null,
      '  </url>',
    ].filter(Boolean).join('\n'),
  );
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n');
}

(async () => {
  const blogEntries = await fetchPublishedPosts();
  const entries = [...staticEntries, ...frameworkEntries, ...blogEntries];
  writeFileSync(resolve('public/sitemap.xml'), generateSitemap(entries));
  console.log(`sitemap.xml gerado (${entries.length} URLs).`);
})();
