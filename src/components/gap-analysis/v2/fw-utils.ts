/**
 * Helpers para derivar selo monocromático (FwMono) e categoria a partir do nome do framework.
 */

export type FwCategory = 'seguranca' | 'privacidade' | 'governanca' | 'qualidade';

export function getFwCategory(tipo?: string | null): FwCategory {
  const t = (tipo || '').toLowerCase();
  if (t.includes('privacidade') || t.includes('privacy') || t.includes('lgpd') || t.includes('gdpr')) return 'privacidade';
  if (t.includes('governanca') || t.includes('governance') || t.includes('cobit') || t.includes('sox')) return 'governanca';
  if (t.includes('qualidade') || t.includes('quality') || t.includes('iso 9') || t.includes('itil')) return 'qualidade';
  return 'seguranca';
}

export const FW_CATEGORY_LABEL: Record<FwCategory, string> = {
  seguranca: 'Segurança da Informação',
  privacidade: 'Privacidade & Dados',
  governanca: 'Governança',
  qualidade: 'Qualidade & Processos',
};

/**
 * Quebra o nome do framework em duas linhas para o selo FwMono.
 * Ex: "ISO/IEC 27001" -> {l1: "ISO/IEC", l2: "27001"}
 *     "NIST CSF 2.0" -> {l1: "NIST", l2: "CSF"}
 *     "LGPD"          -> {l1: "BR", l2: "LGPD"}
 */
export function deriveFwMono(nome: string): { l1: string; l2: string } {
  const n = (nome || '').trim();
  if (!n) return { l1: '—', l2: '—' };

  // Mapas específicos (curadoria)
  const map: Record<string, { l1: string; l2: string }> = {
    'LGPD': { l1: 'BR', l2: 'LGPD' },
    'GDPR': { l1: 'EU', l2: 'GDPR' },
    'HIPAA': { l1: 'US', l2: 'HIPAA' },
    'SOC 2': { l1: 'AICPA', l2: 'SOC2' },
    'PCI DSS': { l1: 'PCI', l2: 'DSS' },
    'COBIT': { l1: 'ISACA', l2: 'COBIT' },
    'CIS Controls': { l1: 'CIS', l2: 'CTRL' },
    'DORA': { l1: 'EU', l2: 'DORA' },
  };
  if (map[n]) return map[n];

  // ISO* / NIST*
  if (/^ISO/i.test(n)) {
    const m = n.match(/^(ISO(?:\/IEC)?)\s+([A-Z0-9.\-]+)/i);
    if (m) return { l1: m[1].toUpperCase(), l2: m[2].replace(/\s+/g, '') };
  }
  if (/^NIST/i.test(n)) {
    const m = n.match(/^NIST[\s\-]*(.+)/i);
    if (m) {
      const rest = m[1].split(/\s+/)[0].replace(/[^A-Z0-9.\-]/gi, '');
      return { l1: 'NIST', l2: rest.toUpperCase() || 'CSF' };
    }
  }

  // Genérico: primeira palavra / segunda palavra
  const parts = n.split(/\s+/);
  if (parts.length === 1) return { l1: '—', l2: parts[0].slice(0, 6).toUpperCase() };
  return { l1: parts[0].toUpperCase(), l2: parts.slice(1).join('').replace(/[^A-Z0-9]/gi, '').slice(0, 6).toUpperCase() };
}
