/**
 * Logo padrão Akuris.
 *
 * Use este helper sempre que precisar exibir o logotipo de uma empresa.
 * Quando a empresa não tiver `logo_url` próprio cadastrado, o fallback
 * automático é o logotipo padrão do Akuris (mesmo usado no menu lateral).
 */
import akurisLogo from '@/assets/akuris-logo.png';

export const AKURIS_DEFAULT_LOGO = akurisLogo;

/** URL pública do logo Akuris para contextos externos (PDFs, e-mails). */
export const AKURIS_DEFAULT_LOGO_URL =
  'https://akuris-grc.lovable.app/akuris-logo-email.png';

/**
 * Retorna o logo da empresa, ou o logo padrão Akuris quando ausente/inválido.
 */
export const getCompanyLogo = (
  logoUrl?: string | null,
): string => {
  if (logoUrl && typeof logoUrl === 'string' && logoUrl.trim().length > 0) {
    return logoUrl;
  }
  return AKURIS_DEFAULT_LOGO;
};

/** Versão para contextos externos (e-mail/PDF) que precisam de URL absoluta. */
export const getCompanyLogoUrl = (
  logoUrl?: string | null,
): string => {
  if (logoUrl && typeof logoUrl === 'string' && logoUrl.trim().length > 0) {
    return logoUrl;
  }
  return AKURIS_DEFAULT_LOGO_URL;
};
