export interface ContactFormData {
  name: string;
  email: string;
  company?: string;
  phone?: string;
  role?: string;
  companySize?: string;
  message?: string;
  requestId?: string;
  locale?: string;
  interest?: string;
  plan?: string;
  source?: string;
}


const LIMITES = { name: 120, email: 254, company: 160, phone: 40, role: 120, companySize: 80, message: 1000 };

/** Devolve a primeira falha de validacao, ou null se estiver tudo bem. */
export function validar(d: ContactFormData): string | null {
  if (!d || typeof d !== 'object' || Array.isArray(d)) return 'Invalid payload';
  for (const key of Object.keys(LIMITES)) {
    const value = (d as unknown as Record<string, unknown>)[key];
    if (value !== undefined && typeof value !== 'string') return 'Invalid field type';
  }
  if (d.requestId !== undefined && (typeof d.requestId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(d.requestId))) return 'Invalid request id';
  if (d.locale !== undefined && !['pt', 'pt-BR', 'en'].includes(d.locale)) return 'Invalid locale';
  if (d.interest !== undefined && !['general', 'grc', 'privacy', 'thirdParties', 'channel', 'migration', 'trust', 'plans', 'guides', 'gap', 'dashboard', 'actions', 'projects', 'controls', 'audits', 'assets', 'licenses', 'keys', 'contracts', 'documents', 'systems', 'privileged', 'reviews', 'incidents', 'continuity', 'reports', 'settings'].includes(d.interest)) return 'Invalid interest';
  if (d.plan !== undefined && (typeof d.plan !== 'string' || !/^[a-zA-Z0-9_-]{0,64}$/.test(d.plan))) return 'Invalid plan';
  if (d.source !== undefined && (typeof d.source !== 'string' || !/^\/[a-zA-Z0-9_/-]{0,150}$/.test(d.source))) return 'Invalid source';
  if (!['1-50', '51-250', '251-1000', '1000+'].includes(d.companySize || '')) return 'Invalid company size';
  const nome = (d?.name ?? "").trim();
  const email = (d?.email ?? "").trim();
  const empresa = (d?.company ?? "").trim();
  const tamanho = (d?.companySize ?? "").trim();
  if (!nome || !email || !empresa || !tamanho) return "Nome, e-mail, empresa e porte são obrigatórios";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "E-mail invalido";
  for (const [campo, max] of Object.entries(LIMITES)) {
    const v = (d as unknown as Record<string, string | undefined>)[campo];
    if (v && v.length > max) return `Campo ${campo} excede ${max} caracteres`;
  }
  return null;
}
