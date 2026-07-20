/**
 * VincularControleDialog — vincula controles a um risco a partir do próprio risco
 * (contraparte do ControlesVinculacaoDialog, que faz o mesmo pelo lado do controle).
 * Grava em controles_riscos (controle_id, risco_id, tipo_vinculacao, eficacia_estimada).
 *
 * Usa o DialogShell padrão (cabeçalho + rodapé Cancel/Salvar + Ctrl+S).
 */
import { useEffect, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DialogShell } from '@/components/ui/dialog-shell';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Link as LinkIcon, Search, ShieldCheck } from 'lucide-react';
import { formatStatus } from '@/lib/text-utils';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  riscoId: string;
  riscoNome: string;
  onSuccess?: () => void;
}

interface Controle {
  id: string;
  codigo: string | null;
  nome: string;
  tipo: string;
  status: string;
}

interface Vinculo {
  controle_id: string;
  tipo_vinculacao: string;
  eficacia_estimada: string;
}

export function VincularControleDialog({ open, onOpenChange, riscoId, riscoNome, onSuccess }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [vinculos, setVinculos] = useState<Vinculo[]>([]);
  const [busca, setBusca] = useState('');

  // Controles ativos da empresa (RLS já limita por company_id)
  const { data: controles = [] } = useQuery({
    queryKey: ['controles-ativos-para-vinculo'],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('controles')
        .select('id, codigo, nome, tipo, status')
        .eq('status', 'ativo')
        .order('codigo', { ascending: true });
      if (error) throw error;
      return (data || []) as Controle[];
    },
  });

  // Pré-carrega vínculos existentes deste risco
  useEffect(() => {
    if (!open || !riscoId) return;
    (async () => {
      const { data } = await supabase
        .from('controles_riscos')
        .select('controle_id, tipo_vinculacao, eficacia_estimada')
        .eq('risco_id', riscoId);
      setVinculos(
        (data || []).map((v) => ({
          controle_id: v.controle_id,
          tipo_vinculacao: v.tipo_vinculacao || 'mitiga',
          eficacia_estimada: v.eficacia_estimada || 'media',
        })),
      );
    })();
  }, [open, riscoId]);

  const isVinculado = (id: string) => vinculos.some((v) => v.controle_id === id);
  const getVinculo = (id: string) => vinculos.find((v) => v.controle_id === id);

  const toggle = (id: string, checked: boolean) => {
    setVinculos((prev) =>
      checked
        ? [...prev, { controle_id: id, tipo_vinculacao: 'mitiga', eficacia_estimada: 'media' }]
        : prev.filter((v) => v.controle_id !== id),
    );
  };

  const update = (id: string, field: keyof Vinculo, value: string) => {
    setVinculos((prev) => prev.map((v) => (v.controle_id === id ? { ...v, [field]: value } : v)));
  };

  const save = useMutation({
    mutationFn: async () => {
      // Substitui o conjunto de vínculos deste risco (mesmo padrão do lado do controle)
      await supabase.from('controles_riscos').delete().eq('risco_id', riscoId);
      if (vinculos.length > 0) {
        const { error } = await supabase.from('controles_riscos').insert(
          vinculos.map((v) => ({
            risco_id: riscoId,
            controle_id: v.controle_id,
            tipo_vinculacao: v.tipo_vinculacao,
            eficacia_estimada: v.eficacia_estimada,
          })),
        );
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: 'Controles vinculados', description: 'Vínculos do risco atualizados.' });
      queryClient.invalidateQueries({ queryKey: ['risco-detail', riscoId] });
      queryClient.invalidateQueries({ queryKey: ['controles'] });
      onSuccess?.();
      onOpenChange(false);
    },
  });

  const filtrados = controles.filter((c) => {
    const q = busca.toLowerCase();
    return !q || c.nome.toLowerCase().includes(q) || (c.codigo || '').toLowerCase().includes(q);
  });

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={LinkIcon}
      title="Vincular controles ao risco"
      description={riscoNome}
      size="md"
      submitLabel="Salvar vínculos"
      isSubmitting={save.isPending}
      onSubmit={() => save.mutate()}
    >
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
        <ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.5} />
        {vinculos.length} {vinculos.length === 1 ? 'controle selecionado' : 'controles selecionados'}
      </div>

      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar controle por código ou nome…"
          className="pl-9"
        />
      </div>

      <div className="space-y-2">
        {filtrados.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Nenhum controle ativo encontrado.</div>
        ) : (
          filtrados.map((c) => {
            const v = getVinculo(c.id);
            return (
              <div key={c.id} className="border border-border rounded-lg p-3">
                <label className="flex items-start gap-3 cursor-pointer flex-1 min-w-0">
                  <Checkbox checked={isVinculado(c.id)} onCheckedChange={(ch) => toggle(c.id, !!ch)} className="mt-0.5" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {c.codigo && <span className="font-mono text-[11px] text-muted-foreground">{c.codigo}</span>}
                      <span className="text-sm font-medium truncate">{c.nome}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{formatStatus(c.tipo)}</div>
                  </div>
                </label>

                {isVinculado(c.id) && (
                  <div className="mt-3 grid grid-cols-2 gap-3 pl-7">
                    <div>
                      <Label className="text-[11px]">Tipo de vínculo</Label>
                      <Select value={v?.tipo_vinculacao || 'mitiga'} onValueChange={(val) => update(c.id, 'tipo_vinculacao', val)}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mitiga">Mitiga</SelectItem>
                          <SelectItem value="previne">Previne</SelectItem>
                          <SelectItem value="detecta">Detecta</SelectItem>
                          <SelectItem value="corrige">Corrige</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-[11px]">Eficácia estimada</Label>
                      <Select value={v?.eficacia_estimada || 'media'} onValueChange={(val) => update(c.id, 'eficacia_estimada', val)}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="alta">Alta</SelectItem>
                          <SelectItem value="media">Média</SelectItem>
                          <SelectItem value="baixa">Baixa</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </DialogShell>
  );
}
