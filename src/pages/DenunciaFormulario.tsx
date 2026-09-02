import { useState, useEffect } from 'react';
import { IconClose, IconUpload, IconExternal, IconShield, IconArrowLeft, IconCopy, IconSuccess } from '@/components/icons';
import { useParams, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { DateField } from '@/components/ui/date-field';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { fetchEmpresaPublicaPorSlug } from '@/lib/denuncia-publica';
import { logger } from '@/lib/logger';
import { getCompanyLogo, AKURIS_DEFAULT_LOGO } from '@/lib/brand-logo';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCanalDenuncia } from '@/hooks/useCanalDenuncia';
import { CanalLayout } from '@/components/denuncia/CanalLayout';
import { useMemo } from 'react';

import { AkurisPulse } from '@/components/ui/AkurisPulse';
interface Empresa {
  id: string;
  nome: string;
  slug: string;
  logo_url?: string;
}

interface EmpresaConfig {
  id: string;
  empresa_id: string;
  ativo: boolean;
  permitir_anonimas: boolean;
  requerer_email: boolean;
  texto_apresentacao?: string;
  politica_privacidade?: string;
  emails_notificacao: string[];
  notificar_administradores: boolean;
  token_publico: string;
}

interface Categoria {
  id: string;
  nome: string;
  descricao?: string;
  ativo: boolean;
}

/**
 * `permitirAnonimas` decide se identificar-se é opcional ou obrigatório.
 *
 * Antes o bloco de identificação inteiro só existia quando a empresa PERMITIA
 * denúncias anónimas — o inverso da intenção. Desligar "Permitir Denúncias
 * Anónimas" escondia nome, e-mail e telefone, `anonima` passava a ser sempre
 * true (era inferido do nome vazio) e o RPC recusava tudo: o canal público
 * ficava inutilizável, com um toast genérico e nada a explicar porquê.
 */
const buildDenunciaSchema = (
  t: (key: string) => string,
  permitirAnonimas: boolean,
  exigirPolitica: boolean,
) => z.object({
  categoria_id: z.string().min(1, t('publicPortal.denunciaForm.validation.category')),
  titulo: z.string().min(5, t('publicPortal.denunciaForm.validation.title')),
  descricao: z.string().min(20, t('publicPortal.denunciaForm.validation.description')),
  local_ocorrencia: z.string().optional(),
  data_ocorrencia: z.string().optional(),
  /**
   * Identificar-se e pedir reserva são coisas diferentes.
   *
   * O anonimato era inferido de um campo vazio: `anonima: !denunciante_nome`.
   * Quem quisesse identificar-se ao comité mas exigir que o nome não saísse
   * dali não tinha como o dizer — e o sistema também não tinha como o
   * registar. É a diferença entre o art. 16.º (confidencialidade, obrigatória)
   * e o art. 6.º/2 (anonimato, opcional) da Diretiva (UE) 2019/1937.
   */
  nivel_identificacao: z.enum(['identificada', 'confidencial', 'anonima']),
  denunciante_nome: permitirAnonimas
    ? z.string().optional()
    : z.string().trim().min(3, t('publicPortal.denunciaForm.validation.nameRequired')),
  denunciante_email: z.string().email(t('publicPortal.denunciaForm.validation.email')).optional().or(z.literal('')),
  denunciante_telefone: z.string().optional(),
  testemunhas: z.string().optional(),
  evidencias_descricao: z.string().optional(),
  /**
   * O consentimento era literal: `politica_aceita: true` ia no envio sem que
   * o denunciante visse o texto — a política só aparecia DEPOIS, na tela de
   * sucesso. O sistema registava um consentimento que nunca foi dado, num
   * canal onde esse registo é justamente a prova legal.
   */
  politica_aceita: exigirPolitica
    ? z.literal(true, { errorMap: () => ({ message: t('publicPortal.denunciaForm.validation.policyRequired') }) })
    : z.boolean().optional(),
}).superRefine((dados, ctx) => {
  /* Quem escolhe identificar-se — mesmo pedindo reserva — tem de deixar nome.
     A regra é a mesma no banco; aqui o erro aparece no campo certo em vez de
     voltar como "denúncia inválida" no fim do formulário. */
  if (dados.nivel_identificacao !== 'anonima' && (dados.denunciante_nome ?? '').trim().length < 3) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['denunciante_nome'],
      message: t('publicPortal.denunciaForm.validation.nameRequired'),
    });
  }
});

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

/**
 * A regra que o `superRefine` do esquema exprime, isolada para poder ser
 * verificada TAMBÉM por etapa.
 *
 * O `superRefine` vive no objecto inteiro, e o zod não chega a executá-lo
 * quando a análise base já falhou — e falha sempre enquanto a política de
 * privacidade não estiver aceite, o que só acontece na etapa 4. Resultado
 * medido: a etapa 2 deixava avançar com o «Nome *» vazio.
 */
const faltaONome = (nivel: unknown, nome: unknown) =>
  nivel !== 'anonima' && String(nome ?? '').trim().length < 3;

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
          /* Recusado pelo navegador: o valor continua na tela para copiar à
             mão, e dizer «falhou» aqui só assustaria. */
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
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [config, setConfig] = useState<EmpresaConfig | null>(null);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [logoUrl, setLogoUrl] = useState<string>(AKURIS_DEFAULT_LOGO);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [codigoAcompanhamento, setCodigoAcompanhamento] = useState('');
  const [protocolo, setProtocolo] = useState<string>('');
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
  /* Identidade e direitos do canal — a mesma fonte das outras duas telas. */
  const canal = useCanalDenuncia(empresaSlug);

  /** Com denúncias anónimas desligadas, identificar-se deixa de ser opcional. */
  const identificacaoObrigatoria = config ? !config.permitir_anonimas : false;

  const denunciaSchema = useMemo(
    () => buildDenunciaSchema(t, config?.permitir_anonimas ?? true, !!config?.politica_privacidade),
    [t, config?.permitir_anonimas, config?.politica_privacidade],
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
    },
  });

  useEffect(() => {
    const loadConfiguracao = async () => {
      if (!empresaSlug) {
        logger.debug('Slug da empresa não fornecido', { module: 'DenunciaFormulario' });
        setLoading(false);
        return;
      }

      try {
        logger.debug('Carregando configuração para empresa slug', { module: 'DenunciaFormulario', action: empresaSlug });
        
        const empresaData = await fetchEmpresaPublicaPorSlug(empresaSlug);

        if (!empresaData) {
          logger.error('Empresa não encontrada para slug', { module: 'DenunciaFormulario', action: empresaSlug });
          setLoading(false);
          return;
        }

        logger.debug('Empresa encontrada', { module: 'DenunciaFormulario' });
        setEmpresa(empresaData);

        // Buscar configurações da empresa
        logger.debug('Buscando configurações para empresa', { module: 'DenunciaFormulario' });
        const { data: configRaw, error: configError } = await supabase.rpc(
          'get_denuncia_config_publica' as never,
          { p_empresa_id: empresaData.id } as never
        );

        const configRows = (configRaw ?? null) as unknown;
        const configData: any = Array.isArray(configRows) ? configRows[0] : configRows;

        if (configError || !configData) {
          logger.error('Erro ao buscar configurações', { module: 'DenunciaFormulario', error: String(configError) });
          setLoading(false);
          return;
        }

        if (!empresaData.canal_ativo) {
          logger.debug('Canal de denúncia desativado', { module: 'DenunciaFormulario' });
          setLoading(false);
          return;
        }

        logger.debug('Configurações carregadas', { module: 'DenunciaFormulario' });
        setConfig(configData);

        const { data: categoriasData, error: categoriasError } = await supabase.rpc(
          'get_denuncias_categorias_publicas' as never,
          { p_empresa_id: empresaData.id } as never
        );

        if (!categoriasError && categoriasData) {
          setCategorias((categoriasData ?? []) as any);
        }

        // Usar logo_url da empresa, com fallback automático para o logo Akuris
        setLogoUrl(getCompanyLogo(empresaData.logo_url));
      } catch (error) {
        logger.error('Erro geral ao carregar configuração', { module: 'DenunciaFormulario', error: String(error) });
      } finally {
        setLoading(false);
      }
    };

    loadConfiguracao();
  }, [empresaSlug]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (anexos.length + files.length > 5) {
      toast.error(t('publicPortal.denunciaForm.maxFiles'));
      return;
    }
    
    const validFiles = files.filter(file => {
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
    if (!empresa) return;
    
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
          denunciante_email: data.denunciante_email || null,
          denunciante_nome: data.denunciante_nome || null,
          /*
            Estes cinco eram recolhidos e deitados fora.

            O formulário pergunta onde, quando, com que testemunhas e que
            provas existem; a função de borda sempre soube recebê-los; e o
            envio passava só quatro campos. O investigador ficava sem o
            essencial de qualquer apuração — e ninguém percebia, porque a
            pessoa tinha mesmo preenchido.
          */
          denunciante_telefone: data.denunciante_telefone || null,
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
                  tipo: file.type,
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

            await supabase.functions.invoke('create-denuncia', {
              body: {
                action: 'anexo_confirmar',
                denuncia_id: denunciaData.id,
                codigo,
                anexo_id: pedido.anexo_id,
              },
            });
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
      setSubmitting(false);
    }
  };

  /*
    Estas três telas ficaram para trás na migração para o `CanalLayout`.

    Continuavam com o azul-escuro da aplicação enquanto o resto do canal já era
    claro e com a cor da empresa — e a do SUCESSO é justamente a que a pessoa
    mais fixa, porque é a que traz o protocolo.
  */
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <AkurisPulse size={32} />
          <p className="mt-2 text-sm text-muted-foreground">{t('publicPortal.common.loading')}</p>
        </div>
      </div>
    );
  }

  if (!empresa || !config) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="mx-auto max-w-md">
          <CardContent className="py-10 text-center">
            <IconShield className="mx-auto mb-4 h-8 w-8 text-muted-foreground" strokeWidth={1.5} />
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

  if (showSuccess) {
    return (
      <CanalLayout
        empresa={canal.empresa}
        config={canal.config}
        nomeDoCanal={canal.nomeDoCanal}
        estiloDaMarca={canal.estiloDaMarca}
        etapa={t('publicPortal.denunciaForm.successTitle')}
      >
        <div>
          <Card>
            <CardContent className="py-10 text-center">
              {/* O título já está no cabeçalho da página. */}
              <IconShield className="mx-auto mb-5 h-8 w-8 text-state-done" strokeWidth={1.5} />

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
                <div className="mt-3 flex justify-start">
                  <BotaoCopiar
                    texto={`${t('publicPortal.denunciaForm.yourProtocol')} ${protocolo}\n${t('publicPortal.denunciaForm.yourTrackingCode')} ${codigoAcompanhamento}`}
                    rotulo={t('publicPortal.denunciaForm.copiarTudo')}
                    rotuloFeito={t('publicPortal.denunciaForm.copiado')}
                  />
                </div>
              )}

              <p className="mb-6 mt-3 text-left text-xs leading-relaxed text-muted-foreground">
                {t('publicPortal.denunciaForm.trackingCodeHint')}{' '}
                {t('publicPortal.denunciaForm.successDescription')}
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
                <Link to={`/${empresaSlug}/denuncia/consulta`}>
                  <Button className="w-full">
                    <IconExternal className="w-4 h-4 mr-2" />
                    {t('publicPortal.denunciaForm.checkStatus')}
                  </Button>
                </Link>
                
                <Link to={`/${empresaSlug}/denuncia`}>
                  <Button variant="outline" className="w-full">
                    <IconArrowLeft className="w-4 h-4 mr-2" />
                    {t('publicPortal.denunciaForm.backHome')}
                  </Button>
                </Link>
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
    >
      <div>
        {/* O título já está no cabeçalho da página: repeti-lo dentro do cartão
            gastava a primeira linha do formulário a dizer o mesmo duas vezes. */}
        <Card>
          <CardContent className="pt-6">
            {/* Onde estou, e quanto falta. */}
            <div className="mb-6">
              <div className="flex items-center justify-between">
                <p className="text-micro font-semibold uppercase tracking-wide text-muted-foreground">
                  {t(`publicPortal.denunciaForm.etapa${etapa}`)}
                </p>
                <p className="text-micro tabular-nums text-muted-foreground">
                  {t('publicPortal.denunciaForm.etapaDe', { atual: etapa, total: TOTAL_ETAPAS })}
                </p>
              </div>
              <div className="mt-2 flex gap-1">
                {[1, 2, 3, 4].map((n) => (
                  <span
                    key={n}
                    className={
                      n <= etapa
                        ? 'h-1 flex-1 rounded-full bg-primary'
                        : 'h-1 flex-1 rounded-full bg-muted'
                    }
                  />
                ))}
              </div>
            </div>

            <Form {...form}>
              {/*
                A rede por baixo: se a submissão for travada por um erro
                num campo de OUTRA etapa, salta-se para lá em vez de ficar
                parado. Sem isto, «Registrar Denúncia» ficava activo, o
                clique não fazia nada, e o ecrã não mostrava mensagem
                nenhuma — o erro estava atrás, numa etapa que já não se vê.
              */}
              <form
                onSubmit={form.handleSubmit(onSubmit, (erros) => {
                  const primeiro = Object.keys(erros)[0];
                  const destino = ETAPA_DO_CAMPO[primeiro];
                  if (destino && destino !== etapa) setEtapa(destino);
                  toast.error(
                    (erros as Record<string, { message?: string }>)[primeiro]?.message ??
                      t('publicPortal.denunciaForm.unexpectedError'),
                  );
                })}
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
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('publicPortal.denunciaForm.categoryPlaceholder')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {categorias.map((categoria) => (
                            <SelectItem key={categoria.id} value={categoria.id}>
                              {categoria.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                        <Input {...field} placeholder={t('publicPortal.denunciaForm.titlePlaceholder')} />
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
                          className="min-h-[120px]"
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
                        <FormLabel>{t('publicPortal.denunciaForm.place')}</FormLabel>
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
                        <FormLabel>{t('publicPortal.denunciaForm.date')}</FormLabel>
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
                                    onChange={() => field.onChange(n)}
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
                              <FormLabel>{t('publicPortal.denunciaForm.email')}</FormLabel>
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
                                <Input {...field} placeholder={t('publicPortal.denunciaForm.phonePlaceholder')} />
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
                    
                    <div className="flex items-center justify-center w-full">
                      <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-muted-foreground/25 rounded-lg cursor-pointer hover:bg-accent">
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          <IconUpload className="w-8 h-8 mb-2 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">
                            {t('publicPortal.denunciaForm.attachCta')}
                          </p>
                        </div>
                        <input
                          type="file"
                          multiple
                          onChange={handleFileUpload}
                          className="hidden"
                          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt"
                        />
                      </label>
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
                <div className="overflow-hidden rounded-lg border border-border">
                  <p className="border-b border-border bg-muted/30 px-4 py-2 text-micro font-semibold uppercase tracking-wide text-muted-foreground">
                    {t('publicPortal.denunciaForm.revisaoTitulo')}
                  </p>
                  <dl className="divide-y divide-border">
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
                      {
                        rotulo: t('publicPortal.denunciaForm.attach'),
                        valor: anexos.length
                          ? t('publicPortal.denunciaForm.revisaoAnexos', { count: anexos.length })
                          : null,
                      },
                    ]
                      .filter((linha) => !!linha.valor)
                      .map((linha) => (
                        <div key={linha.rotulo} className="flex gap-3 px-4 py-2.5">
                          <dt className="w-32 shrink-0 text-xs text-muted-foreground">
                            {linha.rotulo}
                          </dt>
                          <dd className="min-w-0 flex-1 whitespace-pre-wrap break-words text-sm text-foreground">
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
                <div className="flex gap-3 pt-4">
                  {etapa === 1 ? (
                    <Link to={`/${empresaSlug}/denuncia`} className="flex-1">
                      <Button type="button" variant="outline" className="w-full">
                        {t('publicPortal.denunciaForm.cancel')}
                      </Button>
                    </Link>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={() => setEtapa((e) => e - 1)}
                    >
                      {t('publicPortal.denunciaForm.voltarEtapa')}
                    </Button>
                  )}

                  {etapa < TOTAL_ETAPAS ? (
                    <Button
                      type="button"
                      className="flex-1"
                      onClick={async () => {
                        const ok = await form.trigger(CAMPOS_POR_ETAPA[etapa]);
                        /* A regra cruzada, verificada aqui porque o
                           `superRefine` do esquema não corre nesta altura. */
                        const v = form.getValues();
                        if (etapa === 2 && faltaONome(v.nivel_identificacao, v.denunciante_nome)) {
                          form.setError('denunciante_nome', {
                            type: 'manual',
                            message: t('publicPortal.denunciaForm.validation.nameRequired'),
                          });
                          return;
                        }
                        if (ok) setEtapa((e) => e + 1);
                      }}
                    >
                      {t('publicPortal.denunciaForm.avancarEtapa')}
                    </Button>
                  ) : (
                    <Button type="submit" disabled={submitting} className="flex-1">
                      {submitting ? t('publicPortal.denunciaForm.submitting') : t('publicPortal.denunciaForm.submit')}
                    </Button>
                  )}
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </CanalLayout>
  );
}
