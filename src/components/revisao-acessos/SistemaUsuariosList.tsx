import { useState } from "react";
import { IconAdd, IconEdit, IconDelete, IconMore, IconUsers } from '@/components/icons';
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { useOptimizedQuery } from "@/hooks/useOptimizedQuery";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { DataTable, Column } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ConfirmDialog from "@/components/ConfirmDialog";
import { SistemaUsuarioDialog } from "./SistemaUsuarioDialog";
import { formatDateOnly } from "@/lib/date-utils";
import { formatStatus } from "@/lib/text-utils";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { resolveTipoAcessoTone, resolveAtivoTone } from "@/lib/status-tone";
import { SincronizarDiretorio } from "./SincronizarDiretorio";

interface Sistema {
  id: string;
  nome_sistema: string;
}

interface SistemaUsuario {
  id: string;
  nome_usuario: string;
  email_usuario: string | null;
  departamento: string | null;
  cargo: string | null;
  tipo_acesso: string;
  nivel_privilegio: string;
  data_concessao: string | null;
  data_expiracao: string | null;
  ativo: boolean;
  sistema_id: string;
  sistema?: { nome_sistema: string };
  /** De onde veio a linha: 'entra_id', ou null quando foi escrita à mão. */
  origem: string | null;
  sincronizado_em: string | null;
}

export function SistemaUsuariosList() {
  const { empresaId } = useEmpresaId();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useLanguage();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedUsuario, setSelectedUsuario] = useState<SistemaUsuario | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [usuarioToDelete, setUsuarioToDelete] = useState<SistemaUsuario | null>(null);
  const [filtroSistema, setFiltroSistema] = useState<string>("todos");
  const [isDeleting, setIsDeleting] = useState(false);

  const { data: sistemas } = useOptimizedQuery<Sistema[]>(
    async () => {
      const { data, error } = await supabase
        .from("sistemas_privilegiados")
        .select("id, nome_sistema")
        .eq("empresa_id", empresaId)
        .eq("ativo", true)
        .order("nome_sistema");
      return { data: data || [], error };
    },
    [empresaId],
    { cacheKey: `sistemas-privilegiados-${empresaId}` }
  );

  const { data: usuarios, loading } = useOptimizedQuery<SistemaUsuario[]>(
    async () => {
      let query = supabase
        .from("sistemas_usuarios")
        .select(`
          *,
          sistema:sistemas_privilegiados(nome_sistema)
        `)
        .eq("empresa_id", empresaId)
        .order("nome_usuario");

      if (filtroSistema !== "todos") {
        query = query.eq("sistema_id", filtroSistema);
      }

      const { data, error } = await query;
      return { data: data || [], error };
    },
    [empresaId, filtroSistema],
    { cacheKey: `sistemas-usuarios-${empresaId}-${filtroSistema}` }
  );

  const invalidateCache = () => {
    queryClient.invalidateQueries({ queryKey: [`sistemas-usuarios-${empresaId}`] });
  };

  const handleEdit = (usuario: SistemaUsuario) => {
    setSelectedUsuario(usuario);
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!usuarioToDelete) return;
    setIsDeleting(true);

    try {
      const { error } = await supabase
        .from("sistemas_usuarios")
        .delete()
        .eq("id", usuarioToDelete.id);

      if (error) throw error;

      toast({ title: t("revisaoAcessosComp.usuariosList.toastSuccessTitle"), description: t("revisaoAcessosComp.usuariosList.toastDeleted") });
      invalidateCache();
    } catch (error: any) {
      toast({
        title: t("revisaoAcessosComp.usuariosList.toastErrorTitle"),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setUsuarioToDelete(null);
    }
  };

  // tipo de acesso e status agora resolvidos via StatusBadge + resolvers

  const columns: Column<SistemaUsuario>[] = [
    {
      key: "nome_usuario",
      label: t("revisaoAcessosComp.usuariosList.columnNome"),
      sortable: true,
    },
    {
      key: "email_usuario",
      label: t("revisaoAcessosComp.usuariosList.columnEmail"),
      sortable: true,
      render: (row) => row.email_usuario || "-",
    },
    {
      key: "sistema.nome_sistema",
      label: t("revisaoAcessosComp.usuariosList.columnSistema"),
      sortable: true,
      render: (row) => row.sistema?.nome_sistema || "-",
    },
    {
      /*
        Numa revisão, «veio do diretório esta manhã» e «alguém escreveu isto há
        catorze meses» não merecem a mesma confiança — e até agora eram
        indistinguíveis na tela.
      */
      key: "origem",
      label: t("revisaoAcessosComp.usuariosList.columnOrigem"),
      sortable: true,
      render: (row) =>
        row.origem ? (
          <StatusBadge tone="info">
            {t(`revisaoAcessosComp.usuariosList.origem.${row.origem}`)}
          </StatusBadge>
        ) : (
          <span className="text-muted-foreground">
            {t("revisaoAcessosComp.usuariosList.origem.manual")}
          </span>
        ),
    },
    {
      key: "departamento",
      label: t("revisaoAcessosComp.usuariosList.columnDepartamento"),
      sortable: true,
      render: (row) => row.departamento || "-",
    },
    {
      key: "tipo_acesso",
      label: t("revisaoAcessosComp.usuariosList.columnTipoAcesso"),
      sortable: true,
      render: (row) => (
        <StatusBadge {...resolveTipoAcessoTone(row.tipo_acesso)}>
          {formatStatus(row.tipo_acesso)}
        </StatusBadge>
      ),
    },
    {
      key: "data_concessao",
      label: t("revisaoAcessosComp.usuariosList.columnConcessao"),
      sortable: true,
      render: (row) => formatDateOnly(row.data_concessao) || "-",
    },
    {
      key: "ativo",
      label: t("revisaoAcessosComp.usuariosList.columnStatus"),
      sortable: true,
      render: (row) => (
        <StatusBadge {...resolveAtivoTone(row.ativo)}>
          {row.ativo ? t("revisaoAcessosComp.usuariosList.statusAtivo") : t("revisaoAcessosComp.usuariosList.statusInativo")}
        </StatusBadge>
      ),
    },
    {
      key: "actions",
      label: t("revisaoAcessosComp.usuariosList.columnAcoes"),
      render: (row) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm">
              <IconMore className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleEdit(row)}>
              <IconEdit className="h-4 w-4 mr-2" />
              {t("revisaoAcessosComp.usuariosList.buttonEditar")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                setUsuarioToDelete(row);
                setDeleteDialogOpen(true);
              }}
              className="text-destructive focus:text-destructive"
            >
              <IconDelete className="h-4 w-4 mr-2" />
              {t("revisaoAcessosComp.usuariosList.buttonExcluir")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  if (!usuarios?.length && !loading) {
    return (
      <div className="space-y-4">
        {/*
        `flex-wrap`: os tres controlos somam mais do que a largura do telemovel.

        Um `Select` de 250px + «Sincronizar do Entra ID» + «Novo Usuario» dao
        cerca de 348px contra os ~327px uteis. Sem quebrar linha, o ultimo botao
        saia pela direita e era CORTADO pelo `overflow-x-hidden` do `<main>` --
        nao havia como chegar a ele.
      */}
      <div className="flex flex-wrap gap-2 justify-between items-center">
          <Select value={filtroSistema} onValueChange={setFiltroSistema}>
            <SelectTrigger className="w-[250px]">
              <SelectValue placeholder={t("revisaoAcessosComp.usuariosList.filterPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">{t("revisaoAcessosComp.usuariosList.filterAllSystems")}</SelectItem>
              {sistemas?.map((sistema) => (
                <SelectItem key={sistema.id} value={sistema.id}>
                  {sistema.nome_sistema}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <SincronizarDiretorio onSincronizado={invalidateCache} />
            <Button onClick={() => { setSelectedUsuario(null); setDialogOpen(true); }}>
              <IconAdd className="h-4 w-4 mr-2" />
              {t("revisaoAcessosComp.usuariosList.buttonNovo")}
            </Button>
          </div>
        </div>

        <EmptyState
          icon={<IconUsers className="h-10 w-10" />}
          title={t("revisaoAcessosComp.usuariosList.emptyTitle")}
          description={t("revisaoAcessosComp.usuariosList.emptyDescription")}
          action={{
            label: t("revisaoAcessosComp.usuariosList.emptyAction"),
            onClick: () => { setSelectedUsuario(null); setDialogOpen(true); },
          }}
        />

        <SistemaUsuarioDialog
          open={dialogOpen}
          onClose={() => { setDialogOpen(false); setSelectedUsuario(null); }}
          usuario={selectedUsuario}
          onSuccess={invalidateCache}
          sistemaIdPadrao={filtroSistema !== "todos" ? filtroSistema : undefined}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Select value={filtroSistema} onValueChange={setFiltroSistema}>
          <SelectTrigger className="w-[250px]">
            <SelectValue placeholder={t("revisaoAcessosComp.usuariosList.filterPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">{t("revisaoAcessosComp.usuariosList.filterAllSystems")}</SelectItem>
            {sistemas?.map((sistema) => (
              <SelectItem key={sistema.id} value={sistema.id}>
                {sistema.nome_sistema}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-2">
          <SincronizarDiretorio onSincronizado={invalidateCache} />
          <Button onClick={() => { setSelectedUsuario(null); setDialogOpen(true); }}>
            <IconAdd className="h-4 w-4 mr-2" />
            {t("revisaoAcessosComp.usuariosList.buttonNovo")}
          </Button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={usuarios || []}
        /* Sem isto, durante a leitura ficavam cabeçalhos de coluna sobre um
           vazio branco -- sem indicação nenhuma de que algo estava a carregar. */
        loading={loading}
        searchable
        searchPlaceholder={t("revisaoAcessosComp.usuariosList.searchPlaceholder")}
        pageSize={10}
      />

      <SistemaUsuarioDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setSelectedUsuario(null); }}
        usuario={selectedUsuario}
        onSuccess={invalidateCache}
        sistemaIdPadrao={filtroSistema !== "todos" ? filtroSistema : undefined}
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title={t("revisaoAcessosComp.usuariosList.deleteTitle")}
        description={t("revisaoAcessosComp.usuariosList.deleteDescription").replace("{nome}", usuarioToDelete?.nome_usuario || "")}
        confirmText={t("revisaoAcessosComp.usuariosList.deleteConfirm")}
        onConfirm={handleDelete}
        loading={isDeleting}
        variant="destructive"
      />
    </div>
  );
}
