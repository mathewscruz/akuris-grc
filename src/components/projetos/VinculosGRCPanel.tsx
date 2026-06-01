import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useTarefaVinculos, useVinculoMutations } from '@/hooks/useProjetoTarefas';
import { ENTIDADE_LABEL, type ProjetoVinculoEntidade } from '@/types/projetos';
import { Link2, Trash2 } from 'lucide-react';

interface Props {
  tarefaId: string;
}

const ENTIDADES = Object.entries(ENTIDADE_LABEL) as [ProjetoVinculoEntidade, string][];

export function VinculosGRCPanel({ tarefaId }: Props) {
  const { data: vinculos = [] } = useTarefaVinculos(tarefaId);
  const { add, remove } = useVinculoMutations(tarefaId);
  const [tipo, setTipo] = useState<ProjetoVinculoEntidade>('risco');
  const [entId, setEntId] = useState('');

  const handleAdd = () => {
    if (!entId.trim()) return;
    add.mutate({ entidade_tipo: tipo, entidade_id: entId.trim() });
    setEntId('');
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Conecte esta tarefa a qualquer entidade GRC (risco, controle, incidente, auditoria, etc.). Use o ID da entidade.
      </p>
      <div className="flex gap-2">
        <Select value={tipo} onValueChange={(v) => setTipo(v as ProjetoVinculoEntidade)}>
          <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {ENTIDADES.map(([k, label]) => <SelectItem key={k} value={k}>{label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input placeholder="UUID da entidade" value={entId} onChange={(e) => setEntId(e.target.value)} />
        <Button type="button" onClick={handleAdd} disabled={add.isPending}>
          <Link2 className="h-4 w-4" /> Vincular
        </Button>
      </div>
      <ul className="space-y-1.5">
        {vinculos.length === 0 && <li className="text-sm text-muted-foreground">Nenhum vínculo.</li>}
        {vinculos.map((v) => (
          <li key={v.id} className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2 text-sm">
            <span><span className="font-medium">{ENTIDADE_LABEL[v.entidade_tipo]}</span> <span className="text-muted-foreground font-mono text-xs">{v.entidade_id}</span></span>
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => remove.mutate(v.id)}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
