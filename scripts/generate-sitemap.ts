// Gera public/sitemap.xml dinamicamente.
// Roda em predev e prebuild. Inclui rotas estáticas, páginas de framework e posts publicados do blog.

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';
import { loadEnv } from 'vite';
import { frameworksSeo } from '../src/data/frameworks-seo';

const BASE_URL = 'https://akuris.pt';

interface SitemapEntry {
  path: string;
  lastmod?: string;
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: string;
}

const staticEntries: SitemapEntry[] = [
  { path: '/', changefreq: 'weekly', priority: '1.0' },
  { path: '/planos', changefreq: 'monthly', priority: '0.7' },
  { path: '/politica-privacidade', changefreq: 'monthly', priority: '0.4' },
  { path: '/blog', changefreq: 'weekly', priority: '0.8' },
];

const frameworkEntries: SitemapEntry[] = frameworksSeo.map((f) => ({
  path: `/frameworks/${f.slug}`,
  changefreq: 'monthly',
  priority: '0.9',
}));

const env = loadEnv(process.env.NODE_ENV ?? 'production', process.cwd(), '');

function cachedBlogEntries(): SitemapEntry[] {
  const path = resolve('public/sitemap.xml');
  if (!existsSync(path)) return [];
  const xml = readFileSync(path, 'utf8');
  return [...xml.matchAll(/<loc>https:\/\/[^<]+\/blog\/([^<]+)<\/loc>[\s\S]*?(?:<lastmod>([^<]+)<\/lastmod>)?/g)]
    .map(([, slug, lastmod]) => ({ path: `/blog/${slug}`, lastmod, changefreq: 'monthly' as const, priority: '0.7' }));
}

async function fetchPublishedPosts(): Promise<SitemapEntry[]> {
  const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.warn('[sitemap] Supabase indisponível; preservando URLs de blog já publicadas.');
    return cachedBlogEntries();
  }
  try {
    const supabase = createClient(url, key);
    const { data, error } = await supabase
      .from('blog_posts')
      .select('slug, updated_at')
      .eq('published', true);
    if (error) {
      console.warn('[sitemap] erro ao buscar posts:', error.message);
      return cachedBlogEntries();
    }
    return (data ?? []).map((p) => ({
      path: `/blog/${p.slug}`,
      lastmod: p.updated_at?.split('T')[0],
      changefreq: 'monthly',
      priority: '0.7',
    }));
  } catch (e) {
    console.warn('[sitemap] falha ao consultar blog_posts:', e);
    return cachedBlogEntries();
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
