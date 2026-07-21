import { useEffect, useState } from 'react';
import { Rocket } from 'lucide-react';
import { DialogShell } from '@/components/ui/dialog-shell';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import type { Programa } from '@/hooks/usePrograma';
import { getTemplateForFramework, type ProgramaTemplate } from '@/lib/programa-templates';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  programa?: Programa | null;
  onSubmit: (values: { nome: string; framework_id: string | null; data_alvo: string | null; orcamento_total: number | null; descricao: string | null }, opts?: { syncGap?: boolean; template?: ProgramaTemplate | null }) => Promise<boolean>;
}

export function ProgramaDialog({ open, onOpenChange, programa, onSubmit }: Props) {
  const isEdit = !!programa;
  const [nome, setNome] = useState('');
  const [frameworkId, setFrameworkId] = useState<string>('');
  const [dataAlvo, setDataAlvo] = useState('');
  const [orcamento, setOrcamento] = useState('');
  const [descricao, setDescricao] = useState('');
  const [frameworks, setFrameworks] = useState<{ id: string; nome: string }[]>([]);
  const [usarModelo, setUsarModelo] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setNome(programa?.nome ?? '');
    setFrameworkId(programa?.framework_id ?? '');
    setDataAlvo(programa?.data_alvo ?? '');
    setOrcamento(programa?.orcamento_total != null ? String(programa.orcamento_total) : '');
    setDescricao(programa?.descricao ?? '');
    setUsarModelo(true);
    (async () => {
      const { data } = await supabase.from('gap_analysis_frameworks').select('id, nome').order('nome');
      setFrameworks((data || []) as any);
    })();
  }, [open, programa]);

  const fwNome = frameworks.find((f) => f.id === frameworkId)?.nome;
  const modelo = getTemplateForFramework(fwNome);

  const handleSubmit = async () => {
    if (!nome.trim()) return;
    setSaving(true);
    const opts = !isEdit && usarModelo
      ? (frameworkId ? { syncGap: true, template: modelo } : { template: modelo })
      : undefined;
    const ok = await onSubmit({
      nome: nome.trim(),
      framework_id: frameworkId || null,
      data_alvo: dataAlvo || null,
      orcamento_total: orcamento ? Number(orcamento) : null,
      descricao: descricao.trim() || null,
    }, opts);
    setSaving(false);
    if (ok) onOpenChange(false);
  };

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={Rocket}
      title={isEdit ? 'Editar programa' : 'Novo programa de implementação'}
      description="Acompanhe toda a jornada de adequação a um framework — fases, custos, ferramentas e prazos."
      size="md"
      onSubmit={handleSubmit}
      submitLabel={isEdit ? 'Salvar' : 'Criar programa'}
      isSubmitting={saving}
      submitDisabled={!nome.trim()}
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="pg-nome">Nome <span className="text-destructive">*</span></Label>
          <Input id="pg-nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Certificação ISO 27001" />
        </div>

        <div className="space-y-1.5">
          <Label>Framework</Label>
          <Select value={frameworkId || 'none'} onValueChange={(v) => setFrameworkId(v === 'none' ? '' : v)}>
            <SelectTrigger><SelectValue placeholder="Selecionar framework (opcional)" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sem framework específico</SelectItem>
              {frameworks.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="pg-data">Data-alvo (certificação)</Label>
            <Input id="pg-data" type="date" value={dataAlvo} onChange={(e) => setDataAlvo(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pg-orc">Orçamento total (R$)</Label>
            <Input id="pg-orc" type="number" min="0" value={orcamento} onChange={(e) => setOrcamento(e.target.value)} placeholder="0" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="pg-desc">Descrição</Label>
          <Textarea id="pg-desc" value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={2} placeholder="Escopo, objetivo, contexto..." />
        </div>

        {!isEdit && (
          <label className="flex items-start gap-3 rounded-lg border border-border bg-card p-3 cursor-pointer">
            <Checkbox checked={usarModelo} onCheckedChange={(v) => setUsarModelo(!!v)} className="mt-0.5" />
            {frameworkId ? (
              <span className="text-sm">
                Vincular ao <span className="font-medium">Gap Analysis</span> e puxar os controles
                <span className="block text-xs text-muted-foreground mt-0.5">Traz os controles do framework com o status de conformidade real. Se o framework não tiver avaliação, usa o modelo {modelo.label} como base.</span>
              </span>
            ) : (
              <span className="text-sm">
                Começar a partir do modelo <span className="font-medium">{modelo.label}</span>
                <span className="block text-xs text-muted-foreground mt-0.5">Cria as fases e itens típicos já preenchidos com esforço, custo e ferramenta sugeridos — você só ajusta.</span>
              </span>
            )}
          </label>
        )}
      </div>
    </DialogShell>
  );
}
