import { useState, useEffect, useMemo, useRef } from 'react';
import { IconView, IconSuccess, IconWarning, IconTime, IconCalendar, IconShield, IconUserCheck } from '@/components/icons';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresaId } from '@/hooks/useEmpresaId';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DenunciaDialog } from './DenunciaDialog';
import { useToast } from '@/hooks/use-toast';
import { DataTable } from '@/components/ui/data-table';
import { Card, CardContent } from '@/components/ui/card';
import { formatDateOnly, parseDataLocal } from '@/lib/date-utils';
import { formatStatus } from '@/lib/text-utils';
import { StatusBadge } from '@/components/ui/status-badge';
import { resolveDenunciaStatusTone, resolveCriticidadeTone } from '@/lib/status-tone';
import { useLanguage } from '@/contexts/LanguageContext';

import { severidadeDeFaixas } from '@/lib/metrics/riscos';
import { prazoActivo, encerrada as jaEncerrada } from '@/lib/prazo-da-denuncia';
interface Denuncia {
  id: string;
  protocolo: string;
  titulo: string;
  descricao: string;
  status: string;
  gravidade: string;
  anonima: boolean;
  nivel_identificacao?: string | null;
  nome_denunciante?: string;
  email_denunciante?: string;
  created_at: string;
  responsavel_id?: string | null;
  prazo_retorno?: string | null;
  prazo_acusacao?: string | null;
  data_acusacao_recebimento?: string | null;
  categoria?: {
    nome: string;
    cor: string;
  };
}

/** Quantos dias faltam para uma data — negativo quando já passou. */
function diasAte(data?: string | null): number | null {
  if (!data) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const alvo = parseDataLocal(data);
  alvo.setHours(0, 0, 0, 0);
  return Math.round((alvo.getTime() - hoje.getTime()) / 86400000);
}


interface DenunciasDashboardProps {
  itemIdToOpen?: string | null;
  refreshKey?: number | string;
  /**
   * Qual canal se está a ver.
   *
   * Vazio significa «o da minha empresa», que é o caso de quase toda a gente.
   * Numa consultoria que gere o canal de vários clientes, é o cliente
   * escolhido no seletor — a RLS decide se pode, esta prop só diz qual.
   */
  empresaSelecionada?: string | null;
}

export function DenunciasDashboard({ itemIdToOpen, refreshKey, empresaSelecionada }: DenunciasDashboardProps) {
  const { t } = useLanguage();
  const [denuncias, setDenuncias] = useState<Denuncia[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const loadSequence = useRef(0);
  const [selectedDenuncia, setSelectedDenuncia] = useState<Denuncia | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [gravidadeFilter, setGravidadeFilter] = useState('todos');
  /* O filtro que faltava: quem gere o canal procura o que está a arder. */
  const [prazoFilter, setPrazoFilter] = useState('todos');
  const [nomes, setNomes] = useState<Record<string, string>>({});
  const [comReuniao, setComReuniao] = useState<Set<string>>(new Set());
  /* Quem escreveu e ainda não foi lido. `lida_em` era escrito pela conversa e
     nunca lido por ninguém — o comentário lá prometia «o painel conta quantas
     estão à espera de resposta» e não havia painel nenhum a contar. */
  const [porResponder, setPorResponder] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const { empresaId: empresaPropria } = useEmpresaId();
  const empresaId = empresaSelecionada || empresaPropria;

  useEffect(() => {
    setDenuncias([]); setSelectedDenuncia(null); setDialogOpen(false);
    if (empresaId) void carregarDenuncias();
    return () => { loadSequence.current += 1; };
  }, [empresaId, refreshKey]);

  // Detectar se veio com itemIdToOpen
  useEffect(() => {
    if (itemIdToOpen && denuncias.length > 0) {
      const denuncia = denuncias.find(d => d.id === itemIdToOpen);
      if (denuncia) {
        setSelectedDenuncia(denuncia);
        setDialogOpen(true);
      }
    }
  }, [itemIdToOpen, denuncias]);

  /*
    Recarregar a lista não chegava.

    `selectedDenuncia` é um objeto capturado no clique: depois de uma ação
    dentro da ficha — converter em risco, acusar recebimento — a lista voltava
    atualizada e a FICHA ABERTA continuava a mostrar o estado antigo. Quem
    convertia via o botão «Registrar risco» na mesma, e clicava outra vez.
  */
  const carregarDenuncias = async (): Promise<void> => {
    if (!empresaId) return;
    const sequence = ++loadSequence.current;
    setLoading(true); setLoadError(false);
    try {
      const { data, error } = await supabase
        .from('denuncias')
        .select(`
          *,
          categoria:denuncias_categorias(nome, cor)
        `)
        .eq('empresa_id', empresaId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (sequence !== loadSequence.current) return;

      setDenuncias(data || []);
      setSelectedDenuncia((atual) =>
        atual ? ((data ?? []).find((d) => d.id === atual.id) ?? atual) : atual,
      );

      /*
        Os nomes de quem está a apurar.

        A lista declarava `responsavel` e nunca o pedia — a coluna não existia
        e ninguém conseguia ver, da tabela, quem tinha o quê em mãos. Numa
        apuração a várias mãos essa é a primeira pergunta do gestor do canal.
      */
      const responsaveis = Array.from(
        new Set((data ?? []).map((d) => d.responsavel_id).filter(Boolean)),
      ) as string[];
      if (responsaveis.length > 0) {
        const { data: perfis, error: profilesError } = await supabase
          .from('profiles')
          .select('user_id, nome')
          .in('user_id', responsaveis);
        if (profilesError) throw profilesError;
        if (sequence !== loadSequence.current) return;
        setNomes(Object.fromEntries((perfis ?? []).map((p) => [p.user_id, p.nome ?? ''])));
      } else {
        setNomes({});
      }

      /*
        Que denúncias têm reunião por marcar.

        Um pedido de reunião é uma obrigação com relógio (art. 9.º/2) e, sem
        marca na lista, só se descobria abrindo a denúncia e indo à aba certa.
        Uma obrigação que só se vê depois de a procurar não é uma obrigação
        vigiada.
      */
      const { data: pedidos, error: requestsError } = await supabase
        .from('denuncias_reunioes')
        .select('denuncia_id')
        .eq('empresa_id', empresaId)
        .eq('estado', 'solicitada');
      if (requestsError) throw requestsError;
      if (sequence !== loadSequence.current) return;
      setComReuniao(new Set((pedidos ?? []).map((r) => r.denuncia_id)));

      /*
        Quem respondeu e continua à espera.

        A conversa é a única via de retorno de quem denunciou, e uma mensagem
        dela só se via abrindo a denúncia e indo à aba certa. Agora o gatilho
        `trg_mensagem_avisa_o_comite` toca o sino; isto põe a mesma coisa na
        lista, para quem chega ao ecrã sem ter visto o aviso.
      */
      const { data: porLer, error: messagesError } = await supabase
        .from('denuncias_mensagens')
        .select('denuncia_id')
        .eq('empresa_id', empresaId)
        .eq('autor_tipo', 'denunciante')
        .is('lida_em', null);
      if (messagesError) throw messagesError;
      if (sequence !== loadSequence.current) return;
      setPorResponder(new Set((porLer ?? []).map((m) => m.denuncia_id)));
    } catch (error) {
      if (sequence !== loadSequence.current) return;
      setLoadError(true);
      console.error('Erro ao carregar denúncias:', error);
      toast({
        title: t('denunciasAdmin.dashboard.errorLoad'),
        description: t('denunciasAdmin.dashboard.errorLoad'),
        variant: "destructive"
      });
    } finally {
      if (sequence === loadSequence.current) setLoading(false);
    }
  };

  const handleVisualizarDenuncia = (denuncia: Denuncia) => {
    setSelectedDenuncia(denuncia);
    setDialogOpen(true);
  };

  const handleDenunciaAtualizada = () => {
    carregarDenuncias();
  };

  // Filtrar e ordenar denúncias
  const filteredAndSortedDenuncias = useMemo(() => {
    const filtered = denuncias.filter(denuncia => {
      const matchesSearch = searchTerm === '' || 
        denuncia.protocolo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        denuncia.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        denuncia.descricao.toLowerCase().includes(searchTerm.toLowerCase()) ||
        denuncia.nome_denunciante?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'todos' || denuncia.status === statusFilter;
      // Normaliza antes de comparar: registos antigos podem ainda trazer a
      // grafia feminina, e um filtro não pode depender disso.
      const matchesGravidade =
        gravidadeFilter === 'todos' || severidadeDeFaixas(denuncia.gravidade) === gravidadeFilter;

      /* Só interessa o prazo do que ainda está aberto: uma denúncia resolvida
         com prazo passado não é uma pendência, é história. */
      const encerrada = jaEncerrada(denuncia);
      const prazo = prazoActivo(denuncia);
      const dias = diasAte(prazo.data);
      const matchesPrazo =
        prazoFilter === 'todos' ||
        (prazoFilter === 'vencidas' && !encerrada && dias !== null && dias < 0) ||
        (prazoFilter === 'a_vencer' && !encerrada && dias !== null && dias >= 0 && dias <= prazo.janela) ||
        (prazoFilter === 'por_responder' && !encerrada && porResponder.has(denuncia.id)) ||
        (prazoFilter === 'sem_responsavel' && !encerrada && !denuncia.responsavel_id);

      return matchesSearch && matchesStatus && matchesGravidade && matchesPrazo;
    });

    /*
       A ordenação é do `DataTable`, não daqui.

       Havia aqui um `sort` com `localeCompare`, e a tabela recebia
       `sortField`/`onSort` — o que a faz devolver os dados SEM ordenar e
       confiar nesta função. Resultado: a gravidade ordenava por alfabeto —
       «alto, baixo, critico, medio» — e o comparador de escala que existe para
       isto (`compararEscala`) nunca era chamado. A coluna «Denunciante»
       ordenava por um campo inexistente (`denunciante`, quando o campo é
       `nome_denunciante`): clicar no cabeçalho não fazia rigorosamente nada. E
       «Responsável» ordenava por UUID, o que na tela parece ordem aleatória.

       Sem `onSort`, o `DataTable` ordena internamente, com o comparador certo
       e com os `sortAccessor` de cada coluna.
    */
    return filtered;
  }, [denuncias, searchTerm, statusFilter, gravidadeFilter, prazoFilter, porResponder]);

  // Configuração das colunas
  const columns = [
    {
      /*
        Protocolo e data numa célula só.

        A lista ganhou responsável e prazo — informação que faltava — e passou
        a ter dez colunas e barra horizontal: para ver o prazo era preciso
        arrastar a tabela, o que anula a razão de o ter posto lá. Data e
        categoria descem para debaixo do que qualificam, em vez de ocuparem
        coluna própria.
      */
      key: 'protocolo',
      label: t('denunciasAdmin.dashboard.colProtocolo'),
      sortable: true,
      render: (_: any, denuncia: Denuncia) => (
        <span className="flex flex-col">
          <span className="font-mono text-sm">{denuncia.protocolo}</span>
          <span className="text-micro text-muted-foreground">
            {formatDateOnly(denuncia.created_at)}
          </span>
        </span>
      )
    },
    {
      key: 'titulo',
      label: t('denunciasAdmin.dashboard.colTitulo'),
      sortable: true,
      render: (_: any, denuncia: Denuncia) => (
        <span className="flex max-w-xs flex-col">
          <span className="truncate text-sm">{denuncia.titulo}</span>
          <span className="truncate text-micro text-muted-foreground">
            {denuncia.categoria?.nome}
            {denuncia.categoria && (comReuniao.has(denuncia.id) || porResponder.has(denuncia.id)) ? ' · ' : ''}
            {porResponder.has(denuncia.id) && (
              <span className="font-medium text-primary">
                {t('denunciasAdmin.dashboard.porResponder')}
              </span>
            )}
            {comReuniao.has(denuncia.id) && porResponder.has(denuncia.id) ? ' · ' : ''}
            {comReuniao.has(denuncia.id) && (
              <span className="font-medium text-warning">
                {t('denunciasAdmin.dashboard.reuniaoPorMarcar')}
              </span>
            )}
          </span>
        </span>
      )
    },
    {
      key: 'status',
      mobilePriority: 0,
      label: t('denunciasAdmin.dashboard.colStatus'),
      sortable: true,
      render: (_: any, denuncia: Denuncia) => (
        <StatusBadge {...resolveDenunciaStatusTone(denuncia.status)}>
          {formatStatus(denuncia.status)}
        </StatusBadge>
      )
    },
    {
      key: 'gravidade',
      mobilePriority: 1,
      label: t('denunciasAdmin.dashboard.colGravidade'),
      sortable: true,
      /* Normaliza antes de comparar — a base tem grafias antigas — e deixa o
         `compararEscala` pôr Crítico à frente de Alto à frente de Médio. */
      sortAccessor: (d: Denuncia) => severidadeDeFaixas(d.gravidade),
      render: (_: any, denuncia: Denuncia) => (
        <StatusBadge {...resolveCriticidadeTone(denuncia.gravidade)}>
          {formatStatus(denuncia.gravidade)}
        </StatusBadge>
      )
    },
    {
      key: 'denunciante',
      label: t('denunciasAdmin.dashboard.colDenunciante'),
      sortable: true,
      /* Não existe campo `denunciante`: ordenar por `key` comparava
         `undefined` com `undefined` e o cabeçalho era um botão morto. */
      sortAccessor: (d: Denuncia) =>
        (d.nivel_identificacao ?? (d.anonima ? 'anonima' : 'identificada')) === 'anonima'
          ? ''
          : (d.nome_denunciante ?? ''),
      render: (_: any, denuncia: Denuncia) => {
        const nivel = denuncia.nivel_identificacao ?? (denuncia.anonima ? 'anonima' : 'identificada');
        if (nivel === 'anonima') {
          return <Badge variant="secondary">{t('denunciasAdmin.dashboard.anonymousBadge')}</Badge>;
        }
        /* Quem pediu reserva de identidade tem de o ver dito na lista, senão
           o nome circula como se ninguém tivesse pedido nada. */
        return (
          <span className="flex flex-col">
            <span className="text-sm">
              {denuncia.nome_denunciante || t('denunciasAdmin.dashboard.notInformed')}
            </span>
            {nivel === 'confidencial' && (
              <span className="text-micro text-muted-foreground">
                {t('denunciasAdmin.dashboard.confidencialBadge')}
              </span>
            )}
          </span>
        );
      }
    },
    {
      key: 'responsavel_id',
      mobilePriority: 3,
      className: 'min-w-36',
      label: t('denunciasAdmin.dashboard.colResponsavel'),
      sortable: true,
      /* Pelo nome que está no ecrã, não pelo UUID que está por baixo. */
      sortAccessor: (d: Denuncia) => (d.responsavel_id ? (nomes[d.responsavel_id] ?? '') : ''),
      render: (_: any, denuncia: Denuncia) =>
        denuncia.responsavel_id ? (
          <span className="flex items-center gap-1.5 text-sm">
            <IconUserCheck className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
            {nomes[denuncia.responsavel_id] || t('denunciasAdmin.dashboard.notInformed')}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">
            {t('denunciasAdmin.dashboard.semResponsavel')}
          </span>
        )
    },
    {
      /*
        O prazo legal, na lista.

        O relógio da Diretiva só existia dentro da ficha: para saber o que
        estava a vencer era preciso abrir uma denúncia de cada vez.
      */
      key: 'prazo_retorno',
      mobilePriority: 2,
      className: 'min-w-40',
      label: t('denunciasAdmin.dashboard.colPrazo'),
      sortable: true,
      /* Ordena pelo prazo que corre, que é o mesmo que se desenha. */
      sortAccessor: (d: Denuncia) =>
        jaEncerrada(d) ? null : prazoActivo(d).data,
      render: (_: any, denuncia: Denuncia) => {
        const encerrada = jaEncerrada(denuncia);
        if (encerrada) {
          return <span className="text-sm text-muted-foreground">{t('denunciasAdmin.dashboard.prazoCumprido')}</span>;
        }
        const prazo = prazoActivo(denuncia);
        const dias = diasAte(prazo.data);
        if (dias === null) return <span className="text-sm text-muted-foreground">—</span>;
        const tom =
          dias < 0 ? 'text-severity-critical' : dias <= prazo.janela ? 'text-warning' : 'text-muted-foreground';
        return (
          <span className="flex flex-col">
            <span className={`text-sm tabular-nums ${tom}`}>
              {dias < 0
                ? t('denunciasAdmin.dashboard.prazoVencido', { count: Math.abs(dias) })
                : t('denunciasAdmin.dashboard.prazoFaltam', { count: dias })}
            </span>
            {/* Qual dos dois relógios está a contar. Sem isto, «faltam 5 dias»
                não diz se é para acusar o recebimento ou para dar o retorno —
                e as duas coisas exigem trabalho muito diferente. */}
            <span className="text-micro text-muted-foreground">
              {prazo.acusacao
                ? t('denunciasAdmin.dashboard.prazoDeAcusacao')
                : t('denunciasAdmin.dashboard.prazoDeRetorno')}
            </span>
          </span>
        );
      }
    },
    {
      key: 'acoes',
      className: 'w-28 whitespace-nowrap',
      label: t('denunciasAdmin.dashboard.colAcoes'),
      render: (_: any, denuncia: Denuncia) => {
        const prazo = jaEncerrada(denuncia) ? null : prazoActivo(denuncia);
        const dias = prazo ? diasAte(prazo.data) : null;
        const requerAcao = !jaEncerrada(denuncia) && (
          (dias !== null && dias < 0) || porResponder.has(denuncia.id) || !denuncia.responsavel_id
        );
        return <Button
          variant="ghost"
          size={requerAcao ? 'sm' : 'icon-sm'}
          onClick={() => handleVisualizarDenuncia(denuncia)}
          className={requerAcao ? 'text-warning hover:text-warning' : undefined}
          aria-label={requerAcao ? t('denunciasAdmin.dashboard.treatPending') : t('common.view')}
          title={requerAcao ? t('denunciasAdmin.dashboard.treatPending') : t('common.view')}
        >
          {requerAcao ? <IconWarning className="h-4 w-4" /> : <IconView className="h-4 w-4" />}
          {requerAcao && <span>{t('experience.treat')}</span>}
        </Button>;
      }
    }
  ];

  // Configuração dos filtros
  const filters = [
    {
      key: 'status',
      label: t('denunciasAdmin.dashboard.filterStatusLabel'),
      value: statusFilter,
      onChange: setStatusFilter,
      options: [
        { value: 'todos', label: t('denunciasAdmin.dashboard.filterStatusAll') },
        { value: 'nova', label: t('denunciasAdmin.dashboard.statusNova') },
        { value: 'em_analise', label: t('denunciasAdmin.dashboard.statusEmAnalise') },
        { value: 'em_investigacao', label: t('denunciasAdmin.dashboard.statusEmInvestigacao') },
        { value: 'resolvida', label: t('denunciasAdmin.dashboard.statusResolvida') },
        { value: 'arquivada', label: t('denunciasAdmin.dashboard.statusArquivada') },
      ]
    },
    {
      key: 'gravidade',
      label: t('denunciasAdmin.dashboard.filterGravidadeLabel'),
      value: gravidadeFilter,
      onChange: setGravidadeFilter,
      options: [
        { value: 'todos', label: t('denunciasAdmin.dashboard.filterGravidadeAll') },
        { value: 'baixo', label: t('denunciasAdmin.dashboard.gravidadeBaixa') },
        { value: 'medio', label: t('denunciasAdmin.dashboard.gravidadeMedia') },
        { value: 'alto', label: t('denunciasAdmin.dashboard.gravidadeAlta') },
        { value: 'critico', label: t('denunciasAdmin.dashboard.gravidadeCritica') },
      ]
    },
    {
      key: 'prazo',
      label: t('denunciasAdmin.dashboard.filterPrazoLabel'),
      value: prazoFilter,
      onChange: setPrazoFilter,
      options: [
        { value: 'todos', label: t('denunciasAdmin.dashboard.filterPrazoAll') },
        { value: 'vencidas', label: t('denunciasAdmin.dashboard.filterPrazoVencidas') },
        { value: 'a_vencer', label: t('denunciasAdmin.dashboard.filterPrazoAVencer') },
        { value: 'por_responder', label: t('denunciasAdmin.dashboard.filterPrazoPorResponder') },
        { value: 'sem_responsavel', label: t('denunciasAdmin.dashboard.filterPrazoSemResponsavel') },
      ]
    }
  ];

  return (
    <>
      <Card className="rounded-lg border overflow-hidden">
        <CardContent className="p-0">
          <DataTable
            paginated
            pageSize={20}
            data={filteredAndSortedDenuncias}
            columns={columns}
            onRowClick={(denuncia) => handleVisualizarDenuncia(denuncia)}
            loading={loading}
            error={loadError}
            onRefresh={() => void carregarDenuncias()}
            searchable
            searchPlaceholder={t('denunciasAdmin.dashboard.searchPlaceholder')}
            searchValue={searchTerm}
            onSearchChange={setSearchTerm}
            filters={filters}
            emptyState={{
              icon: <IconShield className="h-8 w-8" />,
              title: searchTerm ? t('denunciasAdmin.dashboard.emptyTitleSearch') : t('denunciasAdmin.dashboard.emptyTitle'),
              description: searchTerm 
                ? t('denunciasAdmin.dashboard.emptyDescriptionSearch')
                : t('denunciasAdmin.dashboard.emptyDescription'),
            }}
          />
        </CardContent>
      </Card>

      {/* Dialog de detalhes */}
      {selectedDenuncia && (
        <DenunciaDialog
          denuncia={selectedDenuncia}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onDenunciaAtualizada={handleDenunciaAtualizada}
        />
      )}
    </>
  );
}
