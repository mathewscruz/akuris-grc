/**
 * DenunciaApuracao — a trilha da apuração, com nome em cada linha.
 *
 * O histórico existia e respondia a duas das três perguntas: o QUE aconteceu e
 * QUANDO. Nunca respondeu a QUEM — e uma apuração passa por várias mãos
 * (recebe o comité, atribui-se um responsável, ouve-se o RH, opina o jurídico),
 * de modo que uma trilha sem autor não serve de prova a ninguém.
 *
 * A coluna `usuario_id` estava lá desde 2025, com chave estrangeira para
 * `profiles`, e nenhuma das duas escritas da aplicação a preenchia. Agora
 * escreve-se aqui e o banco assina por omissão (`DEFAULT auth.uid()`), para
 * que nem uma escrita futura distraída consiga deixar linha anónima.
 *
 * ## O sigilo, que era o problema maior
 *
 * O texto destas notas saía na consulta pública por protocolo. Quem denunciou
 * lia a deliberação do comité — incluindo o que se dizia sobre terceiros. Cada
 * consideração passa a nascer INTERNA, e partilhar com quem denunciou é uma
 * escolha explícita, feita linha a linha, com o aviso ao lado.
 */
import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  IconHistory,
  IconLock,
  IconMessage,
  IconUserOff,
  IconCalendarClock,
  IconFlag,
  IconCheck,
} from '@/components/icons';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatDateTime } from '@/lib/date-utils';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/toast';

interface Movimentacao {
  id: string;
  acao: string;
  status_anterior: string | null;
  status_novo: string | null;
  observacoes: string | null;
  visibilidade: string;
  usuario_id: string | null;
  created_at: string | null;
}

interface Props {
  denunciaId: string;
  status: string;
  onAtualizado: () => void;
}

/** Cada acção tem um ícone próprio — a trilha lê-se de relance, não à letra. */
const ICONE_DA_ACAO: Record<string, typeof IconHistory> = {
  registada: IconFlag,
  status_alterado: IconHistory,
  observacao_adicionada: IconMessage,
  consideracao: IconMessage,
  recebimento_acusado: IconCheck,
  reuniao_solicitada: IconCalendarClock,
  reuniao_agendada: IconCalendarClock,
  reuniao_realizada: IconCalendarClock,
  ata_confirmada: IconCheck,
  impedimento_declarado: IconUserOff,
};

export function DenunciaApuracao({ denunciaId, status, onAtualizado }: Props) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [texto, setTexto] = useState('');
  const [partilhar, setPartilhar] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [pedindoImpedimento, setPedindoImpedimento] = useState(false);
  const [motivoImpedimento, setMotivoImpedimento] = useState('');

  const chave = ['denuncia-apuracao', denunciaId];

  const { data: movimentacoes = [], isLoading } = useQuery({
    queryKey: chave,
    enabled: !!denunciaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('denuncias_movimentacoes')
        .select('id, acao, status_anterior, status_novo, observacoes, visibilidade, usuario_id, created_at')
        .eq('denuncia_id', denunciaId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Movimentacao[];
    },
  });

  /* Os nomes de quem assinou, numa consulta só. */
  const autores = useMemo(
    () => Array.from(new Set(movimentacoes.map((m) => m.usuario_id).filter(Boolean) as string[])),
    [movimentacoes],
  );

  const { data: perfis = {} } = useQuery({
    queryKey: ['denuncia-apuracao-autores', denunciaId, autores.join(',')],
    enabled: autores.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('user_id, nome')
        .in('user_id', autores);
      return Object.fromEntries((data ?? []).map((p) => [p.user_id, p.nome ?? '']));
    },
  });

  const { data: impedimentos = [] } = useQuery({
    queryKey: ['denuncia-impedimentos', denunciaId],
    enabled: !!denunciaId,
    queryFn: async () => {
      const { data } = await supabase
        .from('denuncias_impedimentos')
        .select('id, user_id, motivo, created_at')
        .eq('denuncia_id', denunciaId);
      return data ?? [];
    },
  });

  const registarConsideracao = async () => {
    const conteudo = texto.trim();
    if (!conteudo) return;
    setGuardando(true);
    try {
      const { error } = await supabase.from('denuncias_movimentacoes').insert({
        denuncia_id: denunciaId,
        acao: 'consideracao',
        status_anterior: status,
        status_novo: status,
        observacoes: conteudo,
        /* Interna por omissão. Partilhar é um acto, não um esquecimento. */
        visibilidade: partilhar ? 'publica' : 'interna',
        usuario_id: user?.id ?? null,
      });
      if (error) throw error;
      setTexto('');
      setPartilhar(false);
      queryClient.invalidateQueries({ queryKey: chave });
      onAtualizado();
      toast.success(t('denunciasAdmin.apuracao.registada'));
    } catch {
      toast.error(t('denunciasAdmin.apuracao.erroRegistar'));
    } finally {
      setGuardando(false);
    }
  };

  /*
    O impedimento é irreversível para quem o declara: a política de acesso
    exclui-o desta denúncia no instante seguinte. É essa a intenção — um
    conflito de interesse declarado não se desfaz com um clique.
  */
  const declararImpedimento = async () => {
    if (!user?.id) return;
    const motivo = motivoImpedimento.trim();
    try {
      /*
        A trilha primeiro. Depois do impedimento entrar, a política já não me
        deixa escrever nesta denúncia — se a ordem fosse a inversa, o registo
        de que me retirei nunca chegaria a existir.
      */
      const { error: erroTrilha } = await supabase.from('denuncias_movimentacoes').insert({
        denuncia_id: denunciaId,
        acao: 'impedimento_declarado',
        status_anterior: status,
        status_novo: status,
        observacoes: motivo || null,
        visibilidade: 'interna',
        usuario_id: user.id,
      });
      if (erroTrilha) throw erroTrilha;

      const { error } = await supabase.from('denuncias_impedimentos').insert({
        denuncia_id: denunciaId,
        user_id: user.id,
        motivo: motivo || null,
      });
      if (error) throw error;

      setPedindoImpedimento(false);
      setMotivoImpedimento('');
      toast.success(t('denunciasAdmin.apuracao.impedimentoRegistado'));
      onAtualizado();
    } catch {
      toast.error(t('denunciasAdmin.apuracao.erroImpedimento'));
    }
  };

  const rotuloDaAcao = (mov: Movimentacao) => {
    const chaveAcao = `denunciasAdmin.apuracao.acao.${mov.acao}`;
    const rotulo = t(chaveAcao);
    if (mov.acao === 'status_alterado' && mov.status_anterior && mov.status_novo) {
      return t('denunciasAdmin.apuracao.acao.status_alterado_de_para', {
        de: t(`denunciasAdmin.dialog.status${estadoEmChave(mov.status_anterior)}`),
        para: t(`denunciasAdmin.dialog.status${estadoEmChave(mov.status_novo)}`),
      });
    }
    return rotulo;
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
      {/* Declarar-se impedido fecha a porta a quem declara. Pergunta-se antes. */}
      <AlertDialog open={pedindoImpedimento} onOpenChange={setPedindoImpedimento}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('denunciasAdmin.apuracao.impedimentoTitulo')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('denunciasAdmin.apuracao.impedimentoAviso')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            value={motivoImpedimento}
            onChange={(e) => setMotivoImpedimento(e.target.value)}
            rows={3}
            maxLength={1000}
            placeholder={t('denunciasAdmin.apuracao.impedimentoMotivo')}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>{t('denunciasAdmin.apuracao.cancelar')}</AlertDialogCancel>
            <AlertDialogAction onClick={declararImpedimento}>
              {t('denunciasAdmin.apuracao.impedimentoConfirmar')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Escrever a consideração é a acção principal desta aba. */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <p className="text-micro font-semibold uppercase tracking-wide text-muted-foreground">
            {t('denunciasAdmin.apuracao.titulo')}
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="h-7"
            onClick={() => setPedindoImpedimento(true)}
          >
            <IconUserOff className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.5} />
            {t('denunciasAdmin.apuracao.declararImpedimento')}
          </Button>
        </div>
        <p className="mt-1 text-micro text-muted-foreground">
          {t('denunciasAdmin.apuracao.explicacao')}
        </p>

        <Textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={3}
          maxLength={5000}
          className="mt-3"
          placeholder={t('denunciasAdmin.apuracao.placeholder')}
        />

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={partilhar}
              onChange={(e) => setPartilhar(e.target.checked)}
              className="h-3.5 w-3.5 rounded-md border-border"
            />
            {t('denunciasAdmin.apuracao.partilhar')}
          </label>
          <Button size="sm" onClick={registarConsideracao} disabled={guardando || !texto.trim()}>
            {t('denunciasAdmin.apuracao.registar')}
          </Button>
        </div>
        {partilhar && (
          <p className="mt-2 text-micro text-warning">{t('denunciasAdmin.apuracao.avisoPartilha')}</p>
        )}
      </div>

      {impedimentos.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-micro font-semibold uppercase tracking-wide text-muted-foreground">
            {t('denunciasAdmin.apuracao.impedidos')}
          </p>
          <ul className="mt-2 space-y-1">
            {impedimentos.map((i) => (
              <li key={i.id} className="text-xs text-muted-foreground">
                {perfis[i.user_id] || t('denunciasAdmin.apuracao.semNome')}
                {i.motivo ? ` — ${i.motivo}` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* A trilha. Do mais recente para trás, com quem, quando e o quê. */}
      {movimentacoes.length === 0 ? (
        <div className="rounded-lg border border-border bg-card py-10 text-center">
          <IconHistory className="mx-auto h-8 w-8 text-muted-foreground" strokeWidth={1.5} />
          <p className="mt-2 text-sm text-muted-foreground">
            {t('denunciasAdmin.apuracao.vazio')}
          </p>
        </div>
      ) : (
        <ol className="overflow-hidden rounded-lg border border-border bg-card">
          {movimentacoes.map((mov, i) => {
            const Icone = ICONE_DA_ACAO[mov.acao] ?? IconHistory;
            const autor = mov.usuario_id ? perfis[mov.usuario_id] : null;
            const publica = mov.visibilidade === 'publica';
            return (
              <li
                key={mov.id}
                className={cn(
                  'flex gap-3 px-4 py-3',
                  i > 0 && 'border-t border-border',
                )}
              >
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted">
                  <Icone className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <p className="text-sm font-medium text-foreground">{rotuloDaAcao(mov)}</p>
                    <span className="text-micro tabular-nums text-muted-foreground">
                      {mov.created_at ? formatDateTime(mov.created_at) : '—'}
                    </span>
                  </div>
                  <p className="mt-0.5 flex items-center gap-1.5 text-micro text-muted-foreground">
                    {autor
                      ? t('denunciasAdmin.apuracao.por', { nome: autor })
                      : t('denunciasAdmin.apuracao.peloSistema')}
                    {mov.observacoes && (
                      <span className="inline-flex items-center gap-1">
                        ·
                        {publica ? (
                          <>
                            <IconMessage className="h-3 w-3" strokeWidth={1.5} />
                            {t('denunciasAdmin.apuracao.marcaPublica')}
                          </>
                        ) : (
                          <>
                            <IconLock className="h-3 w-3" strokeWidth={1.5} />
                            {t('denunciasAdmin.apuracao.marcaInterna')}
                          </>
                        )}
                      </span>
                    )}
                  </p>
                  {mov.observacoes && (
                    <p className="mt-1.5 whitespace-pre-wrap text-xs text-foreground">
                      {mov.observacoes}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

/** `em_analise` → `EmAnalise`, para casar com as chaves já existentes. */
function estadoEmChave(estado: string): string {
  return estado
    .split('_')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join('');
}
