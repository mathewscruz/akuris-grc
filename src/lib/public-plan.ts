import type { Plano } from '@/lib/planos-utils';

/** Keep catalog values intact. No assumed discount and no hidden rounding to whole currency units. */
export function publicPlanPrice(plan: Pick<Plano, 'preco_mensal' | 'preco_anual'>, annual: boolean) {
  if (annual) return plan.preco_anual > 0 && Number.isFinite(plan.preco_anual)
    ? { monthly: plan.preco_anual / 12, annualTotal: plan.preco_anual }
    : { monthly: null, annualTotal: null };
  return { monthly: Number.isFinite(plan.preco_mensal) && plan.preco_mensal >= 0 ? plan.preco_mensal : null, annualTotal: null };
}
export function planFeatureLabel(value: string) {
  return value.replace(/Compliance Start/g, 'Akuris Start').replace(/GRC Manager/g, 'Akuris Manager');
}
