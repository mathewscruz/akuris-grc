import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Calendar, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { RiscosIcon } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatDateOnly } from '@/lib/date-utils';
import ConfirmDialog from '@/components/ConfirmDialog';
import { TratamentoDialog } from './TratamentoDialog';
import { formatStatus } from '@/lib/text-utils';
import { StatusBadge } from '@/components/ui/status-badge';
import { resolveTratamentoTipoTone, resolveTratamentoStatusTone } from '@/lib/status-tone';

import { AkurisPulse } from '@/components/ui/AkurisPulse';
interface ResponsavelProfile {
  user_id: string;
  nome: string;
  foto_url?: string;
}

interface Tratamento {
  id: string;
  tipo_tratamento: string;
  descricao: string;
  responsavel?: string;
  custo?: number;
  prazo?: string;
  data_inicio?: string;
  status: string;
  eficacia?: string;
  created_at: string;
  responsavel_profile?: ResponsavelProfile;
}

interface TratamentosListProps {
  riscoId: string;
  riscoNome?: string;
  embedded?: boolean;
  riscoData?: {
    nome: string;
    descricao: string;
    categoria?: string;
    nivel_risco_inicial?: string;
  };
}

export function TratamentosList({ riscoId, riscoNome, embedded = false, riscoData }: TratamentosListProps) {
  const [tratamentos, setTratamentos] = useState<Tratamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [tratamentoDialogOpen, setTratamentoDialogOpen] = useState(false);
  const [editingTratamento, setEditingTratamento] = useState<Tratamento | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [tratamentoToDelete, setTratamentoToDelete] = useState<Tratamento | null>(null);

  const fetchTratamentos = async () => {
    try {
      const { data, error } = await supabase
        .from('riscos_tratamentos')
        .select('*')
        .eq('risco_id', riscoId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Buscar perfis dos responsáveis (que são user_id)
      const tratamentosComPerfis = await Promise.all(
        (data || []).map(async (tratamento) => {
          if (tratamento.responsavel) {
            // Tentar buscar como UUID (user_id)
            const { data: profile } = await supabase
              .from('profiles')
              .select('user_id, nome, foto_url')
              .eq('user_id', tratamento.responsavel)
              .single();
            
            if (profile) {
              return { ...tratamento, responsavel_profile: profile };
            }
          }
          return tratamento;
        })
      );
      
      setTratamentos(tratamentosComPerfis);
    } catch (error: any) {
      toast.error('Erro ao carregar tratamentos: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTratamentos();
  }, [riscoId]);

  const handleEdit = (tratamento: Tratamento) => {
    setEditingTratamento(tratamento);
    setTratamentoDialogOpen(true);
  };

  const openDeleteDialog = (tratamento: Tratamento) => {
    setTratamentoToDelete(tratamento);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!tratamentoToDelete) return;

    try {
      const { error } = await supabase
        .from('riscos_tratamentos')
        .delete()
        .eq('id', tratamentoToDelete.id);

      if (error) throw error;

      toast.success('Tratamento excluído com sucesso!');
      setDeleteDialogOpen(false);
      setTratamentoToDelete(null);
      fetchTratamentos();
    } catch (error: any) {
      toast.error('Erro ao excluir tratamento: ' + error.message);
    }
  };

  const openCreateDialog = () => {
    setEditingTratamento(null);
    setTratamentoDialogOpen(true);
  };

  const handleDialogSuccess = () => {
    setTratamentoDialogOpen(false);
    setEditingTratamento(null);
    fetchTratamentos();
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'pendente':
        return 'secondary';
      case 'em andamento':
        return 'default';
      case 'concluído':
        return 'outline';
      case 'cancelado':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const getTipoTratamentoBadgeVariant = (tipo: string) => {
    switch (tipo) {
      case 'mitigar':
        return 'default';
      case 'transferir':
        return 'secondary';
      case 'aceitar':
        return 'destructive';
      case 'evitar':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <AkurisPulse size={32} className="mb-2" />
          <p className="text-sm text-muted-foreground">Carregando tratamentos...</p>
        </div>
      </div>
    );
  }

  const count = tratamentos.length;

  const headerSection = (
    <div className="flex items-center justify-between gap-3 mb-4">
      <div className="flex items-center gap-2">
        {!embedded && (
          <CardTitle className="text-lg">Tratamentos do Risco</CardTitle>
        )}
        <span className="text-xs text-muted-foreground">
          {count} {count === 1 ? 'tratamento cadastrado' : 'tratamentos cadastrados'}
        </span>
      </div>
      <Button onClick={openCreateDialog} size="sm">
        <Plus className="mr-2 h-4 w-4" strokeWidth={1.5} />
        Novo Tratamento
      </Button>
    </div>
  );

  const body = (
    <>
      {headerSection}
      {tratamentos.length === 0 ? (
        <EmptyState
          variant="illustrated"
          icon={<RiscosIcon className="h-7 w-7" />}
          title="Nenhum tratamento cadastrado"
          description="Comece definindo a primeira ação para mitigar, transferir, aceitar ou evitar este risco."
          action={{
            label: 'Cadastrar Primeiro Tratamento',
            onClick: openCreateDialog,
          }}
        />
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Prazo</TableHead>
                <TableHead>Custo</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tratamentos.map((tratamento) => (
                <TableRow key={tratamento.id}>
                  <TableCell>
                    <StatusBadge size="sm" {...resolveTratamentoTipoTone(tratamento.tipo_tratamento)}>
                      {formatStatus(tratamento.tipo_tratamento)}
                    </StatusBadge>
                  </TableCell>
                  <TableCell className="max-w-xs">
                    <div className="truncate" title={tratamento.descricao}>
                      {tratamento.descricao}
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge size="sm" {...resolveTratamentoStatusTone(tratamento.status)}>
                      {formatStatus(tratamento.status)}
                    </StatusBadge>
                  </TableCell>
                  <TableCell>
                    {tratamento.responsavel_profile ? (
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={tratamento.responsavel_profile.foto_url || ''} />
                          <AvatarFallback className="text-xs">
                            {tratamento.responsavel_profile.nome?.charAt(0)?.toUpperCase() || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{tratamento.responsavel_profile.nome}</span>
                      </div>
                    ) : tratamento.responsavel ? (
                      <span className="text-sm text-muted-foreground">{tratamento.responsavel}</span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {tratamento.prazo ? (
                      <div className="flex items-center gap-1.5 text-sm">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
                        {formatDateOnly(tratamento.prazo)}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {tratamento.custo ? (
                      <div className="flex items-center gap-1.5 text-sm">
                        <DollarSign className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
                        {new Intl.NumberFormat('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        }).format(tratamento.custo)}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2 justify-end">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(tratamento)}>
                        <Edit className="h-3.5 w-3.5" strokeWidth={1.5} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openDeleteDialog(tratamento)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <TratamentoDialog
        open={tratamentoDialogOpen}
        onOpenChange={setTratamentoDialogOpen}
        riscoId={riscoId}
        tratamento={editingTratamento}
        onSuccess={handleDialogSuccess}
        riscoData={riscoData}
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Excluir Tratamento"
        description="Tem certeza que deseja excluir este tratamento? Esta ação não pode ser desfeita."
        variant="destructive"
        confirmText="Excluir"
        onConfirm={handleDelete}
      />
    </>
  );

  if (embedded) {
    return <div className="space-y-4">{body}</div>;
  }

  return (
    <Card>
      <CardContent className="pt-6">{body}</CardContent>
    </Card>
  );
}

