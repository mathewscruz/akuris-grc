import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { StatusBadge } from "@/components/ui/status-badge";
import { resolveWorkflowStatusTone } from "@/lib/status-tone";
import { ClipboardList, Edit, FileText, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { useLanguage } from "@/contexts/LanguageContext";
import { logger } from "@/lib/logger";
import { formatDateOnly } from "@/lib/date-utils";
import { RopaExercicioDialog } from "@/components/dados/RopaExercicioDialog";
import { RopaExercicioAnexos } from "@/components/dados/RopaExercicioAnexos";
import ConfirmDialog from "@/components/ConfirmDialog";

interface Props {
  registos: any[];
  onOpenRegisto: (registo: any) => void;
  novoSinal?: number;
}

export function ExerciciosRopaTab({ registos, onOpenRegisto, novoSinal }: Props) {
  const { t } = useLanguage();
  const { empresaId } = useEmpresaId();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [detalhe, setDetalhe] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<string>("");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const { data: exercicios = [] } = useQuery({
    queryKey: ["ropa-exercicios", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ropa_exercicios")
        .select("*")
        .eq("empresa_id", empresaId!)
        .order("data_realizacao", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: perfis = [] } = useQuery({
    queryKey: ["ropa-exercicios-perfis", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, nome").eq("empresa_id", empresaId!);
      return data || [];
    },
  });

  const nomePorUser = useMemo(() => {
    const map: Record<string, string> = {};
    perfis.forEach((p: any) => {
      map[p.user_id] = p.nome;
    });
    return map;
  }, [perfis]);

  const contagem = useMemo(() => {
    const map: Record<string, number> = {};
    registos.forEach((r: any) => {
      if (r.exercicio_id) map[r.exercicio_id] = (map[r.exercicio_id] || 0) + 1;
    });
    return map;
  }, [registos]);

  const linhas = useMemo(
    () => exercicios.map((e: any) => ({ ...e, processos: contagem[e.id] || 0, responsavel_nome: nomePorUser[e.responsavel_id] || "—" })),
    [exercicios, contagem, nomePorUser],
  );

  const openNovo = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  // Permite ao pai abrir o diálogo de criação através de um contador.
  useMemo(() => {
    if (novoSinal) openNovo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [novoSinal]);

  const handleDelete = async () => {
    if (!deleteId || !empresaId) return;
    try {
      const { error } = await supabase.from("ropa_exercicios").delete().eq("id", deleteId).eq("empresa_id", empresaId);
      if (error) throw error;
      toast.success(t("dadosDashboard.ropaExercicios.removido"));
      queryClient.invalidateQueries({ queryKey: ["ropa-exercicios", empresaId] });
      queryClient.invalidateQueries({ queryKey: ["privacidade"] });
      setDeleteId(null);
      setDetalhe(null);
    } catch (error: any) {
      logger.error("Erro ao remover exercício ROPA", { data: error });
      toast.error(t("dadosDashboard.ropaExercicios.erroGuardar"), { description: error?.message });
    }
  };

  const columns = [
    {
      key: "nome",
      label: t("dadosDashboard.ropaExercicios.colNome"),
      sortable: true,
      render: (value: string, row: any) => (
        <div>
          <p className="font-medium">{value}</p>
          {row.versao ? <p className="text-xs text-muted-foreground">{row.versao}</p> : null}
        </div>
      ),
    },
    {
      key: "data_realizacao",
      label: t("dadosDashboard.ropaExercicios.colData"),
      sortable: true,
      render: (value: string) => formatDateOnly(value),
    },
    {
      key: "responsavel_nome",
      label: t("dadosDashboard.ropaExercicios.colResponsavel"),
      sortable: true,
    },
    {
      key: "processos",
      label: t("dadosDashboard.ropaExercicios.colProcessos"),
      sortable: true,
    },
    {
      key: "status",
      label: t("dadosDashboard.ropaExercicios.colStatus"),
      sortable: true,
      render: (value: string) => (
        <StatusBadge {...resolveWorkflowStatusTone(value)}>
          {t(`dadosDashboard.ropaExercicios.status.${value}`)}
        </StatusBadge>

      ),
    },
  ];

  const processosDoExercicio = detalhe ? registos.filter((r: any) => r.exercicio_id === detalhe.id) : [];

  return (
    <div className="space-y-4">
      <Card className="rounded-lg border overflow-hidden">
        <CardContent className="p-0">
          <DataTable
            data={linhas}
            columns={columns}
            onRowClick={(row) => setDetalhe(row)}
            searchable
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder={t("dadosDashboard.ropaExercicios.buscar")}
            sortField={sortField}
            sortDirection={sortDirection}
            onSort={(field) => {
              if (field === sortField) setSortDirection(sortDirection === "asc" ? "desc" : "asc");
              else {
                setSortField(field);
                setSortDirection("asc");
              }
            }}
            emptyState={{
              icon: <ClipboardList className="h-8 w-8" />,
              title: t("dadosDashboard.ropaExercicios.emptyTitulo"),
              description: t("dadosDashboard.ropaExercicios.emptyDescricao"),
              action: { label: t("dadosDashboard.ropaExercicios.novo"), onClick: openNovo },
            }}
          />
        </CardContent>
      </Card>

      <RopaExercicioDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        exercicio={editing}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ["ropa-exercicios", empresaId] });
        }}
      />

      <Sheet open={!!detalhe} onOpenChange={(open) => !open && setDetalhe(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>{detalhe?.nome}</SheetTitle>
          </SheetHeader>
          {detalhe ? (
            <div className="mt-6 space-y-6">
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditing(detalhe);
                    setDialogOpen(true);
                  }}
                >
                  <Edit className="mr-2 h-4 w-4" />
                  {t("dadosDashboard.ropaExercicios.editar")}
                </Button>
                <Button size="sm" variant="outline" className="text-destructive" onClick={() => setDeleteId(detalhe.id)}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t("dadosDashboard.ropaExercicios.remover")}
                </Button>
              </div>

              <dl className="grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    {t("dadosDashboard.ropaExercicios.colData")}
                  </dt>
                  <dd className="text-sm">{formatDateOnly(detalhe.data_realizacao)}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    {t("dadosDashboard.ropaExercicios.colStatus")}
                  </dt>
                  <dd className="text-sm">
                    <StatusBadge {...resolveWorkflowStatusTone(detalhe.status)}>
                      {t(`dadosDashboard.ropaExercicios.status.${detalhe.status}`)}
                    </StatusBadge>

                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    {t("dadosDashboard.ropaExercicios.campoResponsavel")}
                  </dt>
                  <dd className="text-sm">{nomePorUser[detalhe.responsavel_id] || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    {t("dadosDashboard.ropaExercicios.campoDpo")}
                  </dt>
                  <dd className="text-sm">{nomePorUser[detalhe.dpo_id] || "—"}</dd>
                </div>
                {detalhe.escopo ? (
                  <div className="sm:col-span-2">
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                      {t("dadosDashboard.ropaExercicios.campoEscopo")}
                    </dt>
                    <dd className="whitespace-pre-wrap text-sm">{detalhe.escopo}</dd>
                  </div>
                ) : null}
                {detalhe.metodologia ? (
                  <div className="sm:col-span-2">
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                      {t("dadosDashboard.ropaExercicios.campoMetodologia")}
                    </dt>
                    <dd className="whitespace-pre-wrap text-sm">{detalhe.metodologia}</dd>
                  </div>
                ) : null}
                {detalhe.conclusoes ? (
                  <div className="sm:col-span-2">
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                      {t("dadosDashboard.ropaExercicios.campoConclusoes")}
                    </dt>
                    <dd className="whitespace-pre-wrap text-sm">{detalhe.conclusoes}</dd>
                  </div>
                ) : null}
              </dl>

              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("dadosDashboard.ropaExercicios.processosTitulo")}
                </p>
                {processosDoExercicio.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("dadosDashboard.ropaExercicios.semProcessos")}</p>
                ) : (
                  <ul className="divide-y rounded-lg border">
                    {processosDoExercicio.map((r: any) => (
                      <li key={r.id}>
                        <button
                          type="button"
                          className="flex w-full items-center gap-3 p-3 text-left hover:bg-muted/50"
                          onClick={() => {
                            setDetalhe(null);
                            onOpenRegisto(r);
                          }}
                        >
                          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium">{r.nome_tratamento}</span>
                            <span className="block text-xs text-muted-foreground">{r.codigo || "—"}</span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("dadosDashboard.ropaExercicios.anexosTitulo")}
                </p>
                <RopaExercicioAnexos exercicioId={detalhe.id} />
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title={t("dadosDashboard.ropaExercicios.removerTitulo")}
        description={t("dadosDashboard.ropaExercicios.removerDescricao")}
        onConfirm={handleDelete}
      />
    </div>
  );
}
