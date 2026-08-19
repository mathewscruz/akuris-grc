import { useEffect, useState } from "react";
import { IconDownload, IconView, IconSuccess, IconInfo, IconTime, IconCalendar, IconFile, IconPerson } from '@/components/icons';
import { DialogShell } from "@/components/ui/dialog-shell";
import { Button } from "@/components/ui/button";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { useLanguage } from '@/contexts/LanguageContext';
import { dateFnsLocale, formatDateOnly } from '@/lib/date-utils';
import { formatStatus } from '@/lib/text-utils';
interface DocumentoHistorico {
  id: string;
  versao: number;
  arquivo_url: string | null;
  arquivo_nome: string | null;
  status: string;
  data_aprovacao: string | null;
  aprovado_por: string | null;
  data_vencimento: string | null;
  observacoes: string | null;
  created_at: string;
  created_by: string | null;
  created_by_nome?: string;
  aprovador_nome?: string;
}

interface Documento {
  id: string;
  nome: string;
  versao: number;
  status: string;
  arquivo_url?: string;
  arquivo_nome?: string;
  data_aprovacao?: string;
  aprovado_por?: string;
  data_vencimento?: string;
  created_at: string;
  created_by?: string;
}

interface HistoricoVersoesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documento: Documento | null;
}

export const HistoricoVersoesDialog = ({
  open,
  onOpenChange,
  documento,
}: HistoricoVersoesDialogProps) => {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [historico, setHistorico] = useState<DocumentoHistorico[]>([]);

  useEffect(() => {
    if (open && documento) {
      fetchHistorico();
    }
  }, [open, documento]);

  const fetchHistorico = async () => {
    if (!documento) return;

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('documentos_historico')
        .select(`
          *,
          created_by_profile:profiles!documentos_historico_created_by_fkey(nome),
          aprovador_profile:profiles!documentos_historico_aprovado_por_fkey(nome)
        `)
        .eq('documento_id', documento.id)
        .order('versao', { ascending: false });

      if (error) throw error;

      const historicoFormatado = data.map((item: any) => ({
        ...item,
        created_by_nome: item.created_by_profile?.nome || t('documentosExtras.historico.sistema'),
        aprovador_nome: item.aprovador_profile?.nome || null,
      }));

      setHistorico(historicoFormatado);
    } catch (error: any) {
      console.error('Erro ao buscar histórico:', error);
      toast.error(t('documentosExtras.historico.erroBuscar'));
    } finally {
      setLoading(false);
    }
  };

  const handleVisualizarExterno = async (arquivo_url: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('documentos')
        .createSignedUrl(arquivo_url, 3600);

      if (error) throw error;
      
      window.open(data.signedUrl, '_blank');
    } catch (error) {
      console.error('Erro ao gerar URL do arquivo:', error);
      toast.error(t('documentosExtras.historico.erroAbrirDocumento'));
    }
  };

  const handleDownload = async (arquivo_url: string, arquivo_nome: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('documentos')
        .createSignedUrl(arquivo_url, 3600);

      if (error) throw error;

      const response = await fetch(data.signedUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = arquivo_nome;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success(t('documentosExtras.historico.downloadIniciado'));
    } catch (error) {
      console.error('Erro ao fazer download:', error);
      toast.error(t('documentosExtras.historico.erroDownload'));
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; tone: StatusTone }> = {
      ativo: { label: t('documentosExtras.historico.statusAtivo'), tone: 'success' },
      inativo: { label: t('documentosExtras.historico.statusInativo'), tone: 'neutral' },
      pendente_aprovacao: { label: t('documentosExtras.historico.statusPendente'), tone: 'warning' },
      rejeitado: { label: t('documentosExtras.historico.statusRejeitado'), tone: 'destructive' },
    };

    const config = statusConfig[status] || { label: formatStatus(status), tone: 'neutral' as StatusTone };
    return <StatusBadge tone={config.tone}>{config.label}</StatusBadge>;
  };

  if (!documento) return null;

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={IconFile}
      title={t('documentosExtras.historico.titulo').replace('{nome}', documento.nome)}
      size="lg"
      hideFooter
    >
        <div>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <AkurisPulse size={32} className="text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4 pr-4">
              {/* Versão Atual */}
              <Card className="p-4 border-primary/40">
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">
                          {t('documentosExtras.historico.versaoAtual').replace('{versao}', String(documento.versao))}
                        </h3>
                        {getStatusBadge(documento.status)}
                      </div>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <IconCalendar className="h-3 w-3" />
                        {format(new Date(documento.created_at), "dd/MM/yyyy 'às' HH:mm", {
                          locale: dateFnsLocale(),
                        })}
                      </p>
                    </div>
                  </div>

                  {documento.arquivo_nome && (
                    <div className="flex items-center gap-2 text-sm">
                      <IconFile className="h-4 w-4 text-muted-foreground" />
                      <span className="truncate flex-1">{documento.arquivo_nome}</span>
                    </div>
                  )}

                  {documento.data_aprovacao && documento.aprovado_por && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <IconSuccess className="h-4 w-4 text-success" />
                      <span>
                        {t('documentosExtras.historico.aprovadoEm').replace('{data}', formatDateOnly(documento.data_aprovacao))}
                      </span>
                    </div>
                  )}

                  {documento.data_vencimento && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <IconTime className="h-4 w-4" />
                      <span>
                        {t('documentosExtras.historico.vencimento').replace('{data}', formatDateOnly(documento.data_vencimento))}
                      </span>
                    </div>
                  )}

                  {documento.arquivo_url && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleVisualizarExterno(documento.arquivo_url!)}
                      >
                        <IconView className="mr-2 h-4 w-4" />
                        {t('documentosExtras.historico.visualizar')}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          handleDownload(documento.arquivo_url!, documento.arquivo_nome!)
                        }
                      >
                        <IconDownload className="mr-2 h-4 w-4" />
                        {t('documentosExtras.historico.download')}
                      </Button>
                    </div>
                  )}
                </div>
              </Card>

              {/* Versões Anteriores */}
              {historico.length > 0 ? (
                <>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Separator className="flex-1" />
                    <span>{t('documentosExtras.historico.versoesAnteriores')}</span>
                    <Separator className="flex-1" />
                  </div>

                  {historico.map((versao) => (
                    <Card key={versao.id} className="p-4">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold">{t('documentosExtras.historico.versao').replace('{versao}', String(versao.versao))}</h3>
                              {getStatusBadge(versao.status)}
                              <StatusBadge tone="neutral">{t('documentosExtras.historico.arquivada')}</StatusBadge>
                            </div>
                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                              <IconCalendar className="h-3 w-3" />
                              {format(new Date(versao.created_at), "dd/MM/yyyy 'às' HH:mm", {
                                locale: dateFnsLocale(),
                              })}
                            </p>
                          </div>
                        </div>

                        {versao.arquivo_nome && (
                          <div className="flex items-center gap-2 text-sm">
                            <IconFile className="h-4 w-4 text-muted-foreground" />
                            <span className="truncate flex-1">{versao.arquivo_nome}</span>
                          </div>
                        )}

                        {versao.created_by_nome && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <IconPerson className="h-4 w-4" />
                            <span>{t('documentosExtras.historico.criadoPor').replace('{nome}', versao.created_by_nome)}</span>
                          </div>
                        )}

                        {versao.data_aprovacao && versao.aprovador_nome && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <IconSuccess className="h-4 w-4 text-success" />
                            <span>
                              {t('documentosExtras.historico.aprovadoPorEm')
                                .replace('{nome}', versao.aprovador_nome)
                                .replace('{data}', formatDateOnly(versao.data_aprovacao))}
                            </span>
                          </div>
                        )}

                        {versao.data_vencimento && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <IconTime className="h-4 w-4" />
                            <span>
                              {t('documentosExtras.historico.vencimento').replace('{data}', formatDateOnly(versao.data_vencimento))}
                            </span>
                          </div>
                        )}

                        {versao.observacoes && (
                          <div className="flex gap-2 text-sm">
                            <IconInfo className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                            <p className="text-muted-foreground">{versao.observacoes}</p>
                          </div>
                        )}

                        {versao.arquivo_url && (
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleVisualizarExterno(versao.arquivo_url!)}
                            >
                              <IconView className="mr-2 h-4 w-4" />
                              {t('documentosExtras.historico.visualizar')}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                handleDownload(versao.arquivo_url!, versao.arquivo_nome!)
                              }
                            >
                              <IconDownload className="mr-2 h-4 w-4" />
                              {t('documentosExtras.historico.download')}
                            </Button>
                          </div>
                        )}
                      </div>
                    </Card>
                  ))}
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <IconFile className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>{t('documentosExtras.historico.nenhumaVersaoAnterior')}</p>
                  <p className="text-sm mt-1">{t('documentosExtras.historico.primeiroRegistro')}</p>
                </div>
              )}
            </div>
          )}
        </div>
    </DialogShell>
  );
};
