/** Recognisable SVG representations of each framework (not licensed official logos). */
const star = (cx: number, cy: number, r: number) => {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5; const rr = i % 2 ? r * .42 : r; pts.push(`${(cx + rr * Math.cos(a)).toFixed(2)},${(cy + rr * Math.sin(a)).toFixed(2)}`); }
  return pts.join(' ');
};
function EuStars({ r = 15, size = 2.3, color = '#ffcc00' }: { r?: number; size?: number; color?: string }) {
  return <>{Array.from({ length: 12 }, (_, i) => { const a = i * Math.PI / 6; return <polygon key={i} fill={color} points={star(20 + r * Math.sin(a), 20 - r * Math.cos(a), size)} />; })}</>;
}

export function IsoLogo() {
  return <svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="18" fill="none" stroke="#e6e9f2" strokeWidth="1.6" />
    <ellipse cx="20" cy="20" rx="8" ry="18" fill="none" stroke="#e6e9f2" strokeWidth="1" /><path d="M2 20h36M5 11h30M5 29h30" stroke="#e6e9f2" strokeWidth="1" />
    <rect x="5" y="14" width="30" height="12" rx="2" fill="#0a1124" /><text x="20" y="24.2" textAnchor="middle" fontSize="11" fontWeight="900" fill="#fff" fontFamily="Arial, sans-serif">ISO</text></svg>;
}
export function SocLogo() {
  return <svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="19" fill="#1d6fd1" /><circle cx="20" cy="20" r="15.5" fill="none" stroke="#fff" strokeWidth=".8" />
    <text x="20" y="17" textAnchor="middle" fontSize="6.2" fontWeight="700" fill="#fff" fontFamily="Arial, sans-serif">AICPA</text>
    <text x="20" y="26" textAnchor="middle" fontSize="8.5" fontWeight="800" fill="#fff" fontFamily="Arial, sans-serif">SOC</text></svg>;
}
export function LgpdLogo() {
  return <svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 2 5 8v11c0 10 6.5 16.5 15 19 8.5-2.5 15-9 15-19V8L20 2Z" fill="#009c3b" />
    <path d="M20 9 32 20 20 31 8 20Z" fill="#ffdf00" /><circle cx="20" cy="20" r="6" fill="#002776" /><path d="M14.3 18.6c3.7-.9 7.6-.4 11.3 1.6" stroke="#fff" strokeWidth="1" fill="none" /></svg>;
}
export function EuLogo({ label }: { label?: string }) {
  return <svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="19.5" fill="#003399" /><EuStars />
    {label && <text x="20" y="22.6" textAnchor="middle" fontSize={label.length > 3 ? 6.2 : 7.5} fontWeight="800" fill="#fff" fontFamily="Arial, sans-serif">{label}</text>}</svg>;
}
export function NistLogo() {
  return <svg viewBox="0 0 64 40" aria-hidden="true"><text x="32" y="28" textAnchor="middle" fontSize="23" fontWeight="900" fontStyle="italic" fill="#fff" fontFamily="Arial Black, Arial, sans-serif" letterSpacing="-1">NIST</text></svg>;
}
export function PciLogo() {
  return <svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 2 5 8v11c0 10 6.5 16.5 15 19 8.5-2.5 15-9 15-19V8L20 2Z" fill="#e6e9f2" />
    <text x="20" y="22" textAnchor="middle" fontSize="10" fontWeight="900" fill="#0a1124" fontFamily="Arial, sans-serif">PCI</text><text x="20" y="29" textAnchor="middle" fontSize="5.5" fontWeight="700" fill="#c8102e" fontFamily="Arial, sans-serif">DSS</text></svg>;
}

export const FRAMEWORK_LOGOS: [string, JSX.Element][] = [
  ['ISO 27001', <IsoLogo />], ['SOC 2', <SocLogo />], ['LGPD', <LgpdLogo />], ['RGPD / GDPR', <EuLogo />],
  ['NIS2', <EuLogo label="NIS2" />], ['DORA', <EuLogo label="DORA" />], ['NIST CSF', <NistLogo />], ['ISO 27701', <IsoLogo />], ['PCI DSS', <PciLogo />], ['ISO 22301', <IsoLogo />],
];
