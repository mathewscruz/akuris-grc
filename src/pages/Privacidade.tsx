import { useMemo, useState, useEffect } from "react";
import { IconChevron, IconChevronLeft, IconSearch, IconAdd, IconEdit, IconDelete, IconView, IconMore, IconWarning, IconTime, IconFile, IconDatabase, IconUsers, IconLink, IconShieldAlert } from '@/components/icons';
import { logger } from '@/lib/logger';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEmpresaId } from '@/hooks/useEmpresaId';
import { useNavigate, useSearchParams } from "react-router-dom";
import { useFocusRow } from '@/hooks/useFocusRow';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { DadosPessoaisDialog } from "@/components/dados/DadosPessoaisDialog";
import { MapeamentoDialog } from "@/components/dados/MapeamentoDialog";
import { RopaWizard } from "@/components/dados/RopaWizard";
import { RopaDialog } from "@/components/dados/RopaDialog";
import { RopaTab, type NivelRopa } from "@/components/dados/RopaTab";

import { SolicitacaoTitularDialog } from "@/components/dados/SolicitacaoTitularDialog";
import { DescoberDadosTab } from "@/components/dados/DescoberDadosTab";
import { StatStrip } from "@/components/ui/stat-strip";
import { PageHeader } from "@/components/ui/page-header";
import ConfirmDialog from '@/components/ConfirmDialog';
import { formatDateOnly, parseDataLocal } from '@/lib/date-utils';
import { startOfDay, differenceInDays } from 'date-fns';
import { formatStatus } from '@/lib/text-utils';
import { rotuloCategoriaDados } from '@/lib/dados-categorias';
import { RecordDetailDrawer } from '@/components/common/RecordDetailDrawer';
import { rotuloTipoSolicitacao, tiposSolicitacaoDaJurisdicao, normalizarTipoSolicitacao } from '@/lib/direitos-titular';
import { StatusBadge } from '@/components/ui/status-badge';
import { resolveSensibilidadeTone, resolveItemStatusTone, resolveWorkflowStatusTone } from '@/lib/status-tone';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useLanguage } from "@/contexts/LanguageContext";
import { useJurisdicao } from "@/hooks/useJurisdicao";
import { prazoResposta, ehDadoSensivel } from "@/lib/jurisdicao";
import { rotuloCanalSolicitacao } from '@/lib/canal-solicitacao';

export default function Privacidade() {
  /*
    O `?focus=<id>` chega aqui por duas entidades — dado pessoal e tratamento
    ROPA — e a página não o lia de todo. O gancho destaca a linha; o efeito
    mais abaixo escolhe a aba, sem a qual a linha nem existe no DOM.
  */
  useFocusRow();
  const { t } = useLanguage();
  const jurisdicao = useJurisdicao();
  const navigate = useNavigate();
  const { empresaId } = useEmpresaId();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("catalogo");
  const [searchParams] = useSearchParams();
  const [showDadosDialog, setShowDadosDialog] = useState(false);
  const [showMapeamentoDialog, setShowMapeamentoDialog] = useState(false);
  const [showRopaWizard, setShowRopaWizard] = useState(false);
  /** Sinal para o botão do cabeçalho pedir um ROPA novo ao `RopaTab`. */
  const [novoExercicioSinal, setNovoExercicioSinal] = useState(0);
  /** Nível aberto na aba ROPA — decide o que o botão do cabeçalho cria. */
  const [nivelRopa, setNivelRopa] = useState<NivelRopa>('ropas');
  /** ROPA onde o próximo tratamento vai nascer. */
  const [ropaDoNovoTratamento, setRopaDoNovoTratamento] = useState<string | null>(null);

  const [showRopaDialog, setShowRopaDialog] = useState(false);
  const [showSolicitacaoDialog, setShowSolicitacaoDialog] = useState(false);
  const [selectedDado, setSelectedDado] = useState<any>(null);
  const [selectedRopa, setSelectedRopa] = useState<any>(null);
  const [selectedSolicitacao, setSelectedSolicitacao] = useState<any>(null);
  const [showDadoSheet, setShowDadoSheet] = useState(false);
  const [preSelectedDadoId, setPreSelectedDadoId] = useState<string | undefined>();
  
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string; type: string }>({
    open: false,
    id: '',
    type: ''
  });
  
  // States for Catálogo tab DataTable
  const [catalogoSortField, setCatalogoSortField] = useState<string>("");
  const [catalogoSortDirection, setCatalogoSortDirection] = useState<"asc" | "desc">("asc");
  const [searchCatalogoTerm, setSearchCatalogoTerm] = useState("");
  const [categoriaFilter, setCategoriaFilter] = useState("todos");
  const [sensibilidadeFilter, setSensibilidadeFilter] = useState("todos");
  
  // States for Solicitações tab DataTable
  const [searchSolicitacoesTerm, setSearchSolicitacoesTerm] = useState("");
  const [statusSolicitacoesFilter, setStatusSolicitacoesFilter] = useState("todos");
  const [tipoSolicitacaoFilter, setTipoSolicitacaoFilter] = useState("todos");
  const [sortSolicitacoesField, setSortSolicitacoesField] = useState<string>("");
  const [sortSolicitacoesDirection, setSortSolicitacoesDirection] = useState<"asc" | "desc">("asc");
  
  const { toast } = useToast();

  // React Query for all privacy data
  const { data: privacidadeData, isLoading } = useQuery({
    queryKey: ['privacidade', empresaId],
    queryFn: async () => {
      if (!empresaId) return null;
      
      const dadosRes = await supabase.from('dados_pessoais').select('*').eq('empresa_id', empresaId).order('nome');
      const ropaRes = await supabase.from('ropa_registros').select('*').eq('empresa_id', empresaId).order('nome_tratamento');
      const solicitacoesRes = await supabase.from('dados_solicitacoes_titular').select('*').eq('empresa_id', empresaId).order('data_solicitacao', { ascending: false });
      const dadosIds = (dadosRes.data || []).map((d: any) => d.id);
      // `dados_mapeamento` não tem `empresa_id`: a consulta devolvia HTTP 400 e
      // o duplo `as any` escondia o erro de tipos que o teria apanhado. O KPI
      // "Mapeamentos" e a coluna da tabela nunca contaram nada. O recorte por
      // empresa é feito pelos dados pessoais, que já vêm filtrados.
      const mapeamentosRes = dadosIds.length > 0
        ? await supabase.from('dados_mapeamento').select('id, dados_pessoais_id').in('dados_pessoais_id', dadosIds)
        : { data: [], error: null };
      if (mapeamentosRes.error) throw mapeamentosRes.error;
      const ropaDadosRes = dadosIds.length > 0
        ? await supabase.from('ropa_dados_vinculados').select('id, ropa_id, dados_pessoais_id').in('dados_pessoais_id', dadosIds)
        : { data: [] };
      // A coluna é `tipo_incidente` (não `tipo`) e o produto grava
      // `em_investigacao` (não `investigacao`): o cartão marcava 0 em todas as
      // empresas, cada uma com um incidente de privacidade contido no banco.
      const incidentesRes = await supabase
        .from('incidentes')
        .select('id')
        .eq('tipo_incidente', 'privacidade')
        .eq('empresa_id', empresaId)
        .in('status', ['aberto', 'em_investigacao', 'contido']);
      if (incidentesRes.error) throw incidentesRes.error;

      const mapeamentosCounts: Record<string, number> = {};
      (mapeamentosRes.data || []).forEach((m: any) => {
        mapeamentosCounts[m.dados_pessoais_id] = (mapeamentosCounts[m.dados_pessoais_id] || 0) + 1;
      });
      
      /**
       * `ropa_dados_vinculados` não tem chave estrangeira nenhuma: apagar um
       * ROPA deixa as ligações para trás. Um dado da Akuris declarava 9 ROPAs
       * numa empresa com zero registos ROPA — as 9 ligações apontavam a
       * identificadores que já não existem. Só conta o que existe.
       */
      const ropasExistentes = new Set((ropaRes.data || []).map((r: any) => r.id));
      const ropasCounts: Record<string, number> = {};
      (ropaDadosRes.data || []).forEach((r: any) => {
        if (!ropasExistentes.has(r.ropa_id)) return;
        ropasCounts[r.dados_pessoais_id] = (ropasCounts[r.dados_pessoais_id] || 0) + 1;
      });

      /**
       * Um tratamento herda a sensibilidade do dado mais sensível que toca:
       * é isso que decide se a base legal tem de vir do Art. 11 (LGPD) ou do
       * Art. 9 (RGPD). Sem este cruzamento a ROPA seria sempre avaliada como
       * dado comum e a base ilícita nunca apareceria.
       */
      const sensibilidadePorDado: Record<string, string> = {};
      (dadosRes.data || []).forEach((d: any) => { sensibilidadePorDado[d.id] = d.sensibilidade; });
      const ropaSensivel = new Set<string>();
      (ropaDadosRes.data || []).forEach((v: any) => {
        if (ehDadoSensivel(sensibilidadePorDado[v.dados_pessoais_id])) ropaSensivel.add(v.ropa_id);
      });
      /**
       * Um tratamento pode apoiar-se em várias bases legais, e desde
       * `20260819200000` elas vivem em `ropa_bases_legais`. A coluna
       * `ropa_registros.base_legal` guarda só a primeira, projetada por
       * gatilho — a lista mostrava-a como se fosse a base do processo inteiro,
       * e o filtro por "Legítimo interesse" escondia os quatro tratamentos em
       * que ela é a segunda.
       */
      const ropaIds = (ropaRes.data || []).map((r: any) => r.id);
      const basesRes = ropaIds.length > 0
        ? await supabase
            .from('ropa_bases_legais')
            .select('ropa_id, base_legal, ordem')
            .in('ropa_id', ropaIds)
            .order('ordem')
        : { data: [], error: null };
      if (basesRes.error) throw basesRes.error;
      const basesPorRopa: Record<string, string[]> = {};
      (basesRes.data || []).forEach((b: any) => {
        (basesPorRopa[b.ropa_id] ||= []).push(b.base_legal);
      });

      const ropaEnriquecida = (ropaRes.data || []).map((r: any) => ({
        ...r,
        sensibilidade_maxima: ropaSensivel.has(r.id) ? 'sensivel' : 'comum',
        // Sempre um array: um registo antigo sem linhas normalizadas continua
        // a valer pela coluna, em vez de ficar sem base legal nenhuma.
        bases_legais: basesPorRopa[r.id] ?? (r.base_legal ? [r.base_legal] : []),
      }));

      const dadosEnriquecidos = (dadosRes.data || []).map((dado: any) => ({
        ...dado,
        mapeamentos_count: mapeamentosCounts[dado.id] || 0,
        ropas_count: ropasCounts[dado.id] || 0
      }));

      const dados = dadosRes.data || [];
      // Linhas sem nome vieram de importações incompletas. Continuam visíveis
      // para poderem ser corrigidas, mas não contam como catálogo válido.
      const dadosValidos = dados.filter((d: any) => String(d.nome ?? '').trim().length > 0);
      const sensiveis = dadosValidos.filter((d: any) => d.tipo_dados === 'sensivel' || d.sensibilidade === 'muito_sensivel' || d.sensibilidade === 'sensivel').length;
      /**
       * O tipo é normalizado à entrada: o valor antigo (`exclusao`,
       * `revogacao_consentimento`) passa a ler-se pela chave da lei. Sem isto
       * o filtro ofereceria "Eliminação dos dados" e não encontraria as linhas
       * gravadas como "exclusao". O banco não é reescrito — o registo só migra
       * quando for gravado.
       */
      const allSolicitacoes = (solicitacoesRes.data || []).map((s: any) => ({
        ...s,
        tipo_solicitacao: normalizarTipoSolicitacao(s.tipo_solicitacao),
      }));
      const pendentes = allSolicitacoes.filter((s: any) => s.status === 'pendente').length;
      
      return {
        dadosPessoais: dadosEnriquecidos,
        ropaRegistros: ropaEnriquecida,
        solicitacoes: allSolicitacoes,
        incidentesPrivacidade: (incidentesRes.data || []).length,
        dadosIncompletos: dados.length - dadosValidos.length,
        stats: {
          totalDados: dadosValidos.length,
          dadosSensiveis: sensiveis,
          mapeamentos: (mapeamentosRes.data || []).length,
          ropaAtivos: ropaEnriquecida.filter((r: any) => r.status === 'ativo').length,
          solicitacoesPendentes: pendentes
        }
      };
    },
    enabled: !!empresaId,
  });

  /*
    Referências estáveis, não listas novas a cada renderização.

    Estas três listas alimentam efeitos e memos; escritas como `x || []`
    davam um array NOVO em cada passagem enquanto a consulta não respondia,
    e tudo o que dependia delas voltava a correr sem nada ter mudado.
  */
  const dadosPessoais = useMemo(() => privacidadeData?.dadosPessoais || [], [privacidadeData]);
  const ropaRegistros = useMemo(() => privacidadeData?.ropaRegistros || [], [privacidadeData]);
  const solicitacoes = useMemo(() => privacidadeData?.solicitacoes || [], [privacidadeData]);

  /*
    A aba certa para o registo certo.

    O módulo recebe dois tipos de ligação profunda — dado pessoal e tratamento
    ROPA — e todas elas caíam na aba de catálogo, a que abre por omissão. Para
    um ROPA isso é a lista errada: o registo não existe no DOM e o destaque
    nunca acontece. Quem decide é o próprio dado — o id ou está no catálogo ou
    está nos tratamentos.

    O id do tratamento fica guardado porque o `useFocusRow` limpa o parâmetro
    assim que encontra a linha, e o `RopaTab` ainda precisa dele para saber
    que contentor manter aberto.
  */
  const [focoRopa, setFocoRopa] = useState<string | null>(null);
  useEffect(() => {
    const alvo = searchParams.get('focus');
    if (!alvo) return;
    if (dadosPessoais.some((d) => d.id === alvo)) {
      setActiveTab('catalogo');
      return;
    }
    if (ropaRegistros.some((r) => r.id === alvo)) {
      setActiveTab('ropa');
      setFocoRopa(alvo);
    }
  }, [searchParams, dadosPessoais, ropaRegistros]);

  /**
   * A barra do módulo era decorativa.
   *
   * As três abas mostravam seis filtros e três campos de busca, e nenhum deles
   * tocava nos dados: o `DataTable` apenas DESENHA o que recebe em `filters` e
   * `searchValue` — quem filtra é a página, e esta passava a lista crua.
   *
   * Verificado no ecrã: escolher "Saúde" no filtro de categoria deixava as
   * quatro linhas na tabela, incluindo Biométrico, Identificação e Contato.
   *
   * `'todos'` é o valor de "sem filtro", e é também o estado inicial — daí a
   * opção correspondente ter passado a existir em cada lista.
   */
  const semFiltro = (v: string) => !v || v === 'todos';

  /**
   * "Não há registos" e "o filtro não casou" são coisas diferentes.
   *
   * Com os filtros a funcionar, uma busca sem correspondência passava a
   * mostrar "Nenhuma solicitação registada — comece criando o primeiro
   * registro", com botão de criar, numa tabela que tem três. Quem lê isso
   * conclui que perdeu dados.
   */
  const vazio = (temRegistos: boolean, doModulo: { icon: JSX.Element; title: string; description: string; action: { label: string; onClick: () => void } }) =>
    temRegistos
      ? { icon: <IconSearch className="h-8 w-8" />, title: t('common.noResults'), description: t('common.noResultsHint') }
      : doModulo;
  const contem = (texto: unknown, termo: string) =>
    !termo || String(texto ?? '').toLowerCase().includes(termo.toLowerCase());

  const dadosFiltrados = useMemo(
    () =>
      dadosPessoais.filter(
        (d: any) =>
          (semFiltro(categoriaFilter) || d.categoria_dados === categoriaFilter) &&
          (semFiltro(sensibilidadeFilter) || d.sensibilidade === sensibilidadeFilter) &&
          (contem(d.nome, searchCatalogoTerm) || contem(d.descricao, searchCatalogoTerm)),
      ),
    [dadosPessoais, categoriaFilter, sensibilidadeFilter, searchCatalogoTerm],
  );

  const solicitacoesFiltradas = useMemo(
    () =>
      solicitacoes.filter(
        (s: any) =>
          (semFiltro(statusSolicitacoesFilter) || s.status === statusSolicitacoesFilter) &&
          (semFiltro(tipoSolicitacaoFilter) || s.tipo_solicitacao === tipoSolicitacaoFilter) &&
          // O titular vive em `dados_titular`, que é `jsonb` — não há colunas
          // `nome_titular`/`email_titular`. Procurar nelas devolvia sempre
          // zero: escrever "Bianca" esvaziava uma tabela que mostra
          // "Bianca Souza" na coluna Titular.
          (contem(s.dados_titular?.nome, searchSolicitacoesTerm) ||
            contem(s.dados_titular?.email, searchSolicitacoesTerm) ||
            contem(s.dados_titular?.documento, searchSolicitacoesTerm)),
      ),
    [solicitacoes, statusSolicitacoesFilter, tipoSolicitacaoFilter, searchSolicitacoesTerm],
  );
  const incidentesPrivacidade = privacidadeData?.incidentesPrivacidade || 0;
  const dadosIncompletos = privacidadeData?.dadosIncompletos || 0;
  // "Fora do prazo" usa o prazo legal da jurisdição configurada (LGPD 15 dias,
  // RGPD/GDPR 1 mês) e não um valor fixo. Se a solicitação já tem prazo próprio
  // definido pelo utilizador, esse prevalece.
  const solicitacoesForaPrazo = (() => {
    // O titular tem o dia inteiro do prazo. Comparar contra `new Date()` — o
    // instante — declarava fora do prazo uma solicitação que vence HOJE, a
    // partir do momento em que o relógio passava do meio-dia. E `prazo_resposta`
    // é coluna `date`: lida com `new Date()` crua virava meia-noite UTC, ou
    // seja, o dia anterior em Brasília. Os dois erros somavam-se num KPI que
    // se chama "Fora do prazo (LGPD)".
    const inicioDeHoje = startOfDay(new Date());
    return solicitacoes.filter((s: any) => {
      if (s.status === 'atendida' || s.status === 'rejeitada') return false;
      const limite = s.prazo_resposta
        ? parseDataLocal(s.prazo_resposta)
        : (s.data_solicitacao || s.created_at)
          ? prazoResposta(s.data_solicitacao || s.created_at, jurisdicao.codigo)
          : null;
      return limite ? startOfDay(limite) < inicioDeHoje : false;
    }).length;
  })();
  const stats = privacidadeData?.stats || {
    totalDados: 0,
    dadosSensiveis: 0,
    mapeamentos: 0,
    ropaAtivos: 0,
    solicitacoesPendentes: 0
  };

  const invalidatePrivacidade = () => {
    queryClient.invalidateQueries({ queryKey: ['privacidade'] });
  };

  const getSensibilidadeBadge = (tipo: string, sensibilidade: string) => {
    // Nível efetivo: tipo_dados 'sensivel' garante ao menos "Sensível"
    let nivel = sensibilidade || 'comum';
    if (tipo === 'sensivel' && nivel === 'comum') nivel = 'sensivel';
    const labels: Record<string, string> = {
      muito_sensivel: t('sweepDados.privacidade.sensibilidade.muitoSensivel'),
      sensivel: t('sweepDados.privacidade.sensibilidade.sensivel'),
      moderado: t('sweepDados.privacidade.sensibilidade.moderado'),
      comum: t('sweepDados.privacidade.sensibilidade.comum'),
    };
    return <StatusBadge {...resolveSensibilidadeTone(nivel)}>{labels[nivel] || t('sweepDados.privacidade.sensibilidade.comum')}</StatusBadge>;
  };

  const getStatusBadge = (status: string) => {
    const isWorkflow = ['pendente', 'em_analise', 'atendida', 'rejeitada'].includes(status);
    const tone = isWorkflow ? resolveWorkflowStatusTone(status) : resolveItemStatusTone(status);
    return <StatusBadge {...tone}>{formatStatus(status)}</StatusBadge>;
  };

  const getCategoriaLabel = (categoria: string) => {
    return rotuloCategoriaDados(categoria, t);
  };

  /**
   * Base legal com veredicto. `incompativel` é a base que existe na lei mas
   * não para aquele grau de sensibilidade — biometria com legítimo interesse,
   * por exemplo. Antes isto era gravado, listado e exportado na ROPA como se
   * estivesse correto; agora a linha diz o que está errado.
   */
  const celulaBaseLegal = (valor: string, sensibilidade?: string | null) => {
    const { estado, label } = jurisdicao.baseLegal(valor, sensibilidade);
    if (!valor) return <span className="text-muted-foreground">-</span>;
    if (estado === 'ok') return <Badge variant="secondary">{label}</Badge>;
    return (
      <span className="inline-flex items-center gap-1.5">
        <Badge variant="secondary">{label}</Badge>
        <StatusBadge tone="destructive">
          {t(estado === 'incompativel'
            ? 'sweepDados.privacidade.baseLegalIncompativel'
            : 'sweepDados.privacidade.baseLegalDesconhecida')}
        </StatusBadge>
      </span>
    );
  };

  // Catálogo DataTable columns
  const catalogoColumns = [
    {
      key: 'nome',
      label: t('sweepDados.privacidade.colNome'),
      sortable: true,
      render: (value: string, row: any) => (
        <div>
          <button type="button" className="min-h-10 max-w-[280px] text-left" onClick={() => {
            setSelectedDado(row);
            setShowDadoSheet(true);
          }}>
            {String(value ?? '').trim() ? (
              <span className="block truncate font-medium hover:text-primary" title={value}>{value}</span>
            ) : (
              <span className="block font-medium text-warning">{t('sweepDados.privacidade.cadastroIncompleto')}</span>
            )}
          </button>
          {!String(value ?? '').trim() && (
            <p className="text-xs text-muted-foreground">{t('sweepDados.privacidade.completeOuExclua')}</p>
          )}
          {row.descricao && (
            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{row.descricao}</p>
          )}
        </div>
      )
    },
    {
      key: 'categoria_dados',
      label: t('sweepDados.privacidade.colCategoria'),
      sortable: true,
      render: (value: string) => <Badge variant="outline">{getCategoriaLabel(value)}</Badge>
    },
    {
      key: 'sensibilidade',
      label: t('sweepDados.privacidade.colSensibilidade'),
      sortable: true,
      render: (value: string, row: any) => getSensibilidadeBadge(row.tipo_dados, value)
    },
    {
      key: 'base_legal',
      label: t('sweepDados.privacidade.colBaseLegal'),
      sortable: true,
      render: (value: string, row: any) => celulaBaseLegal(value, row?.sensibilidade)
    },
    {
      key: 'mapeamentos_count',
      label: t('sweepDados.privacidade.colMapeamentos'),
      sortable: true,
      render: (value: number) => value > 0 ? (
        <Badge variant="secondary">{value}</Badge>
      ) : <span className="text-muted-foreground">0</span>
    },
    {
      key: 'ropas_count',
      label: t('sweepDados.privacidade.colRopas'),
      sortable: true,
      render: (value: number) => value > 0 ? (
        <Badge variant="secondary">{value}</Badge>
      ) : <span className="text-muted-foreground">0</span>
    },
    {
      key: 'actions',
      label: t('sweepDados.privacidade.colAcoes'),
      render: (_: any, row: any) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={t('layout.moreActions')} title={t('layout.moreActions')}>
              <IconMore className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => { setSelectedDado(row); setShowDadoSheet(true); }}>
              <IconView className="h-4 w-4 mr-2" /> {t('sweepDados.privacidade.verDetalhes')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { setSelectedDado(row); setShowDadosDialog(true); }}>
              <IconEdit className="h-4 w-4 mr-2" /> {t('sweepDados.privacidade.editar')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { setSelectedDado(row); setShowMapeamentoDialog(true); }}>
              <IconLink className="h-4 w-4 mr-2" /> {t('sweepDados.privacidade.mapear')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { setPreSelectedDadoId(row.id); setShowRopaWizard(true); }}>
              <IconFile className="h-4 w-4 mr-2" /> {t('sweepDados.privacidade.criarRopa')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleDelete(row.id, 'dados')} className="text-destructive focus:text-destructive">
              <IconDelete className="h-4 w-4 mr-2" /> {t('sweepDados.privacidade.excluir')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    }
  ];

  const catalogoFilters = [
    {
      key: 'categoria_dados',
      label: t('sweepDados.privacidade.colCategoria'),
      type: 'select' as const,
      options: [
        { value: 'todos', label: t('sweepDados.privacidade.filtroTodas.categorias') },
        { value: 'identificacao', label: t('sweepDados.privacidade.categoria.identificacao') },
        { value: 'contato', label: t('sweepDados.privacidade.categoria.contato') },
        { value: 'localizacao', label: t('sweepDados.privacidade.categoria.localizacao') },
        { value: 'financeiro', label: t('sweepDados.privacidade.categoria.financeiro') },
        { value: 'saude', label: t('sweepDados.privacidade.categoria.saude') },
        { value: 'biometrico', label: t('sweepDados.privacidade.categoria.biometrico') },
        { value: 'comportamental', label: t('sweepDados.privacidade.categoria.comportamental') },
        { value: 'outros', label: t('sweepDados.privacidade.categoria.outros') }
      ],
      value: categoriaFilter,
      onChange: setCategoriaFilter
    },
    {
      key: 'sensibilidade',
      label: t('sweepDados.privacidade.colSensibilidade'),
      type: 'select' as const,
      // Os rótulos estavam deslocados uma posição: `sensivel` aparecia como
      // "Moderado" e `muito_sensivel` como "Sensível". Filtrar por "Sensível"
      // devolvia zero linhas ao lado de uma tabela com dois crachás "Sensível".
      // `moderado` nem era oferecido, apesar de o crachá o saber mostrar.
      // `moderado` nunca existiu numa única linha do produto, e `normal` — que
      // existia — não era oferecido. A migration `20260819270000` normaliza
      // `normal` para `comum` e fixa os três valores com um CHECK.
      options: [
        { value: 'todos', label: t('sweepDados.privacidade.filtroTodas.sensibilidades') },
        { value: 'comum', label: t('sweepDados.privacidade.sensibilidade.comum') },
        { value: 'sensivel', label: t('sweepDados.privacidade.sensibilidade.sensivel') },
        { value: 'muito_sensivel', label: t('sweepDados.privacidade.sensibilidade.muitoSensivel') }
      ],
      value: sensibilidadeFilter,
      onChange: setSensibilidadeFilter
    }
  ];

  // Solicitações DataTable columns
  const solicitacoesColumns = [
    {
      key: 'tipo_solicitacao',
      label: t('sweepDados.privacidade.colTipo'),
      sortable: true,
      render: (value: string) => <Badge variant="outline">{rotuloTipoSolicitacao(value, jurisdicao.codigo, t)}</Badge>
    },
    {
      key: 'dados_titular',
      label: t('sweepDados.privacidade.colTitular'),
      /**
       * `dados_titular` é `jsonb`: o cliente Supabase já devolve um objeto.
       * Aqui fazia-se `JSON.parse(objeto)`, que estoira sempre — o catch
       * devolvia '-' e a coluna do titular nunca mostrou ninguém, em nenhuma
       * solicitação, desde que existe. Numa tela cujo trabalho é responder ao
       * titular dentro do prazo legal, era a informação mais importante.
       */
      render: (value: unknown) => {
        const titular = typeof value === 'string'
          ? (() => { try { return JSON.parse(value); } catch { return null; } })()
          : (value as Record<string, string> | null);
        return titular?.nome || titular?.email || '-';
      }
    },
    {
      key: 'canal_solicitacao',
      label: t('sweepDados.privacidade.colCanal'),
      sortable: true,
      // Sem `render`, saía o valor cru do banco — "telefone", "portal",
      // "email" — em minúsculas, ao lado de colunas que mostram "Correção" e
      // "Pendente". O rótulo já existia, mas só o diálogo o usava.
      render: (value: string) => rotuloCanalSolicitacao(value, t),
    },
    {
      key: 'status',
      label: t('sweepDados.privacidade.colStatus'),
      render: (value: string) => getStatusBadge(value)
    },
    {
      key: 'prazo_resposta',
      label: t('sweepDados.privacidade.colPrazo'),
      sortable: true,
      /**
       * A tela tem um KPI "Fora do prazo", mas a lista mostrava todas as datas
       * iguais: quem estava cinco dias atrasado parecia igual a quem tinha duas
       * semanas. O estado do prazo é a razão de ser desta lista.
       */
      render: (value: string, row: any) => {
        if (!value) return <span className="text-muted-foreground">-</span>;
        const encerrada = row.status === 'atendida' || row.status === 'rejeitada';
        const dias = differenceInDays(startOfDay(parseDataLocal(value)), startOfDay(new Date()));
        return (
          <span className="inline-flex items-center gap-2">
            {formatDateOnly(value)}
            {!encerrada && dias < 0 && (
              <StatusBadge tone="destructive">{t('sweepDados.privacidade.prazoVencido')}</StatusBadge>
            )}
            {!encerrada && dias >= 0 && dias <= 3 && (
              <StatusBadge tone="warning">{t('sweepDados.privacidade.prazoEmDias', { dias })}</StatusBadge>
            )}
          </span>
        );
      }
    },
    {
      key: 'actions',
      label: t('sweepDados.privacidade.colAcoes'),
      render: (_: any, solicitacao: any) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={t('layout.moreActions')} title={t('layout.moreActions')}>
              <IconMore className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => { setSelectedSolicitacao(solicitacao); setShowSolicitacaoDialog(true); }}>
              <IconEdit className="h-4 w-4 mr-2" /> {t('sweepDados.privacidade.editar')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleDelete(solicitacao.id, 'solicitacao')} className="text-destructive focus:text-destructive">
              <IconDelete className="h-4 w-4 mr-2" /> {t('sweepDados.privacidade.excluir')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    }
  ];

  const solicitacoesFilters = [
    {
      key: 'status',
      label: t('sweepDados.privacidade.colStatus'),
      type: 'select' as const,
      options: [
        { value: 'todos', label: t('sweepDados.privacidade.filtroTodas.estados') },
        { value: 'pendente', label: t('sweepDados.privacidade.statusSolicitacao.pendente') },
        { value: 'em_analise', label: t('sweepDados.privacidade.statusSolicitacao.emAnalise') },
        { value: 'atendida', label: t('sweepDados.privacidade.statusSolicitacao.atendida') },
        { value: 'rejeitada', label: t('sweepDados.privacidade.statusSolicitacao.rejeitada') }
      ],
      value: statusSolicitacoesFilter,
      onChange: setStatusSolicitacoesFilter
    },
    {
      key: 'tipo_solicitacao',
      label: t('sweepDados.privacidade.colTipo'),
      type: 'select' as const,
      // Os direitos são os da lei aplicável — LGPD Art. 18, RGPD Arts. 15-22 —
      // e não uma lista fixa de seis que ignorava metade deles.
      options: [
        { value: 'todos', label: t('sweepDados.privacidade.filtroTodas.tipos') },
        ...tiposSolicitacaoDaJurisdicao(jurisdicao.codigo, t).map((d) => ({ value: d.key, label: d.label })),
      ],
      value: tipoSolicitacaoFilter,
      onChange: setTipoSolicitacaoFilter
    }
  ];

  const handleDelete = (id: string, type: string) => {
    setDeleteConfirm({ open: true, id, type });
  };

  const confirmDelete = async () => {
    try {
      let error;

      // Use type-safe table operations
      switch (deleteConfirm.type) {
        case 'dados':
          ({ error } = await supabase.from('dados_pessoais').delete().eq('id', deleteConfirm.id));
          break;
        case 'mapeamento':
          ({ error } = await supabase.from('dados_mapeamento').delete().eq('id', deleteConfirm.id));
          break;
        case 'ropa':
          ({ error } = await supabase.from('ropa_registros').delete().eq('id', deleteConfirm.id));
          break;
        case 'fluxo':
          ({ error } = await supabase.from('dados_fluxos').delete().eq('id', deleteConfirm.id));
          break;
        case 'solicitacao':
          ({ error } = await supabase.from('dados_solicitacoes_titular').delete().eq('id', deleteConfirm.id));
          break;
        default:
          throw new Error(t('sweepDados.privacidade.tipoInvalido'));
      }

      if (error) throw error;

      toast({
        title: t('sweepDados.privacidade.sucesso'),
        description: t('sweepDados.privacidade.itemExcluido'),
      });

      invalidatePrivacidade();
      setDeleteConfirm({ open: false, id: '', type: '' });
    } catch (error: any) {
      logger.error('Erro ao excluir item de privacidade', { error: error instanceof Error ? error.message : String(error) });
      toast({
        title: t('sweepDados.privacidade.erro'),
        description: error.message || t('sweepDados.privacidade.erroExcluirItem'),
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('modules.privacidade.title')}
        description={t('jurisdicao.privacidade.descricao', { lei: jurisdicao.lei })}
        actions={
          activeTab === 'catalogo' ? (
            <Button size="sm" onClick={() => setShowDadosDialog(true)}>
              <IconAdd className="mr-2 h-4 w-4" />
              {t('sweepDados.privacidade.novoDado')}
            </Button>
          ) : activeTab === 'ropa' ? (
            // O botão cria o que a lista mostra: um ROPA na lista de ROPAs, um
            // tratamento quando já se está dentro de um. No dossiê não há nada
            // para criar.
            nivelRopa === 'ropas' ? (
              <Button size="sm" onClick={() => setNovoExercicioSinal((n) => n + 1)}>
                <IconAdd className="mr-2 h-4 w-4" />
                {t('ropaLista.novoRopa')}
              </Button>
            ) : nivelRopa === 'tratamentos' ? (
              <Button size="sm" onClick={() => setShowRopaWizard(true)}>
                <IconAdd className="mr-2 h-4 w-4" />
                {t('ropaLista.novoTratamento')}
              </Button>
            ) : undefined
          ) : activeTab === 'solicitacoes' ? (

            <Button size="sm" onClick={() => setShowSolicitacaoDialog(true)}>
              <IconAdd className="mr-2 h-4 w-4" />
              {t('sweepDados.privacidade.novaSolicitacao')}
            </Button>
          ) : undefined
        }
        secondaryActions={
          activeTab === 'catalogo'
            ? [{
                label: t('sweepDados.privacidade.mapearDado'),
                icon: <IconLink className="h-4 w-4" />,
                onClick: () => setShowMapeamentoDialog(true),
              }]
            : undefined
        }
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="catalogo">{t('cardsKpi.privacidade.abaCatalogo')}</TabsTrigger>
          <TabsTrigger value="ropa">{t('sweepDados.privacidade.abaRopa')}</TabsTrigger>
          <TabsTrigger value="solicitacoes">{t('cardsKpi.privacidade.abaSolicitacoes')}</TabsTrigger>
          <TabsTrigger value="descobertas">{t('sweepDados.privacidade.abaDescobertas')}</TabsTrigger>
        </TabsList>

      <StatStrip
        loading={isLoading}
        items={[
          { key: 'totalDados', label: t('cardsKpi.privacidade.totalDados'), value: stats.totalDados, drillDown: 'privacidade_catalogo' },
          { key: 'dadosSensiveis', label: t('cardsKpi.privacidade.dadosSensiveis'), value: stats.dadosSensiveis, tone: 'warning', drillDown: 'privacidade_sensiveis' },
          // O ROPA não tinha card nenhum, apesar de `stats.ropaAtivos` já ser
          // calculado e deitado fora. Numa empresa cujo trabalho de privacidade
          // é o registo de tratamentos — e há uma assim nos dados reais, com 7
          // ROPA e zero dados catalogados — a tira inteira mostrava zero.
          { key: 'ropa', label: t('cardsKpi.privacidade.ropaRegistros'), value: stats.ropaAtivos, onClick: () => setActiveTab('ropa') },
          { key: 'solicitacoesPendentes', label: t('cardsKpi.privacidade.solicitacoesPendentes'), value: stats.solicitacoesPendentes, drillDown: 'privacidade' },
          { key: 'foraPrazo', label: t('jurisdicao.privacidade.foraPrazo', { lei: jurisdicao.lei }), value: solicitacoesForaPrazo, tone: 'destructive', drillDown: 'privacidade_fora_prazo' },
        ]}
      />

      {(dadosIncompletos > 0 || incidentesPrivacidade > 0) && (
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-warning/30 bg-warning/5 px-4 py-3 text-sm">
          {dadosIncompletos > 0 && (
            <span className="flex items-center gap-2 text-foreground">
              <IconWarning className="h-4 w-4 shrink-0 text-warning" />
              {t('sweepDados.privacidade.incompletosAviso', { count: dadosIncompletos })}
            </span>
          )}
          {incidentesPrivacidade > 0 && (
            <button type="button" onClick={() => navigate('/incidentes')} className="min-h-10 text-left font-medium text-primary hover:underline">
              {t('sweepDados.privacidade.incidentesAbertos', { count: incidentesPrivacidade })}
            </button>
          )}
        </div>
      )}

        <TabsContent value="catalogo" className="space-y-4">
          <Card className="rounded-lg border overflow-hidden">
            <CardContent className="p-0">
              <DataTable
                paginated
                pageSize={20}
                data={dadosFiltrados}
                columns={catalogoColumns}
                onRowClick={(row) => { setSelectedDado(row); setShowDadoSheet(true); }}
                searchPlaceholder={t('sweepDados.privacidade.buscarDados')}
                searchValue={searchCatalogoTerm}
                onSearchChange={setSearchCatalogoTerm}
                filters={catalogoFilters}
                sortField={catalogoSortField}
                sortDirection={catalogoSortDirection}
                onSort={(field) => {
                  if (field === catalogoSortField) {
                    setCatalogoSortDirection(catalogoSortDirection === 'asc' ? 'desc' : 'asc');
                  } else {
                    setCatalogoSortField(field);
                    setCatalogoSortDirection('asc');
                  }
                }}
                emptyState={vazio(dadosPessoais.length > 0, {
                  icon: <IconDatabase className="h-8 w-8" />,
                  title: t('sweepDados.privacidade.emptyDadosTitulo'),
                  description: t('sweepDados.privacidade.emptyDadosDescricao'),
                  action: {
                    label: t('sweepDados.privacidade.novoDado'),
                    onClick: () => setShowDadosDialog(true)
                  }
                })}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ropa" className="space-y-4">
          {/* Três níveis — ROPAs, tratamentos, dossiê — em `RopaTab`. A aba
              listava os TRATAMENTOS como se fossem os ROPA, e a lista de ROPA
              propriamente dita vivia noutra aba sem ligação nenhuma a esta. */}
          <RopaTab
            registos={ropaRegistros}
            aoRecarregar={invalidatePrivacidade}
            aoEditarTratamento={(registo) => { setSelectedRopa(registo); setShowRopaDialog(true); }}
            aoApagarTratamento={(id) => handleDelete(id, 'ropa')}
            aoCriarTratamento={(exercicioId) => { setRopaDoNovoTratamento(exercicioId); setShowRopaWizard(true); }}
            novoRopaSinal={novoExercicioSinal}
            aoMudarNivel={setNivelRopa}
            focoTratamentoId={focoRopa}
          />
        </TabsContent>

        <TabsContent value="solicitacoes" className="space-y-4">

          <Card className="rounded-lg border overflow-hidden">
            <CardContent className="p-0">
              <DataTable
                paginated
                pageSize={20}
                data={solicitacoesFiltradas}
                columns={solicitacoesColumns}
                onRowClick={(solicitacao) => { setSelectedSolicitacao(solicitacao); setShowSolicitacaoDialog(true); }}
                loading={false}
                searchable
                searchPlaceholder={t('sweepDados.privacidade.buscarSolicitacoes')}
                searchValue={searchSolicitacoesTerm}
                onSearchChange={setSearchSolicitacoesTerm}
                filters={solicitacoesFilters}
                sortField={sortSolicitacoesField}
                sortDirection={sortSolicitacoesDirection}
                onSort={(field) => {
                  if (sortSolicitacoesField === field) {
                    setSortSolicitacoesDirection(sortSolicitacoesDirection === 'asc' ? 'desc' : 'asc');
                  } else {
                    setSortSolicitacoesField(field);
                    setSortSolicitacoesDirection('asc');
                  }
                }}
                emptyState={vazio(solicitacoes.length > 0, {
                  icon: <IconUsers className="h-8 w-8" />,
                  title: t('sweepDados.privacidade.emptySolicitacoesTitulo'),
                  description: t('sweepDados.privacidade.emptySolicitacoesDescricao'),
                  action: {
                    label: t('sweepDados.privacidade.novaSolicitacao'),
                    onClick: () => setShowSolicitacaoDialog(true)
                  }
                })}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="descobertas" className="space-y-4">
          <DescoberDadosTab onRefresh={invalidatePrivacidade} />
        </TabsContent>
      </Tabs>

      <DadosPessoaisDialog
        isOpen={showDadosDialog}
        onClose={() => {
          setShowDadosDialog(false);
          setSelectedDado(null);
        }}
        onSave={invalidatePrivacidade}
        dados={selectedDado}
      />
      <MapeamentoDialog
        isOpen={showMapeamentoDialog}
        onClose={() => {
          setShowMapeamentoDialog(false);
          setSelectedDado(null);
        }}
        onSave={invalidatePrivacidade}
      />
      {/* Estava importado e o estado era ligado em três sítios, mas o componente
          nunca aparecia no JSX — logo, não havia forma nenhuma de editar um
          registo ROPA pela interface. O único caminho de entrada era a planilha. */}
      <RopaDialog
        isOpen={showRopaDialog}
        onClose={() => {
          setShowRopaDialog(false);
          setSelectedRopa(null);
        }}
        onSave={invalidatePrivacidade}
        ropa={selectedRopa}
      />
      <RopaWizard
        isOpen={showRopaWizard}
        onClose={() => {
          setShowRopaWizard(false);
          setPreSelectedDadoId(undefined);
        }}
        onSave={invalidatePrivacidade}
        preSelectedDadoId={preSelectedDadoId}
        exercicioId={ropaDoNovoTratamento}
      />
      <SolicitacaoTitularDialog
        isOpen={showSolicitacaoDialog}
        onClose={() => {
          setShowSolicitacaoDialog(false);
          setSelectedSolicitacao(null);
        }}
        onSave={invalidatePrivacidade}
        solicitacao={selectedSolicitacao}
      />
      
      {/*
        Era uma Sheet própria com quatro campos — nome, descrição, categoria e
        base legal — de um catálogo que tem onze. Finalidade, prazo de retenção
        e origem da coleta, que são o que um encarregado precisa de ver, só
        existiam abrindo o formulário de edição. `RecordDetailDrawer` é o
        painel de detalhe que o resto do produto já usa.
      */}
      <RecordDetailDrawer
        open={showDadoSheet}
        onOpenChange={setShowDadoSheet}
        title={selectedDado?.nome}
        subtitle={selectedDado?.descricao}
        badges={selectedDado && (
          <>
            {getSensibilidadeBadge(selectedDado.tipo_dados, selectedDado.sensibilidade)}
            {celulaBaseLegal(selectedDado.base_legal, selectedDado.sensibilidade)}
          </>
        )}
        fields={selectedDado ? [
          { label: t('sweepDados.privacidade.colCategoria'), value: rotuloCategoriaDados(selectedDado.categoria_dados, t) },
          { label: t('sweepDados.privacidade.detTipoDados'), value: formatStatus(selectedDado.tipo_dados) },
          { label: t('sweepDados.privacidade.detOrigemColeta'), value: formatStatus(selectedDado.origem_coleta) },
          { label: t('sweepDados.privacidade.detFormaColeta'), value: formatStatus(selectedDado.forma_coleta) },
          { label: t('sweepDados.privacidade.detPrazoRetencao'), value: selectedDado.prazo_retencao },
          { label: t('sweepDados.privacidade.colMapeamentos'), value: String(selectedDado.mapeamentos_count ?? 0) },
          { label: t('sweepDados.privacidade.colRopas'), value: String(selectedDado.ropas_count ?? 0) },
          { label: t('sweepDados.privacidade.detFinalidade'), value: selectedDado.finalidade_tratamento, full: true },
          { label: t('sweepDados.privacidade.detObservacoes'), value: selectedDado.observacoes, full: true },
        ] : []}
        createdAt={selectedDado?.created_at}
        updatedAt={selectedDado?.updated_at}
      />

      <ConfirmDialog
        open={deleteConfirm.open}
        onOpenChange={(open) => setDeleteConfirm(prev => ({ ...prev, open }))}
        title={t('residuos.privacidade.excluirItem')}
        description={t('residuos.privacidade.excluirItemConfirm')}
        confirmText={t('sweepDados.privacidade.excluir')}
        variant="destructive"
        onConfirm={confirmDelete}
      />
    </div>
  );
}
