import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { IconAdd, IconEdit, IconDelete, IconView, IconMore, IconOrg } from '@/components/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresaId } from '@/hooks/useEmpresaId';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DialogShell } from '@/components/ui/dialog-shell';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatusBadge } from '@/components/ui/status-badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { DataTable, type Column } from '@/components/ui/data-table';
import { useToast } from '@/hooks/use-toast';
import ConfirmDialog from '@/components/ConfirmDialog';
import { formatDateOnly } from '@/lib/date-utils';
import { formatStatus } from '@/lib/text-utils';
import { resolveCriticidadeTone, resolveScoreDueDiligenceTone } from '@/lib/status-tone';
import { opcoesStatusFornecedor, rotuloStatusFornecedor, tomDoStatusFornecedor } from '@/lib/fornecedor-status';
import { useLanguage } from '@/contexts/LanguageContext';
import { RecordDetailDrawer } from '@/components/common/RecordDetailDrawer';
import { ConsultaReceita } from './ConsultaReceita';
import type { ConsultaCnpj } from '@/lib/cnpj';
import type { Json } from '@/integrations/supabase/types';

interface Fornecedor {
  id: string;
  nome: string;
  email?: string;
  cnpj?: string;
  telefone?: string;
  endereco?: string;
  contato_responsavel?: string;
  observacoes?: string;
  status: string;
  categoria?: string;
  tipo: string;
  avaliacao_risco?: string;
  created_at?: string;
  dados_receita?: ConsultaCnpj | Json | null;
  receita_consultada_em?: string | null;
  receita_situacao?: string | null;
}

interface FornecedorFormData {
  nome: string;
  email: string;
  cnpj: string;
  telefone: string;
  endereco: string;
  contato_responsavel: string;
  observacoes: string;
  categoria: string;
  tipo: string;
  avaliacao_risco: string;
  /**
   * A fotografia da Receita anda com o formulário.
   *
   * Guardar só ao gravar o fornecedor é deliberado: consultar não é um acto
   * que altere o cadastro, e uma consulta abandonada a meio não deve deixar
   * rasto nenhum.
   */
  consultaReceita: ConsultaCnpj | null;
}

/**
 * As três colunas da consulta andam sempre juntas.
 *
 * `dados_receita` sem `receita_consultada_em` é um snapshot sem data — o banco
 * recusa (CHECK `fornecedores_receita_datada`), e com razão: um snapshot sem
 * data é indistinguível de um snapshot de há três anos.
 *
 * Devolve objecto vazio quando não houve consulta, para não apagar por
 * omissão o que já estava gravado ao editar outro campo qualquer.
 */
function camposDaReceita(consulta: ConsultaCnpj | null) {
  if (!consulta) return {};
  return {
    /* `Json` do lado do banco; a forma continua a ser `ConsultaCnpj`, e é
       `montarConsulta` quem a garante — na ida e na volta. */
    dados_receita: consulta as unknown as Json,
    receita_consultada_em: consulta.consultado_em,
    receita_situacao: consulta.cadastro.situacao_cadastral,
  };
}

const CATEGORIAS = [
  'Tecnologia',
  'Serviços',
  'Financeiro',
  'Consultoria',
  'Logística',
  'Recursos Humanos',
  'Marketing',
  'Jurídico',
  'Outro'
];

/**
 * Um só gestor de fornecedores, para os dois módulos que os geriam.
 *
 * Antes: a aba de Fornecedores em Contratos e a de Due Diligence eram duas
 * telas sobre a MESMA tabela, com campos e capacidades diferentes -- só a de
 * DD consultava a Receita, só a de Contratos tinha PJ/PF e avaliação de risco.
 * Um fornecedor criado num lado nascia pobre no outro.
 *
 * Agora é este componente, com o superconjunto: consulta à Receita, PJ/PF,
 * avaliação de risco, contagem de contratos e as avaliações de due diligence.
 * As acções de avaliação (Ver / Nova) vêm por `props`, porque são o único
 * pedaço que difere entre os módulos: em DD abrem a aba de avaliações na mesma
 * página; em Contratos levam ao módulo de Due Diligence. O gestor não precisa
 * de saber qual dos dois -- só de as chamar.
 */
interface Props {
  /** Quando presente, mostra "Ver avaliações"/"Nova avaliação" no menu. */
  acoesAvaliacao?: {
    ver: (fornecedor: { id: string; nome: string }) => void;
    nova: (fornecedor: { id: string; nome: string }) => void;
  };
  /**
   * Deep-link da busca global: ao chegar com um `focoId`, abre logo esse
   * fornecedor para edição. Substitui o diálogo que a aba de Contratos tinha
   * só para isto -- a busca continua a levar direto ao item.
   */
  focoId?: string | null;
  /**
   * Quando a PÁGINA põe o botão de criar no cabeçalho, o gestor esconde o seu.
   *
   * O botão vivia numa linha própria por cima da tabela, alinhado à direita --
   * fora do sítio onde está em todos os outros módulos, que é à altura do
   * título. Quem passa de Riscos para Due Diligence procura-o em cima e não o
   * encontra. A página abre o diálogo pelo `ref`.
   */
  botaoNovoNoCabecalho?: boolean;
}

/** O que a página pode pedir ao gestor. */
export interface FornecedoresManagerHandle {
  abrirNovo: () => void;
}

export const FornecedoresManager = forwardRef<FornecedoresManagerHandle, Props>(function FornecedoresManager(
  { acoesAvaliacao, focoId, botaoNovoNoCabecalho }: Props,
  ref,
) {
  const { t } = useLanguage();
  const { empresaId } = useEmpresaId();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detalheFornecedor, setDetalheFornecedor] = useState<any>(null);
  const [editingFornecedor, setEditingFornecedor] = useState<Fornecedor | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  /**
   * Sem filtro por omissão.
   *
   * A lista abria filtrada por `ativo`, com o controlo escondido atrás do
   * botão Filtros e nada no ecrã a dizê-lo. Um fornecedor suspenso ou em
   * avaliação — os dois que mais interessam a uma due diligence —
   * simplesmente não existia para quem olhasse a tela.
   */
  const [statusFilter, setStatusFilter] = useState('all');
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; fornecedor: Fornecedor | null }>({
    open: false,
    fornecedor: null
  });
  const [formData, setFormData] = useState<FornecedorFormData>({
    nome: '',
    email: '',
    cnpj: '',
    telefone: '',
    endereco: '',
    contato_responsavel: '',
    observacoes: '',
    categoria: '',
    tipo: 'pessoa_juridica',
    avaliacao_risco: 'baixo',
    consultaReceita: null
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // A página abre o diálogo de criar a partir do seu cabeçalho.
  useImperativeHandle(ref, () => ({ abrirNovo: () => setDialogOpen(true) }), []);

  // Fetch fornecedores with assessment stats
  const { data: fornecedores = [], isLoading } = useQuery({
    queryKey: ['fornecedores-with-stats', empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data: fornecedoresData, error } = await supabase
        .from('fornecedores')
        .select('*')
        .eq('empresa_id', empresaId!)
        .order('nome');

      if (error) throw error;

      // Contagem de contratos por fornecedor -- a coluna que a aba de Contratos
      // mostrava e que não se quer perder na unificação.
      const { data: contratos } = await supabase
        .from('contratos')
        .select('fornecedor_id')
        .eq('empresa_id', empresaId!);
      const contratosPorForn = new Map<string, number>();
      (contratos || []).forEach((c: any) => {
        if (c.fornecedor_id) contratosPorForn.set(c.fornecedor_id, (contratosPorForn.get(c.fornecedor_id) || 0) + 1);
      });

      // Fetch assessment stats for all fornecedores
      const { data: assessments } = await supabase
        .from('due_diligence_assessments')
        .select('fornecedor_id, fornecedor_email, status, score_final, data_conclusao, created_at')
        .eq('empresa_id', empresaId!);

      const assessmentMap = new Map<string, { total: number; lastScore: number | null; pending: number }>();

      /*
        Por data, do mais antigo para o mais recente: `lastScore` guardava
        simplesmente a última linha que a consulta devolvesse, numa ordem que o
        Postgres não garante. O "último score" do fornecedor podia ser o de há
        dois anos.
      */
      const porData = [...(assessments || [])].sort((x: any, y: any) =>
        String(x.data_conclusao ?? x.created_at).localeCompare(String(y.data_conclusao ?? y.created_at)),
      );

      /*
        Chave: o `fornecedor_id`, e o e-mail apenas para as linhas antigas que
        o backfill não conseguiu casar. Juntar por e-mail perdia o histórico
        de quem não tinha e-mail, apagava-o quando o contacto mudava e fundia
        o de dois fornecedores que partilhassem o mesmo endereço.
      */
      porData.forEach(a => {
        const key = a.fornecedor_id || (a.fornecedor_email ? `email:${a.fornecedor_email.trim().toLowerCase()}` : null);
        if (!key) return;
        const existing = assessmentMap.get(key) || { total: 0, lastScore: null, pending: 0 };
        existing.total++;
        if (a.status === 'concluido' && a.score_final != null) {
          existing.lastScore = a.score_final;
        }
        if (a.status !== 'concluido') {
          existing.pending++;
        }
        assessmentMap.set(key, existing);
      });

      return (fornecedoresData || []).map(f => ({
        ...f,
        _contratosCount: contratosPorForn.get(f.id) || 0,
        _assessmentStats:
          assessmentMap.get(f.id) ||
          (f.email ? assessmentMap.get(`email:${f.email.trim().toLowerCase()}`) : undefined) ||
          { total: 0, lastScore: null, pending: 0 }
      }));
    },
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  });

  const createMutation = useMutation({
    mutationFn: async (data: FornecedorFormData) => {
      const { data: userData } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from('profiles')
        .select('empresa_id')
        .eq('user_id', userData.user?.id)
        .single();

      const { error } = await supabase
        .from('fornecedores')
        .insert({
          nome: data.nome,
          email: data.email || null,
          cnpj: data.cnpj || null,
          telefone: data.telefone || null,
          endereco: data.endereco || null,
          contato_responsavel: data.contato_responsavel || null,
          observacoes: data.observacoes || null,
          categoria: data.categoria || null,
          tipo: data.tipo || 'pessoa_juridica',
          avaliacao_risco: data.avaliacao_risco || 'baixo',
          ...camposDaReceita(data.consultaReceita),
          empresa_id: profile?.empresa_id,
          status: 'ativo',
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fornecedores-with-stats'] });
      // A lista simples ['fornecedores'] alimenta o wizard de contrato e o
      // detalhe do contrato; mantê-la fresca quando o gestor vive em Contratos.
      queryClient.invalidateQueries({ queryKey: ['fornecedores'] });
      setDialogOpen(false);
      resetForm();
      toast({ title: t('dueDiligence.fornecedoresManager.toastCreatedTitle'), description: t('dueDiligence.fornecedoresManager.toastCreatedDescription') });
    },
    onError: (error) => {
      toast({ title: t('dueDiligence.fornecedoresManager.toastCreateErrorTitle'), description: t('dueDiligence.fornecedoresManager.toastCreateErrorDescription', { error: error.message }), variant: "destructive" });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: FornecedorFormData }) => {
      const { error } = await supabase
        .from('fornecedores')
        .update({
          nome: data.nome,
          email: data.email || null,
          cnpj: data.cnpj || null,
          telefone: data.telefone || null,
          endereco: data.endereco || null,
          contato_responsavel: data.contato_responsavel || null,
          observacoes: data.observacoes || null,
          categoria: data.categoria || null,
          tipo: data.tipo || 'pessoa_juridica',
          avaliacao_risco: data.avaliacao_risco || 'baixo',
          ...camposDaReceita(data.consultaReceita),
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fornecedores-with-stats'] });
      // A lista simples ['fornecedores'] alimenta o wizard de contrato e o
      // detalhe do contrato; mantê-la fresca quando o gestor vive em Contratos.
      queryClient.invalidateQueries({ queryKey: ['fornecedores'] });
      setDialogOpen(false);
      resetForm();
      setEditingFornecedor(null);
      toast({ title: t('dueDiligence.fornecedoresManager.toastCreatedTitle'), description: t('dueDiligence.fornecedoresManager.toastUpdatedDescription') });
    },
    onError: (error) => {
      toast({ title: t('dueDiligence.fornecedoresManager.toastCreateErrorTitle'), description: t('dueDiligence.fornecedoresManager.toastUpdateErrorDescription', { error: error.message }), variant: "destructive" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('fornecedores')
        .update({ status: 'inativo' })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fornecedores-with-stats'] });
      // A lista simples ['fornecedores'] alimenta o wizard de contrato e o
      // detalhe do contrato; mantê-la fresca quando o gestor vive em Contratos.
      queryClient.invalidateQueries({ queryKey: ['fornecedores'] });
      setDeleteDialog({ open: false, fornecedor: null });
      toast({ title: t('dueDiligence.fornecedoresManager.toastCreatedTitle'), description: t('dueDiligence.fornecedoresManager.toastRemovedDescription') });
    },
    onError: (error) => {
      toast({ title: t('dueDiligence.fornecedoresManager.toastCreateErrorTitle'), description: t('dueDiligence.fornecedoresManager.toastRemoveErrorDescription', { error: error.message }), variant: "destructive" });
    }
  });

  const resetForm = () => {
    setFormData({ nome: '', email: '', cnpj: '', telefone: '', endereco: '', contato_responsavel: '', observacoes: '', categoria: '', tipo: 'pessoa_juridica', avaliacao_risco: 'baixo', consultaReceita: null });
  };

  const handleEdit = (fornecedor: Fornecedor) => {
    setEditingFornecedor(fornecedor);
    setFormData({
      nome: fornecedor.nome,
      email: fornecedor.email || '',
      cnpj: fornecedor.cnpj || '',
      telefone: fornecedor.telefone || '',
      endereco: fornecedor.endereco || '',
      contato_responsavel: fornecedor.contato_responsavel || '',
      observacoes: fornecedor.observacoes || '',
      categoria: fornecedor.categoria || '',
      tipo: fornecedor.tipo || 'pessoa_juridica',
      avaliacao_risco: fornecedor.avaliacao_risco || 'baixo',
      consultaReceita: (fornecedor.dados_receita as ConsultaCnpj | null) ?? null
    });
    setDialogOpen(true);
  };

  // Deep-link: abre o fornecedor pedido assim que a lista o tiver, uma só vez.
  const focoTratado = useRef<string | null>(null);
  useEffect(() => {
    if (!focoId || focoTratado.current === focoId) return;
    const alvo = fornecedores.find((f) => f.id === focoId);
    if (alvo) {
      focoTratado.current = focoId;
      handleEdit(alvo);
    }
  }, [focoId, fornecedores]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome.trim()) {
      toast({ title: t('dueDiligence.fornecedoresManager.toastCreateErrorTitle'), description: t('dueDiligence.fornecedoresManager.nameRequired'), variant: "destructive" });
      return;
    }
    if (editingFornecedor) {
      updateMutation.mutate({ id: editingFornecedor.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) { setEditingFornecedor(null); resetForm(); }
  };

  // O nível de risco declarado (baixo/médio/alto/crítico) traduz-se pelas chaves
  // que o resto do Akuris já usa, para o selo não ficar preso ao português.
  const rotuloRisco = (v?: string) => {
    switch (v) {
      case 'baixo': return t('campos.opcoes.baixo');
      case 'medio': return t('campos.opcoes.medio');
      case 'alto': return t('campos.opcoes.alto');
      case 'critico': return t('campos.opcoes.critico');
      default: return v ? formatStatus(v) : '-';
    }
  };

  const getRiskBadge = (stats: { total: number; lastScore: number | null; pending: number }) => {
    if (stats.total === 0) return <StatusBadge tone="neutral">{t('dueDiligence.fornecedoresManager.riskNeverEvaluated')}</StatusBadge>;
    if (stats.lastScore === null) return <StatusBadge tone="warning">{t('dueDiligence.fornecedoresManager.riskPending')}</StatusBadge>;
    /*
      `score_final` já vem em percentagem: `calculate-assessment-score` calcula
      a média ponderada das notas de 0 a 10 e multiplica por 10 antes de gravar.
      Aqui multiplicava-se outra vez, e um fornecedor com 75 aparecia com um
      chip verde de "750%" — verde porque 750 passa o limiar de 80.
    */
    const score = stats.lastScore;
    /* Eram TRES faixas aqui (80/60) e QUATRO na lista de avaliacoes
       (80/60/40): o mesmo fornecedor mudava de cor conforme o ecra em que era
       visto. Uma escala so, com a marca A-D ao lado da cor. */
    return <StatusBadge {...resolveScoreDueDiligenceTone(score)}>{score.toFixed(0)}%</StatusBadge>;
  };

  /*
    A lista era de cartões, com o nome seguido de três selos — categoria,
    estado e «Nunca avaliado». O resto do Akuris usa `DataTable` em vinte
    módulos, e o que era selo colado ao título é coluna em todos eles.

    Nada se perdeu: categoria, avaliação e estado continuam lá, cada um na sua
    coluna, onde se pode ordenar por eles e comparar linha a linha — que é
    precisamente o que não se conseguia fazer quando estavam empilhados ao lado
    do nome.
  */
  const colunas: Column<any>[] = [
    {
      key: 'nome',
      label: t('dueDiligence.fornecedoresManager.colNome'),
      sortable: true,
      className: 'max-w-[280px]',
      render: (_: any, f: any) => (
        <span
          className={`block max-w-[260px] truncate ${f.status === 'inativo' ? 'text-muted-foreground' : 'font-medium'}`}
          title={f.nome}
        >
          {f.nome}
        </span>
      ),
    },
    {
      key: 'cnpj',
      mobilePriority: 5,
      label: t('dueDiligence.fornecedoresManager.colCnpj'),
      sortable: true,
      render: (_: any, f: any) => (
        <span className="whitespace-nowrap tabular-nums">{f.cnpj || '-'}</span>
      ),
    },
    {
      key: 'categoria',
      mobilePriority: 6,
      label: t('dueDiligence.fornecedoresManager.colCategoria'),
      sortable: true,
      render: (_: any, f: any) => (f.categoria ? formatStatus(f.categoria) : '-'),
    },
    {
      key: 'tipo',
      mobilePriority: 7,
      label: t('dueDiligence.fornecedoresManager.colTipo'),
      sortable: true,
      render: (_: any, f: any) =>
        f.tipo === 'pessoa_fisica'
          ? t('dueDiligence.fornecedoresManager.tipoPF')
          : t('dueDiligence.fornecedoresManager.tipoPJ'),
    },
    {
      key: 'email',
      mobilePriority: 3,
      label: t('dueDiligence.fornecedoresManager.colEmail'),
      render: (_: any, f: any) => f.email || '-',
    },
    {
      key: 'telefone',
      mobilePriority: 8,
      label: t('dueDiligence.fornecedoresManager.colTelefone'),
      render: (_: any, f: any) => (
        <span className="whitespace-nowrap">{f.telefone || '-'}</span>
      ),
    },
    {
      key: 'contratos',
      mobilePriority: 4,
      label: t('dueDiligence.fornecedoresManager.colContratos'),
      sortable: true,
      render: (_: any, f: any) => (
        <span className="tabular-nums">{f._contratosCount ?? 0}</span>
      ),
    },
    {
      key: 'avaliacao_risco',
      mobilePriority: 1,
      label: t('dueDiligence.fornecedoresManager.colRisco'),
      sortable: true,
      render: (_: any, f: any) =>
        f.avaliacao_risco ? (
          <StatusBadge {...resolveCriticidadeTone(f.avaliacao_risco)}>
            {rotuloRisco(f.avaliacao_risco)}
          </StatusBadge>
        ) : (
          '-'
        ),
    },
    {
      key: 'avaliacao',
      mobilePriority: 2,
      label: t('dueDiligence.fornecedoresManager.colAvaliacao'),
      render: (_: any, f: any) => getRiskBadge(f._assessmentStats),
    },
    {
      key: 'status',
      mobilePriority: 0,
      label: t('dueDiligence.fornecedoresManager.colStatus'),
      sortable: true,
      render: (_: any, f: any) => (
        <StatusBadge tone={tomDoStatusFornecedor(f.status)}>
          {rotuloStatusFornecedor(f.status, t)}
        </StatusBadge>
      ),
    },
    {
      key: 'acoes',
      label: t('dueDiligence.fornecedoresManager.colAcoes'),
      render: (_: any, fornecedor: any) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" onClick={(e) => e.stopPropagation()} aria-label={t('layout.moreActions')} title={t('layout.moreActions')}>
              <IconMore className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            {acoesAvaliacao && (
              <>
                <DropdownMenuItem onClick={() => acoesAvaliacao.ver({ id: fornecedor.id, nome: fornecedor.nome })}>
                  <IconView className="h-4 w-4 mr-2" />{t('dueDiligence.fornecedoresManager.viewAssessments')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => acoesAvaliacao.nova({ id: fornecedor.id, nome: fornecedor.nome })}>
                  <IconAdd className="h-4 w-4 mr-2" />{t('dueDiligence.fornecedoresManager.newAssessment')}
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuItem onClick={() => handleEdit(fornecedor)}>
              <IconEdit className="h-4 w-4 mr-2" />{t('dueDiligence.fornecedoresManager.edit')}
            </DropdownMenuItem>
            <DropdownMenuItem className="text-destructive" onClick={() => setDeleteDialog({ open: true, fornecedor })}>
              <IconDelete className="h-4 w-4 mr-2" />{t('dueDiligence.fornecedoresManager.remove')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const filteredFornecedores = fornecedores.filter(f => {
    if (statusFilter !== 'all' && f.status !== statusFilter) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return f.nome.toLowerCase().includes(term) || f.email?.toLowerCase().includes(term) || f.cnpj?.toLowerCase().includes(term);
    }
    return true;
  });

  return (
    <>
      {/*
        O botao de criar fica ACIMA do quadro, nao dentro.

        E onde esta nos outros modulos -- Controles empurra-o para o cabecalho
        da pagina, Revisao de Acessos poe-o na linha de cima. Busca e filtro
        passam a ser os do `DataTable`: havia aqui uma barra propria, com o seu
        Input e o seu painel de filtros, a fazer a mesma coisa de outra maneira
        e noutro sitio do ecra.
      */}
      {!botaoNovoNoCabecalho && (
        <div className="mb-4 flex items-center justify-end">
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <IconAdd className="h-4 w-4 mr-2" />{t('dueDiligence.fornecedoresManager.newSupplier')}
          </Button>
        </div>
      )}

      <Card className="rounded-lg border overflow-hidden">
        <CardContent className="p-0">
          <DialogShell
            open={dialogOpen}
            onOpenChange={handleOpenChange}
            icon={IconOrg}
            title={editingFornecedor ? t('dueDiligence.fornecedoresManager.editTitle') : t('dueDiligence.fornecedoresManager.createTitle')}
            size="md"
            onSubmit={() => handleSubmit(new Event('submit') as unknown as React.FormEvent)}
            submitLabel={editingFornecedor ? t('dueDiligence.fornecedoresManager.update') : t('dueDiligence.fornecedoresManager.create')}
            isSubmitting={createMutation.isPending || updateMutation.isPending}
          >
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="nome">{t('dueDiligence.fornecedoresManager.fieldName')}</Label>
                    <Input id="nome" value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">{t('dueDiligence.fornecedoresManager.fieldEmail')}</Label>
                    <Input id="email" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                  </div>
                  <div className="col-span-2">
                    <ConsultaReceita
                      cnpj={formData.cnpj}
                      onCnpjChange={(cnpj) => setFormData((f) => ({ ...f, cnpj }))}
                      consulta={formData.consultaReceita}
                      onConsulta={(c) => setFormData((f) => ({ ...f, consultaReceita: c }))}
                      onPreencher={(d) =>
                        setFormData((f) => ({
                          ...f,
                          /*
                            O que a Receita sabe melhor sobrepõe-se; o que ela
                            não tem não apaga o que a pessoa escreveu. Telefone
                            e e-mail do cadastro público são quase sempre da
                            sede, e raramente o contacto que interessa.
                          */
                          nome: d.nome || f.nome,
                          endereco: d.endereco || f.endereco,
                          telefone: f.telefone || d.telefone,
                          email: f.email || d.email,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="telefone">{t('dueDiligence.fornecedoresManager.fieldPhone')}</Label>
                    <Input id="telefone" value={formData.telefone} onChange={(e) => setFormData({ ...formData, telefone: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="categoria">{t('dueDiligence.fornecedoresManager.fieldCategory')}</Label>
                    <Select value={formData.categoria} onValueChange={(value) => setFormData({ ...formData, categoria: value })}>
                      <SelectTrigger><SelectValue placeholder={t('dueDiligence.fornecedoresManager.selectCategoryPlaceholder')} /></SelectTrigger>
                      <SelectContent>
                        {CATEGORIAS.map((cat) => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tipo">{t('dueDiligence.fornecedoresManager.fieldTipo')}</Label>
                    <Select value={formData.tipo} onValueChange={(value) => setFormData({ ...formData, tipo: value })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pessoa_juridica">{t('dueDiligence.fornecedoresManager.tipoPJ')}</SelectItem>
                        <SelectItem value="pessoa_fisica">{t('dueDiligence.fornecedoresManager.tipoPF')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="avaliacao_risco">{t('dueDiligence.fornecedoresManager.fieldRisco')}</Label>
                    <Select value={formData.avaliacao_risco} onValueChange={(value) => setFormData({ ...formData, avaliacao_risco: value })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="baixo">{t('campos.opcoes.baixo')}</SelectItem>
                        <SelectItem value="medio">{t('campos.opcoes.medio')}</SelectItem>
                        <SelectItem value="alto">{t('campos.opcoes.alto')}</SelectItem>
                        <SelectItem value="critico">{t('campos.opcoes.critico')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contato_responsavel">{t('dueDiligence.fornecedoresManager.fieldResponsibleContact')}</Label>
                    <Input id="contato_responsavel" value={formData.contato_responsavel} onChange={(e) => setFormData({ ...formData, contato_responsavel: e.target.value })} />
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label htmlFor="endereco">{t('dueDiligence.fornecedoresManager.fieldAddress')}</Label>
                    <Input id="endereco" value={formData.endereco} onChange={(e) => setFormData({ ...formData, endereco: e.target.value })} />
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label htmlFor="observacoes">{t('dueDiligence.fornecedoresManager.fieldObservations')}</Label>
                    <Textarea id="observacoes" value={formData.observacoes} onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })} rows={3} />
                  </div>
                </div>
                
              </form>
          </DialogShell>
          
          <DataTable
            data={filteredFornecedores}
            columns={colunas}
            loading={isLoading}
            onRowClick={(f) => setDetalheFornecedor(f)}
            searchValue={searchTerm}
            onSearchChange={setSearchTerm}
            searchPlaceholder={t('dueDiligence.fornecedoresManager.searchPlaceholder')}
            filters={[
              {
                key: 'status',
                label: t('dueDiligence.fornecedoresManager.statusLabel'),
                value: statusFilter,
                onChange: setStatusFilter,
                options: [
                  { value: 'all', label: t('fornecedorStatus.todos') },
                  ...opcoesStatusFornecedor(t),
                ],
              },
            ]}
            emptyState={{
              icon: <IconOrg className="h-10 w-10" />,
              title: t('dueDiligence.fornecedoresManager.emptyList'),
              description:
                searchTerm || statusFilter !== 'all'
                  ? t('dueDiligence.fornecedoresManager.emptyFiltered')
                  : t('dueDiligence.fornecedoresManager.emptyDefault'),
              action: {
                label: t('dueDiligence.fornecedoresManager.newSupplier'),
                onClick: () => setDialogOpen(true),
              },
            }}
            paginated
            pageSize={10}
          />
        </CardContent>
      </Card>

      <ConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, fornecedor: null })}
        title={t('dueDiligence.fornecedoresManager.deleteDialogTitle')}
        description={t('dueDiligence.fornecedoresManager.deleteDialogDescription', { nome: deleteDialog.fornecedor?.nome })}
        onConfirm={() => deleteDialog.fornecedor && deleteMutation.mutate(deleteDialog.fornecedor.id)}
        confirmText={t('dueDiligence.fornecedoresManager.deleteConfirm')}
        variant="destructive"
      />
      <RecordDetailDrawer
        open={!!detalheFornecedor}
        onOpenChange={(o) => !o && setDetalheFornecedor(null)}
        title={detalheFornecedor?.nome}
        subtitle={detalheFornecedor?.email}
        badges={detalheFornecedor ? (
          <StatusBadge tone={detalheFornecedor.status === 'ativo' ? 'success' : 'neutral'}>
            {formatStatus(detalheFornecedor.status)}
          </StatusBadge>
        ) : undefined}
        actions={detalheFornecedor ? (
          <Button variant="outline" size="sm" onClick={() => { const f = detalheFornecedor; setDetalheFornecedor(null); handleEdit(f); }}>
            {t('dueDiligence.fornecedoresManager.edit')}
          </Button>
        ) : undefined}
        fields={detalheFornecedor ? [
          { label: t('detalheRegisto.responsavel'), value: detalheFornecedor.contato_responsavel },
          { label: t('fin.comum.categoria'), value: detalheFornecedor.categoria ? formatStatus(detalheFornecedor.categoria) : null },
          { label: t('detalheRegisto.url'), value: detalheFornecedor.telefone },
        ] : []}
        createdAt={detalheFornecedor?.created_at}
      />

    </>
  );
});
