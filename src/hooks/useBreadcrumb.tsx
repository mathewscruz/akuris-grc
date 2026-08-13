import { useLocation } from 'react-router-dom';
import { useMemo, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { tGlobal } from '@/lib/i18n-global';

interface BreadcrumbItem {
  title: string;
  path: string;
}

function getRouteMap(): Record<string, string> {
  return {
    '/dashboard': tGlobal('sweepCore.breadcrumb.dashboard'),
    '/ativos': tGlobal('sweepCore.breadcrumb.ativos'),
    '/riscos': tGlobal('sweepCore.breadcrumb.riscos'),
    '/gap-analysis': tGlobal('sweepCore.breadcrumb.gapAnalysis'),
    '/gap-analysis/frameworks': tGlobal('sweepCore.breadcrumb.frameworks'),
    '/gap-analysis/avaliacao-aderencia': tGlobal('sweepCore.breadcrumb.avaliacaoAderencia'),
    '/controles': tGlobal('sweepCore.breadcrumb.controles'),
    '/auditorias': tGlobal('sweepCore.breadcrumb.auditorias'),
    '/contratos': tGlobal('sweepCore.breadcrumb.contratos'),
    '/documentos': tGlobal('sweepCore.breadcrumb.documentos'),
    '/contas-privilegiadas': tGlobal('sweepCore.breadcrumb.contasPrivilegiadas'),
    '/incidentes': tGlobal('sweepCore.breadcrumb.incidentes'),
    '/dados': tGlobal('sweepCore.breadcrumb.dados'),
    '/configuracoes': tGlobal('sweepCore.breadcrumb.configuracoes'),
    '/due-diligence': tGlobal('sweepCore.breadcrumb.dueDiligence'),
    '/denuncia': tGlobal('sweepCore.breadcrumb.denuncia'),
  };
}

export const useBreadcrumb = () => {
  const location = useLocation();
  const [frameworkName, setFrameworkName] = useState<string | null>(null);

  // Detect if we're on a framework detail page
  const frameworkMatch = location.pathname.match(/\/gap-analysis\/framework\/([a-f0-9-]+)/);
  const frameworkId = frameworkMatch?.[1];

  useEffect(() => {
    if (frameworkId) {
      supabase
        .from('gap_analysis_frameworks')
        .select('nome')
        .eq('id', frameworkId)
        .single()
        .then(({ data }) => {
          if (data) {
            setFrameworkName(data.nome);
          }
        });
    } else {
      setFrameworkName(null);
    }
  }, [frameworkId]);

  const breadcrumbs = useMemo(() => {
    const pathSegments = location.pathname.split('/').filter(Boolean);
    const items: BreadcrumbItem[] = [];

    // Always add Dashboard as first item if not on dashboard
    if (location.pathname !== '/dashboard') {
      items.push({ title: tGlobal('sweepCore.breadcrumb.dashboard'), path: '/dashboard' });
    }

    // Build breadcrumbs from path segments
    let currentPath = '';
    pathSegments.forEach((segment, index) => {
      currentPath += `/${segment}`;
      
      // Special handling for framework detail page
      if (segment === 'framework' && pathSegments[index + 1]) {
        items.push({ 
          title: frameworkName || tGlobal('sweepCore.breadcrumb.framework'), 
          path: currentPath + `/${pathSegments[index + 1]}` 
        });
        return; // Skip the next segment (the ID)
      }
      
      // Skip the framework ID segment
      if (pathSegments[index - 1] === 'framework' && segment.match(/^[a-f0-9-]+$/)) {
        return;
      }
      
      const title = getRouteMap()[currentPath] || segment.charAt(0).toUpperCase() + segment.slice(1);
      items.push({ title, path: currentPath });
    });

    return items;
  }, [location.pathname, frameworkName]);

  return breadcrumbs;
};