import type { Plugin } from 'vite';
import { site } from '../src/i18n/modules/site';
import { publico } from '../src/i18n/modules/publico';
import { frameworksSeo } from '../src/data/frameworks-seo';
import { PUBLIC_MODULES } from '../src/lib/public-modules';

export const escapePublicHtml = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
type PublicPage = { path: string; title: string; description: string; content: string };
const t = (key: string) => site.pt.site[key];
const paragraph = (value: string) => '<p>' + escapePublicHtml(value) + '</p>';
const guides = frameworksSeo.map(f => '<li><a href="/frameworks/' + f.slug + '">' + escapePublicHtml(f.nome) + '</a></li>').join('');
export function publicPages(): PublicPage[] {
  const pages: PublicPage[] = [
    { path: '/', title: t('seoTitle'), description: t('seoDescription'), content: '<h1>' + t('storyHero') + '</h1>' + paragraph(t('heroBody')) + '<h2>Gap Analysis</h2>' + paragraph(t('gapBody')) + '<h2>' + t('catalogTitle') + '</h2>' + PUBLIC_MODULES.map(module => '<h3>' + t(module.title || module.key) + '</h3>' + paragraph(t(module.body || module.key + 'Body'))).join('') + '<h2>' + t('guidesTitle') + '</h2><ul>' + guides + '</ul>' },
    { path: '/frameworks', title: t('guides') + ' | Akuris', description: t('guideBody'), content: '<h1>' + t('guideTitle') + '</h1><ul>' + guides + '</ul>' + paragraph(t('guidesNote')) },
    { path: '/blog', title: publico.pt.publico.blog.seoTitle, description: publico.pt.publico.blog.seoDesc, content: '<h1>' + publico.pt.publico.blog.titulo + '</h1>' + paragraph(publico.pt.publico.blog.sub) },
  ];
  for (const [path, type] of [['/migracao', 'migration'], ['/seguranca', 'trust'], ['/solucoes/canal-de-denuncias', 'channel']]) {
    const title = t(type === 'trust' ? 'trustPageTitle' : type + 'Title');
    const description = t(type === 'trust' ? 'trustPageBody' : type + 'Body');
    pages.push({ path, title: title + ' | Akuris', description, content: '<h1>' + title + '</h1>' + paragraph(description) + [1, 2, 3].map(n => '<h2>' + t(type + n) + '</h2>' + paragraph(t(type + n + 'Body'))).join('') + (type !== 'migration' ? paragraph(t(type + 'Notice')) : '') });
  }
  for (const f of frameworksSeo) pages.push({ path: '/frameworks/' + f.slug, title: f.nome + ' — Guia completo e plataforma | Akuris', description: f.tagline, content: '<h1>' + escapePublicHtml(f.nome) + '</h1>' + paragraph(f.tagline) + paragraph(f.oQueE) + paragraph(f.resumo) + '<h2>Requisitos principais</h2>' + f.requisitosPrincipais.map(r => '<h3>' + escapePublicHtml(r.titulo) + '</h3>' + paragraph(r.desc)).join('') });
  return pages;
}

/** Allowlisted public HTML only. No authenticated records, secrets or fabricated prices. */
export function publicPrerender(): Plugin {
  return {
    name: 'akuris-public-html', apply: 'build', enforce: 'post',
    generateBundle(_options, bundle) {
      const index = bundle['index.html'];
      if (!index || index.type !== 'asset') throw new Error('Public prerender: index.html missing');
      const template = String(index.source);
      for (const page of publicPages()) {
        const url = 'https://akuris.pt' + page.path;
        let html = template.replace(/<title>[^<]*<\/title>/, '<title>' + escapePublicHtml(page.title) + '</title>');
        html = html.replace(/<meta([^>]*(?:name="(?:description|twitter:title|twitter:description)"|property="(?:og:title|og:description|og:url)"))[^>]*>/g, (tag, attrs: string) => {
          const value = /(?:og:url)/.test(attrs) ? url : /(?:og:title|twitter:title)/.test(attrs) ? page.title : page.description;
          return tag.replace(/content="[^"]*"/, 'content="' + escapePublicHtml(value) + '"');
        }).replace(/<link([^>]*rel="canonical"[^>]*)>/, '<link data-rh="true" rel="canonical" href="' + url + '" />');
        // createRoot replaces this same-content reading fallback when the interactive app is ready.
        // Texto para buscadores fica visualmente oculto; o visitante vê só o fundo da marca até o app montar.
        const critical = '<style id="akuris-boot">html,body{background:#0a1628;margin:0}.akuris-seo{position:absolute!important;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap}.akuris-boot{position:fixed;inset:0;display:grid;place-items:center;background:#0a1628}.akuris-boot i{width:14px;height:14px;border-radius:50%;background:#7552FF;animation:akp 1.2s ease-in-out infinite}@keyframes akp{50%{opacity:.3;transform:scale(.7)}}@media (prefers-reduced-motion:reduce){.akuris-boot i{animation:none}}</style><noscript><style>.akuris-boot{display:none}.akuris-seo{position:static!important;width:auto;height:auto;clip:auto;clip-path:none;white-space:normal;color:#fff;max-width:1000px;margin:auto;padding:48px 24px}</style></noscript>';
        const content = '<div id="root"><div class="akuris-boot" aria-hidden="true"><i></i></div><main class="akuris-seo"><nav><a href="/">Akuris</a> · <a href="/frameworks">Guias</a></nav>' + page.content + '<p><a href="/?demo=1">' + t('demo') + '</a> · <a href="mailto:contato@akuris.com.br">contato@akuris.com.br</a></p></main></div>';
        html = html.replace('</head>', critical + '</head>').replace('<div id="root"></div>', content);
        if (page.path === '/') index.source = html;
        else this.emitFile({ type: 'asset', fileName: page.path.slice(1) + '/index.html', source: html });
      }
    },
  };
}
