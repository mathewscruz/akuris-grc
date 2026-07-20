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
import { ptBR } from 'date-fns/locale';
import { useIntegrationNotify } from '@/hooks/useIntegrationNotify';
import { logger } from '@/lib/logger';
import { MasterDetailDialog, type MasterDetailItem } from '@/components/ui/master-detail-dialog';
import { Separator } from '@/components/ui/separator';

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

const STATUS_INFO: Record<string, { label: string; icon: typeof Clock; tone: StatusTone }> = {
  pendente: { label: 'Pendente', icon: Clock, tone: 'warning' },
  aprovado: { label: 'Aprovado', icon: CheckCircle, tone: 'success' },
  rejeitado: { label: 'Rejeitado', icon: XCircle, tone: 'destructive' },
};

export function AprovacaoDialog({ open, onOpenChange, documento, onSuccess, empresaId }: AprovacaoDialogProps) {
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
      toast({ title: 'Erro ao carregar aprovações', description: 'Tente novamente em alguns instantes.', variant: 'destructive' });
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
      toast({ title: 'Aprovador obrigatório', description: 'Por favor, selecione um aprovador.', variant: 'destructive' });
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
          title: 'Solicitação já existe',
          description:
            existente.status === 'pendente'
              ? 'Já existe uma solicitação pendente para este aprovador. Cancele a anterior antes de enviar uma nova.'
              : 'Este aprovador já avaliou este documento. Cancele a aprovação anterior se desejar reenviar.',
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
        title: 'Solicitação enviada',
        description: 'A solicitação de aprovação foi enviada com sucesso. O aprovador receberá uma notificação.',
      });

      setFormData({ aprovador_id: '', comentarios: '' });
      setRequestOpen(false);
      fetchAprovacoes();
      onSuccess();
    } catch (error) {
      logger.error('Erro ao processar:', error);
      toast({
        title: 'Erro ao solicitar aprovação',
        description: error instanceof Error ? error.message : 'Tente novamente em alguns instantes.',
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
      toast({ title: 'Solicitação cancelada', description: 'A solicitação de aprovação foi cancelada com sucesso.' });
      if (selectedId === aprovacaoId) setSelectedId(null);
      fetchAprovacoes();
    } catch (error) {
      logger.error('Erro ao cancelar solicitação:', error);
      toast({ title: 'Erro ao cancelar solicitação', description: 'Tente novamente em alguns instantes.', variant: 'destructive' });
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

      toast({ title: 'Status atualizado', description: 'O status da aprovação foi atualizado com sucesso.' });
      fetchAprovacoes();
      onSuccess();
    } catch (error) {
      logger.error('Erro ao atualizar status:', error);
      toast({ title: 'Erro ao atualizar status', description: 'Tente novamente em alguns instantes.', variant: 'destructive' });
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
        title: 'Comentário obrigatório',
        description:
          actionModal.type === 'rejeitar' ? 'Por favor, informe o motivo da rejeição.' : 'Por favor, descreva as alterações necessárias.',
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
              {info.label}
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
        title="Sistema de Aprovação Desabilitado"
        description='Este documento não requer aprovação. Para habilitar o sistema de aprovação, edite o documento e marque a opção "Requer Aprovação".'
        size="md"
        footer={
          <div className="flex justify-end">
            <Button size="sm" onClick={() => onOpenChange(false)}>Fechar</Button>
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
              {a.tipo_acao === 'solicitacao' ? 'Solicitação de aprovação' : 'Registro de aprovação'}
            </p>
          </div>
          <StatusBadge tone={info.tone} icon={<StatusIcon className="h-3 w-3" />}>
            {info.label}
          </StatusBadge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Solicitada em</p>
            <p className="text-sm">{format(new Date(a.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
          </div>
          {a.data_aprovacao && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Decidida em</p>
              <p className="text-sm">{format(new Date(a.data_aprovacao), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
            </div>
          )}
        </div>

        {a.comentarios && (
          <>
            <Separator />
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Comentários</p>
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
                    Aprovar
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => openActionModal('alteracoes', a.id)}>
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Solicitar Alterações
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => openActionModal('rejeitar', a.id)}>
                    <XCircle className="h-4 w-4 mr-2" />
                    Rejeitar
                  </Button>
                </>
              )}
              {isSolicitante && (
                <Button variant="outline" size="sm" onClick={() => handleCancelarSolicitacao(a.id)}>
                  Cancelar Solicitação
                </Button>
              )}
              {!isAprovador && !isSolicitante && (
                <p className="text-xs text-muted-foreground italic">
                  Apenas o aprovador designado ou quem solicitou pode agir nesta aprovação.
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
        title="Aprovação do Documento"
        description={documento.nome}
        icon={ShieldCheck}
        items={items}
        selectedId={selectedId}
        onSelect={(it) => setSelectedId(it.id)}
        renderDetail={(it) => renderDetail(it as (MasterDetailItem & { raw: Aprovacao }) | null)}
        onCreate={() => setRequestOpen(true)}
        createLabel="Nova Solicitação"
        searchPlaceholder="Buscar aprovador..."
        emptyState={
          <div className="space-y-2">
            <CheckCircle className="h-8 w-8 mx-auto text-muted-foreground/60" />
            <p>Nenhuma aprovação registrada</p>
            <p className="text-xs">Use "Nova Solicitação" para começar</p>
          </div>
        }
        emptySelection="Selecione uma aprovação à esquerda para ver os detalhes."
        size="xl"
        footer={
          <>
            {statusGeral && (
              <StatusBadge
                tone={STATUS_INFO[statusGeral].tone}
                icon={React.createElement(STATUS_INFO[statusGeral].icon, { className: 'h-3 w-3' })}
                className="mr-auto"
              >
                Status geral: {STATUS_INFO[statusGeral].label}
              </StatusBadge>
            )}
            {documento.arquivo_url && (
              <Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)}>
                <Eye className="h-4 w-4 mr-2" />
                Visualizar Documento
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </>
        }
      />

      {/* Sub-dialog: nova solicitação */}
      <DialogShell
        open={requestOpen}
        onOpenChange={setRequestOpen}
        icon={Plus}
        title="Nova Solicitação de Aprovação"
        description="Selecione um aprovador e adicione observações se necessário."
        size="sm"
        onSubmit={() => handleSubmitRequest(new Event('submit') as unknown as React.FormEvent)}
        submitLabel="Enviar Solicitação"
        isSubmitting={loading}
      >
          <form onSubmit={handleSubmitRequest} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="aprovador_id">Aprovador *</Label>
              <Select
                value={formData.aprovador_id}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, aprovador_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o aprovador" />
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
              <Label htmlFor="comentarios">Observações da Solicitação</Label>
              <Textarea
                id="comentarios"
                value={formData.comentarios}
                onChange={(e) => setFormData((prev) => ({ ...prev, comentarios: e.target.value }))}
                placeholder="Descreva o motivo da solicitação ou observações importantes"
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
        description={documento.arquivo_nome || 'Visualização do documento'}
        size="xl"
        noScroll
        className="h-[85vh]"
        footer={
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={() => setPreviewOpen(false)}>
              Fechar
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
                <p className="text-lg font-medium">Documento sem arquivo anexado</p>
              </div>
            ) : !canPreview() ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <FileText className="h-16 w-16 mb-4" />
                <p className="text-lg font-medium">Visualização não disponível</p>
                <p className="text-sm mb-4">Este tipo de arquivo não pode ser visualizado no navegador.</p>
                <Button variant="outline" onClick={() => previewUrl && window.open(previewUrl, '_blank')}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Baixar Documento
                </Button>
              </div>
            ) : isPdf() ? (
              <iframe src={previewUrl || ''} className="w-full h-full" title="Preview do documento" />
            ) : isImage() ? (
              <div className="flex items-center justify-center h-full p-4">
                <img src={previewUrl || ''} alt={documento.nome} className="max-w-full max-h-full object-contain" />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <FileText className="h-16 w-16 mb-4" />
                <Button variant="outline" onClick={() => previewUrl && window.open(previewUrl, '_blank')}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Abrir em Nova Aba
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
          actionModal.type === 'aprovar' ? 'Aprovar Documento'
            : actionModal.type === 'rejeitar' ? 'Rejeitar Documento'
            : 'Solicitar Alterações'
        }
        description={
          actionModal.type === 'aprovar' ? 'Confirme a aprovação do documento. Você pode adicionar um comentário opcional.'
            : actionModal.type === 'rejeitar' ? 'Informe o motivo da rejeição. Este campo é obrigatório.'
            : 'Descreva as alterações necessárias. O documento permanecerá pendente até as correções serem realizadas.'
        }
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={closeActionModal}>
              Cancelar
            </Button>
            <Button size="sm" onClick={executeAction} variant={actionModal.type === 'rejeitar' ? 'destructive' : 'default'}>
              {actionModal.type === 'aprovar' && 'Confirmar Aprovação'}
              {actionModal.type === 'rejeitar' && 'Confirmar Rejeição'}
              {actionModal.type === 'alteracoes' && 'Enviar Solicitação'}
            </Button>
          </div>
        }
      >
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="action-comment">
                {actionModal.type === 'rejeitar' && 'Motivo da Rejeição *'}
                {actionModal.type === 'alteracoes' && 'Alterações Necessárias *'}
                {actionModal.type === 'aprovar' && 'Comentários (opcional)'}
              </Label>
              <Textarea
                id="action-comment"
                value={actionComment}
                onChange={(e) => setActionComment(e.target.value)}
                placeholder={
                  actionModal.type === 'alteracoes'
                    ? 'Descreva detalhadamente as alterações necessárias...'
                    : actionModal.type === 'rejeitar'
                    ? 'Informe o motivo da rejeição...'
                    : 'Adicione um comentário sobre a aprovação...'
                }
                rows={4}
              />
            </div>
          </div>
      </DialogShell>
    </>
  );
}
