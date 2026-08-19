/**
 * Migalhas de pão da aplicação.
 *
 * Regras:
 *  - cada segmento do URL é traduzido a partir de um mapa de rotas (nunca o
 *    slug cru do endereço);
 *  - segmentos que são identificadores (UUID) são resolvidos para o nome real
 *    do registo através do registo único de entidades (`entity-search.ts`);
 *  - enquanto o nome não chega, mostra-se o rótulo do tipo (ex.: "Projeto"),
 *    nunca o UUID.
 */
import { useLocation } from 'react-router-dom';
import { useMemo, useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import { fetchEntityById, type EntityKey } from '@/lib/entity-search';
import { logger } from '@/lib/logger';

interface BreadcrumbItem {
  title: string;
  path: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Rotas com rótulo próprio. A chave é o caminho acumulado. */
function getRouteMap(t: (k: string) => string): Record<string, string> {
  return {
    '/dashboard': t('sweepCore.breadcrumb.dashboard'),
    '/planos-acao': t('p3Breadcrumbs.routes.planosAcao'),
    '/projetos': t('p3Breadcrumbs.routes.projetos'),
    '/projetos/minhas-tarefas': t('p3Breadcrumbs.routes.minhasTarefas'),
    '/projetos/templates': t('p3Breadcrumbs.routes.templates'),
    '/relatorios': t('p3Breadcrumbs.routes.relatorios'),
    '/ativos': t('sweepCore.breadcrumb.ativos'),
    '/ativos/licencas': t('p3Breadcrumbs.routes.licencas'),
    '/ativos/chaves': t('p3Breadcrumbs.routes.chaves'),
    '/riscos': t('sweepCore.breadcrumb.riscos'),
    '/continuidade': t('p3Breadcrumbs.routes.continuidade'),
    '/gap-analysis': t('sweepCore.breadcrumb.gapAnalysis'),
    '/gap-analysis/frameworks': t('sweepCore.breadcrumb.frameworks'),
    '/gap-analysis/avaliacao-aderencia': t('sweepCore.breadcrumb.avaliacaoAderencia'),
    '/governanca': t('p3Breadcrumbs.routes.governanca'),
    '/governanca/controles': t('sweepCore.breadcrumb.controles'),
    '/governanca/auditorias': t('sweepCore.breadcrumb.auditorias'),
    '/sistemas': t('p3Breadcrumbs.routes.sistemas'),
    '/controles': t('sweepCore.breadcrumb.controles'),
    '/auditorias': t('sweepCore.breadcrumb.auditorias'),
    '/contratos': t('sweepCore.breadcrumb.contratos'),
    '/documentos': t('sweepCore.breadcrumb.documentos'),
    '/contas-privilegiadas': t('sweepCore.breadcrumb.contasPrivilegiadas'),
    '/incidentes': t('sweepCore.breadcrumb.incidentes'),
    '/privacidade': t('p3Breadcrumbs.routes.privacidade'),
    '/dados': t('sweepCore.breadcrumb.dados'),
    '/due-diligence': t('sweepCore.breadcrumb.dueDiligence'),
    '/revisao-acessos': t('p3Breadcrumbs.routes.revisaoAcessos'),
    '/denuncia': t('sweepCore.breadcrumb.denuncia'),
    '/configuracoes': t('sweepCore.breadcrumb.configuracoes'),
  };
}

/**
 * Dado o segmento anterior, indica que tipo de registo o UUID representa.
 * `null` significa "resolver via tabela dedicada" (tratado à parte).
 */
function entityKeyForParent(parent: string | undefined): EntityKey | null {
  switch (parent) {
    case 'projetos':
      return 'projeto';
    case 'riscos':
      return 'risco';
    case 'documentos':
      return 'documento';
    case 'contratos':
      return 'contrato';
    case 'incidentes':
      return 'incidente';
    case 'ativos':
      return 'ativo';
    case 'auditorias':
      return 'auditoria';
    case 'due-diligence':
      return 'due_diligence';
    case 'denuncia':
      return 'denuncia';
    case 'planos-acao':
      return 'plano_acao';
    default:
      return null;
  }
}

function fallbackLabelFor(parent: string | undefined, t: (k: string) => string): string {
  const key = entityKeyForParent(parent);
  const map: Partial<Record<EntityKey, string>> = {
    projeto: t('p3Breadcrumbs.entities.projeto'),
    risco: t('p3Breadcrumbs.entities.risco'),
    documento: t('p3Breadcrumbs.entities.documento'),
    contrato: t('p3Breadcrumbs.entities.contrato'),
    incidente: t('p3Breadcrumbs.entities.incidente'),
    ativo: t('p3Breadcrumbs.entities.ativo'),
    auditoria: t('p3Breadcrumbs.entities.auditoria'),
    due_diligence: t('p3Breadcrumbs.entities.dueDiligence'),
    denuncia: t('p3Breadcrumbs.entities.denuncia'),
    plano_acao: t('p3Breadcrumbs.entities.planoAcao'),
  };
  return (key && map[key]) || t('p3Breadcrumbs.entities.registo');
}

export const useBreadcrumb = () => {
  const location = useLocation();
  const { t, locale } = useLanguage();
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id ?? null;
  const [resolved, setResolved] = useState<Record<string, string>>({});

  const pathSegments = useMemo(
    () => location.pathname.split('/').filter(Boolean),
    [location.pathname],
  );

  // Resolve nomes reais para os segmentos que são identificadores.
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const updates: Record<string, string> = {};

      for (let i = 0; i < pathSegments.length; i++) {
        const segment = pathSegments[i];
        if (!UUID_RE.test(segment)) continue;

        const parent = pathSegments[i - 1];

        try {
          // Frameworks de Gap Analysis vivem numa tabela global própria.
          if (parent === 'framework') {
            const { data } = await supabase
              .from('gap_analysis_frameworks')
              .select('nome')
              .eq('id', segment)
              .maybeSingle();
            if (data?.nome) updates[segment] = data.nome;
            continue;
          }

          const key = entityKeyForParent(parent);
          if (!key) continue;
          const row = await fetchEntityById(key, segment, empresaId);
          if (row?.titulo) updates[segment] = row.titulo;
        } catch (error) {
          logger.debug('Falha ao resolver migalha de pão', { segment, error });
        }
      }

      if (!cancelled && Object.keys(updates).length > 0) {
        setResolved((prev) => ({ ...prev, ...updates }));
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [pathSegments, empresaId]);

  const breadcrumbs = useMemo(() => {
    const routeMap = getRouteMap(t);
    const items: BreadcrumbItem[] = [];

    if (location.pathname !== '/dashboard') {
      items.push({ title: t('sweepCore.breadcrumb.dashboard'), path: '/dashboard' });
    }

    let currentPath = '';
    pathSegments.forEach((segment, index) => {
      currentPath += `/${segment}`;

      // "framework" é apenas um conector do URL: o rótulo vem do registo.
      if (segment === 'framework') return;

      if (UUID_RE.test(segment)) {
        const parent = pathSegments[index - 1];
        items.push({
          title: resolved[segment] || fallbackLabelFor(parent, t),
          path: currentPath,
        });
        return;
      }

      const title = routeMap[currentPath];
      if (title) {
        items.push({ title, path: currentPath });
        return;
      }

      // Último recurso: rótulo derivado do segmento, sem hífenes nem slug cru.
      items.push({
        title: segment
          .split('-')
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' '),
        path: currentPath,
      });
    });

    return items;
  }, [location.pathname, pathSegments, resolved, t, locale]);

  return breadcrumbs;
};
