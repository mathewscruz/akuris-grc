import React, { useMemo } from 'react';
import { IconWarning, IconCalendar, IconFile, IconShield, IconUsers, IconOrg, IconMessage } from '@/components/icons';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useNavigate } from 'react-router-dom';
import { isToday, isYesterday } from 'date-fns';
import { ptBR, enUS } from 'date-fns/locale';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatStatus } from '@/lib/text-utils';
import { intlLocale } from '@/lib/date-utils';
import { getEnumLabel } from '@/lib/enum-labels';
import { useQuery } from '@tanstack/react-query';

import { dateFnsLocale } from '@/lib/date-utils';

interface Activity {
  id: string;
  /**
   * O id do REGISTO, não o da linha do feed.
   *
   * Sem ele o clique só sabia o módulo e largava a pessoa na lista inteira,
   * para reencontrar à mão o item em que acabara de clicar. O `record_id` já
   * vinha da consulta a `audit_logs` e era deitado fora; nas criações, o id
   * estava embutido na string `risco-<uuid>` e também não era usado.
   */
  recordId: string;
  type: string;
  title: string;
  description: string;
  created_at: string;
  module: string;
  iconName: string;
  status?: string;
  isSeverity?: boolean;
}

/**
 * O ícone diz de que MÓDULO é a linha — nada mais.
 *
 * Cada um tinha a sua cor: riscos em `text-destructive`, auditorias e denúncias
 * em `text-warning`, documentos em `text-info`. Num feed em que a maioria das
 * linhas é de riscos, isso enchia o cartão de triângulos vermelhos iguais — um
 * risco criado, um risco actualizado e um risco apagado, todos com o mesmo
 * alarme. A cor de severidade fica onde tem significado: no selo, à direita,
 * que vem do dado e não do módulo.
 */
const getIcon = (module: string) => {
  const cls = 'h-4 w-4 text-muted-foreground';
  switch (module) {
    case 'riscos': return <IconWarning className={cls} strokeWidth={1.5} />;
    case 'controles': return <IconShield className={cls} strokeWidth={1.5} />;
    case 'documentos': return <IconFile className={cls} strokeWidth={1.5} />;
    case 'auditorias': return <IconCalendar className={cls} strokeWidth={1.5} />;
    case 'usuarios': return <IconUsers className={cls} strokeWidth={1.5} />;
    case 'contratos': return <IconOrg className={cls} strokeWidth={1.5} />;
    case 'denuncias': return <IconMessage className={cls} strokeWidth={1.5} />;
    default: return <IconFile className={cls} strokeWidth={1.5} />;
  }
};

type BadgeVariant = "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info" | "neutral";

/** Apenas o tom visual; o rótulo vem de formatStatus (sensível ao idioma). */
const statusVariantMap: Record<string, BadgeVariant> = {
  'critico': 'destructive',
  'alto': 'destructive',
  'medio': 'warning',
  'médio': 'warning',
  'baixo': 'success',
  'ativo': 'success',
  'inativo': 'neutral',
  'vencido': 'destructive',
  'em_avaliacao': 'warning',
  'pendente': 'warning',
  'pendente_aprovacao': 'warning',
  'aprovado': 'success',
  'rejeitado': 'destructive',
  'planejada': 'warning',
  'em_andamento': 'info',
  'em_analise': 'info',
  'em_investigacao': 'info',
  'concluida': 'success',
  'concluído': 'success',
  'concluido': 'success',
  'cancelada': 'neutral',
  'nova': 'info',
  'resolvida': 'success',
  'arquivada': 'neutral',
};

const getStatusBadge = (status: string | undefined, t: (key: string) => string, isSeverity: boolean) => {
  if (!status) return null;
  const normalizedStatus = status.toLowerCase().trim();
  const variant = statusVariantMap[normalizedStatus] || 'outline';
  const label = isSeverity ? getEnumLabel(t, 'severidade', status) : formatStatus(status);
  return (
    <Badge variant={variant} className="text-micro px-1.5 py-0 whitespace-nowrap">
      {label}
    </Badge>
  );
};

/**
 * Campos cuja mudança vale a pena contar no feed, por ordem de interesse.
 *
 * A trilha guarda a linha inteira; a maior parte das colunas que mudam num
 * UPDATE (`updated_at`, ids, carimbos) não interessa a ninguém. Estas são as
 * que mudam o que uma pessoa faz a seguir.
 */
const CAMPOS_QUE_IMPORTAM = [
  'nivel_risco_residual',
  'nivel_risco_inicial',
  'status',
  'criticidade',
  'responsavel_id',
  'proxima_avaliacao',
  'prazo',
] as const;

/**
 * O que muda em quase todo o UPDATE e não conta nada a ninguém.
 *
 * Sem esta lista, o campo escolhido para a frase seria quase sempre
 * `updated_at` — que é a mesma informação que a hora já dá ao lado.
 */
const RUIDO = new Set([
  'updated_at',
  'created_at',
  'id',
  'empresa_id',
  'created_by',
  'updated_by',
  'search_vector',
]);

/**
 * O nome do campo com rótulo, nunca o nome da coluna.
 *
 * `formatStatus('codigo')` devolvia "Codigo" — sem acento, porque é o
 * identificador do banco a passar por um capitalizador. Quem escolheu esse
 * nome foi o sistema, não o utilizador: tem de sair traduzido. Sem rótulo
 * definido, o campo não entra na frase (melhor "Registro atualizado" do que
 * "Search_vector alterado").
 */
function rotuloDoCampo(
  campo: string,
  t: (key: string, vars?: Record<string, unknown>) => string,
): string | null {
  const rotulo = t(`activities.campo.${campo}`);
  return rotulo && rotulo !== `activities.campo.${campo}` ? rotulo : null;
}

/** "Crítico → Alto" em vez de "Registro atualizado". */
function descreverMudanca(
  antes: Record<string, unknown> | null,
  depois: Record<string, unknown> | null,
  t: (key: string, vars?: Record<string, unknown>) => string,
): string {
  if (!antes || !depois) return t('activities.recordUpdated');

  /*
    Primeiro os campos que mudam o que a pessoa faz a seguir; se nenhum deles
    mexeu, qualquer outro campo real serve — é sempre mais útil do que
    "Registro atualizado". Só o ruído fica de fora.
  */
  const candidatos: string[] = [
    ...CAMPOS_QUE_IMPORTAM,
    ...Object.keys(depois).filter(
      (k) => !RUIDO.has(k) && !CAMPOS_QUE_IMPORTAM.includes(k as never),
    ),
  ];

  for (const campo of candidatos) {
    const de = antes[campo];
    const para = depois[campo];
    if (de === para) continue;
    // Objetos e listas não cabem numa linha de feed.
    if (typeof para === 'object' && para !== null) continue;
    if (typeof de === 'object' && de !== null) continue;
    // Campo que passou a ter valor (ou deixou de ter) conta como preenchimento,
    // não como transição — "— → Ana" leria mal.
    const rotulo = rotuloDoCampo(campo, t);
    if (!rotulo) continue;
    if (de == null || de === '') {
      if (para == null || para === '') continue;
      return t('activities.fieldSet', { campo: rotulo, valor: formatStatus(String(para)) });
    }
    if (para == null || para === '') continue;
    return t('activities.fieldChanged', {
      campo: rotulo,
      de: formatStatus(String(de)),
      para: formatStatus(String(para)),
    });
  }
  return t('activities.recordUpdated');
}

/**
 * Só estas tabelas têm trigger de auditoria hoje. Alargar a cobertura às
 * restantes (documentos, incidentes, denúncias, contratos, fornecedores)
 * exige uma migration — enquanto isso, o feed mostra alterações apenas destas.
 */
const AUDIT_TABLE_TO_MODULE: Record<string, { module: string; iconName: string }> = {
  riscos: { module: 'riscos', iconName: 'riscos' },
  controles: { module: 'controles', iconName: 'controles' },
  ativos: { module: 'ativos', iconName: 'ativos' },
  auditorias: { module: 'auditorias', iconName: 'auditorias' },
};

async function fetchActivities(empresaId: string, t: any): Promise<Activity[]> {
  const activities: Activity[] = [];

  const [riscosRes, controlesRes, documentosRes, auditoriasRes, denunciasRes] = await Promise.all([
    supabase.from('riscos').select('id, nome, nivel_risco_inicial, nivel_risco_residual, created_at').eq('empresa_id', empresaId).order('created_at', { ascending: false }).limit(3),
    supabase.from('controles').select('id, nome, status, created_at').eq('empresa_id', empresaId).order('created_at', { ascending: false }).limit(3),
    supabase.from('documentos').select('id, nome, status, created_at').eq('empresa_id', empresaId).order('created_at', { ascending: false }).limit(3),
    supabase.from('auditorias').select('id, nome, status, created_at').eq('empresa_id', empresaId).order('created_at', { ascending: false }).limit(2),
    supabase.from('denuncias').select('id, titulo, status, created_at').eq('empresa_id', empresaId).order('created_at', { ascending: false }).limit(2),
  ]);

  riscosRes.data?.forEach(r => activities.push({ id: `risco-${r.id}`, recordId: r.id, type: 'creation', title: r.nome, description: t('activities.newRisk'), created_at: r.created_at, module: 'riscos', iconName: 'riscos', status: r.nivel_risco_residual || r.nivel_risco_inicial, isSeverity: true }));
  controlesRes.data?.forEach(c => activities.push({ id: `controle-${c.id}`, recordId: c.id, type: 'creation', title: c.nome, description: t('activities.newControl'), created_at: c.created_at, module: 'controles', iconName: 'controles', status: c.status }));
  documentosRes.data?.forEach(d => activities.push({ id: `documento-${d.id}`, recordId: d.id, type: 'creation', title: d.nome, description: t('activities.documentAdded'), created_at: d.created_at, module: 'documentos', iconName: 'documentos', status: d.status }));
  auditoriasRes.data?.forEach(a => activities.push({ id: `auditoria-${a.id}`, recordId: a.id, type: 'creation', title: a.nome, description: t('activities.newAudit'), created_at: a.created_at, module: 'auditorias', iconName: 'auditorias', status: a.status }));
  denunciasRes.data?.forEach(d => activities.push({ id: `denuncia-${d.id}`, recordId: d.id, type: 'creation', title: d.titulo, description: t('activities.newComplaint'), created_at: d.created_at, module: 'denuncias', iconName: 'denuncias', status: d.status }));

  // Alterações e remoções vêm da trilha de auditoria. As criações continuam a
  // ser lidas das próprias tabelas porque só 10 tabelas têm trigger de
  // auditoria — usar apenas audit_logs perderia documentos e denúncias.
  const { data: auditRes } = await supabase
    .from('audit_logs')
    .select('id, table_name, record_id, action, old_values, new_values, created_at')
    .eq('empresa_id', empresaId)
    .in('action', ['UPDATE', 'DELETE'])
    .order('created_at', { ascending: false })
    .limit(10);

  auditRes?.forEach((log: any) => {
    const modulo = AUDIT_TABLE_TO_MODULE[log.table_name];
    if (!modulo) return;
    const valores = log.action === 'DELETE' ? log.old_values : log.new_values;
    const titulo = valores?.nome || valores?.titulo;
    if (!titulo) return;
    activities.push({
      id: `audit-${log.id}`,
      recordId: log.record_id,
      type: log.action === 'DELETE' ? 'deletion' : 'update',
      title: titulo,
      /*
        "Registro atualizado", cinco vezes seguidas, não diz nada.

        `old_values` e `new_values` estão aqui e sabem o que mudou. Dizer
        "Crítico → Alto" custa o mesmo espaço e é a diferença entre um feed que
        se lê e um que se ignora.
      */
      description: log.action === 'DELETE'
        ? t('activities.recordDeleted')
        : descreverMudanca(log.old_values, log.new_values, t),
      created_at: log.created_at,
      module: modulo.module,
      iconName: modulo.iconName,
      // O estado só aparecia nas criações; nas alterações a coluna ficava vazia.
      status: valores?.status || valores?.nivel_risco_residual || valores?.nivel_risco_inicial,
      isSeverity: !!(valores?.nivel_risco_residual || valores?.nivel_risco_inicial),
    });
  });

  return activities.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 10);
}

export function RecentActivities({ className }: { className?: string }) {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { t, locale } = useLanguage();
  const empresaId = profile?.empresa_id;

  const { data: activities = [], isLoading } = useQuery({
    queryKey: ['recent-activities', empresaId],
    queryFn: () => fetchActivities(empresaId!, t),
    enabled: !!empresaId,
    staleTime: 5 * 60 * 1000,
  });

  /** Hoje / Ontem / a data, com as linhas daquele dia por baixo. */
  const agrupadasPorDia = useMemo(() => {
    const grupos: Array<{ dia: string; itens: Activity[] }> = [];
    for (const a of activities) {
      const d = new Date(a.created_at);
      const dia = isToday(d)
        ? t('activities.today')
        : isYesterday(d)
        ? t('activities.yesterday')
        : d.toLocaleDateString(intlLocale(), { day: '2-digit', month: 'long' });
      const ultimo = grupos[grupos.length - 1];
      if (ultimo && ultimo.dia === dia) ultimo.itens.push(a);
      else grupos.push({ dia, itens: [a] });
    }
    return grupos;
  }, [activities, t]);

  const routeMap: Record<string, string> = {
    'riscos': '/riscos',
    'controles': '/governanca/controles',
    'documentos': '/documentos',
    'auditorias': '/governanca/auditorias',
    'denuncias': '/denuncia'
  };

  /**
   * Leva o id do registo consigo.
   *
   * `?focus=<id>` é o padrão que o produto já tem: `useFocusRow` rola até à
   * linha e destaca-a por 2,5s (usado em Contratos, Documentos e Planos de
   * Ação). Onde o módulo tem gaveta de detalhe própria — Riscos —, o
   * parâmetro abre-a directamente, que é o que a pessoa quer quando clica no
   * nome de um risco.
   */
  const DETALHE_ABRE_GAVETA: Record<string, string> = {
    riscos: 'risco',
  };

  const handleActivityClick = (activity: Activity) => {
    const route = routeMap[activity.module];
    if (!route) return;
    if (!activity.recordId) {
      navigate(route);
      return;
    }
    const param = DETALHE_ABRE_GAVETA[activity.module] ?? 'focus';
    navigate(`${route}?${param}=${activity.recordId}`);
  };

  return (
    <Card className={`relative flex w-full min-w-0 flex-col overflow-hidden ${className || ''}`}>

      <CardHeader className="pb-3">
        <CardTitle className="text-micro font-semibold uppercase tracking-wide text-muted-foreground">
          {t('dashboard.recentActivities')}
        </CardTitle>
      </CardHeader>
      {/*
        A lista ocupa o que o cartão lhe der e rola por dentro.

        Era `max-h-[400px]`: com o cartão esticado até ao fim do ecrã, um teto
        fixo deixava o resto do cartão em branco — e num ecrã baixo cortava a
        lista antes do fim do cartão. `min-h-0` é obrigatório, senão o item
        flex recusa encolher abaixo do conteúdo e o scroll nunca aparece.
      */}
      <CardContent className="flex-1 min-h-0 overflow-y-auto pt-0 pb-4">
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-muted rounded-full flex-shrink-0"></div>
                  <div className="flex-1 min-w-0">
                    <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-muted rounded w-1/2"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : activities.length > 0 ? (
          /*
            Fio em vez de caixa, e a hora agrupada por dia.

            Cada linha era um `rounded-lg border bg-surface-2/60` — uma caixa
            com borda dentro de um cartão com borda, e `--card` é a mesma cor
            de `--popover` no tema claro, portanto a caixa não recuava nada:
            sobrava o fio. E "há 4 dias" repetido em cinco linhas seguidas é
            ruído; o dia é um cabeçalho, a hora fica na linha.
          */
          <div>
            {agrupadasPorDia.map(({ dia, itens }) => (
              <div key={dia}>
                <div className="sticky top-0 z-10 bg-card/95 backdrop-blur-sm py-1.5 text-micro font-medium uppercase tracking-wide text-muted-foreground">
                  {dia}
                </div>
                {itens.map((activity) => (
                  <button
                    key={activity.id}
                    type="button"
                    onClick={() => handleActivityClick(activity)}
                    className="realce-linha group flex w-full items-start gap-3 border-b border-border/60 py-2.5 text-left transition-ui"
                  >
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
                      {getIcon(activity.module)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-2">
                        <span className="truncate text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                          {activity.title}
                        </span>
                        <span className="ml-auto shrink-0 text-micro tabular-nums text-muted-foreground">
                          {new Date(activity.created_at).toLocaleTimeString(intlLocale(), {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </span>
                      <span className="mt-0.5 flex items-center gap-2">
                        <span className="truncate text-xs text-muted-foreground">{activity.description}</span>
                        {getStatusBadge(activity.status, t, !!activity.isSeverity)}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="mx-auto h-12 w-12 text-muted-foreground mb-4">
              <IconCalendar className="h-12 w-12" />
            </div>
            <p className="text-muted-foreground">{t('dashboard.noActivities')}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
