import React, { useState } from 'react';
import { Bell, Check, ArrowRight, CheckCircle2, ExternalLink } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { StatusBadge, type StatusTone } from '@/components/ui/status-badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/AuthProvider';
import { useLanguage } from '@/contexts/LanguageContext';
import { differenceInDays, formatDistanceToNow, format } from 'date-fns';
import { ptBR, enUS } from 'date-fns/locale';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { resolveNotificationModule } from '@/lib/notification-icons';
import { cn } from '@/lib/utils';
import { formatStatus } from '@/lib/text-utils';
import { logger } from '@/lib/logger';

interface Notification {
  id: string;
  title: string;
  message: string | null;
  type: string;
  read: boolean;
  link_to: string | null;
  created_at: string;
  isAutomatic?: boolean;
}

const STORAGE_KEY = 'readAutomaticNotifications';

const getReadAutomaticNotifications = (): Set<string> => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch {
    return new Set();
  }
};

const markAutomaticNotificationAsRead = (notificationId: string) => {
  try {
    const readNotifications = getReadAutomaticNotifications();
    readNotifications.add(notificationId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...readNotifications]));
  } catch (error) {
    logger.error('Erro ao salvar notificação como lida', { error: (error as Error)?.message, module: 'notifications' });
  }
};

const NotificationCenter: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [detail, setDetail] = useState<Notification | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { t, locale } = useLanguage();
  const [readAutomaticIds, setReadAutomaticIds] = useState<Set<string>>(getReadAutomaticNotifications());

  // Buscar notificações manuais
  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data as Notification[];
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  // Buscar todas as notificações automáticas do sistema
  const { data: automaticNotifications = [] } = useQuery({
    queryKey: ['automatic-notifications', [...readAutomaticIds]],
    queryFn: async () => {
      const notificacoes: Notification[] = [];
      const readIds = readAutomaticIds;
      
      const { data: documentos } = await supabase
        .from('documentos')
        .select('id, nome, data_vencimento, tipo')
        .not('data_vencimento', 'is', null)
        .eq('status', 'ativo');

      const { data: contratos } = await supabase
        .from('contratos')
        .select('id, nome, data_fim, renovacao_automatica')
        .not('data_fim', 'is', null)
        .eq('status', 'ativo');

      const { data: controles } = await supabase
        .from('controles')
        .select('id, nome, proxima_avaliacao')
        .not('proxima_avaliacao', 'is', null)
        .eq('status', 'ativo');

      const { data: incidentes } = await supabase
        .from('incidentes')
        .select('id, titulo, criticidade, status')
        .in('status', ['aberto', 'investigacao'])
        .eq('criticidade', 'critica');

      const { data: ativos } = await supabase
        .from('ativos')
        .select('id, nome, criticidade, status')
        .eq('criticidade', 'critico')
        .eq('status', 'ativo');

      const { data: manutencoesPendentes } = await supabase
        .from('ativos_manutencoes')
        .select('id, ativo_id, data_manutencao, tipo_manutencao, ativos(nome)')
        .in('status', ['agendada', 'em_andamento'])
        .not('data_manutencao', 'is', null);

      const { data: aprovacoesDocumentos } = await supabase
        .from('documentos_aprovacoes')
        .select('id, documento_id, status, tipo_acao, solicitado_por, created_at, documentos(nome), profiles(nome)')
        .eq('aprovador_id', user?.id || '')
        .eq('status', 'pendente')
        .eq('tipo_acao', 'solicitacao');

      const hoje = new Date();

      // Processar documentos
      (documentos || []).forEach(doc => {
        const diasParaVencimento = differenceInDays(new Date(doc.data_vencimento!), hoje);
        
        if (diasParaVencimento < 0) {
          notificacoes.push({
            id: `doc-vencido-${doc.id}`,
            title: 'Documento Vencido',
            message: `O documento \\\"${doc.nome}\\\" está vencido há ${Math.abs(diasParaVencimento)} dias`,
            type: 'error', read: false, link_to: '/documentos',
            created_at: new Date().toISOString(), isAutomatic: true
          });
        } else if (diasParaVencimento === 0) {
          notificacoes.push({
            id: `doc-hoje-${doc.id}`,
            title: 'Documento Vence Hoje',
            message: `O documento \\\"${doc.nome}\\\" vence hoje`,
            type: 'warning', read: false, link_to: '/documentos',
            created_at: new Date().toISOString(), isAutomatic: true
          });
        } else if (diasParaVencimento <= 7) {
          notificacoes.push({
            id: `doc-7dias-${doc.id}`,
            title: 'Documento Vence em Breve',
            message: `O documento \\\"${doc.nome}\\\" vence em ${diasParaVencimento} dias`,
            type: 'warning', read: false, link_to: '/documentos',
            created_at: new Date().toISOString(), isAutomatic: true
          });
        }
      });

      // Processar contratos
      (contratos || []).forEach(contrato => {
        const diasParaVencimento = differenceInDays(new Date(contrato.data_fim!), hoje);
        
        if (diasParaVencimento < 0) {
          notificacoes.push({
            id: `contrato-vencido-${contrato.id}`,
            title: 'Contrato Vencido',
            message: `O contrato \\\"${contrato.nome}\\\" venceu há ${Math.abs(diasParaVencimento)} dias`,
            type: 'error', read: false, link_to: '/contratos',
            created_at: new Date().toISOString(), isAutomatic: true
          });
        } else if (diasParaVencimento <= 30) {
          const renovacaoMsg = contrato.renovacao_automatica ? ' (renovação automática ativada)' : '';
          notificacoes.push({
            id: `contrato-30dias-${contrato.id}`,
            title: 'Contrato Próximo ao Vencimento',
            message: `O contrato \\\"${contrato.nome}\\\" vence em ${diasParaVencimento} dias${renovacaoMsg}`,
            type: 'warning', read: false, link_to: '/contratos',
            created_at: new Date().toISOString(), isAutomatic: true
          });
        }
      });

      // Processar controles
      (controles || []).forEach(controle => {
        const diasParaAvaliacao = differenceInDays(new Date(controle.proxima_avaliacao!), hoje);
        
        if (diasParaAvaliacao <= 15 && diasParaAvaliacao >= 0) {
          notificacoes.push({
            id: `controle-avaliacao-${controle.id}`,
            title: 'Avaliação de Controle Pendente',
            message: `O controle \\\"${controle.nome}\\\" precisa ser avaliado em ${diasParaAvaliacao} dias`,
            type: 'warning', read: false, link_to: `/controles?detalhe=${controle.id}`,
            created_at: new Date().toISOString(), isAutomatic: true
          });
        }
      });

      // Processar incidentes críticos
      (incidentes || []).forEach(incidente => {
        notificacoes.push({
          id: `incidente-critico-${incidente.id}`,
          title: 'Incidente Crítico Aberto',
          message: `O incidente "${incidente.titulo}" está com status ${formatStatus(incidente.status)} e requer atenção imediata`,
          type: 'error', read: false, link_to: `/incidentes?detalhe=${incidente.id}`,
          created_at: new Date().toISOString(), isAutomatic: true
        });
      });

      // Processar ativos críticos
      (ativos || []).forEach(ativo => {
        notificacoes.push({
          id: `ativo-critico-${ativo.id}`,
          title: 'Ativo Crítico Ativo',
          message: `O ativo \\\"${ativo.nome}\\\" está marcado como crítico e requer atenção especial`,
          type: 'warning', read: false, link_to: '/ativos',
          created_at: new Date().toISOString(), isAutomatic: true
        });
      });

      const { data: profileData } = await supabase
        .from('profiles')
        .select('empresa_id')
        .eq('user_id', user!.id)
        .single();
      const userEmpresaId = profileData?.empresa_id;

      const { data: licencas } = await supabase
        .from('ativos_licencas')
        .select('id, nome, data_vencimento, tipo_licenca')
        .eq('status', 'ativa')
        .eq('empresa_id', userEmpresaId || '')
        .not('data_vencimento', 'is', null);

      (licencas || []).forEach(licenca => {
        const diasParaVencimento = differenceInDays(new Date(licenca.data_vencimento), hoje);
        
        if (diasParaVencimento < 0) {
          notificacoes.push({
            id: `licenca-vencida-${licenca.id}`,
            title: 'Licença Vencida',
            message: `A licença \\\"${licenca.nome}\\\" venceu há ${Math.abs(diasParaVencimento)} dias`,
            type: 'error', read: false, link_to: '/ativos/licencas',
            created_at: new Date().toISOString(), isAutomatic: true
          });
        } else if (diasParaVencimento <= 30) {
          notificacoes.push({
            id: `licenca-vencendo-${licenca.id}`,
            title: 'Licença Vencendo',
            message: `A licença \\\"${licenca.nome}\\\" vence em ${diasParaVencimento} dias`,
            type: 'warning', read: false, link_to: '/ativos/licencas',
            created_at: new Date().toISOString(), isAutomatic: true
          });
        }
      });

      const { data: chaves } = await supabase
        .from('ativos_chaves_criptograficas')
        .select('id, nome, data_proxima_rotacao, tipo_chave, ambiente')
        .eq('status', 'ativa')
        .eq('empresa_id', userEmpresaId || '')
        .not('data_proxima_rotacao', 'is', null);

      (chaves || []).forEach(chave => {
        const diasParaRotacao = differenceInDays(new Date(chave.data_proxima_rotacao), hoje);
        
        if (diasParaRotacao < 0) {
          notificacoes.push({
            id: `chave-expirada-${chave.id}`,
            title: 'Chave Expirada',
            message: `A chave \\\"${chave.nome}\\\" (${chave.ambiente}) expirou há ${Math.abs(diasParaRotacao)} dias`,
            type: 'error', read: false, link_to: '/ativos/chaves',
            created_at: new Date().toISOString(), isAutomatic: true
          });
        } else if (diasParaRotacao <= 30) {
          notificacoes.push({
            id: `chave-rotacao-${chave.id}`,
            title: 'Rotação de Chave Necessária',
            message: `A chave \\\"${chave.nome}\\\" precisa ser rotacionada em ${diasParaRotacao} dias`,
            type: 'warning', read: false, link_to: '/ativos/chaves',
            created_at: new Date().toISOString(), isAutomatic: true
          });
        }
      });

      (manutencoesPendentes || []).forEach(manutencao => {
        const diasParaManutencao = differenceInDays(new Date(manutencao.data_manutencao!), hoje);
        
        if (diasParaManutencao <= 7 && diasParaManutencao >= 0) {
          notificacoes.push({
            id: `manutencao-${manutencao.id}`,
            title: 'Manutenção Agendada',
            message: `Manutenção ${manutencao.tipo_manutencao} do ativo \\\"${(manutencao as any).ativos?.nome}\\\" agendada para ${diasParaManutencao === 0 ? 'hoje' : `${diasParaManutencao} dias`}`,
            type: 'warning', read: false, link_to: '/ativos',
            created_at: new Date().toISOString(), isAutomatic: true
          });
        }
      });

      const { data: riscosRevisao } = await supabase
        .from('riscos')
        .select('id, nome, data_proxima_revisao, nivel_risco_inicial')
        .eq('empresa_id', userEmpresaId || '')
        .not('data_proxima_revisao', 'is', null);

      (riscosRevisao || []).forEach(risco => {
        const diasParaRevisao = differenceInDays(new Date(risco.data_proxima_revisao!), hoje);
        
        if (diasParaRevisao < 0) {
          notificacoes.push({
            id: `risco-revisao-vencida-${risco.id}`,
            title: 'Revisão de Risco Vencida',
            message: `O risco \\\"${risco.nome}\\\" (${risco.nivel_risco_inicial || 'N/A'}) está com revisão atrasada há ${Math.abs(diasParaRevisao)} dias`,
            type: 'error', read: false, link_to: '/riscos',
            created_at: new Date().toISOString(), isAutomatic: true
          });
        } else if (diasParaRevisao <= 7) {
          notificacoes.push({
            id: `risco-revisao-proxima-${risco.id}`,
            title: 'Revisão de Risco Próxima',
            message: `O risco \\\"${risco.nome}\\\" precisa ser revisado em ${diasParaRevisao} dias`,
            type: 'warning', read: false, link_to: '/riscos',
            created_at: new Date().toISOString(), isAutomatic: true
          });
        }
      });

      (aprovacoesDocumentos || []).forEach(aprovacao => {
        const solicitanteNome = (aprovacao as any).profiles?.nome || 'Usuário';
        const documentoNome = (aprovacao as any).documentos?.nome || 'Documento';
        
        notificacoes.push({
          id: `aprovacao-doc-${aprovacao.id}`,
          title: 'Solicitação de Aprovação',
          message: `${solicitanteNome} solicitou sua aprovação para o documento \\\"${documentoNome}\\\"`,
          type: 'info', read: false, link_to: `/documentos?aprovar=${aprovacao.documento_id}`,
          created_at: aprovacao.created_at, isAutomatic: true
        });
      });

      return notificacoes.map(notif => ({
        ...notif,
        read: readIds.has(notif.id)
      }));
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const typePriority: Record<string, number> = { error: 0, warning: 1, info: 2, success: 3 };
  const allNotifications = [...notifications, ...automaticNotifications]
    .sort((a, b) => {
      if (!a.read && b.read) return -1;
      if (a.read && !b.read) return 1;
      const prioDiff = (typePriority[a.type] ?? 4) - (typePriority[b.type] ?? 4);
      if (prioDiff !== 0) return prioDiff;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    })
    .slice(0, 30);

  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: () => {
      toast({
        title: t('dashboard.error'),
        description: t('notifications.errorMarkRead'),
        variant: 'destructive',
      });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('read', false);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const handleMarkAllAsRead = () => {
    const unreadAutomatic = automaticNotifications.filter(n => !n.read);
    unreadAutomatic.forEach(n => markAutomaticNotificationAsRead(n.id));
    setReadAutomaticIds(prev => {
      const newSet = new Set(prev);
      unreadAutomatic.forEach(n => newSet.add(n.id));
      return newSet;
    });
    queryClient.invalidateQueries({ queryKey: ['automatic-notifications'] });
    markAllAsReadMutation.mutate();
  };

  const unreadCount = allNotifications.filter(n => !n.read).length;

  const markRead = (notification: Notification) => {
    if (notification.read) return;
    if (notification.isAutomatic) {
      markAutomaticNotificationAsRead(notification.id);
      setReadAutomaticIds(prev => {
        const newSet = new Set(prev);
        newSet.add(notification.id);
        return newSet;
      });
      queryClient.invalidateQueries({ queryKey: ['automatic-notifications'] });
    } else {
      markAsReadMutation.mutate(notification.id);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    markRead(notification);
    setDetail(notification);
    setIsOpen(false);
  };

  const handleNavigateFromDetail = () => {
    if (detail?.link_to) {
      navigate(detail.link_to);
      setDetail(null);
    }
  };

  type Tone = 'success' | 'warning' | 'destructive' | 'info';
  const getTypeTone = (type: string): Tone => {
    switch (type) {
      case 'success': return 'success';
      case 'warning': return 'warning';
      case 'error': return 'destructive';
      default: return 'info';
    }
  };

  const TONE_CLS: Record<Tone, { accent: string; chipBg: string; chipRing: string; iconText: string; chipSolid: string; stripes: string }> = {
    success:     { accent: 'bg-success',     chipBg: 'bg-success/10',     chipRing: 'ring-success/25',     iconText: 'text-success',     chipSolid: 'bg-success',     stripes: 'akuris-stripes-success' },
    warning:     { accent: 'bg-warning',     chipBg: 'bg-warning/10',     chipRing: 'ring-warning/25',     iconText: 'text-warning',     chipSolid: 'bg-warning',     stripes: 'akuris-stripes-warning' },
    destructive: { accent: 'bg-destructive', chipBg: 'bg-destructive/10', chipRing: 'ring-destructive/25', iconText: 'text-destructive', chipSolid: 'bg-destructive', stripes: 'akuris-stripes-destructive' },
    info:        { accent: 'bg-info',        chipBg: 'bg-info/10',        chipRing: 'ring-info/25',        iconText: 'text-info',        chipSolid: 'bg-info',        stripes: 'akuris-stripes-info' },
  };

  const dateFnsLocale = locale === 'pt' ? ptBR : enUS;
  const formatRelative = (iso: string) => {
    const d = new Date(iso);
    const diffSec = (Date.now() - d.getTime()) / 1000;
    if (diffSec < 45) return t('notifications.justNow');
    return formatDistanceToNow(d, { addSuffix: true, locale: dateFnsLocale });
  };

  // Agrupamento por prioridade visual (urgente / atenção / informativo)
  type Group = 'urgent' | 'attention' | 'info';
  const groupOf = (type: string): Group =>
    type === 'error' ? 'urgent' : type === 'warning' ? 'attention' : 'info';

  const groups: Record<Group, typeof allNotifications> = { urgent: [], attention: [], info: [] };
  allNotifications.forEach((n) => groups[groupOf(n.type)].push(n));

  const groupMeta: Array<{ key: Group; label: string; tone: Tone }> = [
    { key: 'urgent',     label: t('notifications.groupUrgent'),     tone: 'destructive' },
    { key: 'attention',  label: t('notifications.groupAttention'),  tone: 'warning' },
    { key: 'info',       label: t('notifications.groupInfo'),       tone: 'info' },
  ];

  const renderItem = (notification: Notification) => {
    const tone = getTypeTone(notification.type);
    const toneCls = TONE_CLS[tone];
    const moduleMeta = resolveNotificationModule(notification);
    const ModuleIcon = moduleMeta.Icon;
    const moduleLabel = t(moduleMeta.i18nKey);

    return (
      <button
        type="button"
        key={notification.id}
        onClick={() => handleNotificationClick(notification)}
        className={cn(
          'group relative w-full text-left rounded-2xl border border-border/50 overflow-hidden',
          'transition-all hover:shadow-[0_8px_22px_-12px_hsl(var(--foreground)/0.18)]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
          toneCls.stripes,
          notification.read && 'opacity-70'
        )}
      >
        <div className="flex items-center gap-3 pl-3 pr-3 py-3">
          {/* Chip sólido 24px */}
          <span
            aria-hidden
            className={cn(
              'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white',
              toneCls.chipSolid
            )}
          >
            <ModuleIcon className="h-3.5 w-3.5" strokeWidth={2.25} />
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/80 leading-none mb-1 truncate">
              {moduleLabel}
            </p>
            <p className={cn(
              'text-[13px] font-semibold leading-tight tracking-tight truncate',
              !notification.read ? 'text-foreground' : 'text-muted-foreground'
            )}>
              {notification.title}
            </p>
            {notification.message && (
              <p className="text-xs text-muted-foreground leading-relaxed mt-0.5 line-clamp-2">
                {notification.message}
              </p>
            )}
            <span className="text-[11px] text-muted-foreground/70 tabular-nums mt-1.5 block">
              {formatRelative(notification.created_at)}
            </span>
          </div>

          {/* Botão "Action" branco — abre o detalhe / link */}
          <span
            className="akuris-pill-action shrink-0"
            aria-hidden
          >
            {notification.link_to ? (t('common.open') !== 'common.open' ? t('common.open') : 'Abrir') : t('notifications.viewDetails') !== 'notifications.viewDetails' ? t('notifications.viewDetails') : 'Ver'}
          </span>
        </div>
      </button>
    );
  };

  // Detalhe da notificação
  const detailModule = detail ? resolveNotificationModule(detail) : null;
  const detailToneKey: StatusTone = detail
    ? (getTypeTone(detail.type) === 'destructive' ? 'destructive' : (getTypeTone(detail.type) as StatusTone))
    : 'neutral';
  const detailToneCls = detail ? TONE_CLS[getTypeTone(detail.type)] : null;
  const DetailIcon = detailModule?.Icon;
  const detailGroupLabel = detail
    ? (detail.type === 'error'
        ? t('notifications.groupUrgent')
        : detail.type === 'warning'
        ? t('notifications.groupAttention')
        : t('notifications.groupInfo'))
    : '';

  return (
    <>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            aria-label={t('notifications.title')}
            className={cn(
              'relative h-9 w-9 p-0 rounded-lg transition-all',
              unreadCount > 0 && 'ring-1 ring-primary/25 bg-primary/[0.04]'
            )}
          >
            <Bell className="h-[18px] w-[18px]" strokeWidth={1.5} />
            {unreadCount > 0 && (
              <span
                className="absolute -top-0.5 -right-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground tabular-nums shadow-[0_2px_6px_-1px_hsl(var(--destructive)/0.5)]"
                aria-label={`${unreadCount} ${t('notifications.unread')}`}
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Button>
        </PopoverTrigger>

        <PopoverContent
          className="w-[384px] max-w-[calc(100vw-2rem)] p-0 overflow-hidden border-border/60 shadow-[0_16px_40px_-10px_hsl(var(--primary)/0.18)]"
          align="end"
          sideOffset={8}
        >
          {/* Header editorial */}
          <div className="px-4 pt-4 pb-3 border-b border-border/60 bg-gradient-to-b from-surface-1 to-surface-2">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-primary/70 leading-none">
                  {t('notifications.eyebrow')}
                </p>
                <p className="mt-1.5 text-sm font-semibold text-foreground tracking-tight tabular-nums">
                  {unreadCount > 0
                    ? `${unreadCount} ${unreadCount === 1 ? t('notifications.unreadOne') : t('notifications.unread')}`
                    : t('notifications.allCaughtUp')}
                </p>
              </div>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllAsRead}
                  className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:text-primary/80 transition-colors whitespace-nowrap"
                >
                  {t('notifications.markAllRead')}
                  <ArrowRight className="h-3 w-3" strokeWidth={1.5} />
                </button>
              )}
            </div>
          </div>

          <ScrollArea className="max-h-[460px]">
            {!user ? (
              <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                {t('notifications.loginToView')}
              </div>
            ) : isLoading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <AkurisPulse size={48} />
                <p className="text-xs text-muted-foreground">{t('common.loading')}</p>
              </div>
            ) : allNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-success/10 ring-1 ring-success/20 text-success mb-3">
                  <CheckCircle2 className="h-6 w-6" strokeWidth={1.5} />
                </div>
                <p className="text-sm font-semibold text-foreground tracking-tight">
                  {t('notifications.allCaughtUp')}
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed mt-1 max-w-[260px]">
                  {t('notifications.allCaughtUpDesc')}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border/40">
                {groupMeta.map(({ key, label, tone }) => {
                  const items = groups[key];
                  if (items.length === 0) return null;
                  return (
                    <section key={key} aria-label={label}>
                      <header className="flex items-center justify-between px-4 pt-3 pb-1.5">
                        <div className="flex items-center gap-2">
                          <span aria-hidden className={cn('h-1.5 w-1.5 rounded-full', TONE_CLS[tone].accent)} />
                          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/80">
                            {label}
                          </p>
                        </div>
                        <span className="text-[10px] font-semibold text-muted-foreground/60 tabular-nums">
                          {items.length}
                        </span>
                      </header>
                      <div>{items.map(renderItem)}</div>
                    </section>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </PopoverContent>
      </Popover>

      {/* Detalhe completo da notificação */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="sm:max-w-lg">
          {detail && detailModule && DetailIcon && detailToneCls && (
            <>
              <DialogHeader>
                <div className="flex items-start gap-3">
                  <span
                    aria-hidden
                    className={cn(
                      'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1',
                      detailToneCls.chipBg,
                      detailToneCls.chipRing,
                      detailToneCls.iconText
                    )}
                  >
                    <DetailIcon className="h-5 w-5" strokeWidth={1.5} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-primary/70 leading-none">
                      {t(detailModule.i18nKey)}
                    </p>
                    <DialogTitle className="mt-1.5 text-base font-semibold leading-tight tracking-tight break-words">
                      {detail.title}
                    </DialogTitle>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <StatusBadge size="sm" tone={detailToneKey}>
                        {detailGroupLabel}
                      </StatusBadge>
                      <span className="text-[11px] text-muted-foreground tabular-nums">
                        {format(new Date(detail.created_at), 'PPp', { locale: dateFnsLocale })}
                      </span>
                      <span className="text-[11px] text-muted-foreground/70">
                        · {formatRelative(detail.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
              </DialogHeader>

              <div className="mt-2 max-h-[50vh] overflow-y-auto">
                {detail.message ? (
                  <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap break-words">
                    {detail.message}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    {t('notifications.noNotifications')}
                  </p>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setDetail(null)}>
                  {t('common.close') || 'Fechar'}
                </Button>
                {detail.link_to && (
                  <Button onClick={handleNavigateFromDetail} className="gap-1">
                    {t('notifications.viewAll') !== 'notifications.viewAll' ? 'Abrir módulo' : 'Abrir módulo'}
                    <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.5} />
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default NotificationCenter;

