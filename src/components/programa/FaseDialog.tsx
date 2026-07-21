import { useEffect, useState } from 'react';
import { Layers } from 'lucide-react';
import { DialogShell } from '@/components/ui/dialog-shell';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ProgramaFase } from '@/hooks/usePrograma';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fase: ProgramaFase | null;
  onSubmit: (id: string, patch: { nome?: string; orcamento?: number | null }) => Promise<boolean>;
}

export function FaseDialog({ open, onOpenChange, fase, onSubmit }: Props) {
  const [nome, setNome] = useState('');
  const [orcamento, setOrcamento] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !fase) return;
    setNome(fase.nome);
    setOrcamento(fase.orcamento != null ? String(fase.orcamento) : '');
  }, [open, fase]);

  const handleSubmit = async () => {
    if (!fase || !nome.trim()) return;
    setSaving(true);
    const ok = await onSubmit(fase.id, { nome: nome.trim(), orcamento: orcamento ? Number(orcamento) : null });
    setSaving(false);
    if (ok) onOpenChange(false);
  };

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={Layers}
      title="Editar fase"
      size="sm"
      onSubmit={handleSubmit}
      submitLabel="Salvar"
      isSubmitting={saving}
      submitDisabled={!nome.trim()}
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="fs-nome">Nome</Label>
          <Input id="fs-nome" value={nome} onChange={(e) => setNome(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="fs-orc">Orçamento da fase (R$)</Label>
          <Input id="fs-orc" type="number" min="0" value={orcamento} onChange={(e) => setOrcamento(e.target.value)} placeholder="Quanto pretende gastar nesta fase" />
        </div>
      </div>
    </DialogShell>
  );
}
