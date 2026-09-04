/**
 * O ROPA em três níveis: ROPAs → tratamentos → dossiê.
 *
 * A aba mostrava os TRATAMENTOS como se fossem os ROPA. Com sete linhas ainda
 * se lia; com três sistemas mapeados e sessenta processos, a primeira coisa
 * que o cliente vê passa a ser uma lista plana de sessenta nomes técnicos sem
 * dizer a que levantamento pertencem. E o produto já tinha o contentor —
 * `ropa_exercicios` — escondido noutra aba, com zero processos ligados,
 * porque nada no caminho normal os ligava.
 *
 *   Nível 1  ROPAs          nome e âmbito. É por aqui que se entra.
 *   Nível 2  Tratamentos    os processos daquele ROPA, com os seus filtros.
 *   Nível 3  Dossiê         o registo inteiro, com anterior/próximo.
 *
 * Os tratamentos que ainda não pertencem a nenhum ROPA não desaparecem: têm
 * uma linha própria no nível 1. Um registo invisível é pior do que um registo
 * mal arrumado.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  IconAdd,
  IconChecklist,
  IconChevron,
  IconChevronLeft,
  IconDelete,
  IconEdit,
  IconFile,
  IconMore,
} from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/ui/status-badge";
import ConfirmDialog from "@/components/ConfirmDialog";
import { RopaDossie } from "@/components/dados/RopaDossie";
import { RopaExercicioAnexos } from "@/components/dados/RopaExercicioAnexos";
import { RopaExercicioDialog } from "@/components/dados/RopaExercicioDialog";
import { RopaImportExport } from "@/components/dados/RopaImportExport";
import { useLanguage } from "@/contexts/LanguageContext";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { useJurisdicao } from "@/hooks/useJurisdicao";
import { supabase } from "@/integrations/supabase/client";
import { exigirLinhas } from "@/lib/supabase-write";
import { formatDateOnly } from "@/lib/date-utils";
import { logger } from "@/lib/logger";
import {
  resolveItemStatusTone,
  resolveWorkflowStatusTone,
} from "@/lib/status-tone";
import { toast } from "@/lib/toast";

/** Chave da linha que junta os tratamentos sem ROPA. */
export const SEM_ROPA = "__sem_ropa__";

export type NivelRopa = "ropas" | "tratamentos" | "dossie";

interface Props {
  /** Tratamentos da empresa, já enriquecidos pela consulta da página. */
  registos: any[];
  aoRecarregar: () => void;
  aoEditarTratamento: (registo: any) => void;
  aoApagarTratamento: (id: string) => void;
  /** Recebe o ROPA aberto: o tratamento novo tem de nascer lá dentro. */
  aoCriarTratamento: (exercicioId: string | null) => void;
  /** Contador: o cabeçalho da página incrementa-o para pedir um ROPA novo. */
  novoRopaSinal?: number;
  /** Diz à página em que nível estamos, para o botão do cabeçalho concordar. */
  aoMudarNivel?: (nivel: NivelRopa) => void;
  /** Tratamento pedido por ligação profunda (`/privacidade?focus=<id>`). */
  focoTratamentoId?: string | null;
  canCreate?: boolean;
  canUpdate?: boolean;
  canDelete?: boolean;
}

export function RopaTab({
  registos,
  aoRecarregar,
  aoEditarTratamento,
  aoApagarTratamento,
  aoCriarTratamento,
  novoRopaSinal,
  aoMudarNivel,
  focoTratamentoId,
  canCreate = false,
  canUpdate = false,
  canDelete = false,
}: Props) {
  const { t } = useLanguage();
  const jurisdicao = useJurisdicao();
  const { empresaId } = useEmpresaId();
  const queryClient = useQueryClient();

  const [ropaAberto, setRopaAberto] = useState<string | null>(null);
  const [dossieIndex, setDossieIndex] = useState<number | null>(null);

  const [dialogAberto, setDialogAberto] = useState(false);
  const [aEditar, setAEditar] = useState<any>(null);
  const [aApagar, setAApagar] = useState<string | null>(null);
  const [sinalVisto, setSinalVisto] = useState(novoRopaSinal ?? 0);

  const [buscaRopas, setBuscaRopas] = useState("");
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroBaseLegal, setFiltroBaseLegal] = useState("todos");
  const [ordem, setOrdem] = useState<{
    campo: string;
    sentido: "asc" | "desc";
  }>({
    campo: "",
    sentido: "asc",
  });

  // O sinal do cabeçalho abre o diálogo de criação sem passar por um efeito
  // que dispararia também na primeira montagem.
  if (canCreate && (novoRopaSinal ?? 0) !== sinalVisto) {
    setSinalVisto(novoRopaSinal ?? 0);
    setAEditar(null);
    setDialogAberto(true);
  }

  const nivel: NivelRopa =
    dossieIndex !== null ? "dossie" : ropaAberto ? "tratamentos" : "ropas";
  // Avisar o pai TEM de ser efeito: chamar `aoMudarNivel` durante a renderização
  // atualiza o estado de `Privacidade` a meio da renderização de `RopaTab`.
  useEffect(() => {
    aoMudarNivel?.(nivel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nivel]);

  /*
    O tratamento está dois níveis abaixo da aba.

    A ligação profunda entrega um id de `ropa_registros`, e a aba abre sempre
    na lista de ROPAs — a linha procurada nem sequer chega ao DOM, por isso o
    `useFocusRow` da página ficava cinco segundos à espera de algo que nunca
    ia aparecer. Abrir o contentor a que o tratamento pertence põe a linha no
    ecrã; o destaque é do gancho, como em qualquer outra lista.

    Uma vez só: `registos` é refeito a cada recarga, e sem a marca do que já
    foi consumido qualquer gravação atirava a pessoa de volta para este ROPA.
  */
  const focoConsumido = useRef<string | null>(null);
  useEffect(() => {
    if (!focoTratamentoId || focoTratamentoId === focoConsumido.current) return;
    const registo = registos.find((r) => r.id === focoTratamentoId);
    if (!registo) return;
    focoConsumido.current = focoTratamentoId;
    setDossieIndex(null);
    setRopaAberto(registo.exercicio_id ?? SEM_ROPA);
  }, [focoTratamentoId, registos]);

  const { data: contentores = [] } = useQuery({
    queryKey: ["ropa-exercicios", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ropa_exercicios")
        .select("*")
        .eq("empresa_id", empresaId!)
        .order("data_realizacao", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: perfis = [] } = useQuery({
    queryKey: ["ropa-exercicios-perfis", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, nome")
        .eq("empresa_id", empresaId!);
      if (error) throw error;
      return data ?? [];
    },
  });

  const nomePorUser = useMemo(() => {
    const mapa: Record<string, string> = {};
    (perfis as any[]).forEach((p) => {
      mapa[p.user_id] = p.nome;
    });
    return mapa;
  }, [perfis]);

  // ── nível 1: os ROPAs ────────────────────────────────────────────────────
  const orfaos = useMemo(
    () => registos.filter((r) => !r.exercicio_id),
    [registos],
  );

  const linhasDeRopa = useMemo(() => {
    const contagem: Record<string, number> = {};
    registos.forEach((r: any) => {
      if (r.exercicio_id)
        contagem[r.exercicio_id] = (contagem[r.exercicio_id] ?? 0) + 1;
    });
    const linhas = (contentores as any[]).map((c) => ({
      ...c,
      chave: c.id,
      descricao: c.escopo ?? "",
      tratamentos: contagem[c.id] ?? 0,
      responsavel_nome: nomePorUser[c.responsavel_id] ?? "—",
    }));
    if (orfaos.length > 0) {
      // Sem esta linha, importar uma planilha sem escolher ROPA fazia os
      // tratamentos desaparecerem do ecrã que os devia mostrar.
      linhas.push({
        id: null,
        chave: SEM_ROPA,
        nome: t("ropaLista.semRopaNome"),
        versao: null,
        descricao: t("ropaLista.semRopaDescricao"),
        data_realizacao: null,
        status: null,
        tratamentos: orfaos.length,
        responsavel_nome: "—",
      });
    }
    const termo = buscaRopas.trim().toLowerCase();
    if (!termo) return linhas;
    return linhas.filter((l) =>
      `${l.nome ?? ""} ${l.descricao ?? ""} ${l.versao ?? ""}`
        .toLowerCase()
        .includes(termo),
    );
  }, [contentores, registos, orfaos.length, nomePorUser, buscaRopas, t]);

  const ropaSelecionado = useMemo(
    () => linhasDeRopa.find((l: any) => l.chave === ropaAberto) ?? null,
    [linhasDeRopa, ropaAberto],
  );

  // ── nível 2: os tratamentos daquele ROPA ─────────────────────────────────
  const doRopa = useMemo(
    () =>
      ropaAberto === SEM_ROPA
        ? orfaos
        : registos.filter((r: any) => r.exercicio_id === ropaAberto),
    [registos, orfaos, ropaAberto],
  );

  const semFiltro = (v: string) => !v || v === "todos";
  const contem = (texto: unknown, termo: string) =>
    !termo ||
    String(texto ?? "")
      .toLowerCase()
      .includes(termo.toLowerCase());

  const tratamentos = useMemo(
    () =>
      doRopa.filter(
        (r: any) =>
          (semFiltro(filtroStatus) || r.status === filtroStatus) &&
          // Basta que UMA das bases do tratamento seja a escolhida.
          (semFiltro(filtroBaseLegal) ||
            (r.bases_legais ?? []).includes(filtroBaseLegal)) &&
          (contem(r.nome_tratamento, busca) || contem(r.finalidade, busca)),
      ),
    [doRopa, filtroStatus, filtroBaseLegal, busca],
  );

  /**
   * A célula de base legal de um tratamento — que pode ter mais do que uma.
   *
   * Mostra as duas primeiras e conta o resto. O texto livre — a base que a lei
   * não reconhece — é cortado, senão uma linha de 120 caracteres esmagava a
   * tabela toda. O dossiê mostra a lista inteira com a justificação de cada uma.
   */
  const celulaBasesLegais = (
    bases: string[] | undefined,
    sensibilidade?: string | null,
  ) => {
    const lista = bases ?? [];
    if (lista.length === 0)
      return <span className="text-muted-foreground">-</span>;
    const mostradas = lista.slice(0, 2);
    const restantes = lista.length - mostradas.length;
    return (
      <span className="inline-flex flex-wrap items-center gap-1.5">
        {mostradas.map((valor) => {
          const { estado, label } = jurisdicao.baseLegal(valor, sensibilidade);
          return (
            <span key={valor} className="inline-flex items-center gap-1.5">
              <Badge
                variant="secondary"
                className="max-w-[24ch] truncate"
                title={label}
              >
                {label}
              </Badge>
              {estado !== "ok" && (
                <StatusBadge tone="destructive">
                  {t(
                    estado === "incompativel"
                      ? "sweepDados.privacidade.baseLegalIncompativel"
                      : "sweepDados.privacidade.baseLegalDesconhecida",
                  )}
                </StatusBadge>
              )}
            </span>
          );
        })}
        {restantes > 0 && (
          <Badge
            variant="outline"
            title={lista
              .slice(2)
              .map((v) => jurisdicao.baseLegal(v, sensibilidade).label)
              .join(" · ")}
          >
            {t("sweepDados.privacidade.maisBasesLegais", { total: restantes })}
          </Badge>
        )}
      </span>
    );
  };

  /** União das bases comuns e sensíveis: é o que pode existir gravado. */
  const todasAsBasesLegais = useMemo(() => {
    const vistas = new Set<string>();
    return [
      ...jurisdicao.basesLegais("comum"),
      ...jurisdicao.basesLegais("sensivel"),
    ]
      .filter((b) => (vistas.has(b.key) ? false : vistas.add(b.key)))
      .map((b) => ({ value: b.key, label: b.label }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jurisdicao.lei]);

  const colunasDeRopa = [
    {
      key: "nome",
      label: t("ropaLista.colRopa"),
      sortable: true,
      render: (valor: string, linha: any) => (
        <div className="min-w-0">
          <p className="font-medium">{valor}</p>
          <p className="line-clamp-2 max-w-[72ch] text-xs text-muted-foreground">
            {linha.descricao || t("ropaLista.semDescricao")}
          </p>
        </div>
      ),
    },
    {
      key: "versao",
      label: t("ropaLista.colVersao"),
      sortable: true,
      render: (valor: string) =>
        valor || <span className="text-muted-foreground">—</span>,
    },
    {
      key: "tratamentos",
      label: t("ropaLista.colTratamentos"),
      sortable: true,
      render: (valor: number) =>
        valor > 0 ? (
          <Badge variant="secondary">{valor}</Badge>
        ) : (
          <span className="text-muted-foreground">0</span>
        ),
    },
    {
      key: "data_realizacao",
      label: t("dadosDashboard.ropaExercicios.colData"),
      sortable: true,
      render: (valor: string) =>
        valor ? (
          formatDateOnly(valor)
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "responsavel_nome",
      label: t("dadosDashboard.ropaExercicios.colResponsavel"),
      sortable: true,
    },
    {
      key: "status",
      label: t("common.status"),
      render: (valor: string) =>
        valor ? (
          <StatusBadge {...resolveWorkflowStatusTone(valor)}>
            {t(`dadosDashboard.ropaExercicios.status.${valor}`)}
          </StatusBadge>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "acoes",
      label: t("common.actions"),
      render: (_: any, linha: any) =>
        linha.id && (canUpdate || canDelete) ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={(e) => e.stopPropagation()}
                aria-label={t("layout.moreActions")}
                title={t("layout.moreActions")}
              >
                <IconMore className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canUpdate && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    setAEditar(linha);
                    setDialogAberto(true);
                  }}
                >
                  <IconEdit className="mr-2 h-4 w-4" /> {t("common.edit")}
                </DropdownMenuItem>
              )}
              {canDelete && (
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    setAApagar(linha.id);
                  }}
                >
                  <IconDelete className="mr-2 h-4 w-4" /> {t("common.delete")}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null,
    },
  ];

  const colunasDeTratamento = [
    {
      key: "nome_tratamento",
      label: t("sweepDados.privacidade.colNomeTratamento"),
      sortable: true,
      render: (valor: string, linha: any) => (
        <div className="min-w-0">
          <p className="font-medium">{valor}</p>
          {linha.codigo ? (
            <p className="text-xs text-muted-foreground">{linha.codigo}</p>
          ) : null}
        </div>
      ),
    },
    {
      key: "base_legal",
      label: t("sweepDados.privacidade.colBaseLegal"),
      sortable: true,
      render: (_valor: string, linha: any) =>
        celulaBasesLegais(linha?.bases_legais, linha?.sensibilidade_maxima),
    },
    {
      key: "categoria_titulares",
      label: t("sweepDados.privacidade.colCategoriaTitulares"),
      sortable: true,
    },
    {
      key: "status",
      label: t("sweepDados.privacidade.colStatus"),
      render: (valor: string) => (
        <StatusBadge {...resolveItemStatusTone(valor)}>
          {t(`sweepDados.privacidade.statusRopa.${valor}`)}
        </StatusBadge>
      ),
    },
    {
      key: "acoes",
      label: t("sweepDados.privacidade.colAcoes"),
      render: (_: any, linha: any) =>
        canUpdate || canDelete ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={(e) => e.stopPropagation()}
                aria-label={t("layout.moreActions")}
                title={t("layout.moreActions")}
              >
                <IconMore className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canUpdate && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    aoEditarTratamento(linha);
                  }}
                >
                  <IconEdit className="mr-2 h-4 w-4" />{" "}
                  {t("sweepDados.privacidade.editar")}
                </DropdownMenuItem>
              )}
              {canDelete && (
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    aoApagarTratamento(linha.id);
                  }}
                >
                  <IconDelete className="mr-2 h-4 w-4" />{" "}
                  {t("sweepDados.privacidade.excluir")}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null,
    },
  ];

  const filtrosDeTratamento = [
    {
      key: "status",
      label: t("sweepDados.privacidade.colStatus"),
      type: "select" as const,
      options: [
        {
          value: "todos",
          label: t("sweepDados.privacidade.filtroTodas.estados"),
        },
        { value: "ativo", label: t("sweepDados.privacidade.statusRopa.ativo") },
        {
          value: "inativo",
          label: t("sweepDados.privacidade.statusRopa.inativo"),
        },
        {
          value: "revisao",
          label: t("sweepDados.privacidade.statusRopa.revisao"),
        },
      ],
      value: filtroStatus,
      onChange: setFiltroStatus,
    },
    {
      key: "base_legal",
      label: t("sweepDados.privacidade.colBaseLegal"),
      type: "select" as const,
      options: [
        {
          value: "todos",
          label: t("sweepDados.privacidade.filtroTodas.basesLegais"),
        },
        ...todasAsBasesLegais,
      ],
      value: filtroBaseLegal,
      onChange: setFiltroBaseLegal,
    },
  ];

  const ordenar = (campo: string) =>
    setOrdem((o) =>
      o.campo === campo
        ? { campo, sentido: o.sentido === "asc" ? "desc" : "asc" }
        : { campo, sentido: "asc" },
    );

  const apagarRopa = async () => {
    if (!aApagar || !empresaId) return;
    try {
      await exigirLinhas(
        supabase
          .from("ropa_exercicios")
          .delete()
          .eq("id", aApagar)
          .eq("empresa_id", empresaId)
          .select("id"),
      );
      toast.success(t("dadosDashboard.ropaExercicios.removido"));
      queryClient.invalidateQueries({
        queryKey: ["ropa-exercicios", empresaId],
      });
      aoRecarregar();
      if (ropaAberto === aApagar) setRopaAberto(null);
      setAApagar(null);
    } catch (erro: any) {
      logger.error("Erro ao remover ROPA", { data: erro });
      toast.error(t("dadosDashboard.ropaExercicios.erroGuardar"), {
        description: erro?.message,
      });
    }
  };

  const voltarAosRopas = () => {
    setDossieIndex(null);
    setRopaAberto(null);
    setBusca("");
    setFiltroStatus("todos");
    setFiltroBaseLegal("todos");
  };

  // ── nível 3: o dossiê ────────────────────────────────────────────────────
  if (nivel === "dossie" && dossieIndex !== null && tratamentos[dossieIndex]) {
    return (
      <div className="space-y-3">
        {/* A navegação percorre a lista FILTRADA deste ROPA, não a base
            inteira: é o que torna "rever os de risco alto" um trabalho de N
            teclas. */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDossieIndex(null)}
          >
            <IconChevronLeft className="h-4 w-4" />
            {t("ropaLista.voltarTratamentos", {
              ropa: ropaSelecionado?.nome ?? "",
            })}
          </Button>
          <div className="flex items-center gap-2">
            <span className="text-xs tabular-nums text-muted-foreground">
              {t("ropaDossie.posicao", {
                atual: dossieIndex + 1,
                total: tratamentos.length,
              })}
            </span>
            <Button
              variant="outline"
              size="sm"
              aria-label={t("ropaDossie.anterior")}
              disabled={dossieIndex === 0}
              onClick={() => setDossieIndex(Math.max(0, dossieIndex - 1))}
            >
              <IconChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              aria-label={t("ropaDossie.proximo")}
              disabled={dossieIndex >= tratamentos.length - 1}
              onClick={() =>
                setDossieIndex(
                  Math.min(tratamentos.length - 1, dossieIndex + 1),
                )
              }
            >
              <IconChevron className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <RopaDossie
          registo={tratamentos[dossieIndex]}
          onEditar={
            canUpdate
              ? () => aoEditarTratamento(tratamentos[dossieIndex])
              : undefined
          }
        />
      </div>
    );
  }

  // ── nível 2: os tratamentos ──────────────────────────────────────────────
  if (nivel === "tratamentos" && ropaSelecionado) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={voltarAosRopas}>
          <IconChevronLeft className="h-4 w-4" /> {t("ropaLista.voltarRopas")}
        </Button>

        <div className="rounded-lg border border-border bg-card px-6 py-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-xl font-semibold leading-tight">
                {ropaSelecionado.nome}
              </h2>
              {ropaSelecionado.descricao ? (
                <p className="mt-1 max-w-[86ch] whitespace-pre-wrap text-sm text-muted-foreground">
                  {ropaSelecionado.descricao}
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs">
                <Medida
                  rotulo={t("ropaLista.colTratamentos")}
                  valor={String(doRopa.length)}
                />
                {ropaSelecionado.versao ? (
                  <Medida
                    rotulo={t("ropaLista.colVersao")}
                    valor={ropaSelecionado.versao}
                    separador
                  />
                ) : null}
                {ropaSelecionado.data_realizacao ? (
                  <Medida
                    rotulo={t("dadosDashboard.ropaExercicios.colData")}
                    valor={formatDateOnly(ropaSelecionado.data_realizacao)}
                    separador
                  />
                ) : null}
                <Medida
                  rotulo={t("dadosDashboard.ropaExercicios.colResponsavel")}
                  valor={ropaSelecionado.responsavel_nome}
                  separador
                />
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {canUpdate && ropaSelecionado.id ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setAEditar(ropaSelecionado);
                    setDialogAberto(true);
                  }}
                >
                  <IconEdit className="mr-2 h-4 w-4" /> {t("common.edit")}
                </Button>
              ) : null}
              {canCreate && (
                <Button
                  size="sm"
                  onClick={() => aoCriarTratamento(ropaSelecionado.id)}
                >
                  <IconAdd className="mr-2 h-4 w-4" />{" "}
                  {t("ropaLista.novoTratamento")}
                </Button>
              )}
            </div>
          </div>

          {/* O importador entra sempre NESTE ROPA. Antes havia um seletor de
              exercício solto na barra, que se lia como filtro e não filtrava
              nada: era o destino da importação. */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <p className="text-sm text-muted-foreground">
              {t("jurisdicao.privacidade.ropaSubtitulo", {
                lei: jurisdicao.lei,
              })}
            </p>
            {canCreate && (
              <RopaImportExport
                registos={doRopa}
                exercicioId={ropaSelecionado.id}
                onImported={aoRecarregar}
              />
            )}
          </div>
        </div>

        <Card className="overflow-hidden rounded-lg border">
          <CardContent className="p-0">
            <DataTable
              paginated
              pageSize={20}
              data={tratamentos}
              columns={colunasDeTratamento}
              onRowClick={(linha: any) =>
                setDossieIndex(
                  tratamentos.findIndex((r: any) => r.id === linha.id),
                )
              }
              searchable
              searchPlaceholder={t("sweepDados.privacidade.buscarRopa")}
              searchValue={busca}
              onSearchChange={setBusca}
              filters={filtrosDeTratamento}
              sortField={ordem.campo}
              sortDirection={ordem.sentido}
              onSort={ordenar}
              emptyState={
                doRopa.length > 0
                  ? {
                      icon: <IconFile className="h-8 w-8" />,
                      title: t("common.noResults"),
                      description: t("common.noResultsHint"),
                    }
                  : {
                      icon: <IconFile className="h-8 w-8" />,
                      title: t("ropaLista.semTratamentosTitulo"),
                      description: t("ropaLista.semTratamentosDescricao"),
                      action: canCreate
                        ? {
                            label: t("ropaLista.novoTratamento"),
                            onClick: () =>
                              aoCriarTratamento(ropaSelecionado.id),
                          }
                        : undefined,
                    }
              }
            />
          </CardContent>
        </Card>

        {ropaSelecionado.id ? (
          <div className="rounded-lg border border-border bg-card px-6 py-5">
            <p className="mb-3 text-micro font-semibold uppercase tracking-wider text-muted-foreground">
              {t("dadosDashboard.ropaExercicios.anexosTitulo")}
            </p>
            <RopaExercicioAnexos
              exercicioId={ropaSelecionado.id}
              canCreate={canCreate}
              canDelete={canDelete}
            />
          </div>
        ) : null}

        <RopaExercicioDialog
          open={dialogAberto}
          onOpenChange={setDialogAberto}
          exercicio={aEditar}
          onSaved={() =>
            queryClient.invalidateQueries({
              queryKey: ["ropa-exercicios", empresaId],
            })
          }
        />
      </div>
    );
  }

  // ── nível 1: os ROPAs ────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {t("ropaLista.subtitulo", { lei: jurisdicao.lei })}
        </p>
        <RopaImportExport
          registos={registos}
          exercicioId={null}
          onImported={aoRecarregar}
        />
      </div>

      <Card className="overflow-hidden rounded-lg border">
        <CardContent className="p-0">
          <DataTable
            paginated
            pageSize={20}
            data={linhasDeRopa}
            columns={colunasDeRopa}
            onRowClick={(linha: any) => setRopaAberto(linha.chave)}
            searchable
            searchPlaceholder={t("ropaLista.buscar")}
            searchValue={buscaRopas}
            onSearchChange={setBuscaRopas}
            sortField={ordem.campo}
            sortDirection={ordem.sentido}
            onSort={ordenar}
            emptyState={{
              icon: <IconChecklist className="h-8 w-8" />,
              title: t("ropaLista.emptyTitulo"),
              description: t("ropaLista.emptyDescricao"),
              action: canCreate
                ? {
                    label: t("ropaLista.novoRopa"),
                    onClick: () => {
                      setAEditar(null);
                      setDialogAberto(true);
                    },
                  }
                : undefined,
            }}
          />
        </CardContent>
      </Card>

      <RopaExercicioDialog
        open={dialogAberto}
        onOpenChange={setDialogAberto}
        exercicio={aEditar}
        onSaved={() =>
          queryClient.invalidateQueries({
            queryKey: ["ropa-exercicios", empresaId],
          })
        }
      />

      <ConfirmDialog
        open={!!aApagar}
        onOpenChange={(aberto) => !aberto && setAApagar(null)}
        title={t("dadosDashboard.ropaExercicios.removerTitulo")}
        description={t("dadosDashboard.ropaExercicios.removerDescricao")}
        onConfirm={apagarRopa}
      />
    </div>
  );
}

/** Rótulo cinzento, valor a preto — o mesmo par de leitura do dossiê. */
function Medida({
  rotulo,
  valor,
  separador,
}: {
  rotulo: string;
  valor: string;
  separador?: boolean;
}) {
  return (
    <span className="inline-flex items-baseline gap-3">
      {separador && (
        <span aria-hidden="true" className="text-border">
          ·
        </span>
      )}
      <span className="inline-flex items-baseline gap-1.5">
        <span className="text-muted-foreground">{rotulo}</span>
        <span className="font-medium text-foreground">{valor}</span>
      </span>
    </span>
  );
}
