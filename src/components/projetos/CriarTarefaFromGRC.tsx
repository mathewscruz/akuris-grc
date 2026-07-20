import React, { useState, useMemo } from 'react';
import { DialogShell } from '@/components/ui/dialog-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { ListTodo } from 'lucide-react';
import { useProjetos } from '@/hooks/useProjetos';
import { useProjetoColunas, useUpsertTarefa } from '@/hooks/useProjetoTarefas';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import type { ProjetoTarefaPrioridade, ProjetoVinculoEntidade } from '@/types/projetos';
import { PRIORIDADE_LABEL } from '@/types/projetos';
import { toast } from 'sonner';

interface CriarTarefaFromGRCProps {
  entidadeTipo: ProjetoVinculoEntidade;
  entidadeId: string;
  tituloSugerido?: string;
  descricaoSugerida?: string;
  /** Render as button. Default true. Pass false to render only the dialog and control via `open`. */
  trigger?: React.ReactNode;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export const CriarTarefaFromGRC: React.FC<CriarTarefaFromGRCProps> = ({
  entidadeTipo, entidadeId, tituloSugerido = '', descricaoSugerida = '', trigger, variant = 'outline', size = 'sm',
}) => {
  const [open, setOpen] = useState(false);
  const [projetoId, setProjetoId] = useState<string>('');
  const [titulo, setTitulo] = useState(tituloSugerido);
  const [descricao, setDescricao] = useState(descricaoSugerida);
  const [prioridade, setPrioridade] = useState<ProjetoTarefaPrioridade>('media');
  const [prazo, setPrazo] = useState<string>('');
  const [salvando, setSalvando] = useState(false);

  const { data: projetos = [] } = useProjetos();
  const { data: colunas = [] } = useProjetoColunas(projetoId || undefined);
  const upsert = useUpsertTarefa();
  const { user, profile } = useAuth();

  const ativos = useMemo(() => projetos.filter(p => p.status === 'ativo'), [projetos]);

  React.useEffect(() => {
    if (open) {
      setTitulo(tituloSugerido);
      setDescricao(descricaoSugerida);
    }
  }, [open, tituloSugerido, descricaoSugerida]);

  const handleSalvar = async () => {
    if (!projetoId) { toast.error('Selecione um projeto'); return; }
    if (titulo.trim().length < 3) { toast.error('Informe um título'); return; }
    const primeiraColuna = colunas[0]?.id;
    if (!primeiraColuna) { toast.error('Projeto sem colunas configuradas'); return; }
    setSalvando(true);
    try {
      const tarefa: any = await upsert.mutateAsync({
        projeto_id: projetoId,
        coluna_id: primeiraColuna,
        titulo,
        descricao: descricao || null,
        prioridade,
        prazo: prazo || null,
        origem_tipo: entidadeTipo,
        origem_id: entidadeId,
      });

      // cria vínculo polimórfico
      if (tarefa?.id && profile?.empresa_id) {
        await supabase.from('projeto_tarefa_vinculos' as any).insert({
          tarefa_id: tarefa.id,
          entidade_tipo: entidadeTipo,
          entidade_id: entidadeId,
          criado_por: user?.id ?? null,
        } as any);
      }

      toast.success('Tarefa criada e vinculada');
      setOpen(false);
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao criar tarefa');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <>
      {trigger ? (
        <span onClick={() => setOpen(true)}>{trigger}</span>
      ) : (
        <Button variant={variant} size={size} onClick={() => setOpen(true)}>
          <ListTodo className="h-4 w-4" /> Criar tarefa de projeto
        </Button>
      )}

      <DialogShell
        open={open}
        onOpenChange={setOpen}
        icon={ListTodo}
        title="Criar tarefa em um projeto"
        description="A tarefa será criada e vinculada automaticamente a este item."
        size="sm"
        onSubmit={handleSalvar}
        submitLabel="Criar tarefa"
        isSubmitting={salvando}
      >
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Projeto</Label>
              <Select value={projetoId} onValueChange={setProjetoId}>
                <SelectTrigger><SelectValue placeholder="Selecione um projeto ativo" /></SelectTrigger>
                <SelectContent>
                  {ativos.length === 0 && <div className="px-3 py-2 text-sm text-muted-foreground">Nenhum projeto ativo</div>}
                  {ativos.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Título</Label>
              <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Prioridade</Label>
                <Select value={prioridade} onValueChange={(v) => setPrioridade(v as ProjetoTarefaPrioridade)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(['baixa', 'media', 'alta', 'critica'] as ProjetoTarefaPrioridade[]).map(p => (
                      <SelectItem key={p} value={p}>{PRIORIDADE_LABEL[p]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Prazo</Label>
                <Input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
              </div>
            </div>

          </div>
      </DialogShell>
    </>
  );
};
