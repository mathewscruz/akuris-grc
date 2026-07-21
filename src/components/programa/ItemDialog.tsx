import { useEffect, useState } from 'react';
import { ListChecks } from 'lucide-react';
import { DialogShell } from '@/components/ui/dialog-shell';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserSelect } from '@/components/riscos/UserSelect';
import type { ProgramaFase, ProgramaItem, ItemStatus, Nivel } from '@/hooks/usePrograma';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: ProgramaItem | null;
  fases: ProgramaFase[];
  defaultFaseId?: string | null;
  onSubmit: (values: Partial<ProgramaItem> & { id?: string }) => Promise<boolean>;
}

const NIVEIS: { value: Nivel; label: string }[] = [
  { value: 'baixo', label: 'Baixo' },
  { value: 'medio', label: 'Médio' },
  { value: 'alto', label: 'Alto' },
];

export function ItemDialog({ open, onOpenChange, item, fases, defaultFaseId, onSubmit }: Props) {
  const isEdit = !!item;
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [faseId, setFaseId] = useState<string>('');
  const [responsavel, setResponsavel] = useState<string>('');
  const [prazo, setPrazo] = useState<string>('');
  const [esforco, setEsforco] = useState<string>('');
  const [impacto, setImpacto] = useState<string>('');
  const [custo, setCusto] = useState<string>('');
  const [ferramenta, setFerramenta] = useState<string>('');
  const [status, setStatus] = useState<ItemStatus>('pendente');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitulo(item?.titulo ?? '');
    setDescricao(item?.descricao ?? '');
    setFaseId(item?.fase_id ?? defaultFaseId ?? '');
    setResponsavel(item?.responsavel_id ?? '');
    setPrazo(item?.prazo ?? '');
    setEsforco(item?.esforco ?? '');
    setImpacto(item?.impacto ?? '');
    setCusto(item?.custo_estimado != null ? String(item.custo_estimado) : '');
    setFerramenta(item?.ferramenta_sugerida ?? '');
    setStatus(item?.status ?? 'pendente');
  }, [open, item, defaultFaseId]);

  const handleSubmit = async () => {
    if (!titulo.trim()) return;
    setSaving(true);
    const ok = await onSubmit({
      id: item?.id,
      titulo: titulo.trim(),
      descricao: descricao.trim() || null,
      fase_id: faseId || null,
      responsavel_id: responsavel || null,
      prazo: prazo || null,
      esforco: (esforco || null) as Nivel | null,
      impacto: (impacto || null) as Nivel | null,
      custo_estimado: custo ? Number(custo) : null,
      ferramenta_sugerida: ferramenta.trim() || null,
      status,
    });
    setSaving(false);
    if (ok) onOpenChange(false);
  };

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={ListChecks}
      title={isEdit ? 'Editar item' : 'Novo item do programa'}
      description="O que precisa ser feito para atender este controle — com esforço, custo, ferramenta e prazo."
      size="md"
      onSubmit={handleSubmit}
      submitLabel={isEdit ? 'Salvar' : 'Adicionar'}
      isSubmitting={saving}
      submitDisabled={!titulo.trim()}
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="it-titulo">Título <span className="text-destructive">*</span></Label>
          <Input id="it-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Implantar MFA em todos os acessos privilegiados" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="it-desc">Descrição</Label>
          <Textarea id="it-desc" value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={2} placeholder="O que envolve, escopo, observações..." />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Fase</Label>
            <Select value={faseId || 'none'} onValueChange={(v) => setFaseId(v === 'none' ? '' : v)}>
              <SelectTrigger><SelectValue placeholder="Sem fase" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem fase</SelectItem>
                {fases.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as ItemStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="em_andamento">Em andamento</SelectItem>
                <SelectItem value="concluido">Concluído</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Esforço</Label>
            <Select value={esforco || 'none'} onValueChange={(v) => setEsforco(v === 'none' ? '' : v)}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                {NIVEIS.map((n) => <SelectItem key={n.value} value={n.value}>{n.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Impacto</Label>
            <Select value={impacto || 'none'} onValueChange={(v) => setImpacto(v === 'none' ? '' : v)}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                {NIVEIS.map((n) => <SelectItem key={n.value} value={n.value}>{n.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="it-custo">Custo estimado (R$)</Label>
            <Input id="it-custo" type="number" min="0" value={custo} onChange={(e) => setCusto(e.target.value)} placeholder="0" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="it-prazo">Prazo</Label>
            <Input id="it-prazo" type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="it-ferramenta">Ferramenta sugerida</Label>
          <Input id="it-ferramenta" value={ferramenta} onChange={(e) => setFerramenta(e.target.value)} placeholder="Ex.: Okta, Microsoft Entra, CrowdStrike..." />
        </div>

        <div className="space-y-1.5">
          <Label>Responsável</Label>
          <UserSelect value={responsavel} onValueChange={setResponsavel} placeholder="Selecionar responsável..." />
        </div>
      </div>
    </DialogShell>
  );
}
