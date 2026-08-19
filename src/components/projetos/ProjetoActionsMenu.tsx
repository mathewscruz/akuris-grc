import React from 'react';
import { IconEdit, IconDelete, IconMore, IconArchive } from '@/components/icons';
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
import type { Projeto } from '@/types/projetos';
import { useUpsertProjeto, useDeleteProjeto } from '@/hooks/useProjetos';
import { useLanguage } from '@/contexts/LanguageContext';

interface Props {
  projeto: Projeto;
  onEdit: () => void;
  /** When set, displays a full destructive button (header style) instead of the dropdown trigger. */
  variant?: 'menu' | 'button';
}

export function ProjetoActionsMenu({ projeto, onEdit, variant = 'menu' }: Props) {
  const { t } = useLanguage();
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
              <IconMore className="h-4 w-4" />
            </Button>
          ) : (
            <Button variant="outline" size="sm">
              <IconMore className="h-4 w-4" /> {t('projetos.actionsMenu.actions')}
            </Button>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuItem onClick={onEdit}>
            <IconEdit className="h-4 w-4 mr-2" /> {t('projetos.actionsMenu.editProject')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={toggleArquivo}>
            {arquivado ? (
              <><IconArchive className="h-4 w-4 mr-2" /> {t('projetos.actionsMenu.reactivate')}</>
            ) : (
              <><IconArchive className="h-4 w-4 mr-2" /> {t('projetos.actionsMenu.archive')}</>
            )}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => { setConfirmName(''); setConfirmDel(true); }}
          >
            <IconDelete className="h-4 w-4 mr-2" /> {t('projetos.actionsMenu.deleteProject')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmDel} onOpenChange={setConfirmDel}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('projetos.actionsMenu.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('projetos.actionsMenu.deleteDescription')}
              <br />{t('projetos.actionsMenu.deleteDescriptionLine2')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label className="text-xs">{t('projetos.actionsMenu.confirmNameLabel')} <strong>{projeto.nome}</strong></Label>
            <Input
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={projeto.nome}
              autoFocus
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('projetos.actionsMenu.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              disabled={confirmName.trim() !== projeto.nome || del.isPending}
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {del.isPending ? t('projetos.actionsMenu.deleting') : t('projetos.actionsMenu.deletePermanently')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
