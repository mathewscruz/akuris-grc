/**
 * PlanoAcaoDetailDrawer — painel lateral do plano de ação (mesmo estilo do painel de risco).
 * Abas: Visão · Histórico · Comentários.
 */
import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatusBadge } from '@/components/ui/status-badge';
import { Chip } from '@/components/ui/chip';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatDateOnly } from '@/lib/date-utils';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';
import { PLANO_STATUS_EDITAVEIS } from './PlanosAcaoKanban';
import { IconEdit, IconClose, IconExternal, IconSend, IconChevronDown } from '@/components/icons';

interface Props {
  plano: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (plano: any) => void;
  onStatusChange: (plano: any, status: string) => void;
  onOpenOrigin?: (plano: any) => void;
  statusConfig: Record<string, { label: string; tone: any; icon: any }>;
  prioridadeConfig: Record<string, { label: string; tone: any; mark: string }>;
  moduloLabels: Record<string, string>;
}

export function PlanoAcaoDetailDrawer({
  plano,
  open,
  onOpenChange,
  onEdit,
  onStatusChange,
  onOpenOrigin,
  statusConfig,
  prioridadeConfig,
  moduloLabels,
}: Props) {
  const { t } = useLanguage();
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [comentario, setComentario] = useState('');
  const [enviando, setEnviando] = useState(false);
  const isExternal = !!plano?._isExternal;
  const planoId = plano?.id as string | undefined;

  const { data: comentarios = [], isLoading: loadingComentarios } = useQuery({
    queryKey: ['plano-acao-comentarios', planoId],
    queryFn: async () => {
      if (!planoId) return [];
      const { data, error } = await supabase
        .from('planos_acao_comentarios')
        .select('id, comentario, created_at, user_id')
        .eq('plano_id', planoId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const rows = data || [];
      const ids = [...new Set(rows.map((r) => r.user_id).filter(Boolean))];
      let nomes: Record<string, string> = {};
      if (ids.length) {
        const { data: profs } = await supabase.from('profiles').select('user_id, nome').in('user_id', ids);
        nomes = Object.fromEntries((profs || []).map((p: any) => [p.user_id, p.nome]));
      }
      return rows.map((r) => ({ ...r, autor: nomes[r.user_id] || '—' }));
    },
    enabled: open && !!planoId && !isExternal,
  });

  const { data: historico = [], isLoading: loadingHistorico } = useQuery({
    queryKey: ['plano-acao-historico', planoId],
    queryFn: async () => {
      if (!planoId || !profile?.empresa_id) return [];
      const { data, error } = await supabase
        .from('audit_logs')
        .select('id, action, changed_fields, created_at, user_id, new_values')
        .eq('empresa_id', profile.empresa_id)
        .eq('table_name', 'planos_acao')
        .eq('record_id', planoId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!planoId && !isExternal && !!profile?.empresa_id,
  });

  const enviarComentario = async () => {
    const texto = comentario.trim();
    if (!texto || !planoId || !user?.id) return;
    setEnviando(true);
    try {
      const { error } = await supabase
        .from('planos_acao_comentarios')
        .insert({ plano_id: planoId, user_id: user.id, comentario: texto });
      if (error) throw error;
      setComentario('');
      queryClient.invalidateQueries({ queryKey: ['plano-acao-comentarios', planoId] });
    } catch (error) {
      logger.error('Erro ao comentar plano de ação', error);
      toast.error(t('planosAcao.commentError'));
    } finally {
      setEnviando(false);
    }
  };

  if (!plano) return null;
  const statusCfg = statusConfig[plano._displayStatus] || statusConfig.pendente;
  const prioCfg = prioridadeConfig[plano.prioridade] || prioridadeConfig.media;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[540px] p-0 flex flex-col gap-0 [&>button.absolute]:hidden">
        <SheetHeader className="px-6 pt-5 pb-5 border-b border-border space-y-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-mono text-muted-foreground">
              {t('planosAcao.detailEyebrow')}
            </span>
            <div className="flex items-center gap-1">
              {!isExternal && (
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => onEdit(plano)}>
                  <IconEdit className="h-3.5 w-3.5 mr-1" strokeWidth={1.5} />
                  {t('planosAcao.actionEdit')}
                </Button>
              )}
              <SheetClose asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" aria-label={t('planosAcao.close')}>
                  <IconClose className="h-4 w-4" strokeWidth={1.5} />
                </Button>
              </SheetClose>
            </div>
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              {isExternal ? (
                <StatusBadge tone={statusCfg.tone}>{statusCfg.label}</StatusBadge>
              ) : (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button type="button" className="inline-flex items-center transition-opacity hover:opacity-80">
                      <StatusBadge tone={statusCfg.tone} className="gap-1">
                        {statusCfg.label}
                        <IconChevronDown className="h-3 w-3 opacity-70" />
                      </StatusBadge>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-48">
                    {PLANO_STATUS_EDITAVEIS.map((s) => (
                      <DropdownMenuItem
                        key={s}
                        onClick={() => onStatusChange(plano, s)}
                        className={plano.status === s ? 'font-semibold' : ''}
                      >
                        {statusConfig[s]?.label}
                        {plano.status === s && <span className="ml-auto text-primary">✓</span>}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              <StatusBadge tone={prioCfg.tone} mark={prioCfg.mark}>{prioCfg.label}</StatusBadge>
              <Chip family="category">{moduloLabels[plano.modulo_origem] || plano.modulo_origem || 'Manual'}</Chip>
            </div>
            <SheetTitle className="text-xl leading-tight font-semibold">{plano.titulo}</SheetTitle>
          </div>
        </SheetHeader>

        <Tabs defaultValue="visao" className="flex-1 flex flex-col min-h-0">
          <TabsList className="mx-6 mt-4 w-auto self-start">
            <TabsTrigger value="visao">{t('planosAcao.tabOverview')}</TabsTrigger>
            <TabsTrigger value="historico">{t('planosAcao.tabHistory')}</TabsTrigger>
            <TabsTrigger value="comentarios">{t('planosAcao.tabComments')}</TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 min-h-0">
            <TabsContent value="visao" className="px-6 py-4 space-y-5 m-0">
              <Field label={t('planosAcao.detailDescription')} value={plano.descricao} />
              <Field label={t('planosAcao.detailNotes')} value={plano.observacoes} />
              <div className="grid grid-cols-2 gap-4">
                <Field label={t('planosAcao.columnDeadline')} value={plano.prazo ? formatDateOnly(plano.prazo) : null} />
                <Field label={t('planosAcao.columnResponsible')} value={plano.profiles?.nome} />
                <Field label={t('planosAcao.detailCreatedAt')} value={plano.created_at ? formatDateOnly(plano.created_at) : null} />
                <Field label={t('planosAcao.detailCompletedAt')} value={plano.data_conclusao ? formatDateOnly(plano.data_conclusao) : null} />
              </div>

              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">{t('planosAcao.detailOrigin')}</p>
                {plano.registro_origem_titulo || plano._isExternal ? (
                  <div className="flex items-center justify-between gap-2 rounded-lg border border-border p-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {plano.registro_origem_titulo || plano.titulo}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {moduloLabels[plano.modulo_origem] || plano.modulo_origem || 'Manual'}
                      </p>
                    </div>
                    {onOpenOrigin && (
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs shrink-0" onClick={() => onOpenOrigin(plano)}>
                        <IconExternal className="h-3.5 w-3.5 mr-1" />
                        {t('planosAcao.actionOpenInModule')}
                      </Button>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">{t('planosAcao.detailNoOrigin')}</p>
                )}
              </div>
            </TabsContent>

            <TabsContent value="historico" className="px-6 py-4 m-0">
              {loadingHistorico ? (
                <AkurisPulse />
              ) : historico.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('planosAcao.historyEmpty')}</p>
              ) : (
                <ul className="space-y-3">
                  {historico.map((h: any) => (
                    <li key={h.id} className="border-l-2 border-border pl-3">
                      <p className="text-sm font-medium">{t(`planosAcao.auditAction.${h.action}`)}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(h.created_at).toLocaleString()}
                        {h.changed_fields?.length ? ` · ${h.changed_fields.join(', ')}` : ''}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>

            <TabsContent value="comentarios" className="px-6 py-4 space-y-4 m-0">
              {!isExternal && (
                <div className="space-y-2">
                  <Textarea
                    value={comentario}
                    onChange={(e) => setComentario(e.target.value)}
                    placeholder={t('planosAcao.commentPlaceholder')}
                    rows={3}
                  />
                  <Button size="sm" onClick={enviarComentario} disabled={enviando || !comentario.trim()}>
                    <IconSend className="h-3.5 w-3.5 mr-1.5" />
                    {t('planosAcao.commentSubmit')}
                  </Button>
                </div>
              )}
              {loadingComentarios ? (
                <AkurisPulse />
              ) : comentarios.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('planosAcao.commentsEmpty')}</p>
              ) : (
                <ul className="space-y-3">
                  {comentarios.map((c: any) => (
                    <li key={c.id} className="rounded-lg border border-border p-3">
                      <p className="text-sm whitespace-pre-wrap">{c.comentario}</p>
                      <p className="text-xs text-muted-foreground mt-1.5">
                        {c.autor} · {new Date(c.created_at).toLocaleString()}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm whitespace-pre-wrap">{value || '—'}</p>
    </div>
  );
}
