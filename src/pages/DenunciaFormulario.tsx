import { useState, useEffect, useRef } from 'react';
import { ArrowRight, Paperclip, Download, Check } from 'lucide-react';
import { CanalState } from '@/components/denuncia/CanalState';
import { buildDenunciaSchema, canalFileMime } from '@/lib/canal-report-form';
import { useCanalUnsavedChanges } from '@/hooks/useCanalUnsavedChanges';
import { IconClose, IconUpload, IconExternal, IconShield, IconArrowLeft, IconCopy, IconSuccess } from '@/components/icons';
import { useParams, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { formatDateOnly } from '@/lib/date-utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { DateField } from '@/components/ui/date-field';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/lib/toast';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCanalDenuncia } from '@/hooks/useCanalDenuncia';
import { CanalLayout } from '@/components/denuncia/CanalLayout';
import { useMemo } from 'react';

import { AkurisPulse } from '@/components/ui/AkurisPulse';
interface Categoria {
  id: string;
  nome: string;
  descricao?: string;
  ativo: boolean;
}

type DenunciaFormData = z.infer<ReturnType<typeof buildDenunciaSchema>>;

/** Que campos cada etapa tem de validar antes de deixar avançar. */
const CAMPOS_POR_ETAPA: Record<number, (keyof DenunciaFormData)[]> = {
  1: ['categoria_id', 'titulo', 'descricao'],
  2: ['nivel_identificacao', 'denunciante_nome', 'denunciante_email'],
  3: [],
  4: ['politica_aceita'],
};
const TOTAL_ETAPAS = 4;

/** Em que etapa vive cada campo — o inverso de `CAMPOS_POR_ETAPA`. */
const ETAPA_DO_CAMPO: Record<string, number> = Object.fromEntries(
  Object.entries(CAMPOS_POR_ETAPA).flatMap(([etapa, campos]) =>
    campos.map((c) => [c as string, Number(etapa)]),
  ),
);

/** Os três níveis, na ordem em que a pessoa os pondera. */
const NIVEIS = ['identificada', 'confidencial', 'anonima'] as const;

/**
 * Copiar sem sair da página.
 *
 * `navigator.clipboard` não existe em contexto inseguro — e um portal de
 * denúncia é acedido por gente em redes e navegadores que não escolhemos. Sem
 * ele, o botão não aparece de todo: um botão de copiar que não copia, no ecrã
 * onde se entrega a única credencial da pessoa, é pior do que não haver botão.
 */
function BotaoCopiar({ texto, rotulo, rotuloFeito }: { texto: string; rotulo: string; rotuloFeito: string }) {
  const { t } = useLanguage();
  const [feito, setFeito] = useState(false);
  const podeCopiar = typeof navigator !== 'undefined' && !!navigator.clipboard?.writeText;
  if (!podeCopiar) return null;
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(texto);
          setFeito(true);
          window.setTimeout(() => setFeito(false), 2000);
        } catch {
          toast.error(t('canalExperience.copyFailed'));
        }
      }}
    >
      {feito ? (
        <IconSuccess className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.5} />
      ) : (
        <IconCopy className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.5} />
      )}
      {feito ? rotuloFeito : rotulo}
    </Button>
  );
}

/** Protocolo ou código: o valor, e a forma de o levar daqui. */
function Credencial({ rotulo, valor }: { rotulo: string; valor: string }) {
  const { t } = useLanguage();
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-micro font-semibold uppercase tracking-wide text-muted-foreground">
          {rotulo}
        </p>
        <BotaoCopiar
          texto={valor}
          rotulo={t('publicPortal.denunciaForm.copiar')}
          rotuloFeito={t('publicPortal.denunciaForm.copiado')}
        />
      </div>
      <p className="mt-1 break-all font-mono text-lg font-semibold text-foreground">{valor}</p>
    </div>
  );
}

export default function DenunciaFormulario() {
  const { empresa: empresaSlug } = useParams();
  const { t } = useLanguage();
  const canal = useCanalDenuncia(empresaSlug);
  const { empresa, config, carregando: loading } = canal;
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [codigoAcompanhamento, setCodigoAcompanhamento] = useState('');
  const [protocolo, setProtocolo] = useState<string>('');
  /**
   * Esta pessoa vai ser avisada por e-mail?
   *
   * Fica gravado no envio, e não lido do formulário: o `form.reset()` corre a
   * seguir e o ecrã de sucesso passaria a ler os valores por omissão. Medido —
   * quem deixou e-mail lia «não enviamos avisos», que é exactamente a frase
   * falsa que esta correcção veio tirar do outro caso.
   *
   * As três condições têm de valer: não ser anónima (não há para onde enviar),
   * ter deixado e-mail, e o canal ter o aviso ligado.
   */
  const [avisaPorEmail, setAvisaPorEmail] = useState(false);
  const [anexos, setAnexos] = useState<File[]>([]);
  /** Ficheiros que NÃO chegaram. A tela final tem de os nomear. */
  const [anexosFalhados, setAnexosFalhados] = useState<string[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);
  /*
    O registo passa a ser guiado.

    Era uma página única com onze campos, categoria a anexos. Quem chega aqui
    costuma estar a hesitar, e uma parede de campos é o momento em que desiste
    — é por isso que o concorrente anuncia "4 passos" como se fosse recurso.
    Os campos e a validação são os mesmos; muda quantos se veem de cada vez.
  */
  const [etapa, setEtapa] = useState(1);
  const [furthestStep, setFurthestStep] = useState(1);
  const [categoriasLoading, setCategoriasLoading] = useState(true);
  const submitLock = useRef(false);
  const nextLock = useRef(false);
  const stageHeading = useRef<HTMLHeadingElement>(null);
  /** Com denúncias anónimas desligadas, identificar-se deixa de ser opcional. */
  const identificacaoObrigatoria = config ? !config.permitir_anonimas || config.requerer_email : false;

  const denunciaSchema = useMemo(
    () => buildDenunciaSchema(t, config?.permitir_anonimas ?? true, !!config?.politica_privacidade, config?.requerer_email ?? false),
    [t, config?.permitir_anonimas, config?.politica_privacidade, config?.requerer_email],
  );

  const form = useForm<DenunciaFormData>({
    resolver: zodResolver(denunciaSchema),
    defaultValues: {
      categoria_id: '',
      titulo: '',
      descricao: '',
      local_ocorrencia: '',
      data_ocorrencia: '',
      /* Confidencial por omissão: é o que a Diretiva já garante a quem se
         identifica, e o que a maioria quer sem saber pedir. */
      nivel_identificacao: 'confidencial',
      denunciante_nome: '',
      denunciante_email: '',
      denunciante_telefone: '',
      testemunhas: '',
      evidencias_descricao: '',
      politica_aceita: false,
    },
  });

  const unsaved = useCanalUnsavedChanges(!showSuccess && (form.formState.isDirty || anexos.length > 0));

  useEffect(() => {
    if (!loading) stageHeading.current?.focus({ preventScroll: true });
  }, [etapa, loading]);

  const goNext = async () => {
    if (nextLock.current || submitting) return;
    nextLock.current = true;
    try {
      // An empty field list must not trigger validation of the entire form.
      const fields = CAMPOS_POR_ETAPA[etapa];
      const valid = fields.length === 0 || await form.trigger(fields, { shouldFocus: true });
      if (valid) {
        setEtapa((value) => Math.min(TOTAL_ETAPAS, value + 1));
        setFurthestStep((value) => Math.max(value, Math.min(TOTAL_ETAPAS, etapa + 1)));
      }
    } finally { nextLock.current = false; }
  };

  const downloadReceipt = () => {
    const text = [
      t('canalExperience.receiptTitle'), canal.nomeDoCanal,
      t('publicPortal.denunciaForm.yourProtocol') + ' ' + protocolo,
      t('publicPortal.denunciaForm.yourTrackingCode') + ' ' + codigoAcompanhamento,
      t('canalExperience.receiptUrl') + ': ' + window.location.origin + '/' + empresaSlug + '/denuncia/consulta',
      '', t('canalExperience.receiptHint'),
    ].join('\n');
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'acesso-' + protocolo.replace(/[^a-zA-Z0-9-]/g, '') + '.txt';
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  useEffect(() => {
    if (!empresa?.id || !config?.id) {
      setCategorias([]);
      return;
    }

    let ativo = true;
    setCategoriasLoading(true);
    supabase
      .rpc('get_denuncias_categorias_publicas' as never, { p_empresa_id: empresa.id } as never)
      .then(({ data, error }) => {
        if (!ativo) return;
        setCategoriasLoading(false);
        if (error) {
          logger.error('Erro ao carregar categorias públicas', {
            module: 'DenunciaFormulario',
            error: String(error),
          });
          setCategorias([]);
          return;
        }
        setCategorias((data ?? []) as Categoria[]);
      });

    return () => {
      ativo = false;
    };
  }, [empresa?.id, config?.id]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (anexos.length + files.length > 5) {
      toast.error(t('publicPortal.denunciaForm.maxFiles'));
      return;
    }
    
    const validFiles = files.filter(file => {
      if (!file.size || !canalFileMime(file)) {
        toast.error(t('canalExperience.invalidFile', { name: file.name }));
        return false;
      }
      if (anexos.some((current) => current.name === file.name && current.size === file.size && current.lastModified === file.lastModified)) return false;
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        toast.error(t('publicPortal.denunciaForm.fileTooLarge', { name: file.name }));
        return false;
      }
      return true;
    });
    
    setAnexos(prev => [...prev, ...validFiles]);
  };

  const removeFile = (index: number) => {
    setAnexos(prev => prev.filter((_, i) => i !== index));
  };

  const onSubmit = async (data: DenunciaFormData) => {
    if (!empresa || submitLock.current) return;
    submitLock.current = true;
    setSubmitting(true);
    
    try {
      // Criar a denúncia usando Edge Function
      const { data: denunciaData, error: denunciaError } = await supabase.functions.invoke('create-denuncia', {
        body: {
          action: 'create',
          empresa_slug: empresa.slug,
          categoria_id: data.categoria_id || null,
          titulo: data.titulo,
          descricao: data.descricao,
          /* `anonima` continua a seguir para o que ainda o lê; o nível é que
             manda, e é ele que distingue confidencial de identificada. */
          nivel_identificacao: data.nivel_identificacao,
          anonima: data.nivel_identificacao === 'anonima',
          politica_aceita: data.politica_aceita === true,
          denunciante_email: data.nivel_identificacao === 'anonima' ? null : data.denunciante_email?.trim() || null,
          denunciante_nome: data.nivel_identificacao === 'anonima' ? null : data.denunciante_nome?.trim() || null,
          /*
            Estes cinco eram recolhidos e deitados fora.

            O formulário pergunta onde, quando, com que testemunhas e que
            provas existem; a função de borda sempre soube recebê-los; e o
            envio passava só quatro campos. O investigador ficava sem o
            essencial de qualquer apuração — e ninguém percebia, porque a
            pessoa tinha mesmo preenchido.
          */
          denunciante_telefone: data.nivel_identificacao === 'anonima' ? null : data.denunciante_telefone || null,
          local_ocorrencia: data.local_ocorrencia || null,
          data_ocorrencia: data.data_ocorrencia || null,
          testemunhas: data.testemunhas || null,
          evidencias_descricao: data.evidencias_descricao || null,
        }
      });

      if (denunciaError) {
        logger.error('Erro ao criar denúncia', { module: 'DenunciaFormulario', error: String(denunciaError) });
        toast.error(t('publicPortal.denunciaForm.createError'));
        return;
      }

      if (denunciaData?.error) {
        logger.error('Erro ao criar denúncia', { module: 'DenunciaFormulario', error: String(denunciaData.error) });
        toast.error(t('publicPortal.denunciaForm.createError'));
        return;
      }

      const codigo = denunciaData.codigo_acompanhamento ?? '';
      setAvisaPorEmail(
        data.nivel_identificacao !== 'anonima' &&
          !!(data.denunciante_email ?? '').trim() &&
          canal.config?.avisar_denunciante_por_email !== false,
      );
      setProtocolo(denunciaData.protocolo);
      setCodigoAcompanhamento(codigo);

      /*
        A evidência, agora por URL assinada — e com o resultado à vista.

        Antes: o ficheiro ia direto para um bucket que não existia, o erro era
        só registado no log e a tela dizia "denúncia registrada" à mesma. A
        pessoa juntava a prova, via sucesso, e a prova nunca existiu. Num canal
        de denúncia a evidência É o caso.

        O denunciante é anónimo e não pode escrever no armazenamento com a
        chave pública; a função de borda valida o código, regista a linha e
        assina a URL daquele ficheiro. O que falhar sai nomeado na tela final.
      */
      const falharam: string[] = [];
      if (anexos.length > 0 && denunciaData.id) {
        for (const file of anexos) {
          try {
            const { data: pedido, error: erroPedido } = await supabase.functions.invoke(
              'create-denuncia',
              {
                body: {
                  action: 'anexo_url',
                  denuncia_id: denunciaData.id,
                  codigo,
                  nome: file.name,
                  tipo: canalFileMime(file),
                  tamanho: file.size,
                },
              },
            );
            if (erroPedido || pedido?.error || !pedido?.token) {
              throw new Error(String(erroPedido ?? pedido?.error ?? 'sem_url'));
            }

            const { error: erroUpload } = await supabase.storage
              .from('denuncias-anexos')
              .uploadToSignedUrl(pedido.caminho, pedido.token, file);
            if (erroUpload) throw erroUpload;

            const { data: confirmed, error: confirmError } = await supabase.functions.invoke('create-denuncia', {
              body: {
                action: 'anexo_confirmar',
                denuncia_id: denunciaData.id,
                codigo,
                anexo_id: pedido.anexo_id,
              },
            });
            if (confirmError || confirmed?.error) throw new Error('attachment_confirmation_failed');
          } catch (erro) {
            logger.error('Falha ao anexar evidência', {
              module: 'DenunciaFormulario',
              error: String(erro),
            });
            falharam.push(file.name);
          }
        }
      }
      setAnexosFalhados(falharam);

      setShowSuccess(true);
      form.reset();
      setAnexos([]);
      
    } catch (error) {
      logger.error('Erro geral ao registrar denúncia', { module: 'DenunciaFormulario', error: String(error) });
      toast.error(t('publicPortal.denunciaForm.unexpectedError'));
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  };

  /*
    Estas três telas ficaram para trás na migração para o `CanalLayout`.

    Continuavam com o azul-escuro da aplicação enquanto o resto do canal já era
    claro e com a cor da empresa — e a do SUCESSO é justamente a que a pessoa
    mais fixa, porque é a que traz o protocolo.
  */
  if (canal.estado !== 'pronto' || !empresa || !config) return <CanalState canal={canal} />;

  if (showSuccess) {
    return (
      <CanalLayout
        empresa={canal.empresa}
        config={canal.config}
        nomeDoCanal={canal.nomeDoCanal}
        estiloDaMarca={canal.estiloDaMarca}
        etapa={t('publicPortal.denunciaForm.successTitle')}
      >
        <div className="canal-success">
          <Card className="border-0 shadow-none">
            <CardContent className="p-0">
              {/* O título já está no cabeçalho da página. */}
              <Check className="mb-5 h-8 w-8 text-state-done" aria-hidden="true" />

              {/*
                Protocolo e código lado a lado, com o mesmo peso.

                Eram dois blocos verdes empilhados, do tamanho do resto da
                página. São as duas cadeias de caracteres sem as quais a
                pessoa nunca mais volta a esta denúncia: precisam de parecer
                credenciais, não de parecer uma mensagem de parabéns.
              */}
              <div className="grid gap-3 text-left sm:grid-cols-2">
                <Credencial
                  rotulo={t('publicPortal.denunciaForm.yourProtocol')}
                  valor={protocolo}
                />
                {codigoAcompanhamento && (
                  <Credencial
                    rotulo={t('publicPortal.denunciaForm.yourTrackingCode')}
                    valor={codigoAcompanhamento}
                  />
                )}
              </div>

              {/*
                Copiar as duas de uma vez.

                O código tem 32 caracteres hexadecimais e não havia forma de o
                copiar: quem denunciava tinha de o transcrever à mão. Errar um
                caractere é perder o acesso à própria denúncia para sempre —
                não há recuperação, e é isso que o texto abaixo agora diz.
              */}
              {codigoAcompanhamento && (
                <div className="mt-4 flex flex-wrap gap-3">
                  <BotaoCopiar
                    texto={`${t('publicPortal.denunciaForm.yourProtocol')} ${protocolo}\n${t('publicPortal.denunciaForm.yourTrackingCode')} ${codigoAcompanhamento}`}
                    rotulo={t('publicPortal.denunciaForm.copiarTudo')}
                    rotuloFeito={t('publicPortal.denunciaForm.copiado')}
                  />
                  <Button type="button" variant="outline" onClick={downloadReceipt}><Download className="mr-2 h-4 w-4" />{t('canalExperience.downloadReceipt')}</Button>
                </div>
              )}

              <p className="mb-6 mt-3 text-left text-xs leading-relaxed text-muted-foreground">
                {t('publicPortal.denunciaForm.trackingCodeHint')}{' '}
                {/*
                  Duas verdades diferentes, e a frase segue quem está a ler.

                  Quem não deixou contacto não vai ser avisado por nada — e
                  dizer-lhe que vai é a promessa falsa que esta tela fazia. Mas
                  quem deixou passa a ser avisado, e repetir-lhe «não enviamos
                  avisos» seria a mesma falha do avesso.
                */}
                {avisaPorEmail
                  ? t('publicPortal.denunciaForm.successDescriptionComAviso')
                  : t('publicPortal.denunciaForm.successDescription')}
              </p>

              {/*
                O que NÃO chegou é dito aqui, nomeando o ficheiro.

                Antes, uma evidência que falhava a subir era registada no log e
                a tela dizia sucesso na mesma — a pessoa saía convencida de que
                a prova estava entregue. Se o canal não conseguiu guardar o
                ficheiro, quem o tem ainda é ela: tem de saber a tempo.
              */}
              {anexosFalhados.length > 0 && (
                <div className="mb-6 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-left">
                  <p className="text-sm font-semibold text-destructive">
                    {t('publicPortal.denunciaForm.anexosFalharamTitulo', {
                      count: anexosFalhados.length,
                    })}
                  </p>
                  <ul className="mt-2 space-y-1">
                    {anexosFalhados.map((nome) => (
                      <li key={nome} className="text-xs text-muted-foreground break-all">
                        {nome}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {t('publicPortal.denunciaForm.anexosFalharamAjuda')}
                  </p>
                </div>
              )}

              <div className="space-y-3">
                <Button className="canal-cta w-full" asChild><Link to={`/${empresaSlug}/denuncia/consulta`}>
                    <IconExternal className="w-4 h-4 mr-2" />
                    {t('publicPortal.denunciaForm.checkStatus')}
                </Link></Button>
                
                <Button variant="outline" className="w-full" asChild><Link to={`/${empresaSlug}/denuncia`}>
                    <IconArrowLeft className="w-4 h-4 mr-2" />
                    {t('publicPortal.denunciaForm.backHome')}
                </Link></Button>
              </div>
              
            </CardContent>
          </Card>
        </div>
      </CanalLayout>
    );
  }

  return (
    <CanalLayout
      empresa={canal.empresa}
      config={canal.config}
      nomeDoCanal={canal.nomeDoCanal}
      estiloDaMarca={canal.estiloDaMarca}
      etapa={t('publicPortal.denunciaForm.cardTitle')}
      voltarPara={`/${empresaSlug}/denuncia`}
      onNavigate={unsaved.onNavigate}
    >
      {unsaved.dialog}
      <div className="canal-form-grid">
        <aside className="canal-form-rail" aria-label={t('publicPortal.denunciaForm.cardTitle')}>
          <ol>{[1, 2, 3, 4].map((number) => <li key={number}>
            <button type="button" disabled={number > furthestStep || submitting} aria-current={number === etapa ? 'step' : undefined} onClick={() => setEtapa(number)}>
              <span className="canal-step-number" aria-hidden="true">{number < etapa ? <Check size={14} /> : number}</span>{t(`publicPortal.denunciaForm.etapa${number}`)}
            </button>
          </li>)}</ol>
          <p className="canal-mobile-progress" role="status">{t('publicPortal.denunciaForm.etapaDe', { atual: etapa, total: TOTAL_ETAPAS })}</p>
          <p className="canal-note">{t('canalExperience.railHint')}</p>
        </aside>
        <div className="min-w-0">
          <div className="canal-form-stage"><h2 ref={stageHeading} tabIndex={-1}>{t(`canalExperience.stage${etapa}`)}</h2><p>{t(`canalExperience.stage${etapa}Hint`)}</p></div>
            <Form {...form}>
              {/*
                A rede por baixo: se a submissão for travada por um erro
                num campo de OUTRA etapa, salta-se para lá em vez de ficar
                parado. Sem isto, «Registrar Denúncia» ficava activo, o
                clique não fazia nada, e o ecrã não mostrava mensagem
                nenhuma — o erro estava atrás, numa etapa que já não se vê.
              */}
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  if (etapa < TOTAL_ETAPAS) { void goNext(); return; }
                  void form.handleSubmit(onSubmit, (erros) => {
                  const primeiro = Object.keys(erros)[0];
                  const destino = ETAPA_DO_CAMPO[primeiro];
                  if (destino && destino !== etapa) setEtapa(destino);
                  toast.error(
                    (erros as Record<string, { message?: string }>)[primeiro]?.message ??
                      t('publicPortal.denunciaForm.unexpectedError'),
                  );
                  })(event);
                }}
                className="space-y-6"
              >
                {etapa === 1 && (
                  <div className="space-y-4">
                {/* Categoria */}
                <FormField
                  control={form.control}
                  name="categoria_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('publicPortal.denunciaForm.category')}</FormLabel>
                      <FormControl>
                        <select className="canal-select" {...field} disabled={categoriasLoading}>
                          <option value="">{t('publicPortal.denunciaForm.categoryPlaceholder')}</option>
                          {categorias.map((categoria) => <option key={categoria.id} value={categoria.id}>{categoria.nome}</option>)}
                        </select>
                      </FormControl>
                      {!categoriasLoading && categorias.length === 0 && <p className="canal-error" role="alert">{t('canalExperience.categoriesUnavailable')}</p>}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Título */}
                <FormField
                  control={form.control}
                  name="titulo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('publicPortal.denunciaForm.title')}</FormLabel>
                      <FormControl>
                        <Input {...field} minLength={8} maxLength={160} placeholder={t('publicPortal.denunciaForm.titlePlaceholder')} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Descrição */}
                <FormField
                  control={form.control}
                  name="descricao"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('publicPortal.denunciaForm.description')}</FormLabel>
                      <FormControl>
                        <Textarea 
                          {...field} 
                          placeholder={t('publicPortal.denunciaForm.descriptionPlaceholder')}
                          className="min-h-[150px]" maxLength={10000}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Onde e quando andam sempre juntos: cabem na mesma linha. */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="local_ocorrencia"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('publicPortal.denunciaForm.place')} <span className="text-muted-foreground font-normal">({t('canalExperience.optional')})</span></FormLabel>
                        <FormControl>
                          <Input {...field} placeholder={t('publicPortal.denunciaForm.placePlaceholder')} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="data_ocorrencia"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('publicPortal.denunciaForm.date')} <span className="text-muted-foreground font-normal">({t('canalExperience.optional')})</span></FormLabel>
                        <FormControl>
                          <DateField value={field.value || null} onChange={(v) => field.onChange(v || '')} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                  </div>
                )}
                {etapa === 2 && (
                  <div className="space-y-5">
                    {/*
                      A escolha, antes dos campos.

                      Era um bloco de três campos opcionais e uma inferência:
                      deixar o nome em branco fazia a denúncia anónima sem que
                      ninguém o dissesse. Quem quisesse identificar-se ao
                      comité exigindo que o nome não saísse dali não tinha
                      sequer como o pedir. Agora escolhe-se, e cada opção diz o
                      que implica — que é a parte que faz alguém decidir falar.
                    */}
                    <FormField
                      control={form.control}
                      name="nivel_identificacao"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('publicPortal.denunciaForm.nivelTitulo')}</FormLabel>
                          <div className="mt-2 space-y-2">
                            {NIVEIS.filter(
                              (n) => n !== 'anonima' || !identificacaoObrigatoria,
                            ).map((n) => {
                              const escolhido = field.value === n;
                              return (
                                <label
                                  key={n}
                                  className={
                                    escolhido
                                      ? 'flex cursor-pointer gap-3 rounded-lg border border-primary bg-primary/5 p-3'
                                      : 'flex cursor-pointer gap-3 rounded-lg border border-border bg-card p-3 transition-ui hover:bg-accent'
                                  }
                                >
                                  <input
                                    type="radio"
                                    name="nivel_identificacao"
                                    value={n}
                                    checked={escolhido}
                                    onChange={() => {
                                      field.onChange(n);
                                      if (n === 'anonima') {
                                        form.setValue('denunciante_nome', '');
                                        form.setValue('denunciante_email', '');
                                        form.setValue('denunciante_telefone', '');
                                        form.clearErrors(['denunciante_nome', 'denunciante_email']);
                                      }
                                    }}
                                    className="mt-0.5 h-4 w-4 shrink-0 accent-[hsl(var(--primary))]"
                                  />
                                  <span className="min-w-0">
                                    <span className="block text-sm font-medium text-foreground">
                                      {t(`publicPortal.denunciaForm.nivel.${n}`)}
                                    </span>
                                    <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                                      {t(`publicPortal.denunciaForm.nivelAjuda.${n}`)}
                                    </span>
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Os dados de contacto só fazem sentido a quem se identifica. */}
                    {form.watch('nivel_identificacao') !== 'anonima' && (
                      <div className="grid gap-4 sm:grid-cols-2">
                        <FormField
                          control={form.control}
                          name="denunciante_nome"
                          render={({ field }) => (
                            <FormItem className="sm:col-span-2">
                              <FormLabel>{t('publicPortal.denunciaForm.name')} *</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder={t('publicPortal.denunciaForm.namePlaceholder')} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="denunciante_email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('publicPortal.denunciaForm.email')}{config.requerer_email ? ' *' : ''}</FormLabel>
                              <FormControl>
                                <Input {...field} type="email" placeholder={t('residuos.placeholders.seuEmail')} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="denunciante_telefone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('publicPortal.denunciaForm.phone')}</FormLabel>
                              <FormControl>
                                <Input {...field} type="tel" autoComplete="off" placeholder={t('publicPortal.denunciaForm.phonePlaceholder')} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    )}

                    {/* Ser anónimo tem um custo: é preciso dizê-lo antes, não depois. */}
                    {form.watch('nivel_identificacao') === 'anonima' && (
                      <p className="rounded-lg border border-border bg-card p-3 text-xs leading-relaxed text-muted-foreground">
                        {t('publicPortal.denunciaForm.anonimaAviso')}
                      </p>
                    )}
                  </div>
                )}
                {etapa === 3 && (
                  <div className="space-y-4">
                {/* Testemunhas */}
                <FormField
                  control={form.control}
                  name="testemunhas"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('publicPortal.denunciaForm.witnesses')}</FormLabel>
                      <FormControl>
                        <Textarea 
                          {...field} 
                          placeholder={t('publicPortal.denunciaForm.witnessesPlaceholder')}
                          className="min-h-[80px]"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Evidências */}
                <FormField
                  control={form.control}
                  name="evidencias_descricao"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('publicPortal.denunciaForm.evidence')}</FormLabel>
                      <FormControl>
                        <Textarea 
                          {...field} 
                          placeholder={t('publicPortal.denunciaForm.evidencePlaceholder')}
                          className="min-h-[80px]"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Upload de Anexos */}
                {(
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">{t('publicPortal.denunciaForm.attach')}</label>
                      <span className="text-xs text-muted-foreground">{t('publicPortal.denunciaForm.attachHint')}</span>
                    </div>

                    {/*
                      O aviso só aparece a quem escolheu não se identificar.

                      Um ficheiro leva por dentro o que a pessoa não escreveu —
                      autor do documento, modelo do aparelho, coordenadas da
                      fotografia. O canal convidava ao upload logo a seguir a
                      prometer anonimato, e nada dizia. Para quem se
                      identificou, o aviso é ruído: a empresa já sabe quem é.
                    */}
                    {form.watch('nivel_identificacao') === 'anonima' && (
                      <Alert>
                        <AlertDescription className="text-xs leading-relaxed">
                          {t('publicPortal.denunciaForm.anexoMetadados')}
                        </AlertDescription>
                      </Alert>
                    )}

                    <div className="canal-upload">
                      <Paperclip aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <label htmlFor="canal-evidence-files">{t('publicPortal.denunciaForm.attachCta')}</label>
                        <p className="canal-note">{t('canalExperience.fileTypes')}</p>
                      </div>
                      <input id="canal-evidence-files" type="file" multiple onChange={handleFileUpload}
                        className="sr-only" aria-label={t('publicPortal.denunciaForm.attach')}
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png" />
                    </div>

                    {/* Lista de anexos */}
                    {anexos.length > 0 && (
                      <div className="space-y-2">
                        {anexos.map((file, index) => (
                          <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                            <span className="text-sm truncate">{file.name}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeFile(index)}
                              aria-label={t('canalExperience.removeFile', { name: file.name })}
                            >
                              <IconClose className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                  </div>
                )}
                {etapa === 4 && (
                  <div className="space-y-4">
                {/*
                  Rever antes de enviar.

                  A última etapa continha só a caixa da política — e, quando a
                  empresa não tinha política configurada, ficava **vazia**: um
                  passo de quatro sem nada dentro. Agora mostra o que vai ser
                  enviado, que é a pergunta de quem está prestes a carregar num
                  botão sem poder voltar atrás.
                */}
                <div>
                  <p className="text-sm font-medium">
                    {t('publicPortal.denunciaForm.revisaoTitulo')}
                  </p>
                  <dl className="canal-review">
                    {[
                      {
                        /* Rótulos curtos e sem asterisco: numa revisão o `*`
                           não pede nada, só sobra. */
                        rotulo: t('publicPortal.denunciaForm.revisaoCategoria'),
                        valor: categorias.find((c) => c.id === form.watch('categoria_id'))?.nome,
                      },
                      {
                        rotulo: t('publicPortal.denunciaForm.revisaoTitulo2'),
                        valor: form.watch('titulo'),
                      },
                      {
                        /*
                          A descrição faltava aqui.

                          O passo diz «confira antes de enviar» e mostrava
                          categoria, título, local e identificação — tudo menos
                          o relato, que é o campo longo, o que a pessoa
                          escreveu com cuidado e o único que não pode corrigir
                          depois de enviar. Conferir sem o ver não é conferir.
                        */
                        rotulo: t('publicPortal.denunciaForm.revisaoDescricao'),
                        valor: form.watch('descricao'),
                      },
                      {
                        rotulo: t('publicPortal.denunciaForm.revisaoLocal'),
                        valor: form.watch('local_ocorrencia'),
                      },
                      {
                        rotulo: t('publicPortal.denunciaForm.revisaoIdentificacao'),
                        valor: t(`publicPortal.denunciaForm.nivel.${form.watch('nivel_identificacao')}`),
                      },
                      {
                        rotulo: t('publicPortal.denunciaForm.name'),
                        /* Anónima já foi dito na linha de cima: repetir o mesmo
                           texto em duas linhas seguidas lê-se como erro. */
                        valor:
                          form.watch('nivel_identificacao') === 'anonima'
                            ? null
                            : form.watch('denunciante_nome'),
                      },
                      { rotulo: t('publicPortal.denunciaForm.date'), valor: form.watch('data_ocorrencia') ? formatDateOnly(form.watch('data_ocorrencia')!) : null },
                      { rotulo: t('publicPortal.denunciaForm.email'), valor: form.watch('nivel_identificacao') === 'anonima' ? null : form.watch('denunciante_email') },
                      { rotulo: t('publicPortal.denunciaForm.phone'), valor: form.watch('nivel_identificacao') === 'anonima' ? null : form.watch('denunciante_telefone') },
                      { rotulo: t('publicPortal.denunciaForm.witnesses'), valor: form.watch('testemunhas') },
                      { rotulo: t('publicPortal.denunciaForm.evidence'), valor: form.watch('evidencias_descricao') },
                      {
                        rotulo: t('publicPortal.denunciaForm.attach'),
                        valor: anexos.length
                          ? anexos.map((file) => file.name).join('\n')
                          : null,
                      },
                    ]
                      .filter((linha) => !!linha.valor)
                      .map((linha) => (
                        <div key={linha.rotulo}>
                          <dt>
                            {linha.rotulo}
                          </dt>
                          <dd>
                            {linha.valor}
                          </dd>
                        </div>
                      ))}
                  </dl>
                </div>

                {config.politica_privacidade && (
                  <FormField
                    control={form.control}
                    name="politica_aceita"
                    render={({ field }) => (
                      <FormItem className="space-y-3 rounded-lg border border-border p-4">
                        <p className="text-micro font-semibold uppercase tracking-wide text-muted-foreground">
                          {t('publicPortal.denunciaForm.politicaTitulo')}
                        </p>
                        {/* A política num painel com altura própria: um texto
                            longo deixava de empurrar a caixa de aceitação para
                            fora do ecrã. */}
                        <p className="max-h-56 overflow-y-auto whitespace-pre-line rounded-md border border-border bg-muted/20 p-3 text-xs leading-relaxed text-muted-foreground">
                          {config.politica_privacidade}
                        </p>
                        <div className="flex items-start gap-2">
                          <FormControl>
                            <Checkbox
                              checked={field.value === true}
                              onCheckedChange={(v) => field.onChange(v === true)}
                              className="mt-0.5"
                            />
                          </FormControl>
                          <FormLabel className="text-sm font-normal leading-snug">
                            {t('publicPortal.denunciaForm.policyAccept')}
                          </FormLabel>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                  </div>
                )}
                {/* Botões de ação */}
                {/* Avançar só depois de a etapa estar válida: o erro aparece
                    onde o campo está, e não três telas à frente. */}
                <div className="canal-actions">
                  {etapa === 1 ? (
                    <Button type="button" variant="ghost" asChild><Link to={`/${empresaSlug}/denuncia`}>{t('publicPortal.denunciaForm.cancel')}</Link></Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setEtapa((e) => e - 1)}
                      disabled={submitting}
                    >
                      {t('publicPortal.denunciaForm.voltarEtapa')}
                    </Button>
                  )}

                  {etapa < TOTAL_ETAPAS ? (
                    <Button key="next-stage" type="button" className="canal-cta"
                      disabled={etapa === 1 && (categoriasLoading || categorias.length === 0)}
                      onClick={(event) => { event.preventDefault(); void goNext(); }}>
                      {t('publicPortal.denunciaForm.avancarEtapa')}<ArrowRight size={17} aria-hidden="true" />
                    </Button>
                  ) : (
                    <Button key="submit-report" type="submit" disabled={submitting} className="canal-cta">
                      {submitting ? t('publicPortal.denunciaForm.submitting') : t('publicPortal.denunciaForm.submit')}
                    </Button>
                  )}
                </div>
              </form>
            </Form>
        </div>
      </div>
    </CanalLayout>
  );
}
