import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet';
import { AtivosIcon, RiscosIcon, IncidentesIcon, DocumentosIcon, DueDiligenceIcon, DenunciasIcon, ControlesIcon, IconView, IconExternal, IconInfo, IconArrowRight, IconScale, IconChecklist, IconKey, IconShieldCheck, IconActivity, IconLock, IconServer, IconChart, IconUserCheck } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/icons/Icon';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { logger } from '@/lib/logger';
import { formatDateShort, formatDateOnly, formatarDiaParaDB } from '@/lib/date-utils';
import { formatStatus } from '@/lib/text-utils';
import { useLanguage } from '@/contexts/LanguageContext';

/**
 * Limite superior da janela, em `YYYY-MM-DD`, para os recortes de "vencendo".
 * Formatado a partir dos componentes LOCAIS: `toISOString()` converte para UTC
 * primeiro e, a oeste de Greenwich, entrega o dia anterior.
 */
const emJanela = (dias: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return formatarDiaParaDB(d);
};

type TFunc = (key: string, params?: Record<string, string | number>) => string;

export type DrillDownKey =
  | 'ativos'
  | 'riscos'
  | 'incidentes'
  | 'planos'
  | 'contratos'
  | 'contratos-vencidos'
  | 'contratos-vencendo'
  | 'documentos'
  | 'due_diligence'
  | 'denuncias'
  | 'controles'
  | 'ativos_chaves'
  | 'ativos_licencas'
  | 'auditorias'
  | 'continuidade'
  | 'gap_analysis'
  | 'revisao_acessos'
  | 'privacidade'
  | 'riscos_aceite'
  | 'sistemas'
  | 'contas_privilegiadas';

interface DrillItem {
  id: string;
  title: string;
  subtitle?: string;
  status?: string;
  tone?: 'destructive' | 'warning' | 'success' | 'info' | 'neutral' | 'primary';
  date?: string;
}

interface DrillConfig {
  title: string;
  description: string;
  icon: React.ElementType;
  route: string;
  fetcher: (empresaId: string) => Promise<DrillItem[]>;
}

const fmtDate = (iso?: string | null) => {
  if (!iso) return undefined;
  try {
    return formatDateShort(iso);
  } catch {
    return undefined;
  }
};

const todayIso = () => new Date().toISOString().slice(0, 10);

const buildConfig = (key: DrillDownKey, t: TFunc): DrillConfig => {
  const d = (k: string) => t(`dashWidgets.drill.${k}`);
  switch (key) {
    case 'riscos':
      return {
        title: d('riscos.title'),
        description: d('riscos.description'),
        icon: RiscosIcon,
        route: '/riscos',
        fetcher: async (empresaId) => {
          const { data, error } = await supabase
            .from('riscos')
            .select('id, nome, nivel_risco_residual, nivel_risco_inicial, status, updated_at')
            .eq('empresa_id', empresaId)
            .eq('aceito', false)
            .order('updated_at', { ascending: false })
            .limit(20);
          if (error) throw error;
          const rank = (n?: string) => {
            const v = (n || '').toLowerCase();
            if (v.includes('crit')) return 4;
            if (v.includes('alt')) return 3;
            if (v.includes('med') || v.includes('méd')) return 2;
            if (v.includes('baix')) return 1;
            return 0;
          };
          return (data || [])
            .map((r: any) => ({ ...r, _nivel: r.nivel_risco_residual || r.nivel_risco_inicial }))
            .sort((a: any, b: any) => rank(b._nivel) - rank(a._nivel))
            .slice(0, 5)
            .map((r: any) => {
              const nivel = (r._nivel || '').toLowerCase();
              return {
                id: r.id,
                title: r.nome,
                subtitle: r.status,
                status: r._nivel || d('noLevel'),
                tone: (nivel.includes('crit') ? 'destructive' : nivel.includes('alt') ? 'warning' : nivel.includes('med') ? 'info' : 'neutral') as DrillItem['tone'],
                date: fmtDate(r.updated_at),
              };
            });
        },
      };
    case 'incidentes':
      return {
        title: d('incidentes.title'),
        description: d('incidentes.description'),
        icon: IncidentesIcon,
        route: '/incidentes',
        fetcher: async (empresaId) => {
          const { data, error } = await supabase
            .from('incidentes')
            .select('id, titulo, status, criticidade, created_at')
            .eq('empresa_id', empresaId)
            // O produto grava `aberto`, `em_investigacao`, `contido` e
            // `resolvido`. Desta lista, só `aberto` existe: a gaveta abria
            // vazia com dois incidentes em curso no banco.
            .in('status', ['aberto', 'em_investigacao', 'contido'])
            .order('created_at', { ascending: false })
            .limit(5);
          if (error) throw error;
          return (data || []).map((i: any) => {
            const c = (i.criticidade || '').toLowerCase();
            return {
              id: i.id,
              title: i.titulo,
              subtitle: i.status,
              status: i.criticidade,
              tone: (c.includes('crit') ? 'destructive' : c.includes('alt') ? 'warning' : 'info') as DrillItem['tone'],
              date: fmtDate(i.created_at),
            };
          });
        },
      };
    case 'planos':
      return {
        title: d('planos.title'),
        description: d('planos.description'),
        icon: IconChecklist,
        route: '/planos-acao',
        fetcher: async (empresaId) => {
          const { data, error } = await supabase
            .from('planos_acao')
            .select('id, titulo, status, prazo, created_at')
            .eq('empresa_id', empresaId)
            .neq('status', 'concluido')
            .order('prazo', { ascending: true, nullsFirst: false })
            .limit(5);
          if (error) throw error;
          const today = todayIso();
          return (data || []).map((p: any) => {
            const overdue = p.prazo && p.prazo < today;
            return {
              id: p.id,
              title: p.titulo,
              subtitle: p.status,
              status: overdue ? d('overdue') : p.status,
              tone: (overdue ? 'destructive' : 'info') as DrillItem['tone'],
              date: fmtDate(p.prazo),
            };
          });
        },
      };
    case 'ativos':
      return {
        title: d('ativos.title'),
        description: d('ativos.description'),
        icon: AtivosIcon,
        route: '/ativos',
        fetcher: async (empresaId) => {
          const { data, error } = await supabase
            .from('ativos')
            .select('id, nome, tipo, criticidade, updated_at')
            .eq('empresa_id', empresaId)
            .order('updated_at', { ascending: false })
            .limit(5);
          if (error) throw error;
          return (data || []).map((a: any) => ({
            id: a.id,
            title: a.nome,
            subtitle: a.tipo,
            status: a.criticidade,
            tone: a.criticidade === 'alta' ? 'warning' : 'neutral',
            date: fmtDate(a.updated_at),
          }));
        },
      };
    // As quatro KPIs de contratos abriam TODAS esta mesma lista: clicar em
    // "Valor vencido" (1 contrato) mostrava os cinco, incluindo rascunhos e
    // contratos que vencem no ano seguinte. Cada tile passa a abrir a lista
    // que o rótulo promete. E a data leva o ano — "03 de jul" não distingue
    // 2026 de 2027, que é a única pergunta num vencimento.
    case 'contratos':
    case 'contratos-vencidos':
    case 'contratos-vencendo': {
      const escopo = key;
      const rotulo =
        escopo === 'contratos-vencidos' ? 'contratosVencidos'
        : escopo === 'contratos-vencendo' ? 'contratosVencendo'
        : 'contratos';
      return {
        title: d(`${rotulo}.title`),
        description: d(`${rotulo}.description`),
        icon: IconScale,
        route: '/contratos',
        fetcher: async (empresaId) => {
          const { data, error } = await supabase
            .from('contratos')
            .select('id, nome, numero_contrato, status, data_fim')
            .eq('empresa_id', empresaId)
            .order('data_fim', { ascending: true, nullsFirst: false });
          if (error) throw error;
          const today = todayIso();
          const em30 = formatarDiaParaDB(new Date(Date.now() + 30 * 86400000));
          // Estados administrativos (rascunho, negociação, encerrado...) não
          // vencem: nunca entram nas listas de vencimento.
          const administra = (st: string) =>
            !['ativo', 'vigente'].includes((st || '').toLowerCase());
          const filtrado = (data || []).filter((c: any) => {
            if (escopo === 'contratos-vencidos') {
              return !administra(c.status) && c.data_fim && c.data_fim < today;
            }
            if (escopo === 'contratos-vencendo') {
              return !administra(c.status) && c.data_fim && c.data_fim >= today && c.data_fim <= em30;
            }
            return true;
          });
          return filtrado.slice(0, 5).map((c: any) => {
            const expired = c.data_fim && c.data_fim < today;
            return {
              id: c.id,
              title: c.nome || c.numero_contrato || d('fallbackContract'),
              subtitle: c.numero_contrato || c.status,
              status: expired ? d('expired') : c.status,
              tone: (expired ? 'destructive' : 'info') as DrillItem['tone'],
              date: formatDateOnly(c.data_fim),
            };
          });
        },
      };
    }
    case 'documentos':
      return {
        title: d('documentos.title'),
        description: d('documentos.description'),
        icon: DocumentosIcon,
        route: '/documentos',
        fetcher: async (empresaId) => {
          /*
            O painel promete um recorte no seu próprio subtítulo; a consulta
            trazia as primeiras N linhas da tabela. Um arquivado ou um rascunho
            aparecia em "vencendo", uma chave saudável em "próxima da rotação".
            Num painel de GRC isso enterra o que é problema no meio do que não é.
          */
          const { data, error } = await supabase
            .from('documentos')
            .select('id, nome, status, data_vencimento')
            .eq('empresa_id', empresaId)
            // O estado gravado é `pendente`; `pendente_aprovacao` não existe
            // numa única linha — três linhas abaixo o mesmo bloco já o tratava.
            .or(`status.eq.pendente,and(status.eq.ativo,data_vencimento.lte.${emJanela(30)})`)
            .order('data_vencimento', { ascending: true, nullsFirst: false })
            .limit(5);
          if (error) throw error;
          return (data || []).map((d: any) => ({
            id: d.id,
            title: d.nome,
            subtitle: d.status,
            status: d.status,
            tone: (d.status === 'pendente' || d.status === 'pendente_aprovacao' ? 'warning' : 'info') as DrillItem['tone'],
            date: fmtDate(d.data_vencimento),
          }));
        },
      };
    case 'due_diligence':
      return {
        title: d('due_diligence.title'),
        description: d('due_diligence.description'),
        icon: DueDiligenceIcon,
        route: '/due-diligence',
        fetcher: async (empresaId) => {
          const { data, error } = await supabase
            .from('due_diligence_assessments')
            .select('id, fornecedor_nome, status, score_final, updated_at')
            .eq('empresa_id', empresaId)
            .neq('status', 'concluido')
            .order('updated_at', { ascending: false })
            .limit(5);
          if (error) throw error;
          return (data || []).map((d: any) => {
            const score = d.score_final;
            return {
              id: d.id,
              title: d.fornecedor_nome,
              subtitle: d.status,
              status: typeof score === 'number' ? t('dashWidgets.drill.score', { value: score }) : undefined,
              tone: (typeof score !== 'number' ? 'neutral' : score < 50 ? 'destructive' : score < 70 ? 'warning' : 'success') as DrillItem['tone'],
              date: fmtDate(d.updated_at),
            };
          });
        },
      };
    case 'denuncias':
      return {
        title: d('denuncias.title'),
        description: d('denuncias.description'),
        icon: DenunciasIcon,
        route: '/denuncia',
        fetcher: async (empresaId) => {
          const { data, error } = await supabase
            .from('denuncias')
            .select('id, protocolo, titulo, gravidade, status, created_at')
            .eq('empresa_id', empresaId)
            .in('status', ['nova', 'novas', 'em_investigacao', 'em_andamento'])
            .order('created_at', { ascending: false })
            .limit(5);
          if (error) throw error;
          return (data || []).map((d: any) => {
            const g = (d.gravidade || '').toLowerCase();
            return {
              id: d.id,
              title: d.titulo || d.protocolo || t('dashWidgets.drill.fallbackComplaint'),
              subtitle: d.protocolo,
              status: d.gravidade || d.status,
              tone: (g.includes('crit') || g.includes('alt') ? 'destructive' : 'warning') as DrillItem['tone'],
              date: fmtDate(d.created_at),
            };
          });
        },
      };
    case 'controles':
      return {
        title: d('controles.title'),
        description: d('controles.description'),
        icon: ControlesIcon,
        route: '/controles',
        fetcher: async (empresaId) => {
          const { data, error } = await supabase
            .from('controles')
            .select('id, nome, codigo, status, criticidade, proxima_avaliacao')
            .eq('empresa_id', empresaId)
            .eq('status', 'ativo')
            .order('criticidade', { ascending: false })
            .limit(5);
          if (error) throw error;
          return (data || []).map((c: any) => {
            const cr = (c.criticidade || '').toLowerCase();
            return {
              id: c.id,
              title: c.nome,
              subtitle: c.codigo || c.status,
              status: c.criticidade || c.status,
              tone: (cr.includes('alt') || cr.includes('crit') ? 'warning' : 'info') as DrillItem['tone'],
              date: fmtDate(c.proxima_avaliacao),
            };
          });
        },
      };

    // ── Novos módulos ──────────────────────────────────────────────────────
    case 'ativos_chaves':
      return {
        title: d('ativos_chaves.title'),
        description: d('ativos_chaves.description'),
        icon: IconKey,
        route: '/ativos/chaves',
        fetcher: async (empresaId) => {
          const { data, error } = await supabase
            .from('ativos_chaves_criptograficas')
            .select('id, nome, tipo_chave, criticidade, data_proxima_rotacao')
            .eq('empresa_id', empresaId)
            .lte('data_proxima_rotacao', emJanela(30))
            .order('data_proxima_rotacao', { ascending: true, nullsFirst: false })
            .limit(5);
          if (error) throw error;
          const today = todayIso();
          return (data || []).map((c: any) => {
            const overdue = c.data_proxima_rotacao && c.data_proxima_rotacao < today;
            return {
              id: c.id,
              title: c.nome,
              subtitle: c.tipo_chave,
              status: overdue ? d('rotationOverdue') : c.criticidade,
              tone: (overdue ? 'destructive' : c.criticidade === 'alta' ? 'warning' : 'neutral') as DrillItem['tone'],
              date: fmtDate(c.data_proxima_rotacao),
            };
          });
        },
      };
    case 'ativos_licencas':
      return {
        title: d('ativos_licencas.title'),
        description: d('ativos_licencas.description'),
        icon: IconKey,
        route: '/ativos/licencas',
        fetcher: async (empresaId) => {
          const { data, error } = await supabase
            .from('ativos_licencas')
            .select('id, nome, tipo_licenca, criticidade, data_vencimento')
            .eq('empresa_id', empresaId)
            .lte('data_vencimento', emJanela(30))
            .order('data_vencimento', { ascending: true, nullsFirst: false })
            .limit(5);
          if (error) throw error;
          const today = todayIso();
          return (data || []).map((l: any) => {
            const expired = l.data_vencimento && l.data_vencimento < today;
            return {
              id: l.id,
              title: l.nome,
              subtitle: l.tipo_licenca,
              status: expired ? d('expiredFem') : l.criticidade,
              tone: (expired ? 'destructive' : l.criticidade === 'alta' ? 'warning' : 'info') as DrillItem['tone'],
              date: fmtDate(l.data_vencimento),
            };
          });
        },
      };
    case 'auditorias':
      return {
        title: d('auditorias.title'),
        description: d('auditorias.description'),
        icon: IconChecklist,
        route: '/governanca/auditorias',
        fetcher: async (empresaId) => {
          // `auditoria_trabalhos` tem ZERO linhas em todo o produto — a gaveta
          // dos quatro KPIs de Auditorias abria sempre vazia. O que os KPIs
          // contam são as auditorias em si.
          const { data, error } = await supabase
            .from('auditorias')
            .select('id, nome, tipo, status, data_inicio')
            .eq('empresa_id', empresaId)
            .neq('status', 'concluida')
            .order('data_inicio', { ascending: true, nullsFirst: false })
            .limit(5);
          if (error) throw error;
          return (data || []).map((a: any) => ({
            id: a.id,
            title: a.nome,
            subtitle: a.tipo,
            status: a.status,
            tone: (a.status === 'em_andamento' ? 'info' : 'warning') as DrillItem['tone'],
            date: fmtDate(a.data_inicio),
          }));
        },
      };
    case 'continuidade':
      return {
        title: d('continuidade.title'),
        description: d('continuidade.description'),
        icon: IconShieldCheck,
        route: '/continuidade',
        fetcher: async (empresaId) => {
          const { data, error } = await supabase
            .from('continuidade_planos')
            .select('id, nome, tipo, status, proxima_revisao')
            .eq('empresa_id', empresaId)
            .lte('proxima_revisao', emJanela(30))
            .order('proxima_revisao', { ascending: true, nullsFirst: false })
            .limit(5);
          if (error) throw error;
          const today = todayIso();
          return (data || []).map((p: any) => {
            const overdue = p.proxima_revisao && p.proxima_revisao < today;
            return {
              id: p.id,
              title: p.nome,
              subtitle: p.tipo,
              status: overdue ? d('reviewOverdue') : p.status,
              tone: (overdue ? 'destructive' : 'info') as DrillItem['tone'],
              date: fmtDate(p.proxima_revisao),
            };
          });
        },
      };
    case 'gap_analysis':
      return {
        title: d('gap_analysis.title'),
        description: d('gap_analysis.description'),
        icon: IconChart,
        route: '/gap-analysis/frameworks',
        fetcher: async (empresaId) => {
          // Lista os 5 frameworks com mais avaliações da empresa
          const { data, error } = await supabase
            .from('gap_analysis_evaluations')
            .select('framework_id, gap_analysis_frameworks!inner(id, nome, versao, tipo_framework)')
            .eq('empresa_id', empresaId)
            .limit(50);
          if (error) throw error;
          const counts = new Map<string, { fw: any; n: number }>();
          (data || []).forEach((row: any) => {
            const fw = row.gap_analysis_frameworks;
            if (!fw) return;
            const cur = counts.get(fw.id) || { fw, n: 0 };
            cur.n += 1;
            counts.set(fw.id, cur);
          });
          return Array.from(counts.values())
            .sort((a, b) => b.n - a.n)
            .slice(0, 5)
            .map(({ fw, n }) => ({
              id: fw.id,
              title: `${fw.nome} ${fw.versao || ''}`.trim(),
              subtitle: fw.tipo_framework,
              status: t('dashWidgets.drill.evaluationsCount', { count: n }),
              tone: 'info' as DrillItem['tone'],
            }));
        },
      };
    case 'revisao_acessos':
      return {
        title: d('revisao_acessos.title'),
        description: d('revisao_acessos.description'),
        icon: IconUserCheck,
        route: '/revisao-acessos',
        fetcher: async (empresaId) => {
          const { data, error } = await supabase
            .from('access_reviews')
            .select('id, nome_revisao, status, data_limite, total_contas')
            .eq('empresa_id', empresaId)
            .neq('status', 'concluida')
            .order('data_limite', { ascending: true, nullsFirst: false })
            .limit(5);
          if (error) throw error;
          const today = todayIso();
          return (data || []).map((r: any) => {
            const overdue = r.data_limite && r.data_limite < today;
            return {
              id: r.id,
              title: r.nome_revisao,
              subtitle: t('dashWidgets.drill.accountsCount', { count: r.total_contas || 0 }),
              status: overdue ? d('overdueFem') : r.status,
              tone: (overdue ? 'destructive' : 'warning') as DrillItem['tone'],
              date: fmtDate(r.data_limite),
            };
          });
        },
      };
    case 'privacidade':
      return {
        title: d('privacidade.title'),
        description: d('privacidade.description'),
        icon: IconView,
        route: '/privacidade',
        fetcher: async (empresaId) => {
          const { data, error } = await supabase
            .from('dados_solicitacoes_titular')
            .select('id, tipo_solicitacao, status, prazo_resposta')
            .eq('empresa_id', empresaId)
            .neq('status', 'concluida')
            .order('prazo_resposta', { ascending: true, nullsFirst: false })
            .limit(5);
          if (error) throw error;
          const today = todayIso();
          return (data || []).map((s: any) => {
            const overdue = s.prazo_resposta && s.prazo_resposta < today;
            return {
              id: s.id,
              title: s.tipo_solicitacao,
              subtitle: s.status,
              status: overdue ? d('deadlineExpired') : s.status,
              tone: (overdue ? 'destructive' : 'warning') as DrillItem['tone'],
              date: fmtDate(s.prazo_resposta),
            };
          });
        },
      };
    case 'riscos_aceite':
      return {
        title: d('riscos_aceite.title'),
        description: d('riscos_aceite.description'),
        icon: IconActivity,
        route: '/riscos/aceite',
        fetcher: async (empresaId) => {
          const { data, error } = await supabase
            .from('riscos')
            .select('id, nome, nivel_risco_residual, nivel_risco_inicial, data_proxima_revisao')
            .eq('empresa_id', empresaId)
            .eq('aceito', true)
            .order('data_proxima_revisao', { ascending: true, nullsFirst: false })
            .limit(5);
          if (error) throw error;
          const today = todayIso();
          return (data || []).map((r: any) => {
            const overdue = r.data_proxima_revisao && r.data_proxima_revisao < today;
            return {
              id: r.id,
              title: r.nome,
              subtitle: r.nivel_risco_residual || r.nivel_risco_inicial,
              status: overdue ? d('reviewExpired') : d('activeAcceptance'),
              tone: (overdue ? 'destructive' : 'info') as DrillItem['tone'],
              date: fmtDate(r.data_proxima_revisao),
            };
          });
        },
      };
    case 'sistemas':
      return {
        title: d('sistemas.title'),
        description: d('sistemas.description'),
        icon: IconServer,
        route: '/sistemas',
        fetcher: async (empresaId) => {
          const { data, error } = await (supabase
            .from('sistemas_privilegiados' as any)
            .select('id, nome_sistema, tipo_sistema, criticidade, ativo, updated_at') as any)
            .eq('empresa_id', empresaId)
            .order('criticidade', { ascending: false })
            .limit(5);
          if (error) throw error;
          return (data || []).map((s: any) => ({
            id: s.id,
            title: s.nome_sistema,
            subtitle: s.tipo_sistema,
            status: s.criticidade,
            tone: (s.criticidade === 'alta' ? 'warning' : 'info') as DrillItem['tone'],
            date: fmtDate(s.updated_at),
          }));
        },
      };
    case 'contas_privilegiadas':
      return {
        title: d('contas_privilegiadas.title'),
        description: d('contas_privilegiadas.description'),
        icon: IconLock,
        route: '/contas-privilegiadas',
        fetcher: async (empresaId) => {
          const { data, error } = await (supabase
            .from('contas_privilegiadas' as any)
            .select('id, usuario_beneficiario, nivel_privilegio, status, data_expiracao') as any)
            .eq('empresa_id', empresaId)
            .order('data_expiracao', { ascending: true, nullsFirst: false })
            .limit(5);
          if (error) throw error;
          const today = todayIso();
          return (data || []).map((c: any) => {
            const expired = c.data_expiracao && c.data_expiracao < today;
            return {
              id: c.id,
              title: c.usuario_beneficiario,
              subtitle: c.nivel_privilegio,
              status: expired ? d('expired') : c.status,
              tone: (expired ? 'destructive' : 'warning') as DrillItem['tone'],
              date: fmtDate(c.data_expiracao),
            };
          });
        },
      };
    default:
      return {
        title: d('fallback.title'),
        description: d('fallback.description'),
        icon: IconInfo,
        route: '/dashboard',
        fetcher: async () => [],
      };
  }
};

interface KpiDrillDownDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kpiKey: DrillDownKey | null;
}

export const KpiDrillDownDrawer: React.FC<KpiDrillDownDrawerProps> = ({ open, onOpenChange, kpiKey }) => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { t } = useLanguage();
  const empresaId = profile?.empresa_id;

  const config = React.useMemo(() => (kpiKey ? buildConfig(kpiKey, t) : null), [kpiKey, t]);

  const { data: items, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['drill-down', kpiKey, empresaId],
    queryFn: async () => {
      if (!config || !empresaId) return [];
      try {
        return await config.fetcher(empresaId);
      } catch (e) {
        logger.error('drill-down fetch failed', e);
        throw e;
      }
    },
    enabled: open && !!config && !!empresaId,
    staleTime: 30_000,
  });

  if (!config) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col">
        <SheetHeader>
          <div className="flex items-center gap-3">
            <Icon as={config.icon as any} size="md" className="shrink-0 text-primary" />
            <div className="min-w-0">
              <SheetTitle className="truncate">{config.title}</SheetTitle>
              <SheetDescription className="text-xs">{config.description}</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-y-auto -mx-6 px-6 py-4 space-y-2">
          {isLoading && (
            <div className="min-h-[200px] flex flex-col items-center justify-center gap-2">
              <AkurisPulse size={48} />
              <p className="text-xs text-muted-foreground">{t('dashWidgets.drill.loading')}</p>
            </div>
          )}
          {isError && (
            <div className="flex flex-col items-center gap-3 py-8">
              <EmptyState
                title={t('dashWidgets.drill.errorTitle')}
                description={t('dashWidgets.drill.errorDescription')}
                icon={<Icon as={IconInfo} size="lg" />}
              />
              <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
                {isFetching ? t('dashWidgets.drill.retrying') : t('dashWidgets.drill.retry')}
              </Button>
            </div>
          )}
          {!isLoading && !isError && (items?.length ?? 0) === 0 && (
            <EmptyState
              title={t('dashWidgets.drill.emptyTitle')}
              description={t('dashWidgets.drill.emptyDescription')}
              icon={<Icon as={config.icon as any} size="lg" />}
              variant="illustrated"
            />
          )}
          {!isLoading &&
            !isError &&
            items?.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  onOpenChange(false);
                  navigate(`${config.route}?focus=${item.id}`);
                }}
                className="w-full text-left p-3 rounded-lg border bg-card hover:bg-accent/50 hover:border-primary/30 transition-ui flex items-start justify-between gap-3 group"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-foreground truncate">{item.title}</div>
                  <div className="mt-1 flex items-center gap-2 flex-wrap">
                    {item.status && (
                      <StatusBadge tone={item.tone ?? 'neutral'} variant="soft">
                        {formatStatus(item.status)}
                      </StatusBadge>
                    )}
                    {item.date && (
                      <span className="text-micro text-muted-foreground tabular-nums">{item.date}</span>
                    )}
                  </div>
                </div>
                <Icon
                  as={IconExternal}
                  size="sm"
                  className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5"
                />
              </button>
            ))}
        </div>

        <SheetFooter>
          <Button
            variant="default"
            className="w-full"
            onClick={() => {
              onOpenChange(false);
              navigate(config.route);
            }}
          >
            {t('dashWidgets.drill.viewAll')}
            <Icon as={IconArrowRight} size="sm" className="ml-2" />
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};

