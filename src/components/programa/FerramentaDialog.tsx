import { useEffect, useState } from 'react';
import { Wrench } from 'lucide-react';
import { DialogShell } from '@/components/ui/dialog-shell';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ProgramaFase, ProgramaFerramenta, FerramentaStatus } from '@/hooks/usePrograma';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ferramenta?: ProgramaFerramenta | null;
  fases: ProgramaFase[];
  onSubmit: (values: Partial<ProgramaFerramenta> & { id?: string }) => Promise<boolean>;
}

export function FerramentaDialog({ open, onOpenChange, ferramenta, fases, onSubmit }: Props) {
  const isEdit = !!ferramenta;
  const [nome, setNome] = useState('');
  const [categoria, setCategoria] = useState('');
  const [fornecedor, setFornecedor] = useState('');
  const [custo, setCusto] = useState('');
  const [recorrencia, setRecorrencia] = useState<'unica' | 'mensal' | 'anual'>('anual');
  const [status, setStatus] = useState<FerramentaStatus>('planejada');
  const [faseId, setFaseId] = useState('');
  const [obs, setObs] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setNome(ferramenta?.nome ?? '');
    setCategoria(ferramenta?.categoria ?? '');
    setFornecedor(ferramenta?.fornecedor ?? '');
    setCusto(ferramenta?.custo != null ? String(ferramenta.custo) : '');
    setRecorrencia(ferramenta?.recorrencia ?? 'anual');
    setStatus(ferramenta?.status ?? 'planejada');
    setFaseId(ferramenta?.fase_id ?? '');
    setObs(ferramenta?.observacoes ?? '');
  }, [open, ferramenta]);

  const handleSubmit = async () => {
    if (!nome.trim()) return;
    setSaving(true);
    const ok = await onSubmit({
      id: ferramenta?.id,
      nome: nome.trim(),
      categoria: categoria.trim() || null,
      fornecedor: fornecedor.trim() || null,
      custo: custo ? Number(custo) : null,
      recorrencia,
      status,
      fase_id: faseId || null,
      observacoes: obs.trim() || null,
    });
    setSaving(false);
    if (ok) onOpenChange(false);
  };

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={Wrench}
      title={isEdit ? 'Editar ferramenta' : 'Nova ferramenta'}
      description="Ferramenta técnica que você está ou vai contratar para se adequar."
      size="md"
      onSubmit={handleSubmit}
      submitLabel={isEdit ? 'Salvar' : 'Adicionar'}
      isSubmitting={saving}
      submitDisabled={!nome.trim()}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="fr-nome">Nome <span className="text-destructive">*</span></Label>
            <Input id="fr-nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Microsoft Entra ID" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fr-cat">Categoria</Label>
            <Input id="fr-cat" value={categoria} onChange={(e) => setCategoria(e.target.value)} placeholder="Ex.: Identidade / MFA" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="fr-forn">Fornecedor</Label>
            <Input id="fr-forn" value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} placeholder="Ex.: Microsoft" />
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as FerramentaStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="planejada">Planejada</SelectItem>
                <SelectItem value="avaliando">Avaliando</SelectItem>
                <SelectItem value="contratada">Contratada</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="fr-custo">Custo (R$)</Label>
            <Input id="fr-custo" type="number" min="0" value={custo} onChange={(e) => setCusto(e.target.value)} placeholder="0" />
          </div>
          <div className="space-y-1.5">
            <Label>Recorrência</Label>
            <Select value={recorrencia} onValueChange={(v) => setRecorrencia(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="unica">Única</SelectItem>
                <SelectItem value="mensal">Mensal</SelectItem>
                <SelectItem value="anual">Anual</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Fase (opcional)</Label>
          <Select value={faseId || 'none'} onValueChange={(v) => setFaseId(v === 'none' ? '' : v)}>
            <SelectTrigger><SelectValue placeholder="Sem fase" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sem fase</SelectItem>
              {fases.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="fr-obs">Observações</Label>
          <Textarea id="fr-obs" value={obs} onChange={(e) => setObs(e.target.value)} rows={2} placeholder="Plano, licenças, contato comercial..." />
        </div>
      </div>
    </DialogShell>
  );
}
