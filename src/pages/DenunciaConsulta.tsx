import { useState, useRef, useEffect } from 'react';
import { ArrowRight, Eye, EyeOff, RefreshCw, LogOut } from 'lucide-react';
import { CanalState } from '@/components/denuncia/CanalState';
import { CanalEvidenceUpload } from '@/components/denuncia/CanalEvidenceUpload';
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
  acesso_legado_limitado?: boolean;
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
function PrazosDoCaso({ denuncia }: { denuncia: { prazo_acusacao: string | null; prazo_retorno: string | null; data_acusacao_recebimento: string | null; data_conclusao: string | null; status: string } }) {
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
      feitoEm: denuncia.data_conclusao,
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
                ? l.feitoEm ? t('publicPortal.denunciaConsulta.prazoCumpridoEm', {
                    data: formatDateOnly(l.feitoEm),
                  }) : t('canalExperience.deadlineDone')
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
  const [refreshing, setRefreshing] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [legacy, setLegacy] = useState(false);
  const [activeAccess, setActiveAccess] = useState<{ protocolo: string; codigo: string } | null>(null);
  const requestSequence = useRef(0);
  const messageLock = useRef(false);
  const resultHeading = useRef<HTMLHeadingElement>(null);
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
  const clearCase = () => {
    requestSequence.current += 1;
    setDenuncia(null); setShowDetails(false); setMensagens([]); setMovimentacoes([]); setReunioes([]);
    setActiveAccess(null); setCodigo(''); setProtocolo(''); setNovaMensagem(''); setLookupError(''); setShowCode(false);
    setSearching(false); setRefreshing(false);
  };
  useEffect(() => { clearCase(); return () => { requestSequence.current += 1; }; }, [empresaSlug]);
  useEffect(() => { if (showDetails) resultHeading.current?.focus(); }, [showDetails]);
  const applyCase = (value: RespostaConsulta) => {
    setDenuncia(value); setMensagens(value.mensagens ?? []); setReunioes(value.reunioes ?? []);
    setMovimentacoes((value.movimentacoes ?? []).map((mov) => ({ ...mov, observacoes: mov.observacoes ?? null, usuario: null })));
  };
  const recarregar = async () => {
    if (!empresa || !activeAccess || refreshing || messageLock.current) return;
    const sequence = requestSequence.current;
    setRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-denuncia', { body: {
        action: 'consult', empresa_slug: empresa.slug, protocolo: activeAccess.protocolo, codigo: activeAccess.codigo,
      } });
      if (sequence !== requestSequence.current) return;
      if (error || !data?.denuncia) throw new Error('refresh_failed');
      applyCase(data.denuncia as RespostaConsulta);
      toast({ description: t('canalExperience.refreshSuccess') });
    } catch {
      if (sequence === requestSequence.current) toast({ description: t('canalExperience.refreshError'), variant: 'destructive' });
    } finally { if (sequence === requestSequence.current) setRefreshing(false); }
  };

  const buscarDenuncia = async (e: React.FormEvent) => {
    e.preventDefault();

    if (searching) return;
    setLookupError('');
    if (!empresa || !protocolo.trim() || (!legacy && !codigo.trim())) {
      setLookupError(t('canalExperience.codeRequired'));
      return;
    }

    const sequence = ++requestSequence.current;
    const credentials = { protocolo: protocolo.trim().toUpperCase(), codigo: legacy ? '' : codigo.trim() };
    setSearching(true);
    setActiveAccess(null);
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
          protocolo: credentials.protocolo,
          codigo: credentials.codigo,
        },
      });

      if (sequence !== requestSequence.current) return;
      const denunciaData = (data?.denuncia ?? null) as RespostaConsulta | null;

      if (error || !denunciaData) {
        setLookupError(t('publicPortal.denunciaConsulta.notFoundDescription'));
        return;
      }

      applyCase(denunciaData);
      setActiveAccess(credentials);
      setShowDetails(true);
    } catch (error) {
      if (sequence !== requestSequence.current) return;
      logger.error('Erro ao buscar denúncia', { module: 'DenunciaConsulta', error: String(error) });
      setLookupError(t('publicPortal.denunciaConsulta.searchError'));
      toast({
        title: t('publicPortal.denunciaConsulta.error'),
        description: t('publicPortal.denunciaConsulta.searchError'),
        variant: "destructive"
      });
    } finally {
      if (sequence === requestSequence.current) setSearching(false);
    }
  };

  /** Manda a mensagem pelo código de acompanhamento — a única credencial que
      quem denunciou tem, porque não tem conta. */
  const enviarMensagem = async () => {
    const texto = novaMensagem.trim();
    if (!texto || !denuncia?.id || !activeAccess?.codigo || messageLock.current || refreshing) return;
    messageLock.current = true;
    const sequence = requestSequence.current;
    setEnviandoMensagem(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-denuncia', {
        body: {
          action: 'mensagem',
          denuncia_id: denuncia.id,
          codigo: activeAccess.codigo,
          mensagem: texto,
        },
      });
      if (sequence !== requestSequence.current) return;
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
      if (sequence !== requestSequence.current) return;
      logger.error('Erro ao enviar mensagem', { module: 'DenunciaConsulta', error: String(erro) });
      toast({
        title: t('publicPortal.denunciaConsulta.error'),
        description: t('publicPortal.denunciaConsulta.mensagemErro'),
        variant: 'destructive',
      });
    } finally {
      messageLock.current = false;
      setEnviandoMensagem(false);
    }
  };

  const getStatusText = (status: string) => {
    const label = t(`publicPortal.denunciaConsulta.status.${status}`);
    return label.startsWith('publicPortal.') ? status : label;
  };

  const formatDate = (dateString: string) => formatDateTime(dateString);

  if (canal.estado !== 'pronto' || !empresa || !canal.config) return <CanalState canal={canal} />;
  const privateAccess = !!denuncia?.id && !!activeAccess?.codigo && !denuncia?.acesso_legado_limitado;

  return (
    <CanalLayout
      empresa={canal.empresa}
      config={canal.config}
      nomeDoCanal={canal.nomeDoCanal}
      estiloDaMarca={canal.estiloDaMarca}
      etapa={showDetails ? t('publicPortal.denunciaConsulta.acompanhar') : t('canalExperience.lookupHeadline')}
      voltarPara={`/${empresaSlug}/denuncia`}
    >
      <div>
        {!showDetails && <div className="canal-search-grid">
          <div>
            <p className="text-muted-foreground mb-6">{t('canalExperience.lookupHint')}</p>
            <form onSubmit={buscarDenuncia} className="space-y-5">
              <div className="space-y-2"><Label htmlFor="protocolo">{t('publicPortal.denunciaConsulta.protocolLabel')}</Label>
                <Input id="protocolo" value={protocolo} onChange={(event) => setProtocolo(event.target.value.toUpperCase())}
                  placeholder={t('publicPortal.denunciaConsulta.protocolPlaceholder')} maxLength={100} autoComplete="off" spellCheck={false} required aria-describedby="protocol-help" />
                <p id="protocol-help" className="text-xs text-muted-foreground">{t('canalExperience.protocolHelp')}</p>
              </div>
              {!legacy && <div className="space-y-2"><Label htmlFor="codigo">{t('publicPortal.denunciaConsulta.codeLabel')}</Label>
                <div className="flex gap-2"><Input id="codigo" type={showCode ? 'text' : 'password'} value={codigo} onChange={(event) => setCodigo(event.target.value.trim())}
                  placeholder={t('publicPortal.denunciaConsulta.codePlaceholder')} maxLength={128} autoComplete="off" spellCheck={false} required aria-describedby="code-help" />
                  <Button type="button" variant="outline" size="icon" className="h-11 w-11 shrink-0" aria-label={t(showCode ? 'canalExperience.hideCode' : 'canalExperience.showCode')} aria-pressed={showCode} onClick={() => setShowCode((value) => !value)}>{showCode ? <EyeOff size={18} /> : <Eye size={18} />}</Button>
                </div><p id="code-help" className="text-xs text-muted-foreground">{t('canalExperience.codeHelp')}</p>
              </div>}
              <label className="flex items-start gap-3 text-xs text-muted-foreground"><input type="checkbox" className="mt-1 accent-[hsl(var(--primary))]" checked={legacy} onChange={(event) => { setLegacy(event.target.checked); setLookupError(''); }} />{t('canalExperience.legacy')}</label>
              {legacy && <p className="canal-note">{t('canalExperience.legacyHint')}</p>}
              {lookupError && <p className="canal-error" role="alert">{lookupError}</p>}
              <Button type="submit" disabled={searching} className="canal-cta">{searching ? t('publicPortal.denunciaConsulta.searching') : t('publicPortal.denunciaConsulta.search')}<ArrowRight size={18} aria-hidden="true" /></Button>
            </form>
          </div>
          <aside className="canal-search-help"><h2>{t('canalExperience.accessHelp')}</h2>
            <details open><summary>{t('canalExperience.whereCodes')}</summary><p>{t('canalExperience.whereCodesHint')}</p></details>
            {canal.config.permitir_anonimas && !canal.config.requerer_email && <details><summary>{t('canalExperience.anonymousQuestion')}</summary><p>{t('canalExperience.anonymousAnswer')}</p></details>}
            <details><summary>{t('canalExperience.lostCode')}</summary><p>{t('canalExperience.lostCodeHint')}</p></details>
          </aside>
        </div>}

        {/* Resultado da busca */}
        {showDetails && denuncia && (
          <div className="space-y-6">
            <div className="flex flex-wrap gap-3 justify-end"><Button variant="outline" onClick={recarregar} disabled={refreshing}><RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />{t('canalExperience.refresh')}</Button><Button variant="ghost" onClick={clearCase}><LogOut size={16} />{t('canalExperience.exitCase')}</Button></div>
            {!privateAccess && <p className="canal-note">{t('canalExperience.legacyHint')}</p>}
            {/* Informações da denúncia */}
            <Card>
              <CardHeader>
                <div className="flex flex-wrap gap-4 items-start justify-between">
                  <div>
                    <CardTitle ref={resultHeading} tabIndex={-1} className="flex flex-wrap items-center gap-2 mb-2 break-all">
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
            {privateAccess && <Card className="border-0 shadow-none canal-case-section">
              <CardHeader className="px-0">
                <CardTitle className="text-base">
                  {t('publicPortal.denunciaConsulta.conversaTitulo')}
                </CardTitle>
                <CardDescription>
                  {t('publicPortal.denunciaConsulta.conversaDescricao')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 px-0">
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
                            <p className="mt-0.5 whitespace-pre-wrap break-words text-sm">{m.mensagem}</p>
                            <p className="mt-1 text-micro tabular-nums text-muted-foreground">
                              {formatDate(m.created_at)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <Label htmlFor="canal-new-message">{t('canalExperience.newMessage')}</Label>
                <Textarea
                  id="canal-new-message"
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
            </Card>}

            {privateAccess && <CanalEvidenceUpload denunciaId={denuncia.id} codigo={activeAccess!.codigo} />}

            {/*
              A reunião do art. 9.º/2.

              `permitir_reuniao` existia na configuração e não tinha ecrã
              nenhum — uma opção que ligava e desligava coisa alguma. O pedido
              parte daqui porque é aqui que quem denunciou está autenticado.
            */}
            {privateAccess && <SolicitarReuniao
              denunciaId={denuncia.id}
              codigo={activeAccess!.codigo}
              permitido={canal.config?.permitir_reuniao !== false}
              reunioes={reunioes}
              onMudou={recarregar}
            />}

            {/* Histórico de movimentações */}
            {privateAccess && <Card className="border-0 shadow-none canal-case-section">
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
                          <div className="absolute left-[5px] top-5 bottom-0 w-px bg-border"></div>
                        )}
                        <div className="absolute left-0 top-1.5 w-3 h-3 bg-primary/70 rounded-full"></div>
                        <div className="space-y-1">
                          <div className="flex flex-wrap gap-2 items-center justify-between">
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
            </Card>}

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
