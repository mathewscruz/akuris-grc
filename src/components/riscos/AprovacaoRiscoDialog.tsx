
import { logger } from '@/lib/logger';
import React, { useState } from 'react';
import { DialogShell } from '@/components/ui/dialog-shell';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { resolveAprovacaoTone } from '@/lib/status-tone';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { CheckCircle, XCircle, Send, Clock, User, MessageSquare, ShieldCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { toast } from 'sonner';
import { UserSelect } from './UserSelect';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatStatus } from '@/lib/text-utils';
import { useLanguage } from '@/contexts/LanguageContext';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  risco: any;
  onSuccess: () => void;
}

export function AprovacaoRiscoDialog({ open, onOpenChange, risco, onSuccess }: Props) {
  const { profile } = useAuth();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [comentario, setComentario] = useState('');
  const [aprovadorId, setAprovadorId] = useState('');

  const statusAprovacao = risco?.status_aprovacao || 'rascunho';
  const historicoAprovacao = (risco?.historico_aprovacao as any[]) || [];
  const isAprovador = risco?.aprovador_id === profile?.user_id;

  // Aceite de risco
  const statusAceite = risco?.status_aceite;
  const isAprovadorAceite = risco?.aprovador_aceite === profile?.user_id;

  const handleEnviarAprovacao = async () => {
    if (!aprovadorId) {
      toast.error(t('riscosDialogs.aprovacao.selecioneAprovador'));
      return;
    }
    setLoading(true);
    try {
      const novoHistorico = [
        ...historicoAprovacao,
        {
          acao: 'enviado',
          usuario_id: profile?.user_id,
          usuario_nome: profile?.nome,
          data: new Date().toISOString(),
          comentario: comentario || t('riscosDialogs.aprovacao.enviadoParaAprovacao')
        }
      ];

      const { error } = await supabase
        .from('riscos')
        .update({
          status_aprovacao: 'pendente',
          aprovador_id: aprovadorId,
          historico_aprovacao: novoHistorico
        })
        .eq('id', risco.id)
        .eq('empresa_id', profile!.empresa_id);

      if (error) throw error;

      await supabase.from('notifications').insert({
        user_id: aprovadorId,
        title: t('riscosDialogs.aprovacao.notificacaoTitle'),
        message: t('riscosDialogs.aprovacao.notificacaoMessage', { nome: risco.nome }),
        type: 'info',
        link_to: '/riscos'
      });

      toast.success(t('riscosDialogs.aprovacao.riscoEnviado'));
      setComentario('');
      onSuccess();
    } catch (error: any) {
      toast.error(t('riscosDialogs.aprovacao.erro', { mensagem: error.message }));
    } finally {
      setLoading(false);
    }
  };

  const handleDecisao = async (decisao: 'aprovado' | 'rejeitado') => {
    setLoading(true);
    try {
      const novoHistorico = [
        ...historicoAprovacao,
        {
          acao: decisao,
          usuario_id: profile?.user_id,
          usuario_nome: profile?.nome,
          data: new Date().toISOString(),
          comentario: comentario || (decisao === 'aprovado' ? t('riscosDialogs.aprovacao.aprovado') : t('riscosDialogs.aprovacao.rejeitado'))
        }
      ];

      const { error } = await supabase
        .from('riscos')
        .update({
          status_aprovacao: decisao,
          data_aprovacao: decisao === 'aprovado' ? new Date().toISOString() : null,
          comentarios_aprovacao: comentario || null,
          historico_aprovacao: novoHistorico
        })
        .eq('id', risco.id)
        .eq('empresa_id', profile!.empresa_id);

      if (error) throw error;

      if (risco.created_by) {
        await supabase.from('notifications').insert({
          user_id: risco.created_by,
          title: decisao === 'aprovado' ? t('riscosDialogs.aprovacao.decisaoTituloAprovado') : t('riscosDialogs.aprovacao.decisaoTituloRejeitado'),
          message: t('riscosDialogs.aprovacao.decisaoMessage', { nome: risco.nome, decisao, comentario: comentario ? t('riscosDialogs.aprovacao.comentarioSufixo', { comentario }) : '' }),
          type: decisao === 'aprovado' ? 'success' : 'warning',
          link_to: '/riscos'
        });
      }

      toast.success(t('riscosDialogs.aprovacao.riscoDecisao', { decisao }));
      setComentario('');
      onSuccess();
    } catch (error: any) {
      toast.error(t('riscosDialogs.aprovacao.erro', { mensagem: error.message }));
    } finally {
      setLoading(false);
    }
  };

  const handleDecisaoAceite = async (decisao: 'aprovado' | 'rejeitado') => {
    setLoading(true);
    try {
      const agora = new Date();
      const historicoAceite: any[] = Array.isArray(risco?.historico_aceite) ? risco.historico_aceite : [];
      const updateData: any = {
        status_aceite: decisao,
        comentarios_aprovacao: comentario || null,
      };

      if (decisao === 'aprovado') {
        // Validade: usa a data pedida; se em falta ou já passada, 12 meses a partir da aprovação.
        let validoAte: string | null = risco?.aceite_valido_ate || null;
        if (!validoAte || new Date(validoAte) <= agora) {
          const d = new Date(agora);
          d.setMonth(d.getMonth() + 12);
          validoAte = d.toISOString().split('T')[0];
        }
        updateData.aceito = true;
        updateData.data_aceite = agora.toISOString();
        updateData.aceite_valido_ate = validoAte;
        // Histórico empilhado: nunca sobrescrever aceites anteriores.
        updateData.historico_aceite = [
          ...historicoAceite,
          {
            evento: 'aprovado',
            em: agora.toISOString(),
            aprovador: profile?.user_id,
            aprovador_nome: profile?.nome,
            valido_ate: validoAte,
            justificativa: risco?.justificativa_aceite || null,
            comentario: comentario || null,
          },
        ];
      } else {
        updateData.aceito = false;
        updateData.data_aceite = null;
        updateData.historico_aceite = [
          ...historicoAceite,
          {
            evento: 'rejeitado',
            em: agora.toISOString(),
            aprovador: profile?.user_id,
            aprovador_nome: profile?.nome,
            comentario: comentario || null,
          },
        ];
      }

      const { error } = await supabase
        .from('riscos')
        .update(updateData)
        .eq('id', risco.id)
        .eq('empresa_id', profile!.empresa_id);

      if (error) throw error;

      // Notificar o criador do risco
      if (risco.created_by) {
        await supabase.from('notifications').insert({
          user_id: risco.created_by,
          title: decisao === 'aprovado' ? t('riscosDialogs.aprovacao.aceiteAprovadoTitulo') : t('riscosDialogs.aprovacao.aceiteRejeitadoTitulo'),
          message: t('riscosDialogs.aprovacao.aceiteDecisaoMessage', { nome: risco.nome, decisao, comentario: comentario ? t('riscosDialogs.aprovacao.comentarioSufixo', { comentario }) : '' }),
          type: decisao === 'aprovado' ? 'success' : 'warning',
          link_to: decisao === 'aprovado' ? '/riscos/aceite' : '/riscos'
        });
      }

      // Enviar e-mail de resultado
      try {
        await supabase.functions.invoke('send-risco-aceite-notification', {
          body: {
            risco_id: risco.id,
            risco_nome: risco.nome,
            aprovador_id: profile?.user_id,
            solicitante_id: risco.created_by,
            empresa_id: profile?.empresa_id,
            tipo: decisao,
            comentario: comentario || undefined
          }
        });
      } catch (emailError) {
        logger.warn('Erro ao enviar e-mail de aceite:', { data: emailError });
      }

      toast.success(decisao === 'aprovado' ? t('riscosDialogs.aprovacao.aceiteDecisaoToastAprovado') : t('riscosDialogs.aprovacao.aceiteDecisaoToastRejeitado'));
      setComentario('');
      onSuccess();
    } catch (error: any) {
      toast.error(t('riscosDialogs.aprovacao.erro', { mensagem: error.message }));
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    if (status === 'aprovado' || status === 'rejeitado' || status === 'pendente') {
      const labels: Record<string, string> = { aprovado: t('riscosDialogs.aprovacao.aprovado'), rejeitado: t('riscosDialogs.aprovacao.rejeitado'), pendente: t('riscosDialogs.aprovacao.pendente') };
      return <StatusBadge {...resolveAprovacaoTone(status)}>{labels[status]}</StatusBadge>;
    }
    return <StatusBadge tone="neutral">{t('riscosDialogs.aprovacao.rascunho')}</StatusBadge>;
  };

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={CheckCircle}
      title={t('riscosDialogs.aprovacao.title')}
      description={risco?.nome}
      size="md"
      hideFooter
    >
          <div className="space-y-4">
            {/* === SEÇÃO ACEITE DE RISCO === */}
            {statusAceite === 'pendente' && (
              <div className="space-y-3 rounded-lg border border-warning/30 bg-warning/5 p-4">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-warning" strokeWidth={1.5} />
                  <Label className="text-base font-semibold">{t('riscosDialogs.aprovacao.aceitePendenteTitulo')}</Label>
                </div>
                <p className="text-sm text-muted-foreground">
                  {risco?.justificativa_aceite && (
                    <><strong>{t('riscosDialogs.aprovacao.justificativa')}</strong> {risco.justificativa_aceite}</>
                  )}
                </p>

                {isAprovadorAceite ? (
                  <>
                    <Textarea
                      value={comentario}
                      onChange={(e) => setComentario(e.target.value)}
                      placeholder={t('riscosDialogs.aprovacao.comentarioPlaceholder')}
                      className="min-h-[60px]"
                    />
                    <div className="flex gap-2">
                      <Button onClick={() => handleDecisaoAceite('aprovado')} disabled={loading} className="flex-1" variant="default">
                        <CheckCircle className="mr-2 h-4 w-4" />
                        {t('riscosDialogs.aprovacao.aprovarAceite')}
                      </Button>
                      <Button onClick={() => handleDecisaoAceite('rejeitado')} disabled={loading} className="flex-1" variant="destructive">
                        <XCircle className="mr-2 h-4 w-4" />
                        {t('riscosDialogs.aprovacao.rejeitarAceite')}
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-muted-foreground text-center py-2 bg-muted rounded-lg">
                    <Clock className="h-5 w-5 mx-auto mb-1 opacity-50" />
                    {t('riscosDialogs.aprovacao.aguardandoDecisaoAprovador')}
                  </div>
                )}
              </div>
            )}

            {statusAceite === 'aprovado' && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-success/10 border border-success/30 text-success text-sm">
                <CheckCircle className="h-4 w-4" strokeWidth={1.5} /> {t('riscosDialogs.aprovacao.aceiteAprovadoEm', { data: risco?.data_aceite ? format(new Date(risco.data_aceite), "dd/MM/yyyy", { locale: ptBR }) : '-' })}
              </div>
            )}

            {statusAceite === 'rejeitado' && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">
                <XCircle className="h-4 w-4" strokeWidth={1.5} /> {t('riscosDialogs.aprovacao.aceiteRejeitadoMsg')}
              </div>
            )}

            {/* === SEÇÃO APROVAÇÃO GERAL === */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{t('riscosDialogs.aprovacao.statusAprovacao')}</span>
              {getStatusBadge(statusAprovacao)}
            </div>

            {(statusAprovacao === 'rascunho' || statusAprovacao === 'rejeitado') && (
              <div className="space-y-3 border rounded-lg p-4">
                <Label>{t('riscosDialogs.aprovacao.enviarParaAprovacao')}</Label>
                <UserSelect
                  value={aprovadorId}
                  onValueChange={setAprovadorId}
                  placeholder={t('riscosDialogs.aprovacao.selecioneOAprovador')}
                />
                <Textarea
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value)}
                  placeholder={t('riscosDialogs.aprovacao.comentarioOpcional')}
                  className="min-h-[60px]"
                />
                <Button onClick={handleEnviarAprovacao} disabled={loading} className="w-full">
                  <Send className="mr-2 h-4 w-4" />
                  {t('riscosDialogs.aprovacao.enviarParaAprovacao')}
                </Button>
              </div>
            )}

            {statusAprovacao === 'pendente' && isAprovador && (
              <div className="space-y-3 border rounded-lg p-4">
                <Label>{t('riscosDialogs.aprovacao.suaDecisao')}</Label>
                <Textarea
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value)}
                  placeholder={t('riscosDialogs.aprovacao.comentarioDecisao')}
                  className="min-h-[60px]"
                />
                <div className="flex gap-2">
                  <Button onClick={() => handleDecisao('aprovado')} disabled={loading} className="flex-1" variant="default">
                    <CheckCircle className="mr-2 h-4 w-4" />
                    {t('riscosDialogs.aprovacao.aprovar')}
                  </Button>
                  <Button onClick={() => handleDecisao('rejeitado')} disabled={loading} className="flex-1" variant="destructive">
                    <XCircle className="mr-2 h-4 w-4" />
                    {t('riscosDialogs.aprovacao.rejeitar')}
                  </Button>
                </div>
              </div>
            )}

            {statusAprovacao === 'pendente' && !isAprovador && (
              <div className="text-sm text-muted-foreground text-center py-4 bg-muted rounded-lg">
                <Clock className="h-6 w-6 mx-auto mb-2 opacity-50" />
                {t('riscosDialogs.aprovacao.aguardandoDecisaoAprovador')}
              </div>
            )}

            {/* Histórico */}
            {historicoAprovacao.length > 0 && (
              <div className="space-y-2">
                <Label>{t('riscosDialogs.aprovacao.historicoAprovacoes')}</Label>
                <div className="space-y-2">
                  {[...historicoAprovacao].reverse().map((item: any, i: number) => (
                    <div key={i} className="border rounded p-3 text-sm space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <User className="h-3 w-3" />
                          <span className="font-medium">{item.usuario_nome || t('riscosDialogs.aprovacao.sistema')}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {item.data ? format(new Date(item.data), "dd/MM/yyyy HH:mm", { locale: ptBR }) : '-'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge size="sm" tone="neutral" variant="outline">{formatStatus(item.acao)}</StatusBadge>
                        {item.comentario && (
                          <span className="text-muted-foreground flex items-center gap-1">
                            <MessageSquare className="h-3 w-3" />
                            {item.comentario}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
    </DialogShell>
  );
}
