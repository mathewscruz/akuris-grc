// Prefetch map: route path → lazy import function
// Matches the lazy imports in App.tsx
const prefetchMap: Record<string, () => Promise<unknown>> = {
  '/dashboard': () => import('@/pages/Dashboard'),
  '/planos-acao': () => import('@/pages/PlanosAcao'),
  '/ativos': () => import('@/pages/Ativos'),
  '/ativos/licencas': () => import('@/pages/AtivosLicencas'),
  '/ativos/chaves': () => import('@/pages/AtivosChaves'),
  '/riscos': () => import('@/pages/Riscos'),
  '/riscos/aceite': () => import('@/pages/RiscosAceite'),
  '/gap-analysis/frameworks': () => import('@/pages/GapAnalysisFrameworks'),
  '/governanca': () => import('@/pages/Governanca'),
  '/sistemas': () => import('@/pages/Sistemas'),
  '/contratos': () => import('@/pages/Contratos'),
  '/documentos': () => import('@/pages/Documentos'),
  '/contas-privilegiadas': () => import('@/pages/ContasPrivilegiadas'),
  '/revisao-acessos': () => import('@/pages/RevisaoAcessos'),
  '/incidentes': () => import('@/pages/Incidentes'),
  '/privacidade': () => import('@/pages/Privacidade'),
  '/due-diligence': () => import('@/pages/DueDiligence'),
  '/denuncia': () => import('@/pages/Denuncia'),
  
  '/continuidade': () => import('@/pages/Continuidade'),
  '/relatorios': () => import('@/pages/Relatorios'),
  '/configuracoes': () => import('@/pages/Configuracoes'),
};

const prefetched = new Set<string>();

export function prefetchRoute(path: string) {
  if (prefetched.has(path)) return;
  const loader = prefetchMap[path];
  if (loader) {
    prefetched.add(path);
    loader().catch(() => prefetched.delete(path));
  }
}
