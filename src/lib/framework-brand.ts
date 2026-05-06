/**
 * Framework brand catalog — Akuris editorial typography system.
 *
 * Strategy: typographic badges with semantic tones grouped by domain.
 * Avoids copyright risk (ISO/NIST/PCI/AICPA logos are trademarked) while
 * keeping visual coherence with the Akuris design system.
 *
 * To add an actual logo later: set `logoSrc` to an imported SVG asset.
 */

export type FrameworkTone =
  | 'security' // Cybersecurity & infosec
  | 'privacy' // Privacy & data protection laws
  | 'governance' // IT/quality/service governance
  | 'risk' // Risk & ERM
  | 'financial' // Financial / SOX-like
  | 'health' // Healthcare
  | 'environment'; // ISO 14001 etc.

export interface FrameworkBrand {
  acronym: string;
  fullName: string;
  tone: FrameworkTone;
  logoSrc?: string;
}

const TONE_STYLES: Record<FrameworkTone, { bg: string; text: string; ring: string }> = {
  security: {
    bg: 'bg-[hsl(217_45%_22%)]',
    text: 'text-[hsl(210_40%_94%)]',
    ring: 'ring-[hsl(217_45%_30%)]',
  },
  privacy: {
    bg: 'bg-[hsl(258_45%_24%)]',
    text: 'text-[hsl(258_60%_92%)]',
    ring: 'ring-[hsl(258_45%_34%)]',
  },
  governance: {
    bg: 'bg-[hsl(215_20%_24%)]',
    text: 'text-[hsl(215_30%_92%)]',
    ring: 'ring-[hsl(215_20%_34%)]',
  },
  risk: {
    bg: 'bg-[hsl(28_50%_24%)]',
    text: 'text-[hsl(38_60%_92%)]',
    ring: 'ring-[hsl(28_50%_34%)]',
  },
  financial: {
    bg: 'bg-[hsl(155_30%_22%)]',
    text: 'text-[hsl(155_40%_92%)]',
    ring: 'ring-[hsl(155_30%_32%)]',
  },
  health: {
    bg: 'bg-[hsl(190_45%_22%)]',
    text: 'text-[hsl(190_50%_92%)]',
    ring: 'ring-[hsl(190_45%_32%)]',
  },
  environment: {
    bg: 'bg-[hsl(140_30%_22%)]',
    text: 'text-[hsl(140_40%_92%)]',
    ring: 'ring-[hsl(140_30%_32%)]',
  },
};

export const getToneStyle = (tone: FrameworkTone) => TONE_STYLES[tone];

/**
 * Normalize framework name to a slug for lookup.
 * Strips ISO/IEC prefix variations, version suffixes, and accents.
 */
const normalize = (name: string): string =>
  name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/iso\/iec/g, 'iso')
    .replace(/[^a-z0-9]/g, '');

const CATALOG: FrameworkBrand[] = [
  // Privacy / data protection
  { acronym: 'LGPD', fullName: 'Lei Geral de Proteção de Dados', tone: 'privacy' },
  { acronym: 'GDPR', fullName: 'General Data Protection Regulation', tone: 'privacy' },
  { acronym: 'CCPA', fullName: 'California Consumer Privacy Act', tone: 'privacy' },
  { acronym: '27701', fullName: 'ISO/IEC 27701 — Privacy Information', tone: 'privacy' },

  // Security
  { acronym: '27001', fullName: 'ISO/IEC 27001 — Information Security', tone: 'security' },
  { acronym: 'NIST', fullName: 'NIST Cybersecurity Framework', tone: 'security' },
  { acronym: 'NIST', fullName: 'NIST SP 800-82 — ICS Security', tone: 'security' },
  { acronym: 'PCI', fullName: 'Payment Card Industry Data Security Standard', tone: 'security' },
  { acronym: 'CIS', fullName: 'CIS Critical Security Controls', tone: 'security' },
  { acronym: 'SOC2', fullName: 'SOC 2 Type II', tone: 'security' },
  { acronym: 'NIS2', fullName: 'Network and Information Security Directive 2', tone: 'security' },
  { acronym: 'DORA', fullName: 'Digital Operational Resilience Act', tone: 'security' },
  { acronym: '62443', fullName: 'ISO/IEC 62443 — Industrial Cybersecurity', tone: 'security' },

  // Governance / IT service / quality
  { acronym: 'COBIT', fullName: 'COBIT — IT Governance', tone: 'governance' },
  { acronym: 'ITIL', fullName: 'ITIL — IT Service Management', tone: 'governance' },
  { acronym: '20000', fullName: 'ISO/IEC 20000 — IT Service Management', tone: 'governance' },
  { acronym: '9001', fullName: 'ISO 9001 — Quality Management', tone: 'governance' },
  { acronym: '37301', fullName: 'ISO 37301 — Compliance Management', tone: 'governance' },

  // Risk
  { acronym: '31000', fullName: 'ISO 31000 — Risk Management', tone: 'risk' },
  { acronym: 'COSO', fullName: 'COSO ERM — Enterprise Risk Management', tone: 'risk' },
  { acronym: 'COSO', fullName: 'COSO Internal Control', tone: 'governance' },

  // Financial
  { acronym: 'SOX', fullName: 'Sarbanes-Oxley Act', tone: 'financial' },

  // Health
  { acronym: 'HIPAA', fullName: 'Health Insurance Portability and Accountability Act', tone: 'health' },

  // Environment
  { acronym: '14001', fullName: 'ISO 14001 — Environmental Management', tone: 'environment' },
];

const LOOKUP: Record<string, FrameworkBrand> = {};
for (const brand of CATALOG) {
  LOOKUP[normalize(brand.fullName)] = brand;
  LOOKUP[normalize(brand.acronym)] = brand;
}

// Direct keys for common DB names
const DIRECT_KEYS: Record<string, FrameworkBrand> = {
  lgpd: CATALOG[0],
  gdpr: CATALOG[1],
  ccpa: CATALOG[2],
  iso27701: CATALOG[3],
  iso27001: CATALOG[4],
  nistcsf: CATALOG[5],
  nistsp80082: CATALOG[6],
  pcidss: CATALOG[7],
  ciscontrols: CATALOG[8],
  soc2typeii: CATALOG[9],
  nis2: CATALOG[10],
  dora: CATALOG[11],
  iso62443: CATALOG[12],
  cobit: CATALOG[13],
  itil: CATALOG[14],
  iso20000: CATALOG[15],
  iso9001: CATALOG[16],
  iso37301: CATALOG[17],
  iso31000: CATALOG[18],
  cosoerm: CATALOG[19],
  cosointernalcontrol: CATALOG[20],
  sox: CATALOG[21],
  hipaa: CATALOG[22],
  iso14001: CATALOG[23],
};

const FALLBACK: FrameworkBrand = {
  acronym: '?',
  fullName: 'Framework personalizado',
  tone: 'governance',
};

/**
 * Resolve a framework brand from its name (and optional version).
 * Returns a typographic acronym + tone. Never returns null.
 */
export function resolveFrameworkBrand(name: string, _versao?: string): FrameworkBrand {
  if (!name) return FALLBACK;
  const slug = normalize(name);

  // Try direct keys first
  if (DIRECT_KEYS[slug]) return DIRECT_KEYS[slug];

  // Try lookup
  if (LOOKUP[slug]) return LOOKUP[slug];

  // Partial matches for ISO/NIST variants
  for (const key of Object.keys(DIRECT_KEYS)) {
    if (slug.includes(key) || key.includes(slug)) return DIRECT_KEYS[key];
  }

  // Generic acronym from initials (max 5 chars)
  const acronym = name
    .replace(/[^A-Za-z0-9 ]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 5);

  return { ...FALLBACK, acronym: acronym || '?', fullName: name };
}
