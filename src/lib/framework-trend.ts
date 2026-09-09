export interface FrameworkSnapshot { framework_id: string; score: number; recorded_at: string }
/** Compare the same frameworks, each to its latest observation at/before cutoff.
 * No baseline for even one member means no comparable portfolio trend. */
export function comparableFrameworkTrend(current: { id: string; score: number }[], history: FrameworkSnapshot[], cutoff: Date): number | null {
  const cohort = [...new Map(current.map(f => [f.id, f])).values()];
  if (!cohort.length) return null;
  const latest = new Map<string, FrameworkSnapshot>();
  for (const row of history) {
    const at = new Date(row.recorded_at).getTime();
    if (!Number.isFinite(at) || at > cutoff.getTime() || !Number.isFinite(row.score)) continue;
    const previous = latest.get(row.framework_id);
    if (!previous || at > new Date(previous.recorded_at).getTime()) latest.set(row.framework_id, row);
  }
  if (cohort.some(f => !latest.has(f.id) || !Number.isFinite(f.score))) return null;
  return Math.round(cohort.reduce((sum, f) => sum + f.score - latest.get(f.id)!.score, 0) / cohort.length);
}
