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
