import { useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import DOMPurify from 'dompurify';
import { brandedEmailDocument, EMAIL_BRAND, escapeHtml, safeEmailUrl } from '../../../supabase/functions/_shared/email-brand';

interface EmailPreviewProps {
  assunto: string;
  conteudoHtml: string;
  imagemUrl?: string | null;
}

/** Uses the same brand, spacing and responsive shell as the outgoing system emails. */
export function EmailPreview({ assunto, conteudoHtml, imagemUrl }: EmailPreviewProps) {
  const { t, locale } = useLanguage();
  const srcDoc = useMemo(() => {
    const safeUrl = imagemUrl ? safeEmailUrl(imagemUrl) : '';
    const safeImage = safeUrl ? `<img src="${escapeHtml(safeUrl)}" alt="" width="528" style="display:block;width:100%;max-width:528px;height:auto;border-radius:8px;margin:0 0 24px" />` : '';
    const content = DOMPurify.sanitize(conteudoHtml, { USE_PROFILES: { html: true } }) || `<p>${escapeHtml(t('configGeral.emailPreview.placeholderContent'))}</p>`;
    return brandedEmailDocument(
      assunto || t('configGeral.emailPreview.defaultSubject'),
      safeImage + content,
      { locale: locale === 'en' ? 'en' : 'pt' },
    ).split(EMAIL_BRAND.logoUrl).join('/akuris-logo-email-dark-v2.png');
  }, [assunto, conteudoHtml, imagemUrl, t, locale]);

  return <iframe
    title={t('configGeral.emailPreview.iframeTitle')}
    srcDoc={srcDoc}
    sandbox=""
    className="w-full h-[640px] rounded-md border border-border bg-white"
  />;
}
