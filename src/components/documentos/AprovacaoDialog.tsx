import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { DialogShell } from '@/components/ui/dialog-shell';
import { StatusBadge, type StatusTone } from '@/components/ui/status-badge';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle, XCircle, Clock, User, Plus, MessageSquare, FileText, Eye, ExternalLink, ShieldCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { enUS, ptBR } from 'date-fns/locale';
import { useIntegrationNotify } from '@/hooks/useIntegrationNotify';
import { logger } from '@/lib/logger';
import { MasterDetailDialog, type MasterDetailItem } from '@/components/ui/master-detail-dialog';
import { Separator } from '@/components/ui/separator';
import { useLanguage } from '@/contexts/LanguageContext';

import { AkurisPulse } from '@/components/ui/AkurisPulse';
interface Documento {
  id: string;
  nome: string;
  data_aprovacao?: string;
  aprovado_por?: string;
  created_by?: string;
  arquivo_url?: string;
  arquivo_nome?: string;
  arquivo_tipo?: string;
}

interface Aprovacao {
  id: string;
  aprovador_id: string;
  status: string;
  comentarios?: string;
  data_aprovacao?: string;
  created_at: string;
  aprovador_nome?: string;
  tipo_acao?: string;
  solicitado_por?: string;
}

interface Profile {
  user_id: string;
  nome: string;
  email: string;
  role: string;
}

interface AprovacaoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documento: Documento;
  onSuccess: () => void;
  empresaId?: string | null;
}

const STATUS_INFO: Record<string, { labelKey: string; icon: typeof Clock; tone: StatusTone }> = {
  pendente: { labelKey: 'documentos.dialogs.statusPendente', icon: Clock, tone: 'warning' },
  aprovado: { labelKey: 'documentos.dialogs.statusAprovado', icon: CheckCircle, tone: 'success' },
  rejeitado: { labelKey: 'documentos.dialogs.statusRejeitado', icon: XCircle, tone: 'destructive' },
};

export function AprovacaoDialog({ open, onOpenChange, documento, onSuccess, empresaId }: AprovacaoDialogProps) {
  const { t, locale } = useLanguage();
  const [aprovacoes, setAprovacoes] = useState<Aprovacao[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [formData, setFormData] = useState({ aprovador_id: '', comentarios: '' });
  const [actionModal, setActionModal] = useState<{
    open: boolean;
    type: 'aprovar' | 'rejeitar' | 'alteracoes' | null;
    aprovacaoId: string;
  }>({ open: false, type: null, aprovacaoId: '' });
  const [actionComment, setActionComment] = useState('');
  const { toast } = useToast();
  const { notify } = useIntegrationNotify();

  // ============ Lifecycle ============
  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
    };
    getCurrentUser();
  }, []);

  useEffect(() => {
    if (open && (documento as any)?.requer_aprovacao) {
      fetchAprovacoes();
      fetchProfiles();
    }
  }, [open, documento.id]);

  // Preview lazy: só carrega quando o usuário abre o sub-dialog
  useEffect(() => {
    if (!previewOpen || !documento?.arquivo_url) return;

    const loadPreview = async () => {
      setLoadingPreview(true);
      try {
        if (documento.arquivo_url!.includes('supabase')) {
          const path = documento.arquivo_url!.split('/documentos/')[1];
          if (path) {
            const { data, error } = await supabase.storage.from('documentos').createSignedUrl(path, 3600);
            if (!error && data?.signedUrl) {
              setPreviewUrl(data.signedUrl);
            } else {
              setPreviewUrl(documento.arquivo_url!);
            }
          } else {
            setPreviewUrl(documento.arquivo_url!);
          }
        } else {
          setPreviewUrl(documento.arquivo_url!);
        }
      } catch (error) {
        logger.error('Erro ao carregar preview:', error);
        setPreviewUrl(documento.arquivo_url!);
      } finally {
        setLoadingPreview(false);
      }
    };

    loadPreview();
  }, [previewOpen, documento?.arquivo_url]);

  // ============ Helpers ============
  const canPreview = () => {
    const tipo = documento?.arquivo_tipo?.toLowerCase() || '';
    const nome = documento?.arquivo_nome?.toLowerCase() || '';
    return (
      tipo.includes('pdf') ||
      tipo.includes('image') ||
      nome.endsWith('.pdf') ||
      nome.endsWith('.png') ||
      nome.endsWith('.jpg') ||
      nome.endsWith('.jpeg')
    );
  };
  const isPdf = () => {
    const tipo = documento?.arquivo_tipo?.toLowerCase() || '';
    const nome = documento?.arquivo_nome?.toLowerCase() || '';
    return tipo.includes('pdf') || nome.endsWith('.pdf');
  };
  const isImage = () => {
    const tipo = documento?.arquivo_tipo?.toLowerCase() || '';
    const nome = documento?.arquivo_nome?.toLowerCase() || '';
    return tipo.includes('image') || nome.endsWith('.png') || nome.endsWith('.jpg') || nome.endsWith('.jpeg');
  };

  // ============ Data fetch ============
  const fetchAprovacoes = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('documentos_aprovacoes')
        .select('*')
        .eq('documento_id', documento.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const aprovacoesComNomes = await Promise.all(
        (data || []).map(async (aprovacao) => {
          try {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('nome')
              .eq('user_id', aprovacao.aprovador_id)
              .single();
            return { ...aprovacao, aprovador_nome: profileData?.nome || 'Usuário não encontrado' };
          } catch {
            return { ...aprovacao, aprovador_nome: 'Usuário não encontrado' };
          }
        })
      );

      setAprovacoes(aprovacoesComNomes);
      if (aprovacoesComNomes.length > 0 && !selectedId) {
        setSelectedId(aprovacoesComNomes[0].id);
      }
    } catch (error) {
      logger.error('Erro ao buscar aprovações:', error);
      toast({ title: t('documentos.dialogs.erroCarregarAprovacoes'), description: t('documentos.dialogs.tenteNovamente'), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const fetchProfiles = async () => {
    try {
      let query = supabase
        .from('profiles')
        .select('user_id, nome, email, role')
        .in('role', ['admin', 'super_admin']);

      if (empresaId) query = query.eq('empresa_id', empresaId);

      const { data, error } = await query.order('nome');
      if (error) throw error;
      setProfiles(data || []);
    } catch (error) {
      logger.error('Erro ao buscar profiles:', error);
    }
  };

  // ============ Mutations ============
  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.aprovador_id) {
      toast({ title: t('documentos.dialogs.aprovadorObrigatorioTitulo'), description: t('documentos.dialogs.aprovadorObrigatorioDescricao'), variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();

      const { data: existente, error: checkError } = await supabase
        .from('documentos_aprovacoes')
        .select('id, status')
        .eq('documento_id', documento.id)
        .eq('aprovador_id', formData.aprovador_id)
        .maybeSingle();

      if (checkError) logger.error('Erro ao verificar aprovação existente:', checkError);

      if (existente) {
        toast({
          title: t('documentos.dialogs.solicitacaoJaExisteTitulo'),
          description:
            existente.status === 'pendente'
              ? t('documentos.dialogs.solicitacaoJaExistePendente')
              : t('documentos.dialogs.solicitacaoJaExisteAvaliada'),
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      const aprovacaoData = {
        documento_id: documento.id,
        aprovador_id: formData.aprovador_id,
        status: 'pendente',
        comentarios: formData.comentarios.trim() || null,
        data_aprovacao: null,
        tipo_acao: 'solicitacao',
        solicitado_por: userData.user?.id || null,
        data_solicitacao: new Date().toISOString(),
      };

      const { error } = await supabase.from('documentos_aprovacoes').insert([aprovacaoData]);
      if (error) throw error;

      try {
        await supabase.functions.invoke('send-approval-notification', {
          body: { documento_id: documento.id, aprovador_id: formData.aprovador_id, solicitante_id: userData.user?.id },
        });
      } catch (emailError) {
        logger.error('Erro ao chamar edge function:', emailError);
      }

      toast({
        title: t('documentos.dialogs.solicitacaoEnviadaTitulo'),
        description: t('documentos.dialogs.solicitacaoEnviadaDescricao'),
      });

      setFormData({ aprovador_id: '', comentarios: '' });
      setRequestOpen(false);
      fetchAprovacoes();
      onSuccess();
    } catch (error) {
      logger.error('Erro ao processar:', error);
      toast({
        title: t('documentos.dialogs.erroSolicitarAprovacaoTitulo'),
        description: error instanceof Error ? error.message : t('documentos.dialogs.tenteNovamente'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancelarSolicitacao = async (aprovacaoId: string) => {
    try {
      const { error } = await supabase.from('documentos_aprovacoes').delete().eq('id', aprovacaoId);
      if (error) throw error;
      toast({ title: t('documentos.dialogs.solicitacaoCanceladaTitulo'), description: t('documentos.dialogs.solicitacaoCanceladaDescricao') });
      if (selectedId === aprovacaoId) setSelectedId(null);
      fetchAprovacoes();
    } catch (error) {
      logger.error('Erro ao cancelar solicitação:', error);
      toast({ title: t('documentos.dialogs.erroCancelarSolicitacaoTitulo'), description: t('documentos.dialogs.tenteNovamente'), variant: 'destructive' });
    }
  };

  const handleStatusChange = async (aprovacaoId: string, novoStatus: string, comentarios?: string) => {
    try {
      const { error } = await supabase
        .from('documentos_aprovacoes')
        .update({
          status: novoStatus,
          comentarios: comentarios || null,
          data_aprovacao: novoStatus !== 'pendente' ? new Date().toISOString() : null,
        })
        .eq('id', aprovacaoId);

      if (error) throw error;

      if (novoStatus === 'aprovado') {
        notify('documento_aprovado', {
          titulo: `Documento aprovado: ${documento.nome}`,
          descricao: comentarios || 'Documento foi aprovado com sucesso',
          link: '/documentos',
          gravidade: 'baixa',
        });
      } else if (novoStatus === 'rejeitado') {
        notify('documento_rejeitado', {
          titulo: `Documento rejeitado: ${documento.nome}`,
          descricao: comentarios || 'Documento foi rejeitado',
          link: '/documentos',
          gravidade: 'media',
        });
      }

      toast({ title: t('documentos.dialogs.statusAtualizadoTitulo'), description: t('documentos.dialogs.statusAtualizadoDescricao') });
      fetchAprovacoes();
      onSuccess();
    } catch (error) {
      logger.error('Erro ao atualizar status:', error);
      toast({ title: t('documentos.dialogs.erroAtualizarStatusTitulo'), description: t('documentos.dialogs.tenteNovamente'), variant: 'destructive' });
    }
  };

  // ============ Action modal ============
  const openActionModal = (type: 'aprovar' | 'rejeitar' | 'alteracoes', aprovacaoId: string) => {
    setActionModal({ open: true, type, aprovacaoId });
    setActionComment('');
  };
  const closeActionModal = () => {
    setActionModal({ open: false, type: null, aprovacaoId: '' });
    setActionComment('');
  };
  const executeAction = async () => {
    if (!actionModal.aprovacaoId || !actionModal.type) return;
    if ((actionModal.type === 'rejeitar' || actionModal.type === 'alteracoes') && !actionComment.trim()) {
      toast({
        title: t('documentos.dialogs.comentarioObrigatorioTitulo'),
        description:
          actionModal.type === 'rejeitar' ? t('documentos.dialogs.comentarioObrigatorioRejeicao') : t('documentos.dialogs.comentarioObrigatorioAlteracoes'),
        variant: 'destructive',
      });
      return;
    }
    const novoStatus = actionModal.type === 'aprovar' ? 'aprovado' : actionModal.type === 'rejeitar' ? 'rejeitado' : 'pendente';
    await handleStatusChange(actionModal.aprovacaoId, novoStatus, actionComment.trim() || undefined);
    closeActionModal();
  };

  // ============ Master-detail items (deve ficar antes de qualquer early return) ============
  const items: (MasterDetailItem & { raw: Aprovacao })[] = useMemo(
    () =>
      aprovacoes.map((a) => {
        const info = STATUS_INFO[a.status] ?? STATUS_INFO.pendente;
        return {
          id: a.id,
          label: a.aprovador_nome || 'Aprovador',
          description: format(new Date(a.data_aprovacao || a.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }),
          badge: (
            <StatusBadge tone={info.tone} size="sm">
              {t(info.labelKey)}
            </StatusBadge>
          ),
          icon: User,
          raw: a,
        };
      }),
    [aprovacoes]
  );

  // ============ Early return: requer aprovação desabilitado ============
  if (!(documento as any).requer_aprovacao) {
    return (
      <DialogShell
        open={open}
        onOpenChange={onOpenChange}
        icon={ShieldCheck}
        title={t('documentos.dialogs.aprovacaoDesabilitadaTitulo')}
        description={t('documentos.dialogs.aprovacaoDesabilitadaDescricao')}
        size="md"
        footer={
          <div className="flex justify-end">
            <Button size="sm" onClick={() => onOpenChange(false)}>{t('documentos.dialogs.fechar')}</Button>
          </div>
        }
      >
        <div />
      </DialogShell>
    );
  }

  const statusGeral =
    aprovacoes.length > 0
      ? aprovacoes.some((a) => a.status === 'aprovado')
        ? 'aprovado'
        : aprovacoes.some((a) => a.status === 'rejeitado')
        ? 'rejeitado'
        : 'pendente'
      : null;

  const renderDetail = (item: (MasterDetailItem & { raw: Aprovacao }) | null) => {
    if (!item) return null;
    const a = item.raw;
    const info = STATUS_INFO[a.status] ?? STATUS_INFO.pendente;
    const StatusIcon = info.icon;
    const isAprovador = currentUserId === a.aprovador_id;
    const isSolicitante = currentUserId === a.solicitado_por;

    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold tracking-tight">{a.aprovador_nome}</h2>
            <p className="text-sm text-muted-foreground">
              {a.tipo_acao === 'solicitacao' ? t('documentos.dialogs.solicitacaoAprovacao') : t('documentos.dialogs.registroAprovacao')}
            </p>
          </div>
          <StatusBadge tone={info.tone} icon={<StatusIcon className="h-3 w-3" />}>
            {t(info.labelKey)}
          </StatusBadge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('documentos.dialogs.solicitadaEm')}</p>
            <p className="text-sm">{format(new Date(a.created_at), locale === 'pt' ? "dd/MM/yyyy 'às' HH:mm" : "MM/dd/yyyy 'at' h:mm a", { locale: locale === 'pt' ? ptBR : enUS })}</p>
          </div>
          {a.data_aprovacao && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('documentos.dialogs.decididaEm')}</p>
              <p className="text-sm">{format(new Date(a.data_aprovacao), locale === 'pt' ? "dd/MM/yyyy 'às' HH:mm" : "MM/dd/yyyy 'at' h:mm a", { locale: locale === 'pt' ? ptBR : enUS })}</p>
            </div>
          )}
        </div>

        {a.comentarios && (
          <>
            <Separator />
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('documentos.dialogs.comentariosLabel')}</p>
              <p className="text-sm whitespace-pre-wrap leading-relaxed bg-muted/40 rounded-md p-3 border">{a.comentarios}</p>
            </div>
          </>
        )}

        {a.status === 'pendente' && a.tipo_acao === 'solicitacao' && (
          <>
            <Separator />
            <div className="flex flex-wrap gap-2">
              {isAprovador && (
                <>
                  <Button size="sm" onClick={() => openActionModal('aprovar', a.id)}>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    {t('documentos.dialogs.aprovar')}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => openActionModal('alteracoes', a.id)}>
                    <MessageSquare className="h-4 w-4 mr-2" />
                    {t('documentos.dialogs.solicitarAlteracoes')}
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => openActionModal('rejeitar', a.id)}>
                    <XCircle className="h-4 w-4 mr-2" />
                    {t('documentos.dialogs.rejeitar')}
                  </Button>
                </>
              )}
              {isSolicitante && (
                <Button variant="outline" size="sm" onClick={() => handleCancelarSolicitacao(a.id)}>
                  {t('documentos.dialogs.cancelarSolicitacao')}
                </Button>
              )}
              {!isAprovador && !isSolicitante && (
                <p className="text-xs text-muted-foreground italic">
                  {t('documentos.dialogs.apenasAprovadorSolicitante')}
                </p>
              )}
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <>
      <MasterDetailDialog
        open={open}
        onOpenChange={onOpenChange}
        title={t('documentos.dialogs.aprovacaoDocumentoTitulo')}
        description={documento.nome}
        icon={ShieldCheck}
        items={items}
        selectedId={selectedId}
        onSelect={(it) => setSelectedId(it.id)}
        renderDetail={(it) => renderDetail(it as (MasterDetailItem & { raw: Aprovacao }) | null)}
        onCreate={() => setRequestOpen(true)}
        createLabel={t('documentos.dialogs.novaSolicitacao')}
        searchPlaceholder={t('documentos.dialogs.buscarAprovador')}
        emptyState={
          <div className="space-y-2">
            <CheckCircle className="h-8 w-8 mx-auto text-muted-foreground/60" />
            <p>{t('documentos.dialogs.nenhumaAprovacao')}</p>
            <p className="text-xs">{t('documentos.dialogs.useNovaSolicitacao')}</p>
          </div>
        }
        emptySelection={t('documentos.dialogs.selecioneAprovacao')}
        size="xl"
        footer={
          <>
            {statusGeral && (
              <StatusBadge
                tone={STATUS_INFO[statusGeral].tone}
                icon={React.createElement(STATUS_INFO[statusGeral].icon, { className: 'h-3 w-3' })}
                className="mr-auto"
              >
                {t('documentos.dialogs.statusGeral', { status: t(STATUS_INFO[statusGeral].labelKey) })}
              </StatusBadge>
            )}
            {documento.arquivo_url && (
              <Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)}>
                <Eye className="h-4 w-4 mr-2" />
                {t('documentos.dialogs.visualizarDocumento')}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              {t('documentos.dialogs.fechar')}
            </Button>
          </>
        }
      />

      {/* Sub-dialog: nova solicitação */}
      <DialogShell
        open={requestOpen}
        onOpenChange={setRequestOpen}
        icon={Plus}
        title={t('documentos.dialogs.novaSolicitacaoAprovacaoTitulo')}
        description={t('documentos.dialogs.novaSolicitacaoAprovacaoDescricao')}
        size="sm"
        onSubmit={() => handleSubmitRequest(new Event('submit') as unknown as React.FormEvent)}
        submitLabel={t('documentos.dialogs.enviarSolicitacao')}
        isSubmitting={loading}
      >
          <form onSubmit={handleSubmitRequest} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="aprovador_id">{t('documentos.dialogs.aprovadorObrigatorio')}</Label>
              <Select
                value={formData.aprovador_id}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, aprovador_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('documentos.dialogs.selecioneAprovador')} />
                </SelectTrigger>
                <SelectContent>
                  {profiles.map((profile) => (
                    <SelectItem key={profile.user_id} value={profile.user_id}>
                      <div className="flex items-center gap-2 min-w-0">
                        <User className="h-4 w-4 shrink-0" />
                        <div className="min-w-0">
                          <div className="truncate">{profile.nome}</div>
                          <div className="text-xs text-muted-foreground truncate">{profile.email}</div>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="comentarios">{t('documentos.dialogs.observacoesSolicitacao')}</Label>
              <Textarea
                id="comentarios"
                value={formData.comentarios}
                onChange={(e) => setFormData((prev) => ({ ...prev, comentarios: e.target.value }))}
                placeholder={t('documentos.dialogs.descrevaMotivoSolicitacao')}
                rows={3}
              />
            </div>

          </form>
      </DialogShell>

      {/* Sub-dialog: preview do documento */}
      <DialogShell
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        icon={Eye}
        title={documento.nome}
        description={documento.arquivo_nome || t('documentos.dialogs.visualizacaoDocumento')}
        size="xl"
        noScroll
        className="h-[85vh]"
        footer={
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={() => setPreviewOpen(false)}>
              {t('documentos.dialogs.fechar')}
            </Button>
          </div>
        }
      >
          <div className="flex-1 overflow-hidden bg-muted/20">
            {loadingPreview ? (
              <div className="flex items-center justify-center h-full">
                <AkurisPulse size={32} className="text-muted-foreground" />
              </div>
            ) : !documento?.arquivo_url ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <FileText className="h-16 w-16 mb-4" />
                <p className="text-lg font-medium">{t('documentos.dialogs.documentoSemArquivo')}</p>
              </div>
            ) : !canPreview() ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <FileText className="h-16 w-16 mb-4" />
                <p className="text-lg font-medium">{t('documentos.dialogs.visualizacaoIndisponivel')}</p>
                <p className="text-sm mb-4">{t('documentos.dialogs.arquivoNaoVisualizavel')}</p>
                <Button variant="outline" onClick={() => previewUrl && window.open(previewUrl, '_blank')}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  {t('documentos.dialogs.baixarDocumento')}
                </Button>
              </div>
            ) : isPdf() ? (
              <iframe src={previewUrl || ''} className="w-full h-full" title={t('documentos.dialogs.visualizacaoDocumento')} />
            ) : isImage() ? (
              <div className="flex items-center justify-center h-full p-4">
                <img src={previewUrl || ''} alt={documento.nome} className="max-w-full max-h-full object-contain" />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <FileText className="h-16 w-16 mb-4" />
                <Button variant="outline" onClick={() => previewUrl && window.open(previewUrl, '_blank')}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  {t('documentos.dialogs.abrirNovaAba')}
                </Button>
              </div>
            )}
          </div>
      </DialogShell>

      {/* Sub-dialog: ação (aprovar / rejeitar / solicitar alterações) */}
      <DialogShell
        open={actionModal.open}
        onOpenChange={(o) => !o && closeActionModal()}
        icon={actionModal.type === 'rejeitar' ? XCircle : actionModal.type === 'alteracoes' ? MessageSquare : CheckCircle}
        title={
          actionModal.type === 'aprovar' ? t('documentos.dialogs.aprovarDocumentoTitulo')
            : actionModal.type === 'rejeitar' ? t('documentos.dialogs.rejeitarDocumentoTitulo')
            : t('documentos.dialogs.solicitarAlteracoesTitulo')
        }
        description={
          actionModal.type === 'aprovar' ? t('documentos.dialogs.confirmarAprovacaoDescricao')
            : actionModal.type === 'rejeitar' ? t('documentos.dialogs.motivoRejeicaoObrigatorio')
            : t('documentos.dialogs.descrevaAlteracoesNecessarias')
        }
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={closeActionModal}>
              {t('documentos.dialogs.cancelar')}
            </Button>
            <Button size="sm" onClick={executeAction} variant={actionModal.type === 'rejeitar' ? 'destructive' : 'default'}>
              {actionModal.type === 'aprovar' && t('documentos.dialogs.confirmarAprovacao')}
              {actionModal.type === 'rejeitar' && t('documentos.dialogs.confirmarRejeicao')}
              {actionModal.type === 'alteracoes' && t('documentos.dialogs.enviarSolicitacao')}
            </Button>
          </div>
        }
      >
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="action-comment">
                {actionModal.type === 'rejeitar' && t('documentos.dialogs.motivoRejeicaoLabel')}
                {actionModal.type === 'alteracoes' && t('documentos.dialogs.alteracoesNecessariasLabel')}
                {actionModal.type === 'aprovar' && t('documentos.dialogs.comentariosOpcional')}
              </Label>
              <Textarea
                id="action-comment"
                value={actionComment}
                onChange={(e) => setActionComment(e.target.value)}
                placeholder={
                  actionModal.type === 'alteracoes'
                    ? t('documentos.dialogs.placeholderAlteracoes')
                    : actionModal.type === 'rejeitar'
                    ? t('documentos.dialogs.placeholderRejeicao')
                    : t('documentos.dialogs.placeholderAprovacao')
                }
                rows={4}
              />
            </div>
          </div>
      </DialogShell>
    </>
  );
}
