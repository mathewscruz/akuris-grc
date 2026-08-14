import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTarefaVinculos, useVinculoMutations } from '@/hooks/useProjetoTarefas';
import type { ProjetoVinculoEntidade } from '@/types/projetos';
import { Link2, Trash2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { EntidadeSelect } from '@/components/common/EntidadeSelect';
import { ENTITY_BY_KEY, type EntityKey, type EntityRow } from '@/lib/entity-search';

interface Props {
  tarefaId: string;
}

/**
 * Só oferecemos os tipos de vínculo que têm seletor real de registo — nunca
 * voltamos a pedir UUID escrito à mão.
 */
const TIPOS: ProjetoVinculoEntidade[] = [
  'risco', 'controle', 'gap_requirement', 'incidente', 'auditoria', 'auditoria_item',
  'contrato', 'fornecedor', 'due_diligence', 'documento', 'ativo', 'denuncia',
  'plano_acao', 'dados_pessoais', 'conta_privilegiada', 'continuidade',
].filter((k) => !!ENTITY_BY_KEY[k as EntityKey]) as ProjetoVinculoEntidade[];

export function VinculosGRCPanel({ tarefaId }: Props) {
  const { t } = useLanguage();
  const { data: vinculos = [] } = useTarefaVinculos(tarefaId);
  const { add, remove } = useVinculoMutations(tarefaId);
  const [tipo, setTipo] = useState<ProjetoVinculoEntidade>('risco');
  const [entId, setEntId] = useState('');
  const [rowSelecionada, setRowSelecionada] = useState<EntityRow | undefined>();

  const tipos = useMemo(() => TIPOS, []);

  const handleAdd = () => {
    if (!entId) return;
    add.mutate({ entidade_tipo: tipo, entidade_id: entId });
    setEntId('');
    setRowSelecionada(undefined);
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{t('vinculosGrc.hint')}</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Select
          value={tipo}
          onValueChange={(v) => { setTipo(v as ProjetoVinculoEntidade); setEntId(''); setRowSelecionada(undefined); }}
        >
          <SelectTrigger className="w-full sm:w-[220px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {tipos.map((k) => (
              <SelectItem key={k} value={k}>{t(`entidades.${k}`)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="min-w-0 flex-1">
          <EntidadeSelect
            entidade={tipo as EntityKey}
            value={entId}
            onValueChange={(id, row) => { setEntId(id); setRowSelecionada(row); }}
          />
        </div>
        <Button type="button" onClick={handleAdd} disabled={!entId || add.isPending}>
          <Link2 className="h-4 w-4" /> {t('projetos.vinculos.link')}
        </Button>
      </div>
      {rowSelecionada && (
        <p className="text-xs text-muted-foreground">
          {t(`entidades.${tipo}`)} · <span className="font-mono">{rowSelecionada.codigo}</span> — {rowSelecionada.titulo}
        </p>
      )}
      <ul className="space-y-1.5">
        {vinculos.length === 0 && <li className="text-sm text-muted-foreground">{t('projetos.vinculos.noLinks')}</li>}
        {vinculos.map((v) => (
          <li key={v.id} className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2 text-sm">
            <span>
              <span className="font-medium">{t(`entidades.${v.entidade_tipo}`)}</span>{' '}
              <VinculoResumo tipo={v.entidade_tipo as EntityKey} id={v.entidade_id} />
            </span>
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => remove.mutate(v.id)}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Mostra identificador amigável em vez do UUID cru do vínculo persistido. */
function VinculoResumo({ tipo, id }: { tipo: EntityKey; id: string }) {
  const def = ENTITY_BY_KEY[tipo];
  const codigo = def ? `${def.prefixo}-${id.replace(/-/g, '').slice(-3).toUpperCase()}` : id;
  return <span className="font-mono text-xs text-muted-foreground">{codigo}</span>;
}
