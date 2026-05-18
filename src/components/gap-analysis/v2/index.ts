/**
 * Gap Analysis v2 — primitivos compartilhados da reforma.
 * Mantém identidade Akuris (DM Sans, tokens semânticos, sem cores cruas Tailwind).
 */
export { StackBar } from './StackBar';
export type { StackSegmentKind, StackSegment } from './StackBar';
export { MaturityScale, getMaturityLevel } from './MaturityScale';
export { StatusSeg } from './StatusSeg';
export { InsightStrip } from './InsightStrip';
export type { InsightTone } from './InsightStrip';
export { KpiTiny } from './KpiTiny';
export type { KpiTone } from './KpiTiny';
export { AIBadge } from './AIBadge';
export { FwMono } from './FwMono';
export { SectionHead } from './SectionHead';
export { MaturityHero } from './MaturityHero';
export { AIRecommendedTile } from './AIRecommendedTile';
export { ActiveFrameworkRow } from './ActiveFrameworkRow';
export { deriveFwMono, getFwCategory, FW_CATEGORY_LABEL } from './fw-utils';
export type { FwCategory } from './fw-utils';
