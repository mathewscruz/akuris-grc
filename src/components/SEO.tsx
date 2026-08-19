import { Helmet } from 'react-helmet-async';
import { useLanguage } from '@/contexts/LanguageContext';
import { intlLocale } from '@/lib/date-utils';

interface SEOProps {
  title: string;
  description: string;
  canonical?: string;
  ogImage?: string;
  ogType?: 'website' | 'article';
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
  noindex?: boolean;
}

const BASE_URL = 'https://akuris.com.br';
const DEFAULT_OG = 'https://storage.googleapis.com/gpt-engineer-file-uploads/MJNkC7cGUPbiXnnNmwkC0KGKpFQ2/social-images/social-1778100765278-AKURIS.webp';

export function SEO({
  title,
  description,
  canonical,
  ogImage = DEFAULT_OG,
  ogType = 'website',
  jsonLd,
  noindex = false,
}: SEOProps) {
  const url = canonical
    ? canonical.startsWith('http') ? canonical : `${BASE_URL}${canonical}`
    : BASE_URL;

  const { locale } = useLanguage();
  /*
    Eram dois testes de duas variantes num produto de três. O português de
    PORTUGAL era anunciado como `pt-BR`, e o do BRASIL — o público principal —
    como `en`: cada página brasileira declarava-se inglesa no `<html lang>` e
    no Open Graph. Afeta leitor de ecrã, oferta de tradução do browser e
    indexação.
  */
  const htmlLang = intlLocale();
  const ogLocale = htmlLang.replace('-', '_');

  const schemas = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];

  return (
    <Helmet>
      <html lang={htmlLang} />
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      {noindex && <meta name="robots" content="noindex,nofollow" />}

      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content={ogType} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:site_name" content="Akuris" />
      <meta property="og:locale" content={ogLocale} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />

      {schemas.map((schema, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(schema)}
        </script>
      ))}
    </Helmet>
  );
}
