
import { useState, useEffect } from "react";
import { DialogShell } from "@/components/ui/dialog-shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClipboardCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface ControleTeste {
  id: string;
  controle_id: string;
  data_teste: string;
  resultado: string;
  observacoes?: string;
  evidencias?: string;
  testador?: string;
  proxima_avaliacao?: string;
}

interface ControlesTestesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  controle: { id: string; nome: string } | null;
  teste?: ControleTeste | null;
}

export default function ControlesTestesDialog({ open, onOpenChange, controle, teste }: ControlesTestesDialogProps) {
  const emptyForm = {
    data_teste: new Date().toISOString().split('T')[0],
    resultado: "eficaz",
    observacoes: "",
    evidencias: "",
    testador: "",
    proxima_avaliacao: ""
  };
  const [formData, setFormData] = useState(emptyForm);
  const [isDirty, setIsDirty] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (teste) {
      setFormData({
        data_teste: teste.data_teste || new Date().toISOString().split('T')[0],
        resultado: teste.resultado || "eficaz",
        observacoes: teste.observacoes || "",
        evidencias: teste.evidencias || "",
        testador: teste.testador || "",
        proxima_avaliacao: teste.proxima_avaliacao || ""
      });
    } else {
      setFormData(emptyForm);
    }
    setIsDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teste, open]);

  const update = (patch: Partial<typeof formData>) => {
    setFormData(prev => ({ ...prev, ...patch }));
    setIsDirty(true);
  };

  const saveTesteMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!controle) throw new Error('Controle não selecionado');

      const testeData = {
        ...data,
        controle_id: controle.id,
        data_teste: data.data_teste || null,
        proxima_avaliacao: data.proxima_avaliacao || null
      };

      if (teste) {
        const { error } = await supabase
          .from('controles_testes')
          .update(testeData)
          .eq('id', teste.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('controles_testes')
          .insert([testeData]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['controles_testes'] });
      toast({
        title: teste ? "Teste atualizado" : "Teste registrado",
        description: teste ? "O teste foi atualizado com sucesso." : "O teste foi registrado com sucesso.",
      });
      setIsDirty(false);
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: `Não foi possível ${teste ? 'atualizar' : 'registrar'} o teste: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  const handleSubmit = () => {
    if (!formData.data_teste || !formData.resultado) {
      toast({
        title: "Erro",
        description: "Data do teste e resultado são obrigatórios.",
        variant: "destructive",
      });
      return;
    }
    saveTesteMutation.mutate(formData);
  };

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={ClipboardCheck}
      title={teste ? "Editar Teste" : "Novo Teste"}
      description={controle?.nome}
      size="md"
      onSubmit={handleSubmit}
      submitLabel={teste ? "Atualizar" : "Registrar"}
      isSubmitting={saveTesteMutation.isPending}
      isDirty={isDirty}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="data_teste">Data do Teste *</Label>
            <Input
              id="data_teste"
              type="date"
              value={formData.data_teste}
              onChange={(e) => update({ data_teste: e.target.value })}
              required
            />
          </div>

          <div>
            <Label htmlFor="resultado">Resultado *</Label>
            <Select value={formData.resultado} onValueChange={(value) => update({ resultado: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="eficaz">Eficaz</SelectItem>
                <SelectItem value="ineficaz">Ineficaz</SelectItem>
                <SelectItem value="parcialmente_eficaz">Parcialmente Eficaz</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="testador">Testador</Label>
            <Input
              id="testador"
              value={formData.testador}
              onChange={(e) => update({ testador: e.target.value })}
              placeholder="Nome do testador"
            />
          </div>

          <div>
            <Label htmlFor="proxima_avaliacao">Próxima Avaliação</Label>
            <Input
              id="proxima_avaliacao"
              type="date"
              value={formData.proxima_avaliacao}
              onChange={(e) => update({ proxima_avaliacao: e.target.value })}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="observacoes">Observações</Label>
          <Textarea
            id="observacoes"
            value={formData.observacoes}
            onChange={(e) => update({ observacoes: e.target.value })}
            placeholder="Detalhes sobre o teste realizado"
            rows={3}
          />
        </div>

        <div>
          <Label htmlFor="evidencias">Evidências</Label>
          <Textarea
            id="evidencias"
            value={formData.evidencias}
            onChange={(e) => update({ evidencias: e.target.value })}
            placeholder="Links ou referências das evidências coletadas"
            rows={2}
          />
        </div>
      </div>
    </DialogShell>
  );
}
