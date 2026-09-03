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

export interface FrameworkBadgePalette {
  from: string;
  to: string;
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

/**
 * Assinaturas cromáticas próprias do Akuris.
 *
 * São deliberadamente diferentes dos logótipos institucionais: ajudam o
 * utilizador a reconhecer rapidamente cada referencial sem sugerir endosso,
 * certificação ou autorização do titular da marca.
 */
const BADGE_PALETTES: Array<[RegExp, FrameworkBadgePalette]> = [
  [/^iso27001/, { from: '#315f8f', to: '#142f50' }],
  [/^iso27701/, { from: '#7654a8', to: '#352458' }],
  [/^iso62443|^nistsp80082|^nist80082/, { from: '#5b6c7c', to: '#27343f' }],
  [/^nist/, { from: '#3979a8', to: '#183c5a' }],
  [/^cis/, { from: '#b06528', to: '#563014' }],
  [/^pcidss|^pci/, { from: '#23858d', to: '#0d454b' }],
  [/^soc2|^soc/, { from: '#3a758b', to: '#173c4b' }],
  [/^lgpd/, { from: '#7046b5', to: '#351d68' }],
  [/^gdpr|^rgpd/, { from: '#365fa7', to: '#182d59' }],
  [/^ccpa|^cpra/, { from: '#a24770', to: '#4d1e36' }],
  [/^hipaa/, { from: '#27828b', to: '#10464c' }],
  [/^cobit/, { from: '#59687e', to: '#283443' }],
  [/^itil|^iso20000/, { from: '#4c7b79', to: '#203f3e' }],
  [/^iso9001/, { from: '#8a7441', to: '#443718' }],
  [/^cosointernal|^cosoic/, { from: '#646977', to: '#303540' }],
  [/^cosoerm|^coso/, { from: '#86543d', to: '#42281c' }],
  [/^iso31000/, { from: '#9a622d', to: '#4b2e15' }],
  [/^iso37301/, { from: '#80593a', to: '#3e2a1a' }],
  [/^sox|^sarbanes/, { from: '#34765a', to: '#173d2d' }],
  [/^dora/, { from: '#844b91', to: '#412347' }],
  [/^nis2|^nis/, { from: '#515f9b', to: '#272e53' }],
  [/^iso14001/, { from: '#3d8654', to: '#1a472a' }],
];

const TONE_PALETTES: Record<FrameworkTone, FrameworkBadgePalette> = {
  security: { from: '#365f8c', to: '#172f4d' },
  privacy: { from: '#7049a1', to: '#352252' },
  governance: { from: '#5d6877', to: '#2d3540' },
  risk: { from: '#8b5a32', to: '#462b17' },
  financial: { from: '#347158', to: '#193a2c' },
  health: { from: '#2f7881', to: '#173e44' },
  environment: { from: '#3b7c50', to: '#1b4229' },
};

export function resolveFrameworkBadgePalette(name: string, tone: FrameworkTone): FrameworkBadgePalette {
  const slug = normalize(name);
  return BADGE_PALETTES.find(([pattern]) => pattern.test(slug))?.[1] ?? TONE_PALETTES[tone];
}

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
