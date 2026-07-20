import { useState } from "react";
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
import { Plus, Pencil, Trash2, Users, MoreHorizontal } from "lucide-react";
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
}

export function SistemaUsuariosList() {
  const { empresaId } = useEmpresaId();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
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

      toast({ title: "Sucesso", description: "Usuário removido com sucesso" });
      invalidateCache();
    } catch (error: any) {
      toast({
        title: "Erro ao remover usuário",
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
      label: "Nome",
      sortable: true,
    },
    {
      key: "email_usuario",
      label: "Email",
      sortable: true,
      render: (row) => row.email_usuario || "-",
    },
    {
      key: "sistema.nome_sistema",
      label: "Sistema",
      sortable: true,
      render: (row) => row.sistema?.nome_sistema || "-",
    },
    {
      key: "departamento",
      label: "Departamento",
      sortable: true,
      render: (row) => row.departamento || "-",
    },
    {
      key: "tipo_acesso",
      label: "Tipo de Acesso",
      sortable: true,
      render: (row) => (
        <StatusBadge size="sm" {...resolveTipoAcessoTone(row.tipo_acesso)}>
          {formatStatus(row.tipo_acesso)}
        </StatusBadge>
      ),
    },
    {
      key: "data_concessao",
      label: "Concessão",
      sortable: true,
      render: (row) => formatDateOnly(row.data_concessao) || "-",
    },
    {
      key: "ativo",
      label: "Status",
      sortable: true,
      render: (row) => (
        <StatusBadge size="sm" {...resolveAtivoTone(row.ativo)}>
          {row.ativo ? "Ativo" : "Inativo"}
        </StatusBadge>
      ),
    },
    {
      key: "actions",
      label: "Ações",
      render: (row) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleEdit(row)}>
              <Pencil className="h-4 w-4 mr-2" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                setUsuarioToDelete(row);
                setDeleteDialogOpen(true);
              }}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  if (!usuarios?.length && !loading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Select value={filtroSistema} onValueChange={setFiltroSistema}>
            <SelectTrigger className="w-[250px]">
              <SelectValue placeholder="Filtrar por sistema" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os Sistemas</SelectItem>
              {sistemas?.map((sistema) => (
                <SelectItem key={sistema.id} value={sistema.id}>
                  {sistema.nome_sistema}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => { setSelectedUsuario(null); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Usuário
          </Button>
        </div>

        <EmptyState
          icon={<Users className="h-10 w-10" />}
          title="Nenhum usuário cadastrado"
          description="Cadastre usuários vinculados aos sistemas para gerenciar revisões de acesso."
          action={{
            label: "Cadastrar Usuário",
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
            <SelectValue placeholder="Filtrar por sistema" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os Sistemas</SelectItem>
            {sistemas?.map((sistema) => (
              <SelectItem key={sistema.id} value={sistema.id}>
                {sistema.nome_sistema}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={() => { setSelectedUsuario(null); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Usuário
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={usuarios || []}
        searchable
        searchPlaceholder="Buscar usuários..."
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
        title="Excluir Usuário"
        description={`Tem certeza que deseja excluir o usuário "${usuarioToDelete?.nome_usuario}"? Esta ação não pode ser desfeita.`}
        confirmText="Excluir"
        onConfirm={handleDelete}
        loading={isDeleting}
        variant="destructive"
      />
    </div>
  );
}
