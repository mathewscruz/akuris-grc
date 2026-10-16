import {
  Shield01Icon, SecurityCheckIcon, CloudIcon, UserLock01Icon, StarIcon, Target02Icon,
  CreditCardIcon, CheckListIcon, Globe02Icon, Factory01Icon, Settings02Icon,
  CustomerService01Icon, Award01Icon, JusticeScale01Icon, Alert02Icon, CubeIcon,
  Money03Icon, Hospital01Icon, Leaf01Icon, BankIcon, UmbrellaIcon, ChartLineData02Icon,
  ShieldUserIcon, PulseRectangle01Icon,
} from '@hugeicons/core-free-icons';
import type { IconSvgElement } from '@hugeicons/react';
import type { FrameworkTone } from '@/lib/framework-brand';

const norm = (s?: string | null) =>
  (s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/iso\/iec/g, 'iso').replace(/[^a-z0-9]/g, '');

/** Assunto de cada framework, em ícone Hugeicons. */
const POR_NOME: Array<[RegExp, IconSvgElement]> = [
  [/bacen|cmn4893|4893/, BankIcon],
  [/anpd/, ShieldUserIcon],
  [/susep/, UmbrellaIcon],
  [/cvm/, ChartLineData02Icon],
  [/^iso27001/, SecurityCheckIcon],
  [/^iso27701/, UserLock01Icon],
  [/^iso62443|80082/, Factory01Icon],
  [/^nist/, Target02Icon],
  [/^cis/, CheckListIcon],
  [/^pci/, CreditCardIcon],
  [/^soc/, CloudIcon],
  [/^lgpd/, UserLock01Icon],
  [/^gdpr|^rgpd/, StarIcon],
  [/^ccpa|^cpra/, Globe02Icon],
  [/^hipaa/, Hospital01Icon],
  [/^cobit/, Settings02Icon],
  [/^itil|^iso20000/, CustomerService01Icon],
  [/^iso9001/, Award01Icon],
  [/^iso37301/, JusticeScale01Icon],
  [/^coso/, CubeIcon],
  [/^iso31000/, Alert02Icon],
  [/^sox|^sarbanes/, Money03Icon],
  [/^dora/, PulseRectangle01Icon],
  [/^nis/, Shield01Icon],
  [/^iso14001/, Leaf01Icon],
];

const POR_TOM: Record<FrameworkTone, IconSvgElement> = {
  security: Shield01Icon, privacy: UserLock01Icon, governance: Settings02Icon, risk: Alert02Icon,
  financial: Money03Icon, health: Hospital01Icon, environment: Leaf01Icon,
};

export function iconeDoSelo(nome: string, tom: FrameworkTone): IconSvgElement {
  const n = norm(nome);
  return POR_NOME.find(([re]) => re.test(n))?.[1] ?? POR_TOM[tom];
}

export interface SeloInfo {
  /** Texto do arco superior. */
  nome: string;
  /** Texto do arco inferior, por idioma. */
  tema: { pt: string; en: string };
  /** Token CSS da cor do aro/ícone. */
  cor: string;
}

const T = (pt: string, en = pt) => ({ pt, en });

const SELOS: Array<[RegExp, Omit<SeloInfo, 'nome'> & { nome?: string }]> = [
  [/bacen|cmn4893|4893/, { nome: 'BACEN 4.893', tema: T('Segurança cibernética', 'Cybersecurity'), cor: '--fw-gold' }],
  [/anpd/, { nome: 'ANPD 15/2024', tema: T('Incidentes de dados', 'Data incidents'), cor: '--fw-teal' }],
  [/susep/, { nome: 'SUSEP 638', tema: T('Segurança cibernética', 'Cybersecurity'), cor: '--fw-gold' }],
  [/cvm/, { nome: 'CVM 35', tema: T('Mercado de capitais', 'Capital markets'), cor: '--fw-gold' }],
  [/^iso27001/, { nome: 'ISO 27001', tema: T('Segurança da informação', 'Information security'), cor: '--fw-blue' }],
  [/^iso27701/, { nome: 'ISO 27701', tema: T('Privacidade', 'Privacy'), cor: '--fw-teal' }],
  [/^iso62443/, { nome: 'ISO 62443', tema: T('Segurança industrial', 'Industrial security'), cor: '--fw-violet' }],
  [/80082/, { nome: 'NIST 800-82', tema: T('Segurança OT', 'OT security'), cor: '--fw-violet' }],
  [/^nist/, { nome: 'NIST CSF', tema: T('Cibersegurança', 'Cybersecurity'), cor: '--fw-violet' }],
  [/^cis/, { nome: 'CIS CONTROLS', tema: T('Controles críticos', 'Critical controls'), cor: '--fw-blue' }],
  [/^pci/, { nome: 'PCI DSS', tema: T('Segurança de pagamentos', 'Payment security'), cor: '--fw-gold' }],
  [/^soc/, { nome: 'SOC 2', tema: T('Trust Services'), cor: '--fw-blue' }],
  [/^lgpd/, { nome: 'LGPD', tema: T('Privacidade de dados', 'Data privacy'), cor: '--fw-teal' }],
  [/^gdpr|^rgpd/, { nome: 'GDPR', tema: T('Proteção de dados', 'Data protection'), cor: '--fw-blue' }],
  [/^ccpa|^cpra/, { nome: 'CCPA', tema: T('Privacidade do consumidor', 'Consumer privacy'), cor: '--fw-teal' }],
  [/^hipaa/, { nome: 'HIPAA', tema: T('Saúde', 'Healthcare'), cor: '--fw-health' }],
  [/^nis/, { nome: 'NIS2', tema: T('Resiliência digital', 'Network security'), cor: '--fw-violet' }],
  [/^dora/, { nome: 'DORA', tema: T('Resiliência operacional', 'Operational resilience'), cor: '--fw-violet' }],
  [/^sox|^sarbanes/, { nome: 'SOX', tema: T('Controles financeiros', 'Financial controls'), cor: '--fw-gold' }],
  [/^iso14001/, { nome: 'ISO 14001', tema: T('Meio ambiente', 'Environment'), cor: '--fw-environment' }],
  [/^iso9001/, { nome: 'ISO 9001', tema: T('Qualidade', 'Quality'), cor: '--fw-governance' }],
  [/^iso31000/, { nome: 'ISO 31000', tema: T('Gestão de riscos', 'Risk management'), cor: '--fw-risk' }],
  [/^iso37301/, { nome: 'ISO 37301', tema: T('Compliance'), cor: '--fw-governance' }],
];

const TEMA_TOM: Record<FrameworkTone, { pt: string; en: string }> = {
  security: T('Segurança da informação', 'Information security'),
  privacy: T('Privacidade de dados', 'Data privacy'),
  governance: T('Governança', 'Governance'),
  risk: T('Gestão de riscos', 'Risk management'),
  financial: T('Regulação financeira', 'Financial regulation'),
  health: T('Saúde', 'Healthcare'),
  environment: T('Meio ambiente', 'Environment'),
};

export function seloDoFramework(nome: string, brand: { acronym: string; tone: FrameworkTone }): SeloInfo {
  const n = norm(nome);
  const achado = SELOS.find(([re]) => re.test(n))?.[1];
  const nomeCurto = nome.length <= 14 ? nome.toUpperCase() : brand.acronym;
  if (achado) return { nome: achado.nome ?? nomeCurto, tema: achado.tema, cor: achado.cor };
  return { nome: nomeCurto, tema: TEMA_TOM[brand.tone], cor: `--fw-${brand.tone}` };
}
