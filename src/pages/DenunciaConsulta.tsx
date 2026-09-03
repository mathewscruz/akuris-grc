import { useState } from 'react';
import { IconSearch, IconView, IconSuccess, IconInfo, IconTime, IconFile, IconShield } from '@/components/icons';
import { useParams } from 'react-router-dom';
import { logger } from '@/lib/logger';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatDateTime, formatDateOnly, parseDataLocal } from '@/lib/date-utils';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { StatusBadge } from '@/components/ui/status-badge';
import { resolveDenunciaStatusTone } from '@/lib/status-tone';
import { useToast } from '@/hooks/use-toast';
import { useCanalDenuncia } from '@/hooks/useCanalDenuncia';
import { CanalLayout } from '@/components/denuncia/CanalLayout';
import { SolicitarReuniao, type ReuniaoPublica } from '@/components/denuncia/SolicitarReuniao';

import { AkurisPulse } from '@/components/ui/AkurisPulse';
interface Denuncia {
  id: string;
  protocolo: string;
  titulo: string;
  status: string;
  /* `gravidade` saiu da resposta publica: era o default da coluna a
     fazer-se passar por avaliacao do comite. Ver a migration
     20260902050000. */
  prazo_acusacao: string | null;
  prazo_retorno: string | null;
  data_acusacao_recebimento: string | null;
  created_at: string;
  data_atribuicao: string | null;
  data_inicio_investigacao: string | null;
  data_conclusao: string | null;
  categoria: {
    nome: string;
    cor: string;
  } | null;
}

/** O que `consult_denuncia_publica` devolve, do lado de quem consulta. */
interface RespostaConsulta extends Denuncia {
  mensagens?: { id: string; autor_tipo: string; mensagem: string; created_at: string }[];
  reunioes?: ReuniaoPublica[];
  movimentacoes?: Omit<Movimentacao, 'usuario'>[];
}

interface Movimentacao {
  id: string;
  acao: string;
  status_anterior: string | null;
  status_novo: string;
  observacoes: string | null;
  created_at: string;
  usuario: {
    nome: string;
  } | null;
}

/**
 * As duas datas que a lei dá a quem denunciou.
 *
 * Não é enfeite: quem denuncia não tem conta, não recebe aviso nenhum e só
 * volta aqui por iniciativa própria. Se o ecrã não disser até quando a empresa
 * tem de acusar o recebimento e de dar retorno, a pessoa não tem como saber se
 * o silêncio é normal ou se já passou do prazo — e é justamente aí que a
 * Diretiva (UE) 2019/1937 lhe dá o direito de ir para fora, à autoridade.
 *
 * Cumprido pinta-se de feito; vencido pinta-se de vencido. Não se esconde o
 * atraso da empresa a quem ele prejudica.
 */
function PrazosDoCaso({ denuncia }: { denuncia: { prazo_acusacao: string | null; prazo_retorno: string | null; data_acusacao_recebimento: string | null; status: string } }) {
  const { t } = useLanguage();
  const encerrada = ['resolvida', 'arquivada'].includes(denuncia.status);
  if (!denuncia.prazo_acusacao && !denuncia.prazo_retorno) return null;

  const atrasado = (data: string | null, cumprido: boolean) => {
    if (cumprido || !data) return false;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const alvo = parseDataLocal(data);
    alvo.setHours(0, 0, 0, 0);
    return alvo.getTime() < hoje.getTime();
  };

  const linhas = [
    {
      chave: 'acusacao',
      rotulo: t('publicPortal.denunciaConsulta.prazoAcusacao'),
      data: denuncia.prazo_acusacao,
      cumprido: !!denuncia.data_acusacao_recebimento,
      feitoEm: denuncia.data_acusacao_recebimento,
    },
    {
      chave: 'retorno',
      rotulo: t('publicPortal.denunciaConsulta.prazoRetorno'),
      data: denuncia.prazo_retorno,
      cumprido: encerrada,
      feitoEm: null,
    },
  ].filter((l) => !!l.data);

  return (
    <div className="grid gap-3 rounded-lg border border-border bg-muted/20 p-4 sm:grid-cols-2">
      {linhas.map((l) => {
        const vencido = atrasado(l.data, l.cumprido);
        return (
          <div key={l.chave}>
            <p className="text-micro font-semibold uppercase tracking-wide text-muted-foreground">
              {l.rotulo}
            </p>
            <p
              className={
                l.cumprido
                  ? 'mt-0.5 text-sm font-medium text-state-done'
                  : vencido
                    ? 'mt-0.5 text-sm font-medium text-severity-critical'
                    : 'mt-0.5 text-sm font-medium text-foreground'
              }
            >
              {l.cumprido
                ? t('publicPortal.denunciaConsulta.prazoCumpridoEm', {
                    data: formatDateOnly(l.feitoEm ?? l.data!),
                  })
                : vencido
                  ? t('publicPortal.denunciaConsulta.prazoVencidoEm', { data: formatDateOnly(l.data!) })
                  : t('publicPortal.denunciaConsulta.prazoAte', { data: formatDateOnly(l.data!) })}
            </p>
          </div>
        );
      })}
    </div>
  );
}

export default function DenunciaConsulta() {
  const { empresa: empresaSlug } = useParams<{ empresa: string }>();
  const { toast } = useToast();
  const { t } = useLanguage();
  const canal = useCanalDenuncia(empresaSlug);
  const empresa = canal.empresa;
  const [searching, setSearching] = useState(false);
  const [protocolo, setProtocolo] = useState('');
  const [codigo, setCodigo] = useState('');
  const [denuncia, setDenuncia] = useState<Denuncia | null>(null);
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([]);
  const [showDetails, setShowDetails] = useState(false);
  /*
    A conversa com o comité.

    Esta tela era só leitura: quem denunciou via o estado e a linha do tempo, e
    não conseguia acrescentar nada. A Diretiva (UE) 2019/1937 exige retorno ao
    informante, e retorno sem via de resposta não é retorno.
  */
  const [mensagens, setMensagens] = useState<{ id: string; autor_tipo: string; mensagem: string; created_at: string }[]>([]);
  const [novaMensagem, setNovaMensagem] = useState('');
  const [enviandoMensagem, setEnviandoMensagem] = useState(false);
  /* A reunião do art. 9.º/2 — pedida daqui, porque é aqui que quem denunciou
     está autenticado pelo protocolo e pelo código. */
  const [reunioes, setReunioes] = useState<ReuniaoPublica[]>([]);
  /* Recarrega sem passar pelo formulário — usado depois de pedir reunião ou
     de aceitar a acta, para o ecrã mostrar já o novo estado. */
  const recarregar = async () => {
    if (!empresa || !protocolo.trim()) return;
    const { data } = await supabase.functions.invoke('create-denuncia', {
      body: {
        action: 'consult',
        empresa_slug: empresa.slug,
        protocolo: protocolo.trim().toUpperCase(),
        codigo: codigo.trim(),
      },
    });
    const atual = (data?.denuncia ?? null) as RespostaConsulta | null;
    if (!atual) return;
    setDenuncia(atual);
    setMensagens(atual.mensagens ?? []);
    setReunioes(atual.reunioes ?? []);
    setMovimentacoes(
      (atual.movimentacoes ?? []).map((mov) => ({
        ...mov,
        observacoes: mov.observacoes ?? null,
        usuario: null,
      })),
    );
  };

  const buscarDenuncia = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!empresa || !protocolo.trim()) {
      toast({
        title: t('publicPortal.denunciaConsulta.error'),
        description: t('publicPortal.denunciaConsulta.typeProtocol'),
        variant: "destructive"
      });
      return;
    }

    setSearching(true);
    setDenuncia(null);
    setMovimentacoes([]);
    setMensagens([]);
    setReunioes([]);
    setShowDetails(false);

    try {
      const { data, error } = await supabase.functions.invoke('create-denuncia', {
        body: {
          action: 'consult',
          empresa_slug: empresa.slug,
          protocolo: protocolo.trim().toUpperCase(),
          codigo: codigo.trim(),
        },
      });

      const denunciaData: any = data?.denuncia ?? null;

      if (error || !denunciaData) {
        toast({
          title: t('publicPortal.denunciaConsulta.notFoundTitle'),
          description: t('publicPortal.denunciaConsulta.notFoundDescription'),
          variant: "destructive"
        });
        return;
      }

      setDenuncia(denunciaData);
      setMensagens(denunciaData.mensagens ?? []);
      setReunioes(denunciaData.reunioes ?? []);
      setMovimentacoes(
        (denunciaData.movimentacoes ?? []).map((mov: any) => ({
          ...mov,
          observacoes: mov.observacoes ?? null,
          usuario: null,
        }))
      );

      setShowDetails(true);
    } catch (error) {
      logger.error('Erro ao buscar denúncia', { module: 'DenunciaConsulta', error: String(error) });
      toast({
        title: t('publicPortal.denunciaConsulta.error'),
        description: t('publicPortal.denunciaConsulta.searchError'),
        variant: "destructive"
      });
    } finally {
      setSearching(false);
    }
  };

  /** Manda a mensagem pelo código de acompanhamento — a única credencial que
      quem denunciou tem, porque não tem conta. */
  const enviarMensagem = async () => {
    const texto = novaMensagem.trim();
    if (!texto || !denuncia) return;
    setEnviandoMensagem(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-denuncia', {
        body: {
          action: 'mensagem',
          denuncia_id: denuncia.id,
          codigo: codigo.trim(),
          mensagem: texto,
        },
      });
      if (error || data?.error) throw new Error(String(error ?? data?.error));

      setMensagens((atual) => [
        ...atual,
        {
          id: `local-${Date.now()}`,
          autor_tipo: 'denunciante',
          mensagem: texto,
          created_at: new Date().toISOString(),
        },
      ]);
      setNovaMensagem('');
      toast({ title: t('publicPortal.denunciaConsulta.mensagemEnviada') });
    } catch (erro) {
      logger.error('Erro ao enviar mensagem', { module: 'DenunciaConsulta', error: String(erro) });
      toast({
        title: t('publicPortal.denunciaConsulta.error'),
        description: t('publicPortal.denunciaConsulta.mensagemErro'),
        variant: 'destructive',
      });
    } finally {
      setEnviandoMensagem(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'nova':
        return <IconFile className="w-4 h-4" />;
      case 'em_analise':
        return <IconTime className="w-4 h-4" />;
      case 'em_investigacao':
        return <IconInfo className="w-4 h-4" />;
      case 'concluida':
        return <IconSuccess className="w-4 h-4" />;
      default:
        return <IconFile className="w-4 h-4" />;
    }
  };

  const getStatusText = (status: string) => {
    const label = t(`publicPortal.denunciaConsulta.status.${status}`);
    return label.startsWith('publicPortal.') ? status : label;
  };

  const formatDate = (dateString: string) => formatDateTime(dateString);

  if (canal.carregando) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <AkurisPulse size={32} />
          <p className="text-muted-foreground">{t('publicPortal.common.loading')}</p>
        </div>
      </div>
    );
  }

  if (!empresa || !empresa.canal_ativo || !canal.config) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="max-w-md">
          <CardContent className="py-10 text-center">
            <IconShield className="mx-auto mb-4 h-8 w-8 text-muted-foreground" />
            <h2 className="mb-2 text-base font-semibold text-foreground">
              {t('publicPortal.denunciaForm.unavailableTitle')}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t('publicPortal.denunciaForm.unavailableDescription')}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <CanalLayout
      empresa={canal.empresa}
      config={canal.config}
      nomeDoCanal={canal.nomeDoCanal}
      estiloDaMarca={canal.estiloDaMarca}
      etapa={t('publicPortal.denunciaConsulta.acompanhar')}
      voltarPara={`/${empresaSlug}/denuncia`}
    >
      <div>
        {/* Formulário de busca */}
        <Card className="mb-6 bg-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconSearch className="w-5 h-5" />
              {t('publicPortal.denunciaConsulta.searchTitle')}
            </CardTitle>
            <CardDescription>
              {t('publicPortal.denunciaConsulta.searchDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={buscarDenuncia} className="flex flex-col gap-4 sm:flex-row">
              <div className="flex-1">
                <Label htmlFor="protocolo" className="sr-only">
                  {t('publicPortal.denunciaConsulta.protocolLabel')}
                </Label>
                <Input
                  id="protocolo"
                  value={protocolo}
                  onChange={(e) => setProtocolo(e.target.value.toUpperCase())}
                  placeholder={t('publicPortal.denunciaConsulta.protocolPlaceholder')}
                  className="font-mono"
                  required
                />
              </div>
              <div className="flex-1">
                <Label htmlFor="codigo" className="sr-only">
                  {t('publicPortal.denunciaConsulta.codeLabel')}
                </Label>
                <Input
                  id="codigo"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value.trim())}
                  placeholder={t('publicPortal.denunciaConsulta.codePlaceholder')}
                  className="font-mono"
                />
              </div>
              <Button type="submit" disabled={searching}>
                <IconSearch className="w-4 h-4 mr-2" />
                {searching ? t('publicPortal.denunciaConsulta.searching') : t('publicPortal.denunciaConsulta.search')}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Resultado da busca */}
        {showDetails && denuncia && (
          <div className="space-y-6">
            {/* Informações da denúncia */}
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 mb-2">
                      <IconFile className="w-5 h-5" />
                      {t('publicPortal.denunciaConsulta.protocol')} {denuncia.protocolo}
                    </CardTitle>
                    <CardDescription className="text-base">
                      {denuncia.titulo}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <StatusBadge {...resolveDenunciaStatusTone(denuncia.status)}>
                      {getStatusText(denuncia.status)}
                    </StatusBadge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/*
                  Os prazos de quem denunciou.

                  A página dos direitos, ao lado, promete «recebimento em 7
                  dias e retorno em 90». Isso é a promessa; isto são as datas
                  deste caso. Sem elas, acompanhar a denúncia é ver um estado
                  que não muda e não saber se é normal ou se a empresa está
                  atrasada — e quem denuncia não tem outra forma de o descobrir.
                */}
                <PrazosDoCaso denuncia={denuncia} />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-muted-foreground">
                      {t('publicPortal.denunciaConsulta.reportDate')}
                    </Label>
                    <p className="text-sm">{formatDate(denuncia.created_at)}</p>
                  </div>
                  {denuncia.categoria && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-muted-foreground">
                        {t('publicPortal.denunciaConsulta.category')}
                      </Label>
                      <p className="text-sm">{denuncia.categoria.nome}</p>
                    </div>
                  )}
                  {denuncia.data_atribuicao && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-muted-foreground">
                        {t('publicPortal.denunciaConsulta.assignmentDate')}
                      </Label>
                      <p className="text-sm">{formatDate(denuncia.data_atribuicao)}</p>
                    </div>
                  )}
                  {denuncia.data_inicio_investigacao && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-muted-foreground">
                        {t('publicPortal.denunciaConsulta.investigationStart')}
                      </Label>
                      <p className="text-sm">{formatDate(denuncia.data_inicio_investigacao)}</p>
                    </div>
                  )}
                </div>

                {denuncia.data_conclusao && (
                  <Alert>
                    <IconSuccess className="h-4 w-4" />
                    <AlertDescription>
                      <strong>{t('publicPortal.denunciaConsulta.concludedAt')}</strong> {formatDate(denuncia.data_conclusao)}
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/*
              A conversa com o comité.

              É a metade que faltava do direito ao retorno: sem via de
              resposta, quem denunciou não podia acrescentar o que faltou nem
              responder a uma pergunta da apuração.
            */}
            <Card className="bg-white">
              <CardHeader>
                <CardTitle className="text-base">
                  {t('publicPortal.denunciaConsulta.conversaTitulo')}
                </CardTitle>
                <CardDescription>
                  {t('publicPortal.denunciaConsulta.conversaDescricao')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {mensagens.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t('publicPortal.denunciaConsulta.conversaVazia')}
                  </p>
                ) : (
                  <div className="max-h-[280px] space-y-2 overflow-y-auto rounded-lg border border-border bg-muted/20 p-3">
                    {mensagens.map((m) => {
                      const meu = m.autor_tipo === 'denunciante';
                      return (
                        <div key={m.id} className={meu ? 'flex justify-end' : 'flex justify-start'}>
                          <div
                            className={
                              meu
                                ? 'max-w-[80%] rounded-lg bg-primary/10 px-3 py-2'
                                : 'max-w-[80%] rounded-lg border border-border bg-card px-3 py-2'
                            }
                          >
                            <p className="text-micro font-medium text-muted-foreground">
                              {meu
                                ? t('publicPortal.denunciaConsulta.conversaVoce')
                                : t('publicPortal.denunciaConsulta.conversaComite')}
                            </p>
                            <p className="mt-0.5 whitespace-pre-wrap text-sm">{m.mensagem}</p>
                            <p className="mt-1 text-micro tabular-nums text-muted-foreground">
                              {formatDate(m.created_at)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <Textarea
                  value={novaMensagem}
                  onChange={(e) => setNovaMensagem(e.target.value)}
                  rows={3}
                  maxLength={5000}
                  placeholder={t('publicPortal.denunciaConsulta.conversaPlaceholder')}
                />
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    onClick={enviarMensagem}
                    disabled={enviandoMensagem || !novaMensagem.trim()}
                  >
                    {t('publicPortal.denunciaConsulta.conversaEnviar')}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/*
              A reunião do art. 9.º/2.

              `permitir_reuniao` existia na configuração e não tinha ecrã
              nenhum — uma opção que ligava e desligava coisa alguma. O pedido
              parte daqui porque é aqui que quem denunciou está autenticado.
            */}
            <SolicitarReuniao
              denunciaId={denuncia.id}
              codigo={codigo.trim()}
              permitido={canal.config?.permitir_reuniao !== false}
              reunioes={reunioes}
              onMudou={recarregar}
            />

            {/* Histórico de movimentações */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <IconTime className="w-5 h-5" />
                  {t('publicPortal.denunciaConsulta.historyTitle')}
                </CardTitle>
                <CardDescription>
                  {t('publicPortal.denunciaConsulta.historyDescription')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {movimentacoes.length > 0 ? (
                  <div className="space-y-4">
                    {movimentacoes.map((movimentacao, index) => (
                      <div key={movimentacao.id} className="relative pl-6 pb-4">
                        {index < movimentacoes.length - 1 && (
                          <div className="absolute left-2 top-6 w-0.5 h-full bg-muted"></div>
                        )}
                        <div className="absolute left-0 top-1 w-4 h-4 bg-primary rounded-full"></div>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            {/* O nome da acção, traduzido. Estava a sair o
                                identificador da base com underscores trocados
                                por espaços — «Recebimento Acusado». */}
                            <p className="font-medium text-sm">
                              {t(`publicPortal.denunciaConsulta.acao.${movimentacao.acao}`)}
                            </p>
                            <span className="text-xs text-muted-foreground">
                              {formatDate(movimentacao.created_at)}
                            </span>
                          </div>
                          {/*
                            Só quando o estado MUDOU mesmo.

                            A trilha guarda `status_anterior` e `status_novo`
                            em toda a linha, mudem eles ou não — um pedido de
                            reunião grava `nova → nova`. O ecrã imprimia a
                            transição na mesma, e quem denunciou lia «Status
                            alterado de "Nova" para "Nova"» por baixo do seu
                            próprio pedido de reunião. Medido no portal.
                          */}
                          {movimentacao.status_anterior &&
                            movimentacao.status_novo &&
                            movimentacao.status_anterior !== movimentacao.status_novo && (
                            <p className="text-xs text-muted-foreground">
                              {t('publicPortal.denunciaConsulta.statusChanged', { from: getStatusText(movimentacao.status_anterior), to: getStatusText(movimentacao.status_novo) })}
                            </p>
                          )}
                          {movimentacao.observacoes && (
                            <p className="text-sm text-muted-foreground">
                              {movimentacao.observacoes}
                            </p>
                          )}
                          {movimentacao.usuario && (
                            <p className="text-xs text-muted-foreground">
                              {t('publicPortal.denunciaConsulta.by')} {movimentacao.usuario.nome}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-4">
                    {t('publicPortal.denunciaConsulta.noHistory')}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Informações importantes */}
            <Alert>
              <IconView className="h-4 w-4" />
              <AlertDescription>
                <strong>{t('publicPortal.denunciaConsulta.importantLabel')}</strong>{' '}
                {t('publicPortal.denunciaConsulta.importantText')}
              </AlertDescription>
            </Alert>
          </div>
        )}
      </div>
    </CanalLayout>
  );
}
