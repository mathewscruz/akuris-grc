import { EMAIL_BRAND } from "./email-brand.ts";
export { EMAIL_HEADER_HTML } from "./email-brand.ts";
// Constantes centralizadas do sistema de e-mails Akuris
export const SYSTEM_NAME = 'Akuris';
export const SYSTEM_URL = 'https://akuris.pt';
export const NOREPLY_EMAIL = 'noreply@akuris.com.br';
export const PRIMARY_COLOR = '#7552ff';
export const PRIMARY_DARK = '#5a3fd6';
export const PRIMARY_BG = '#f0eeff';
export const SYSTEM_DESCRIPTION = 'Plataforma de Governança, Risco e Compliance';

// URL do logo para e-mails - hospedado no app publicado
export const AKURIS_LOGO_URL = EMAIL_BRAND.logoUrl;

// Logo como imagem HTML para uso em templates de e-mail inline
export const LOGO_IMG_HTML = `<img src="${EMAIL_BRAND.logoUrl}" alt="Akuris" width="160" style="display:block;height:auto" />`;
