import React from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MoreVertical, Pencil, Archive, ArchiveRestore, Trash2 } from 'lucide-react';
import type { Projeto } from '@/types/projetos';
import { useUpsertProjeto, useDeleteProjeto } from '@/hooks/useProjetos';

interface Props {
  projeto: Projeto;
  onEdit: () => void;
  /** When set, displays a full destructive button (header style) instead of the dropdown trigger. */
  variant?: 'menu' | 'button';
}

export function ProjetoActionsMenu({ projeto, onEdit, variant = 'menu' }: Props) {
  const upsert = useUpsertProjeto();
  const del = useDeleteProjeto();
  const [confirmDel, setConfirmDel] = React.useState(false);
  const [confirmName, setConfirmName] = React.useState('');

  const arquivado = projeto.status === 'arquivado';

  const toggleArquivo = async () => {
    await upsert.mutateAsync({
      id: projeto.id,
      nome: projeto.nome,
      status: arquivado ? 'ativo' : 'arquivado',
    } as any);
  };

  const confirmDelete = async () => {
    if (confirmName.trim() !== projeto.nome) return;
    await del.mutateAsync(projeto.id);
    setConfirmDel(false);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {variant === 'menu' ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          ) : (
            <Button variant="outline" size="sm">
              <MoreVertical className="h-4 w-4" /> Ações
            </Button>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuItem onClick={onEdit}>
            <Pencil className="h-4 w-4 mr-2" /> Editar projeto
          </DropdownMenuItem>
          <DropdownMenuItem onClick={toggleArquivo}>
            {arquivado ? (
              <><ArchiveRestore className="h-4 w-4 mr-2" /> Reativar projeto</>
            ) : (
              <><Archive className="h-4 w-4 mr-2" /> Arquivar projeto</>
            )}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => { setConfirmName(''); setConfirmDel(true); }}
          >
            <Trash2 className="h-4 w-4 mr-2" /> Excluir projeto
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmDel} onOpenChange={setConfirmDel}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir projeto definitivamente</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação remove o projeto, todas as tarefas, comentários, anexos e vínculos com módulos GRC.
              <br />Não pode ser desfeita. Se você só quer pausar o trabalho, prefira <strong>arquivar</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label className="text-xs">Para confirmar, digite o nome do projeto: <strong>{projeto.nome}</strong></Label>
            <Input
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={projeto.nome}
              autoFocus
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={confirmName.trim() !== projeto.nome || del.isPending}
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {del.isPending ? 'Excluindo…' : 'Excluir definitivamente'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
