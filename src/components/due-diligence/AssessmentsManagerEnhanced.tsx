import { rowOpenProps, CARD_HOVER } from '@/lib/row-interaction';
import { IconAdd, IconClose, IconFilter, IconEdit, IconDelete, IconView, IconMore, IconSuccess, IconWarning, IconTime, IconRefresh, IconSend, IconFile, IconPerson, IconAward, IconTrendUp, IconUsers, IconSort, IconMail , IconDownload } from '@/components/icons';
import { useState, useEffect, useMemo, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DialogShell } from '@/components/ui/dialog-shell';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useDueDiligenceStats } from '@/hooks/useDueDiligenceStats';
import { AssessmentDialog } from './AssessmentDialog';
import ConfirmDialog from '@/components/ConfirmDialog';
import { RelatorioDoFornecedor, type RespostaPontuada } from './RelatorioDoFornecedor';
import { DataTable, type Column } from '@/components/ui/data-table';
import { cn } from '@/lib/utils';
import { AssessmentResponsesViewer } from './AssessmentResponsesViewer';
import { ReportsSidebar } from './ReportsSidebar';
import { IntegrationSuggestions } from './IntegrationSuggestions';
import type { ParecerDaIA } from './ParecerIA';
import { gerarRelatorioFornecedor } from './relatorio-fornecedor';
import { formatDateOnly, parseDataLocal } from '@/lib/date-utils';
import { startOfDay } from 'date-fns';
import { formatStatus } from '@/lib/text-utils';
import { StatusBadge, type StatusTone } from '@/components/ui/status-badge';
import { resolveDueDiligenceStatusTone, resolveScoreDueDiligenceTone } from '@/lib/status-tone';
import { useLanguage } from '@/contexts/LanguageContext';

import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { exigirEscrita } from '@/lib/supabase-write';
interface Assessment {
  id: string;
  fornecedor_nome: string;
  fornecedor_email: string;
  status: string;
  data_inicio?: string;
  data_conclusao?: string;
  data_expiracao: string;
  data_envio?: string;
  score_final?: number;
  ia_parecer?: ParecerDaIA | null;
  ia_nivel_risco?: string | null;
  ia_avaliado_em?: string | null;
  token: string;
  link_token: string;
  template: {
    id: string;
    nome: string;
    categoria: string;
  };
}

interface ReminderDialogProps {
  assessment: Assessment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

function ReminderDialog({ assessment, open, onOpenChange, onSuccess }: ReminderDialogProps) {
  const [sending, setSending] = useState(false);
  const { toast } = useToast();
  const { t } = useLanguage();

  const sendReminder = async () => {
    if (!assessment) return;

    try {
      setSending(true);
      
      const { data: profileData } = await supabase
        .from('profiles')
        .select('empresa_id')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      let empresaNome = 'Akuris';
      let empresaLogoUrl = null;

      if (profileData?.empresa_id) {
        const { data: empresaData } = await supabase
          .from('empresas')
          .select('nome, logo_url')
          .eq('id', profileData.empresa_id)
          .single();
        
        if (empresaData) {
          empresaNome = empresaData.nome;
          empresaLogoUrl = empresaData.logo_url;
        }
      }

      const assessmentLink = `${window.location.origin}/assessment/${assessment.link_token}`;
      
      await supabase.functions.invoke('send-due-diligence-email', {
        body: {
          type: 'reminder',
          assessment_id: assessment.id,
          fornecedor_nome: assessment.fornecedor_nome,
          fornecedor_email: assessment.fornecedor_email,
          template_nome: assessment.template.nome,
          assessment_link: assessmentLink,
          data_expiracao: assessment.data_expiracao,
          empresa_nome: empresaNome,
          empresa_logo_url: empresaLogoUrl
        }
      });

      await exigirEscrita(supabase
        .from('due_diligence_assessments')
        .update({ ultimo_lembrete_enviado: new Date().toISOString() })
        .eq('id', assessment.id));

      toast({
        title: t('dueDiligence.assessmentsManagerEnhanced.toastReminderSentTitle'),
        description: t('dueDiligence.assessmentsManagerEnhanced.toastReminderSentDescription', { fornecedor: assessment.fornecedor_nome }),
      });

      onSuccess();
      onOpenChange(false);

    } catch (error: any) {
      toast({
        title: t('dueDiligence.assessmentsManagerEnhanced.toastReminderErrorTitle'),
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={IconMail}
      title={t('dueDiligence.assessmentsManagerEnhanced.reminderTitle')}
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            {t('dueDiligence.assessmentsManagerEnhanced.cancel')}
          </Button>
          <Button size="sm" onClick={sendReminder} disabled={sending}>
            {sending ? t('dueDiligence.assessmentsManagerEnhanced.sending') : t('dueDiligence.assessmentsManagerEnhanced.sendReminder')}
          </Button>
        </div>
      }
    >
        {assessment && (
          <div className="space-y-4">
            <div className="space-y-2">
              <p><strong>{t('dueDiligence.assessmentsManagerEnhanced.reminderSupplier')}</strong> {assessment.fornecedor_nome}</p>
              <p><strong>{t('dueDiligence.assessmentsManagerEnhanced.reminderEmail')}</strong> {assessment.fornecedor_email}</p>
              <p><strong>{t('dueDiligence.assessmentsManagerEnhanced.reminderTemplate')}</strong> {assessment.template.nome}</p>
              <p><strong>{t('dueDiligence.assessmentsManagerEnhanced.reminderStatus')}</strong> {formatStatus(assessment.status)}</p>
            </div>
          </div>
        )}
    </DialogShell>
  );
}

interface AssessmentsManagerEnhancedProps {
  /** Avaliação a abrir por ligação profunda (`/due-diligence?focus=<id>`). */
  focoId?: string | null;
  filter?: {
    fornecedorId?: string;
    fornecedorNome?: string;
  } | null;
}

// Número de itens por página
const ITEMS_PER_PAGE_OPTIONS = [10, 20, 50];

export function AssessmentsManagerEnhanced({ filter, focoId }: AssessmentsManagerEnhancedProps = {}) {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoriaFilter, setCategoriaFilter] = useState('all');
  const [sortField, setSortField] = useState<string>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [reminderDialog, setReminderDialog] = useState<{ open: boolean; assessment: Assessment | null }>({
    open: false,
    assessment: null
  });
  const [assessmentDialog, setAssessmentDialog] = useState<{ 
    open: boolean; 
    assessment: Assessment | null; 
    mode: 'create' | 'view' 
  }>({
    open: false,
    assessment: null,
    mode: 'create'
  });
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; assessment: Assessment | null }>({
    open: false,
    assessment: null
  });
  const [aReavaliar, setAReavaliar] = useState(false);
  const [aGerarRelatorio, setAGerarRelatorio] = useState(false);

  /*
    Relatorio gerencial da avaliacao.

    Terminada a avaliacao ficava um score na tela e nada que se pudesse levar a
    uma reuniao. Quem precisasse de apresentar a decisao -- ao comite, ao
    juridico, ao cliente que exige due diligence dos seus fornecedores --
    copiava numeros a mao para um documento a parte.

    As respostas vao no anexo de proposito: um relatorio que so mostra o numero
    obriga a acreditar nele. Com as respostas ao lado, o numero pode ser
    conferido.
  */
  const gerarRelatorio = async (assessment: Assessment) => {
    setAGerarRelatorio(true);
    try {
      const { data: respostas, error } = await supabase
        .from('due_diligence_responses')
        .select('resposta, pontuacao, arquivo_url, resposta_arquivo_url, due_diligence_questions!inner(titulo, peso, ordem)')
        .eq('assessment_id', assessment.id);
      if (error) throw error;

      /* A nota por secção vem do mesmo sítio que o ecrã lê. Sem ela, o PDF
         que vai anexo ao processo dizia QUANTO e não ONDE. */
      const { data: notas } = await supabase
        .from('due_diligence_scores')
        .select('score_breakdown')
        .eq('assessment_id', assessment.id)
        .maybeSingle();
      const porSecao = Object.entries((notas?.score_breakdown ?? {}) as Record<string, unknown>).map(
        ([secao, valor]) => ({
          secao,
          score: typeof valor === 'number' ? valor : Number((valor as { score?: number })?.score ?? 0),
          perguntas: typeof valor === 'number' ? undefined : (valor as { perguntas?: number })?.perguntas,
        }),
      );

      const ordenadas = (respostas ?? [])
        .map((r: any) => ({
          pergunta: r.due_diligence_questions?.titulo ?? '-',
          resposta: r.resposta ?? null,
          peso: r.due_diligence_questions?.peso ?? null,
          pontuacao: r.pontuacao ?? null,
          temAnexo: !!(r.arquivo_url || r.resposta_arquivo_url),
          _ordem: r.due_diligence_questions?.ordem ?? 0,
        }))
        .sort((a, b) => a._ordem - b._ordem);

      await gerarRelatorioFornecedor(
        {
          fornecedorNome: assessment.fornecedor_nome,
          templateNome: (assessment as any).due_diligence_templates?.nome ?? null,
          scoreFinal: assessment.score_final ?? null,
          status: assessment.status ?? null,
          dataEnvio: (assessment as any).data_envio ?? null,
          dataConclusao: (assessment as any).data_conclusao ?? null,
          parecer: (assessment.ia_parecer as ParecerDaIA) ?? null,
          parecerEm: assessment.ia_avaliado_em ?? null,
          respostas: ordenadas,
          porSecao,
        },
        {
          titulo: t('dueDiligence.relatorio.titulo'),
          subtitulo: t('dueDiligence.relatorio.subtitulo'),
          seccaoResumo: t('dueDiligence.relatorio.seccaoResumo'),
          seccaoParecer: t('dueDiligence.relatorio.seccaoParecer'),
          seccaoRespostas: t('dueDiligence.relatorio.seccaoRespostas'),
          score: t('dueDiligence.relatorio.score'),
          semScore: t('dueDiligence.relatorio.semScore'),
          porSecao: t('dueDiligence.relatorio.porSecao'),
          nivelRisco: t('dueDiligence.relatorio.nivelRisco'),
          semParecer: t('dueDiligence.relatorio.semParecer'),
          avisoParecer: t('dueDiligence.relatorio.avisoParecer'),
          confianca: t('dueDiligence.relatorio.confianca'),
          pontosFortes: t('dueDiligence.parecerIA.pontosFortes'),
          pontosAtencao: t('dueDiligence.parecerIA.pontosAtencao'),
          evidenciasEmFalta: t('dueDiligence.parecerIA.evidenciasEmFalta'),
          recomendacoes: t('dueDiligence.parecerIA.recomendacoes'),
          colPergunta: t('dueDiligence.relatorio.colPergunta'),
          colResposta: t('dueDiligence.relatorio.colResposta'),
          colNota: t('dueDiligence.relatorio.colNota'),
          semAnexo: t('dueDiligence.relatorio.semAnexo'),
          enviadoEm: t('dueDiligence.relatorio.enviadoEm'),
          concluidoEm: t('dueDiligence.relatorio.concluidoEm'),
          questionario: t('dueDiligence.relatorio.questionario'),
        },
      );
    } catch (erro) {
      toast({
        title: t('dueDiligence.relatorio.erro'),
        description: erro instanceof Error ? erro.message : String(erro),
        variant: 'destructive',
      });
    } finally {
      setAGerarRelatorio(false);
    }
  };


  /*
    Reavaliar a pedido.

    O parecer nasce sozinho quando o fornecedor submete. Este botao existe para
    o caso de a chamada ter falhado (o gateway estava em baixo, os creditos
    tinham acabado) ou de o questionario ter mudado desde entao -- sem ele, a
    unica saida era apagar a avaliacao e recomecar.
  */
  const reavaliarComIA = async (assessmentId: string) => {
    setAReavaliar(true);
    try {
      const { data, error } = await supabase.functions.invoke('avaliar-fornecedor-ia', {
        body: { assessment_id: assessmentId },
      });
      // `invoke` devolve {data,error} e NAO lanca: sem esta verificacao, uma
      // falha do gateway passaria por sucesso.
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: t('dueDiligence.parecerIA.titulo'), description: t('dueDiligence.parecerIA.reavaliadoOk') });
      await fetchAssessments();
      setScoreDialog((d) => (d.assessment ? { ...d, assessment: { ...d.assessment, ia_parecer: data?.parecer ?? null, ia_avaliado_em: new Date().toISOString() } } : d));
    } catch (erro) {
      toast({
        title: t('dueDiligence.parecerIA.reavaliadoErro'),
        description: erro instanceof Error ? erro.message : String(erro),
        variant: 'destructive',
      });
    } finally {
      setAReavaliar(false);
    }
  };

  const [scoreDialog, setScoreDialog] = useState<{ 
    open: boolean; 
    assessment: Assessment | null; 
    scoreData: any 
  }>({
    open: false,
    assessment: null,
    scoreData: null
  });
  const [responsesDialog, setResponsesDialog] = useState<{ 
    open: boolean; 
    assessment: Assessment | null; 
  }>({
    open: false,
    assessment: null
  });
  const { toast } = useToast();
  const { t } = useLanguage();
  const { data: stats, isLoading: statsLoading } = useDueDiligenceStats();

  useEffect(() => {
    fetchAssessments();
  }, []);

  useEffect(() => {
    if (filter?.fornecedorNome) {
      setSearchTerm(filter.fornecedorNome);
    }
  }, [filter]);

  /*
    Abre a avaliação pedida pela ligação profunda, uma vez só.

    `assessments` é recarregado a cada ação da lista; sem a marca do que já
    foi consumido, fechar a ficha e lembrar (por exemplo) fazia-a reabrir
    sozinha por cima do que a pessoa estivesse a fazer.
  */
  const focoConsumido = useRef<string | null>(null);
  useEffect(() => {
    if (!focoId || focoId === focoConsumido.current || assessments.length === 0) return;
    const alvo = assessments.find((a) => a.id === focoId);
    if (!alvo) return;
    focoConsumido.current = focoId;
    setAssessmentDialog({ open: true, assessment: alvo, mode: 'view' });
  }, [focoId, assessments]);

  useEffect(() => {
    const handleCreateAssessment = (event: CustomEvent) => {
      setAssessmentDialog({ 
        open: true, 
        assessment: {
          fornecedor_nome: event.detail.fornecedorNome,
          fornecedor_id: event.detail.fornecedorId
        } as any, 
        mode: 'create' 
      });
    };
    
    window.addEventListener('createAssessment', handleCreateAssessment as EventListener);
    
    return () => {
      window.removeEventListener('createAssessment', handleCreateAssessment as EventListener);
    };
  }, []);

  const fetchAssessments = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('due_diligence_assessments')
        .select(`
          *,
          templates:template_id(id, nome, categoria)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      /*
        O status gravado é o status. Aqui reescrevia-se para 'expirado' no
        cliente sempre que o prazo tivesse passado — e como o cartão ainda
        acrescenta o seu próprio selo de expirado, saíam dois chips iguais
        lado a lado. Pior: o painel do topo não faz essa reescrita, portanto a
        MESMA avaliação aparecia como "Expirado" aqui e "Em Andamento" ali, no
        mesmo ecrã. A expiração é uma marca sobre o estado, não o estado.
      */
      const formattedAssessments: Assessment[] = (data || []).map(assessment => {
        const status = assessment.status;

        return {
          id: assessment.id,
          fornecedor_nome: assessment.fornecedor_nome,
          fornecedor_email: assessment.fornecedor_email,
          status: status,
          data_inicio: assessment.data_inicio,
          data_conclusao: assessment.data_conclusao,
          data_expiracao: assessment.data_expiracao,
          data_envio: assessment.data_envio,
          score_final: assessment.score_final,
          /*
            O parecer da IA vinha na consulta e morria aqui.

            A consulta faz `select('*')`, por isso `ia_parecer`,
            `ia_avaliado_em` e `ia_nivel_risco` chegavam do servidor; este mapa
            montava o objecto do ecrã campo a campo e não os copiava. O tipo
            `Assessment` declara-os, o painel do parecer recebia-os como
            argumento — e recebia sempre `null`. O botão «Reavaliar» estava lá,
            gastava crédito, gravava o parecer na base, e o ecrã continuava
            vazio: não havia por onde o ver.
          */
          ia_parecer: (assessment.ia_parecer as ParecerDaIA | null) ?? null,
          ia_avaliado_em: assessment.ia_avaliado_em ?? null,
          ia_nivel_risco: assessment.ia_nivel_risco ?? null,
          token: assessment.link_token,
          link_token: assessment.link_token,
          template: {
            id: assessment.template_id,
            nome: assessment.templates?.nome || 'Template não encontrado',
            categoria: assessment.templates?.categoria || 'N/A'
          }
        };
      });

      setAssessments(formattedAssessments);
    } catch (error: any) {
      toast({
        title: t('dueDiligence.assessmentsManagerEnhanced.errorLoadTitle'),
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Lista de categorias únicas
  const categorias = useMemo(() => {
    const cats = new Set(assessments.map(a => a.template.categoria));
    return Array.from(cats).filter(Boolean);
  }, [assessments]);

  // Filtrar e ordenar assessments
  const filteredAndSortedAssessments = useMemo(() => {
    let filtered = assessments;

    if (searchTerm) {
      filtered = filtered.filter(assessment =>
        assessment.fornecedor_nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        assessment.fornecedor_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        assessment.template.nome.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter && statusFilter !== 'all') {
      filtered = filtered.filter(assessment => assessment.status === statusFilter);
    }

    if (categoriaFilter && categoriaFilter !== 'all') {
      filtered = filtered.filter(assessment => assessment.template.categoria === categoriaFilter);
    }

    // Ordenar
    filtered.sort((a, b) => {
      let aValue: any = a[sortField as keyof Assessment];
      let bValue: any = b[sortField as keyof Assessment];

      if (sortField === 'template.nome') {
        aValue = a.template.nome;
        bValue = b.template.nome;
      } else if (sortField === 'score_final') {
        aValue = a.score_final || 0;
        bValue = b.score_final || 0;
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc' 
          ? aValue.localeCompare(bValue) 
          : bValue.localeCompare(aValue);
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [assessments, searchTerm, statusFilter, categoriaFilter, sortField, sortDirection]);

  // Paginação

  /**
   * As colunas da tabela de avaliacoes.
   *
   * Era um cartao por avaliacao, com os campos em rotulo-e-valor dentro dele.
   * Em cartao nao se comparam duas avaliacoes de relance -- cada valor esta
   * noutro sitio -- nem se ordena por score ou por prazo. Sao as duas
   * perguntas que se fazem a uma lista destas: quem esta pior, e quem vence
   * primeiro.
   */
  const colunasDeAvaliacao: Column<Assessment>[] = [
    {
      key: 'fornecedor_nome',
      label: t('dueDiligence.assessmentsManagerEnhanced.colSupplier'),
      render: (_v, a) => (
        <div className="min-w-0">
          <div className="font-medium text-foreground truncate">{a.fornecedor_nome}</div>
          {a.fornecedor_email && (
            <div className="text-micro text-muted-foreground truncate">{a.fornecedor_email}</div>
          )}
        </div>
      ),
    },
    {
      key: 'template',
      label: t('dueDiligence.assessmentsManagerEnhanced.colTemplate'),
      sortAccessor: (a) => a.template?.nome ?? '',
      render: (_v, a) => <span className="text-xs text-foreground/85">{a.template?.nome ?? '—'}</span>,
    },
    {
      key: 'categoria',
      label: t('dueDiligence.assessmentsManagerEnhanced.colCategory'),
      sortAccessor: (a) => a.template?.categoria ?? '',
      render: (_v, a) => <span className="text-xs text-muted-foreground">{a.template?.categoria ?? '—'}</span>,
    },
    {
      key: 'data_expiracao',
      label: t('dueDiligence.assessmentsManagerEnhanced.colDeadline'),
      render: (_v, a) => {
        const expirou = a.status !== 'concluido' && isExpired(a.data_expiracao);
        return (
          <div className="flex items-center gap-1.5">
            <span className={cn('text-xs tabular-nums', expirou ? 'text-destructive font-medium' : 'text-foreground/85')}>
              {formatDateOnly(a.data_expiracao)}
            </span>
            {expirou && (
              <StatusBadge tone="destructive" variant="soft">
                {t('dueDiligence.assessmentsManagerEnhanced.expired')}
              </StatusBadge>
            )}
          </div>
        );
      },
    },
    {
      key: 'score_final',
      /* `score` era o rotulo do cartao -- "Score:", com dois pontos, porque
         vinha seguido do valor. Num cabecalho de tabela isso le-se mal. */
      label: t('dueDiligence.assessmentsManagerEnhanced.colScore'),
      /* Ordena pelo numero, nao pelo rotulo: por alfabeto "Bom" vinha antes de
         "Excelente" e de "Ruim", que e a ordem de nada. */
      sortAccessor: (a) => (a.score_final == null ? -1 : a.score_final),
      render: (_v, a) =>
        a.score_final != null ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleScoreClick(a); }}
            className="hover:underline"
          >
            {/* A marca (A-D) e a cor vem do resolvedor unico; o icone saiu
                porque a marca ja faz o mesmo trabalho e melhor. */}
            <StatusBadge {...resolveScoreDueDiligenceTone(a.score_final)}>
              {getScoreBadge(a.score_final).text}
              <span className="ml-1 tabular-nums">{a.score_final.toFixed(1)}%</span>
            </StatusBadge>
          </button>
        ) : (
          <span className="text-xs text-muted-foreground">
            {a.status === 'concluido'
              ? t('dueDiligence.assessmentsManagerEnhanced.calculating')
              : t('dueDiligence.assessmentsManagerEnhanced.pending')}
          </span>
        ),
    },
    {
      key: 'status',
      label: t('dueDiligence.assessmentsManagerEnhanced.colStatus'),
      render: (_v, a) => getStatusBadge(a.status),
    },
    {
      key: 'acoes',
      label: t('dueDiligence.assessmentsManagerEnhanced.colActions'),
      render: (_v, a) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={t('layout.moreActions')} onClick={(e) => e.stopPropagation()}>
              <IconMore className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            {a.status === 'concluido' && (
              <>
                <DropdownMenuItem onClick={() => setScoreDialog({ open: true, assessment: a, scoreData: null })}>
                  <IconAward className="h-4 w-4 mr-2" />
                  {t('dueDiligence.assessmentsManagerEnhanced.viewScore')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setResponsesDialog({ open: true, assessment: a })}>
                  <IconView className="h-4 w-4 mr-2" />
                  {t('dueDiligence.assessmentsManagerEnhanced.viewResponses')}
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuItem onClick={() => setAssessmentDialog({ open: true, assessment: a, mode: 'view' })}>
              <IconFile className="h-4 w-4 mr-2" />
              {t('dueDiligence.assessmentsManagerEnhanced.details')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => resendAssessment(a)} disabled={a.status === 'concluido'}>
              <IconRefresh className="h-4 w-4 mr-2" />
              {t('dueDiligence.assessmentsManagerEnhanced.resend')}
            </DropdownMenuItem>
            {canSendReminder(a) && (
              <DropdownMenuItem onClick={() => setReminderDialog({ open: true, assessment: a })}>
                <IconSend className="h-4 w-4 mr-2" />
                {t('dueDiligence.assessmentsManagerEnhanced.reminder')}
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setDeleteDialog({ open: true, assessment: a })} className="text-destructive">
              <IconDelete className="h-4 w-4 mr-2" />
              {t('dueDiligence.assessmentsManagerEnhanced.delete')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const paginatedAssessments = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedAssessments.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredAndSortedAssessments, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredAndSortedAssessments.length / itemsPerPage);

  // Reset page quando filtros mudam
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, categoriaFilter]);

  const getStatusBadge = (status: string) => {
    return <StatusBadge {...resolveDueDiligenceStatusTone(status)}>{formatStatus(status)}</StatusBadge>;
  };


  /**
   * O ROTULO da faixa. A cor vem de `resolveScoreDueDiligenceTone`.
   *
   * Devolvia tambem um `tone`, e era o quarto sitio a decidir a cor do score.
   * Pior: para 60-79 devolvia `info`, que sem `mark` se desenha CINZENTO --
   * um score de 62,5% chegava ao ecra com a cor de um campo vazio.
   *
   * Os limiares ficam aqui porque sao os mesmos do resolvedor, e mudam juntos;
   * a guarda `uma-escala-para-o-score` reprova se se separarem.
   */
  const getScoreBadge = (score?: number | null): { text: string } => {
    if (score == null) return { text: t('dueDiligence.assessmentsManagerEnhanced.scoreAwaiting') };
    if (score >= 80) return { text: t('dueDiligence.assessmentsManagerEnhanced.scoreExcellent') };
    if (score >= 60) return { text: t('dueDiligence.assessmentsManagerEnhanced.scoreGood') };
    if (score >= 40) return { text: t('dueDiligence.assessmentsManagerEnhanced.scoreRegular') };
    return { text: t('dueDiligence.assessmentsManagerEnhanced.scoreBad') };
  };

  const isExpired = (dateString: string) => {
    // Expira no fim do dia do prazo, e `parseDataLocal` evita perder um dia
    // por fuso quando a coluna não tem hora.
    if (!dateString) return false;
    return startOfDay(new Date()) > startOfDay(parseDataLocal(dateString));
  };

  const isExpiringSoon = (dateString: string) => {
    const expirationDate = new Date(dateString);
    const now = new Date();
    const diffTime = expirationDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 && diffDays <= 7;
  };

  const canSendReminder = (assessment: Assessment) => {
    return assessment.status !== 'concluido' && !isExpired(assessment.data_expiracao);
  };

  const viewAssessment = (assessment: Assessment) => {
    const url = `${window.location.origin}/assessment/${assessment.link_token}`;
    window.open(url, '_blank');
  };

  const resendAssessment = async (assessment: Assessment) => {
    try {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('empresa_id')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      let empresaNome = 'Akuris';
      let empresaLogoUrl = null;

      if (profileData?.empresa_id) {
        const { data: empresaData } = await supabase
          .from('empresas')
          .select('nome, logo_url')
          .eq('id', profileData.empresa_id)
          .single();
        
        if (empresaData) {
          empresaNome = empresaData.nome;
          empresaLogoUrl = empresaData.logo_url;
        }
      }

      const assessmentLink = `${window.location.origin}/assessment/${assessment.link_token}`;
      
      await supabase.functions.invoke('send-due-diligence-email', {
        body: {
          type: 'send',
          assessment_id: assessment.id,
          fornecedor_nome: assessment.fornecedor_nome,
          fornecedor_email: assessment.fornecedor_email,
          template_nome: assessment.template.nome,
          assessment_link: assessmentLink,
          data_expiracao: assessment.data_expiracao,
          empresa_nome: empresaNome,
          empresa_logo_url: empresaLogoUrl
        }
      });

      toast({
        title: t('dueDiligence.assessmentsManagerEnhanced.toastResentTitle'),
        description: t('dueDiligence.assessmentsManagerEnhanced.toastResentDescription', { fornecedor: assessment.fornecedor_nome }),
      });

    } catch (error: any) {
      toast({
        title: t('dueDiligence.assessmentsManagerEnhanced.toastResentErrorTitle'),
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const deleteAssessment = async (assessment: Assessment) => {
    try {
      const { error } = await supabase
        .from('due_diligence_assessments')
        .delete()
        .eq('id', assessment.id);

      if (error) throw error;

      toast({
        title: t('dueDiligence.assessmentsManagerEnhanced.toastDeletedTitle'),
        description: t('dueDiligence.assessmentsManagerEnhanced.toastDeletedDescription'),
      });

      fetchAssessments();
      setDeleteDialog({ open: false, assessment: null });

    } catch (error: any) {
      toast({
        title: t('dueDiligence.assessmentsManagerEnhanced.toastDeletedErrorTitle'),
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setCategoriaFilter('all');
  };

  const hasActiveFilters = searchTerm || statusFilter !== 'all' || categoriaFilter !== 'all';

  if (loading) {
    return <div className="text-center p-8">{t('dueDiligence.assessmentsManagerEnhanced.loading')}</div>;
  }

  const calcularScoreMedio = () => {
    const concluidas = assessments.filter(a => 
      a.status === 'concluido' && a.score_final != null && a.score_final > 0
    );
    
    if (concluidas.length === 0) return 0;
    
    // `score_final` já é percentagem — ver calculate-assessment-score.
    return (concluidas.reduce((sum, a) => sum + (a.score_final || 0), 0) / concluidas.length);
  };

  const handleScoreClick = async (assessment: Assessment) => {
    try {
      const { data: scoreData } = await supabase
        .from('due_diligence_scores')
        .select('*')
        .eq('assessment_id', assessment.id)
        .single();
      
      if (scoreData) {
        setScoreDialog({
          open: true,
          assessment,
          scoreData
        });
      } else {
        toast({
          title: t('acessosDd.dueDiligence.scoreNotFoundTitle'),
          description: t('acessosDd.dueDiligence.scoreNotFoundDescription'),
          variant: "destructive"
        });
      }
    } catch (error: any) {
      toast({
        title: t('acessosDd.dueDiligence.errorTitle'),
        description: error.message,
        variant: "destructive"
      });
    }
  };

  // Função para obter classe de borda baseada na expiração
  const getExpirationBorderClass = (assessment: Assessment) => {
    if (assessment.status === 'concluido') return '';
    if (isExpired(assessment.data_expiracao)) return 'border-l-4 border-l-destructive';
    if (isExpiringSoon(assessment.data_expiracao)) return 'border-l-4 border-l-amber-500';
    return '';
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <Card className="rounded-lg border overflow-hidden">
          <CardContent className="p-0">
            <div className="p-6 pb-4">
              <div className="flex items-center justify-between gap-4 mb-4">
                <div className="relative flex-1 max-w-sm">
                  <Input
                    placeholder={t('dueDiligence.assessmentsManagerEnhanced.searchPlaceholder')}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <ReportsSidebar />
                  <Button
                    variant="outline" 
                    size="sm"
                    onClick={() => setShowFilters(!showFilters)}
                  >
                    <IconFilter className="h-4 w-4 mr-2" />
                    {t('dueDiligence.assessmentsManagerEnhanced.filters')}
                  </Button>
                </div>
              </div>
              
              {showFilters && (
                <div className="bg-card rounded-lg p-4 mb-4 flex items-center gap-4 flex-wrap border border-border">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm">{t('dueDiligence.assessmentsManagerEnhanced.filterStatusLabel')}</Label>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder={t('dueDiligence.assessmentsManagerEnhanced.filterStatusPlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t('dueDiligence.assessmentsManagerEnhanced.statusAll')}</SelectItem>
                        <SelectItem value="pendente">{t('dueDiligence.assessmentsManagerEnhanced.statusPending')}</SelectItem>
                        <SelectItem value="ativo">{t('dueDiligence.assessmentsManagerEnhanced.statusActive')}</SelectItem>
                        <SelectItem value="em_andamento">{t('dueDiligence.assessmentsManagerEnhanced.statusInProgress')}</SelectItem>
                        <SelectItem value="concluido">{t('dueDiligence.assessmentsManagerEnhanced.statusCompleted')}</SelectItem>
                        <SelectItem value="expirado">{t('dueDiligence.assessmentsManagerEnhanced.statusExpired')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-sm">{t('dueDiligence.assessmentsManagerEnhanced.filterCategoryLabel')}</Label>
                    <Select value={categoriaFilter} onValueChange={setCategoriaFilter}>
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t('dueDiligence.assessmentsManagerEnhanced.categoryAll')}</SelectItem>
                        {categorias.map((cat) => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {hasActiveFilters && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={clearFilters}
                    >
                      <IconClose className="h-4 w-4 mr-1" />
                      {t('dueDiligence.assessmentsManagerEnhanced.clearFilters')}
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/*
              A lista das avaliacoes e uma TABELA, como as outras do produto.

              Era um cartao por avaliacao, com os campos em rotulo-e-valor
              dentro dele e uma paginacao escrita a mao por baixo. Custava tres
              coisas: nao dava para comparar duas avaliacoes de relance (cada
              valor esta noutro sitio da coluna), nao dava para ordenar por
              score nem por prazo, e a paginacao repetia o que a `DataTable` ja
              faz -- incluindo o "Mostrando X a Y de Z" e o seletor de tamanho.

              A busca e os filtros ficam onde estavam, no cabecalho desta
              secao; por isso a tabela leva `searchable={false}` e recebe
              `filtering`, que e o que a faz distinguir "nao ha nada" de "o
              filtro nao achou nada".
            */}
            <div className="p-6 pt-0">
              <DataTable
                data={filteredAndSortedAssessments}
                columns={colunasDeAvaliacao}
                loading={loading}
                searchable={false}
                paginated
                pageSize={itemsPerPage}
                pageSizeOptions={ITEMS_PER_PAGE_OPTIONS}
                onRowClick={viewAssessment}
                filtering={{ active: Boolean(hasActiveFilters), onClear: clearFilters }}
                emptyState={{
                  icon: <IconFile className="h-12 w-12 text-muted-foreground" />,
                  title: t('dueDiligence.assessmentsManagerEnhanced.emptyTitle'),
                  description: t('dueDiligence.assessmentsManagerEnhanced.emptyDescription'),
                }}
              />
            </div>
          </CardContent>
        </Card>

        <div>
          {filteredAndSortedAssessments.length === 0 && !loading && (
            <Card>
              <CardContent className="text-center py-8">
                <IconFile className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">{t('dueDiligence.assessmentsManagerEnhanced.emptyTitle')}</h3>
                <p className="text-muted-foreground">
                  {hasActiveFilters 
                    ? t('dueDiligence.assessmentsManagerEnhanced.emptyFilteredDescription')
                    : t('dueDiligence.assessmentsManagerEnhanced.emptyDescription')}
                </p>
              </CardContent>
            </Card>
          )}

          <ReminderDialog
            assessment={reminderDialog.assessment}
            open={reminderDialog.open}
            onOpenChange={(open) => setReminderDialog({ open, assessment: null })}
            onSuccess={fetchAssessments}
          />

          <AssessmentDialog
            open={assessmentDialog.open}
            onOpenChange={(open) => setAssessmentDialog({ open, assessment: null, mode: 'create' })}
            assessment={assessmentDialog.assessment as any}
            mode={assessmentDialog.mode}
            onSuccess={fetchAssessments}
          />

          <ConfirmDialog
            open={deleteDialog.open}
            onOpenChange={(open) => setDeleteDialog({ open, assessment: null })}
            title={t('dueDiligence.assessmentsManagerEnhanced.deleteDialogTitle')}
            description={t('dueDiligence.assessmentsManagerEnhanced.deleteDialogDescription', { fornecedor: deleteDialog.assessment?.fornecedor_nome })}
            onConfirm={() => deleteDialog.assessment && deleteAssessment(deleteDialog.assessment)}
            confirmText={t('dueDiligence.assessmentsManagerEnhanced.deleteConfirm')}
            cancelText={t('dueDiligence.assessmentsManagerEnhanced.deleteCancel')}
          />

          {/* Dialog de Score com Integrações */}
          <DialogShell
            open={scoreDialog.open}
            onOpenChange={(open) => setScoreDialog({ open, assessment: null, scoreData: null })}
            icon={IconAward}
            title={t('dueDiligence.assessmentsManagerEnhanced.scoreDialogTitle', { fornecedor: scoreDialog.assessment?.fornecedor_nome ?? '' })}
            size="xl"
            hideFooter
          >
              <div className="space-y-4">
                {/*
                  O relatorio ocupa a largura toda.

                  Estava em duas colunas desiguais: o numero e as barras em 2/3,
                  e o parecer da IA espremido no 1/3 de lado. O parecer passou
                  para dentro do relatorio, ao lado do que o numero diz, porque e
                  a mesma leitura do mesmo material -- so que uma e aritmetica e
                  a outra e interpretacao, e ficam rotuladas como tal.
                */}
                <div className="flex flex-wrap items-center gap-2">
                  {scoreDialog.assessment && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={aGerarRelatorio}
                      onClick={() => scoreDialog.assessment && gerarRelatorio(scoreDialog.assessment)}
                    >
                      <IconDownload className="h-4 w-4 mr-2" strokeWidth={1.5} />
                      {aGerarRelatorio ? t('dueDiligence.relatorio.aGerar') : t('dueDiligence.relatorio.botao')}
                    </Button>
                  )}
                  {scoreDialog.assessment && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={aReavaliar}
                      onClick={() => scoreDialog.assessment && reavaliarComIA(scoreDialog.assessment.id)}
                    >
                      {aReavaliar ? t('dueDiligence.parecerIA.aAvaliar') : t('dueDiligence.parecerIA.reavaliar')}
                    </Button>
                  )}
                </div>

                {scoreDialog.assessment && (
                  <ScoreVisualizationWrapper assessment={scoreDialog.assessment} />
                )}

                {scoreDialog.assessment && scoreDialog.assessment.score_final != null && (
                  <IntegrationSuggestions
                    assessment={{
                      id: scoreDialog.assessment.id,
                      fornecedor_nome: scoreDialog.assessment.fornecedor_nome,
                      score_final: scoreDialog.assessment.score_final,
                    }}
                  />
                )}
              </div>
          </DialogShell>

          {/* Dialog de Respostas */}
          <AssessmentResponsesViewer
            open={responsesDialog.open}
            onOpenChange={(open) => setResponsesDialog({ open, assessment: null })}
            assessment={responsesDialog.assessment}
          />
        </div>
      </div>
    </TooltipProvider>
  );
}

// Wrapper component para buscar dados do score
function ScoreVisualizationWrapper({ assessment }: { assessment: Assessment }) {
  const [scoreData, setScoreData] = useState<any>(null);
  const [respostas, setRespostas] = useState<RespostaPontuada[]>([]);
  const [loading, setLoading] = useState(true);
  const { t } = useLanguage();

  /* As respostas com a nota que cada uma levou. E o passo que faltava entre o
     numero e o parecer: quais respostas custaram pontos, para se poder cobrar
     o fornecedor por elas. */
  useEffect(() => {
    supabase
      .from('due_diligence_responses')
      .select('question_id, resposta, pontuacao, due_diligence_questions!inner(titulo, peso, secao)')
      .eq('assessment_id', assessment.id)
      .then(({ data }) => {
        setRespostas(
          (data ?? []).map((r: any) => ({
            question_id: r.question_id,
            titulo: r.due_diligence_questions?.titulo ?? '',
            secao: r.due_diligence_questions?.secao ?? '',
            peso: Number(r.due_diligence_questions?.peso ?? 1),
            resposta: r.resposta,
            pontuacao: r.pontuacao === null || r.pontuacao === undefined ? null : Number(r.pontuacao),
          })),
        );
      });
  }, [assessment.id]);

  useEffect(() => {
    const fetchScoreData = async () => {
      try {
        const { data, error } = await supabase
          .from('due_diligence_scores')
          .select('*')
          .eq('assessment_id', assessment.id)
          .single();

        if (error && error.code !== 'PGRST116') {
          throw error;
        }

        setScoreData(data);
      } catch (error) {
        console.error('Erro ao buscar dados do score:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchScoreData();
  }, [assessment.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <AkurisPulse size={32} />
      </div>
    );
  }

  if (!scoreData) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">{t('dueDiligence.assessmentsManagerEnhanced.scoreNotCalculated')}</p>
      </div>
    );
  }

  return (
    <RelatorioDoFornecedor
      fornecedor={assessment.fornecedor_nome}
      template={assessment.template?.nome}
      concluidoEm={assessment.data_conclusao ?? null}
      scoreTotal={Number(scoreData.score_total ?? 0)}
      classificacao={scoreData.classificacao ?? 'ruim'}
      breakdown={scoreData.score_breakdown ?? null}
      cobertura={scoreData.observacoes_ia ?? null}
      respostas={respostas}
      parecer={(assessment.ia_parecer as ParecerDaIA) ?? null}
    />
  );
}
