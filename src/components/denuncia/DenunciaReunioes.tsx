/**
 * DenunciaReunioes — a reunião do art. 9.º/2, do lado do comité.
 *
 * A Diretiva (UE) 2019/1937 obriga o canal a permitir, a pedido de quem
 * denuncia, um encontro presencial. A coluna `permitir_reuniao` já existia na
 * configuração desde a onda anterior — e não havia forma nenhuma de pedir nem
 * de marcar. Era uma opção que ligava e desligava coisa nenhuma.
 *
 * O que a lei pede não acaba na marcação. O art. 18.º/2 diz o que fazer com o
 * que ali se disser: registo completo e exacto, **com consentimento**, e a
 * oportunidade de a pessoa verificar, rectificar e aceitar a acta. Por isso
 * este ecrã tem três momentos e não um: marcar, registar, e partilhar para
 * confirmação. A acta só sai daqui quando houve consentimento — a restrição
 * está no próprio esquema, não só neste botão.
 */
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { StatusBadge } from '@/components/ui/status-badge';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { IconCalendarClock, IconCheck, IconLock } from '@/components/icons';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatDateTime } from '@/lib/date-utils';
import { toast } from '@/lib/toast';
import { avisarDenunciante } from '@/lib/avisar-denunciante';

interface Reuniao {
  id: string;
  estado: string;
  modalidade: string;
  preferencia: string | null;
  solicitada_em: string;
  agendada_para: string | null;
  local: string | null;
  resposta: string | null;
  realizada_em: string | null;
  ata: string | null;
  consentimento_registo: boolean;
  ata_partilhada_em: string | null;
  ata_confirmada_em: string | null;
}

interface Props {
  denunciaId: string;
  empresaId: string;
  status: string;
  onAtualizado: () => void;
}

/** O tom acompanha o que falta fazer, não o que já se fez. */
const TOM_DO_ESTADO: Record<string, { tone: 'warning' | 'info' | 'success' | 'neutral' }> = {
  solicitada: { tone: 'warning' },
  agendada: { tone: 'info' },
  realizada: { tone: 'success' },
  recusada: { tone: 'neutral' },
  cancelada: { tone: 'neutral' },
};

export function DenunciaReunioes({ denunciaId, empresaId, status, onAtualizado }: Props) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [rascunho, setRascunho] = useState<Record<string, Partial<Reuniao>>>({});
  const [guardando, setGuardando] = useState(false);

  const chave = ['denuncia-reunioes', denunciaId];

  const { data: reunioes = [], isLoading } = useQuery({
    queryKey: chave,
    enabled: !!denunciaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('denuncias_reunioes')
        .select('*')
        .eq('denuncia_id', denunciaId)
        .order('solicitada_em', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Reuniao[];
    },
  });

  const campo = <K extends keyof Reuniao>(r: Reuniao, nome: K): Reuniao[K] =>
    (rascunho[r.id]?.[nome] ?? r[nome]) as Reuniao[K];

  const editar = (id: string, mudanca: Partial<Reuniao>) =>
    setRascunho((atual) => ({ ...atual, [id]: { ...atual[id], ...mudanca } }));

  /**
   * Regista a movimentação junto com a mudança — a trilha é a prova.
   *
   * Falha alto de propósito: uma reunião marcada sem registo de que foi
   * marcada é exactamente o que o cliente não consegue mostrar à auditoria.
   */
  const trilha = async (acao: string, observacoes?: string | null) => {
    const { error } = await supabase.from('denuncias_movimentacoes').insert({
      denuncia_id: denunciaId,
      acao,
      status_anterior: status,
      status_novo: status,
      observacoes: observacoes ?? null,
      /* Marcações e datas são do interesse de quem pediu a reunião. */
      visibilidade: 'publica',
      usuario_id: user?.id ?? null,
    });
    if (error) throw error;
  };

  const guardar = async (r: Reuniao, mudanca: Partial<Reuniao>, acao: string) => {
    setGuardando(true);
    try {
      const { error } = await supabase
        .from('denuncias_reunioes')
        .update({ ...mudanca, atualizado_por: user?.id ?? null })
        .eq('id', r.id);
      if (error) throw error;
      await trilha(acao);
      /* Marcar, recusar ou partilhar a acta e novidade para quem pediu a
         reuniao -- e ate agora so aparecia se ela voltasse ao portal. */
      void avisarDenunciante(denunciaId, 'reuniao');
      setRascunho((atual) => ({ ...atual, [r.id]: {} }));
      queryClient.invalidateQueries({ queryKey: chave });
      onAtualizado();
      toast.success(t('denunciasAdmin.reuniao.guardada'));
    } catch {
      toast.error(t('denunciasAdmin.reuniao.erroGuardar'));
    } finally {
      setGuardando(false);
    }
  };

  /* O comité também pode propor — a lei fixa o direito de pedir, não proíbe
     oferecer. Vale sobretudo quando a denúncia chega confusa e uma conversa
     resolve o que dez mensagens não resolvem. */
  const propor = async () => {
    setGuardando(true);
    try {
      const { error } = await supabase.from('denuncias_reunioes').insert({
        denuncia_id: denunciaId,
        empresa_id: empresaId,
        estado: 'agendada',
        modalidade: 'presencial',
        criado_por: user?.id ?? null,
      });
      if (error) throw error;
      await trilha('reuniao_proposta');
      queryClient.invalidateQueries({ queryKey: chave });
      onAtualizado();
    } catch {
      toast.error(t('denunciasAdmin.reuniao.erroGuardar'));
    } finally {
      setGuardando(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <AkurisPulse size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{t('denunciasAdmin.reuniao.explicacao')}</p>
        <Button variant="outline" size="sm" onClick={propor} disabled={guardando}>
          <IconCalendarClock className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.5} />
          {t('denunciasAdmin.reuniao.propor')}
        </Button>
      </div>

      {reunioes.length === 0 ? (
        <div className="rounded-lg border border-border bg-card py-10 text-center">
          <IconCalendarClock className="mx-auto h-8 w-8 text-muted-foreground" strokeWidth={1.5} />
          <p className="mt-2 text-sm text-muted-foreground">{t('denunciasAdmin.reuniao.vazio')}</p>
        </div>
      ) : (
        reunioes.map((r) => {
          const podeAgendar = ['solicitada', 'agendada'].includes(r.estado);
          const podeRegistar = r.estado === 'agendada' || r.estado === 'realizada';
          return (
            <div key={r.id} className="space-y-4 rounded-lg border border-border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <StatusBadge {...(TOM_DO_ESTADO[r.estado] ?? { tone: 'neutral' })}>
                    {t(`denunciasAdmin.reuniao.estado.${r.estado}`)}
                  </StatusBadge>
                  <p className="mt-1 text-micro text-muted-foreground">
                    {t('denunciasAdmin.reuniao.pedidaEm', { data: formatDateTime(r.solicitada_em) })}
                    {' · '}
                    {t(`denunciasAdmin.reuniao.modalidade.${r.modalidade}`)}
                  </p>
                </div>
              </div>

              {/* O que a pessoa escreveu ao pedir. É a primeira coisa a ler. */}
              {r.preferencia && (
                <div className="rounded-md border border-border bg-muted/30 p-3">
                  <p className="text-micro font-semibold uppercase tracking-wide text-muted-foreground">
                    {t('denunciasAdmin.reuniao.preferencia')}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-xs text-foreground">{r.preferencia}</p>
                </div>
              )}

              {podeAgendar && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor={`quando-${r.id}`} className="text-xs">
                      {t('denunciasAdmin.reuniao.quando')}
                    </Label>
                    <Input
                      id={`quando-${r.id}`}
                      type="datetime-local"
                      value={paraCampoLocal(campo(r, 'agendada_para'))}
                      onChange={(e) =>
                        editar(r.id, { agendada_para: deCampoLocal(e.target.value) })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`onde-${r.id}`} className="text-xs">
                      {t('denunciasAdmin.reuniao.onde')}
                    </Label>
                    <Input
                      id={`onde-${r.id}`}
                      value={campo(r, 'local') ?? ''}
                      onChange={(e) => editar(r.id, { local: e.target.value })}
                      placeholder={t('denunciasAdmin.reuniao.ondePlaceholder')}
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor={`resposta-${r.id}`} className="text-xs">
                      {t('denunciasAdmin.reuniao.resposta')}
                    </Label>
                    <Textarea
                      id={`resposta-${r.id}`}
                      rows={2}
                      value={campo(r, 'resposta') ?? ''}
                      onChange={(e) => editar(r.id, { resposta: e.target.value })}
                      placeholder={t('denunciasAdmin.reuniao.respostaPlaceholder')}
                    />
                    <p className="text-micro text-muted-foreground">
                      {t('denunciasAdmin.reuniao.respostaAjuda')}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 sm:col-span-2">
                    <Button
                      size="sm"
                      disabled={guardando || !campo(r, 'agendada_para')}
                      onClick={() =>
                        guardar(
                          r,
                          {
                            estado: 'agendada',
                            agendada_para: campo(r, 'agendada_para'),
                            local: campo(r, 'local'),
                            resposta: campo(r, 'resposta'),
                          },
                          'reuniao_agendada',
                        )
                      }
                    >
                      {t('denunciasAdmin.reuniao.agendar')}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={guardando}
                      onClick={() =>
                        guardar(
                          r,
                          { estado: 'realizada', realizada_em: new Date().toISOString() },
                          'reuniao_realizada',
                        )
                      }
                    >
                      {t('denunciasAdmin.reuniao.marcarRealizada')}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={guardando || !campo(r, 'resposta')}
                      onClick={() =>
                        guardar(
                          r,
                          { estado: 'recusada', resposta: campo(r, 'resposta') },
                          'reuniao_recusada',
                        )
                      }
                    >
                      {t('denunciasAdmin.reuniao.recusar')}
                    </Button>
                  </div>
                </div>
              )}

              {/*
                A acta. Sem consentimento não se guarda registo — e sem registo
                partilhado a pessoa não pode verificar nem rectificar, que é a
                outra metade do art. 18.º/2.
              */}
              {podeRegistar && (
                <div className="space-y-3 border-t border-border pt-3">
                  <div className="space-y-1.5">
                    <Label htmlFor={`ata-${r.id}`} className="text-xs">
                      {t('denunciasAdmin.reuniao.ata')}
                    </Label>
                    <Textarea
                      id={`ata-${r.id}`}
                      rows={5}
                      value={campo(r, 'ata') ?? ''}
                      onChange={(e) => editar(r.id, { ata: e.target.value })}
                      placeholder={t('denunciasAdmin.reuniao.ataPlaceholder')}
                    />
                  </div>

                  <label className="flex cursor-pointer items-start gap-2">
                    <Checkbox
                      checked={campo(r, 'consentimento_registo') === true}
                      onCheckedChange={(v) => editar(r.id, { consentimento_registo: v === true })}
                      className="mt-0.5"
                    />
                    <span className="text-xs leading-snug text-muted-foreground">
                      {t('denunciasAdmin.reuniao.consentimento')}
                    </span>
                  </label>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={guardando}
                      onClick={() =>
                        guardar(
                          r,
                          {
                            ata: campo(r, 'ata'),
                            consentimento_registo: campo(r, 'consentimento_registo'),
                          },
                          'ata_registada',
                        )
                      }
                    >
                      {t('denunciasAdmin.reuniao.guardarAta')}
                    </Button>
                    <Button
                      size="sm"
                      disabled={
                        guardando || !campo(r, 'ata') || campo(r, 'consentimento_registo') !== true
                      }
                      onClick={() =>
                        guardar(
                          r,
                          {
                            ata: campo(r, 'ata'),
                            consentimento_registo: true,
                            ata_partilhada_em: new Date().toISOString(),
                          },
                          'ata_partilhada',
                        )
                      }
                    >
                      {t('denunciasAdmin.reuniao.partilharAta')}
                    </Button>
                  </div>

                  <p className="flex items-start gap-1.5 text-micro text-muted-foreground">
                    <IconLock className="mt-0.5 h-3 w-3 shrink-0" strokeWidth={1.5} />
                    {t('denunciasAdmin.reuniao.ataAjuda')}
                  </p>

                  {r.ata_confirmada_em && (
                    <p className="flex items-center gap-1.5 text-micro font-medium text-state-done">
                      <IconCheck className="h-3 w-3" strokeWidth={1.5} />
                      {t('denunciasAdmin.reuniao.ataConfirmada', {
                        data: formatDateTime(r.ata_confirmada_em),
                      })}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

/**
 * ISO ⇄ campo `datetime-local`, sempre na hora de quem está a ver.
 *
 * O `datetime-local` não tem fuso: escrever `toISOString().slice(0,16)` num
 * deles mostra a hora em UTC com cara de hora local — o mesmo engano que já
 * corrompeu datas noutros módulos deste produto.
 */
function paraCampoLocal(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function deCampoLocal(valor: string): string | null {
  if (!valor) return null;
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
