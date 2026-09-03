/**
 * DenunciaRelogio — os dois prazos que a lei impõe, e o botão que cumpre um.
 *
 * O módulo não tinha relógio nenhum. A Diretiva (UE) 2019/1937 exige acusar o
 * recebimento em 7 dias e dar retorno ao informante em 3 meses; no Brasil a
 * Lei 14.457/2022 tornou o canal obrigatório onde há CIPA e o Decreto
 * 11.129/2022 lista-o como parâmetro de programa de integridade. Sem prazo à
 * vista e sem registo da acusação, o cliente **não consegue provar** que
 * cumpriu — que é exactamente o que ele compra.
 *
 * Os prazos são escritos pelo banco no momento do registo, a partir da
 * configuração da empresa (ver `tg_denuncia_prazos`). Aqui só se mostram e se
 * fecha o primeiro: acusar o recebimento é uma acção, não um campo.
 */
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { Button } from '@/components/ui/button';
import { IconTime, IconSuccess } from '@/components/icons';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatDateOnly, parseDataLocal } from '@/lib/date-utils';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/toast';
import { avisarDenunciante } from '@/lib/avisar-denunciante';
import { encerrada as jaEncerrada } from '@/lib/prazo-da-denuncia';

interface Props {
  denuncia: {
    id: string;
    prazo_acusacao: string | null;
    prazo_retorno: string | null;
    data_acusacao_recebimento: string | null;
    status: string;
  };
  onAtualizado: () => void;
}

/** Quantos dias faltam — negativo quando já passou. */
function diasAte(data: string | null): number | null {
  if (!data) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const alvo = parseDataLocal(data);
  alvo.setHours(0, 0, 0, 0);
  return Math.round((alvo.getTime() - hoje.getTime()) / 86400000);
}

export function DenunciaRelogio({ denuncia, onAtualizado }: Props) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [salvando, setSalvando] = useState(false);

  const acusada = !!denuncia.data_acusacao_recebimento;
  const encerrada = jaEncerrada(denuncia);
  const diasAcusacao = diasAte(denuncia.prazo_acusacao);
  const diasRetorno = diasAte(denuncia.prazo_retorno);

  const acusarRecebimento = async () => {
    setSalvando(true);
    try {
      const agora = new Date().toISOString();
      const { error } = await supabase
        .from('denuncias')
        .update({ data_acusacao_recebimento: agora })
        .eq('id', denuncia.id);
      if (error) throw error;

      /*
        A acusação entra na trilha E na conversa: quem denunciou tem de a ver
        do lado dele, senão a obrigação foi cumprida no banco e não para a
        pessoa a quem se devia.
      */
      const { error: erroTrilha } = await supabase.from('denuncias_movimentacoes').insert({
        denuncia_id: denuncia.id,
        acao: 'recebimento_acusado',
        status_anterior: denuncia.status,
        status_novo: denuncia.status,
        observacoes: null,
        /* Acusar o recebimento é um facto de quem denunciou: vê-o na consulta.
           E fica assinado — `user` estava aqui, por usar, desde o início. */
        visibilidade: 'publica',
        usuario_id: user?.id ?? null,
      });
      /* A trilha é a prova de que a obrigação foi cumprida. Se ela não entrou,
         a acusação existe no banco e não existe no registo — falha alto. */
      if (erroTrilha) throw erroTrilha;

      /* A acusacao e uma obrigacao PARA COM quem denunciou: cumpri-la sem lhe
         dizer cumpre o registo e nao cumpre a pessoa. */
      void avisarDenunciante(denuncia.id, 'recebimento');
      onAtualizado();
      toast.success(t('denunciasAdmin.relogio.acusada'));
    } catch (e) {
      toast.error(t('denunciasAdmin.relogio.erroAcusar'));
    } finally {
      setSalvando(false);
    }
  };

  /** Verde cumprido, vermelho vencido, âmbar a aproximar-se. */
  const tom = (dias: number | null, cumprido: boolean) => {
    if (cumprido) return 'text-state-done';
    if (dias === null) return 'text-muted-foreground';
    if (dias < 0) return 'text-severity-critical';
    if (dias <= 2) return 'text-warning';
    return 'text-muted-foreground';
  };

  const rotuloPrazo = (dias: number | null) => {
    if (dias === null) return '—';
    if (dias < 0) return t('denunciasAdmin.relogio.vencidoHa', { count: Math.abs(dias) });
    if (dias === 0) return t('denunciasAdmin.relogio.venceHoje');
    return t('denunciasAdmin.relogio.faltamDias', { count: dias });
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <IconTime className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
        <span className="text-micro font-semibold uppercase tracking-wide text-muted-foreground">
          {t('denunciasAdmin.relogio.titulo')}
        </span>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-xs text-muted-foreground">
            {t('denunciasAdmin.relogio.acusacaoRecebimento')}
          </p>
          {acusada ? (
            <p className="mt-0.5 flex items-center gap-1.5 text-sm font-medium text-state-done">
              <IconSuccess className="h-3.5 w-3.5" strokeWidth={1.5} />
              {formatDateOnly(denuncia.data_acusacao_recebimento!)}
            </p>
          ) : (
            <>
              <p className={cn('mt-0.5 text-sm font-medium', tom(diasAcusacao, false))}>
                {rotuloPrazo(diasAcusacao)}
              </p>
              <p className="text-micro text-muted-foreground">
                {t('denunciasAdmin.relogio.ate', {
                  data: denuncia.prazo_acusacao ? formatDateOnly(denuncia.prazo_acusacao) : '—',
                })}
              </p>
              <Button
                size="sm"
                variant="outline"
                className="mt-2 h-7"
                onClick={acusarRecebimento}
                disabled={salvando}
              >
                {t('denunciasAdmin.relogio.acusar')}
              </Button>
            </>
          )}
        </div>

        <div>
          <p className="text-xs text-muted-foreground">{t('denunciasAdmin.relogio.retorno')}</p>
          <p className={cn('mt-0.5 text-sm font-medium', tom(diasRetorno, encerrada))}>
            {encerrada ? t('denunciasAdmin.relogio.cumprido') : rotuloPrazo(diasRetorno)}
          </p>
          <p className="text-micro text-muted-foreground">
            {t('denunciasAdmin.relogio.ate', {
              data: denuncia.prazo_retorno ? formatDateOnly(denuncia.prazo_retorno) : '—',
            })}
          </p>
        </div>
      </div>
    </div>
  );
}
