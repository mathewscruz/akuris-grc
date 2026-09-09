/** Hours are decimal durations; zero RPO is legitimate, blank is not zero. */
export function recoveryHours(value: string | number | null | undefined): number | null {
  if (value == null || String(value).trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
export function validRecoveryTargets(p: { mtpd_horas?: string | number; rto_horas?: string | number; rpo_horas?: string | number }): boolean {
  const mtpd = recoveryHours(p.mtpd_horas);
  const rto = recoveryHours(p.rto_horas);
  const rpo = recoveryHours(p.rpo_horas);
  // RPO is a data-loss window, independent of the service restoration RTO.
  return mtpd != null && mtpd > 0 && rto != null && rpo != null && rto <= mtpd;
}
