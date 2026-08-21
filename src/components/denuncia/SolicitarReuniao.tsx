/**
 * SolicitarReuniao — o direito do art. 9.º/2, no ecrã de quem denunciou.
 *
 * A Diretiva (UE) 2019/1937 dá a quem denuncia o direito de pedir um encontro
 * presencial, dentro de prazo razoável. Não é um extra de conveniência: há
 * relatos que ninguém escreve num formulário, e o encontro é a forma de os
 * receber sem exigir que a pessoa os deixe por escrito primeiro.
 *
 * O pedido parte daqui porque é aqui que a pessoa está autenticada — pelo
 * protocolo e pelo código de acompanhamento, as únicas credenciais que tem.
 *
 * A acta fecha o ciclo. O art. 18.º/2 não se contenta com um registo: exige
 * que quem esteve na reunião a possa **verificar, rectificar e aceitar**. Por
 * isso, quando o comité partilha a acta, ela aparece aqui com um botão de
 * confirmação — e a confirmação fica na trilha.
 */
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { StatusBadge } from '@/components/ui/status-badge';
import { IconCalendarClock, IconCheck } from '@/components/icons';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatDateTime } from '@/lib/date-utils';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';

export interface ReuniaoPublica {
  id: string;
  estado: string;
  modalidade: string;
  solicitada_em: string;
  agendada_para: string | null;
  local: string | null;
  resposta: string | null;
  ata: string | null;
  ata_partilhada_em: string | null;
  ata_confirmada_em: string | null;
}

interface Props {
  denunciaId: string;
  codigo: string;
  permitido: boolean;
  reunioes: ReuniaoPublica[];
  onMudou: () => void;
}

const MODALIDADES = ['presencial', 'videochamada', 'telefone'] as const;

const TOM_DO_ESTADO: Record<string, 'warning' | 'info' | 'success' | 'neutral'> = {
  solicitada: 'warning',
  agendada: 'info',
  realizada: 'success',
  recusada: 'neutral',
  cancelada: 'neutral',
};

export function SolicitarReuniao({ denunciaId, codigo, permitido, reunioes, onMudou }: Props) {
  const { t } = useLanguage();
  const [modalidade, setModalidade] = useState<(typeof MODALIDADES)[number]>('presencial');
  const [preferencia, setPreferencia] = useState('');
  const [enviando, setEnviando] = useState(false);

  const emAberto = reunioes.some((r) => ['solicitada', 'agendada'].includes(r.estado));

  const pedir = async () => {
    setEnviando(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-denuncia', {
        body: {
          action: 'reuniao_solicitar',
          denuncia_id: denunciaId,
          codigo,
          modalidade,
          preferencia,
        },
      });
      if (error || data?.error) throw new Error(String(error ?? data?.error));
      setPreferencia('');
      onMudou();
      toast.success(t('publicPortal.reuniao.pedida'));
    } catch (erro) {
      logger.error('Falha ao pedir reunião', { module: 'SolicitarReuniao', error: String(erro) });
      toast.error(t('publicPortal.reuniao.erroPedir'));
    } finally {
      setEnviando(false);
    }
  };

  const confirmarAta = async (reuniaoId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('create-denuncia', {
        body: {
          action: 'reuniao_confirmar_ata',
          reuniao_id: reuniaoId,
          denuncia_id: denunciaId,
          codigo,
        },
      });
      if (error || data?.error) throw new Error(String(error ?? data?.error));
      onMudou();
      toast.success(t('publicPortal.reuniao.ataConfirmada'));
    } catch (erro) {
      logger.error('Falha ao confirmar acta', { module: 'SolicitarReuniao', error: String(erro) });
      toast.error(t('publicPortal.reuniao.erroConfirmar'));
    }
  };

  if (!permitido && reunioes.length === 0) return null;

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <IconCalendarClock className="h-4 w-4 text-primary" strokeWidth={1.5} />
        <h2 className="text-sm font-semibold text-foreground">{t('publicPortal.reuniao.titulo')}</h2>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        {t('publicPortal.reuniao.explicacao')}
      </p>

      {reunioes.map((r) => (
        <div key={r.id} className="mt-4 rounded-md border border-border bg-muted/20 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={TOM_DO_ESTADO[r.estado] ?? 'neutral'}>
              {t(`publicPortal.reuniao.estado.${r.estado}`)}
            </StatusBadge>
            <span className="text-micro text-muted-foreground">
              {t(`publicPortal.reuniao.modalidade.${r.modalidade}`)}
            </span>
          </div>

          {r.agendada_para && (
            <p className="mt-2 text-xs text-foreground">
              {t('publicPortal.reuniao.marcadaPara', { data: formatDateTime(r.agendada_para) })}
              {r.local ? ` · ${r.local}` : ''}
            </p>
          )}

          {r.resposta && (
            <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{r.resposta}</p>
          )}

          {/* A acta, para verificar e aceitar — art. 18.º/2. */}
          {r.ata && r.ata_partilhada_em && (
            <div className="mt-3 border-t border-border pt-3">
              <p className="text-micro font-semibold uppercase tracking-wide text-muted-foreground">
                {t('publicPortal.reuniao.ata')}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-xs text-foreground">{r.ata}</p>
              {r.ata_confirmada_em ? (
                <p className="mt-2 flex items-center gap-1.5 text-micro font-medium text-state-done">
                  <IconCheck className="h-3 w-3" strokeWidth={1.5} />
                  {t('publicPortal.reuniao.ataAceite', {
                    data: formatDateTime(r.ata_confirmada_em),
                  })}
                </p>
              ) : (
                <>
                  <p className="mt-2 text-micro text-muted-foreground">
                    {t('publicPortal.reuniao.ataAjuda')}
                  </p>
                  <Button size="sm" className="mt-2" onClick={() => confirmarAta(r.id)}>
                    {t('publicPortal.reuniao.confirmarAta')}
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      ))}

      {permitido && !emAberto && (
        <div className="mt-4 space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">{t('publicPortal.reuniao.como')}</Label>
            <div className="flex flex-wrap gap-2">
              {MODALIDADES.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setModalidade(m)}
                  className={
                    modalidade === m
                      ? 'rounded-md border border-primary bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary'
                      : 'rounded-md border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-ui hover:bg-accent'
                  }
                >
                  {t(`publicPortal.reuniao.modalidade.${m}`)}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="preferencia-reuniao" className="text-xs">
              {t('publicPortal.reuniao.preferencia')}
            </Label>
            <Textarea
              id="preferencia-reuniao"
              rows={3}
              maxLength={2000}
              value={preferencia}
              onChange={(e) => setPreferencia(e.target.value)}
              placeholder={t('publicPortal.reuniao.preferenciaPlaceholder')}
            />
          </div>

          <Button size="sm" onClick={pedir} disabled={enviando}>
            {t('publicPortal.reuniao.pedir')}
          </Button>
        </div>
      )}
    </section>
  );
}
