import React from 'react';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { CriarTarefaFromGRC } from './CriarTarefaFromGRC';
import type { ProjetoVinculoEntidade } from '@/types/projetos';
import { useLanguage } from '@/contexts/LanguageContext';
import { IconChecklist } from '@/components/icons';

/**
 * Item de menu controlado: abre o dialog do CriarTarefaFromGRC mesmo quando
 * o DropdownMenu fecha (estado vive fora do menu).
 */
export function CriarTarefaMenuItem(props: {
  entidadeTipo: ProjetoVinculoEntidade;
  entidadeId: string;
  tituloSugerido?: string;
  descricaoSugerida?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const { t } = useLanguage();
  return (
    <>
      <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setOpen(true); }}>
        <IconChecklist className="mr-2 h-4 w-4" /> {t('projetos.criarTarefaGRC.buttonLabel')}
      </DropdownMenuItem>
      <CriarTarefaFromGRC
        open={open}
        onOpenChange={setOpen}
        entidadeTipo={props.entidadeTipo}
        entidadeId={props.entidadeId}
        tituloSugerido={props.tituloSugerido}
        descricaoSugerida={props.descricaoSugerida}
      />
    </>
  );
}
