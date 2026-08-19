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

import { tGlobal } from '@/lib/i18n-global';

export function getFwCategoryLabel(): Record<FwCategory, string> {
  return {
    seguranca: tGlobal('sweepRiscos.gap.fwCategoryLong.seguranca'),
    privacidade: tGlobal('sweepRiscos.gap.fwCategoryLong.privacidade'),
    governanca: tGlobal('sweepRiscos.gap.fwCategoryLong.governanca'),
    qualidade: tGlobal('sweepRiscos.gap.fwCategoryLong.qualidade'),
  };
}



/**
 * Quebra o nome do framework em duas linhas para o selo FwMono.
 * Ex: "ISO/IEC 27001" -> {l1: "ISO/IEC", l2: "27001"}
 *     "NIST CSF 2.0" -> {l1: "NIST", l2: "CSF"}
 *     "LGPD"          -> {l1: "BR", l2: "LGPD"}
 */
