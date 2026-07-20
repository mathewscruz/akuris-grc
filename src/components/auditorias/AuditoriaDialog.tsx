
import { useState, useEffect } from "react";
import { DialogShell } from "@/components/ui/dialog-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, ClipboardCheck } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";


interface AuditoriaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  auditoria?: any;
  onSuccess: () => void;
}

const AuditoriaDialog = ({ open, onOpenChange, auditoria, onSuccess }: AuditoriaDialogProps) => {
  const [formData, setFormData] = useState({
    nome: '',
    descricao: '',
    tipo: '',
    status: 'planejamento',
    prioridade: 'media',
    auditor_equipe: [] as string[],
    data_inicio: null as Date | null,
    data_fim_prevista: null as Date | null,
    escopo: '',
    objetivos: '',
    metodologia: '',
    framework: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (auditoria) {
      setFormData({
        nome: auditoria.nome || '',
        descricao: auditoria.descricao || '',
        tipo: auditoria.tipo || '',
        status: auditoria.status || 'planejamento',
        prioridade: auditoria.prioridade || 'media',
        
        auditor_equipe: auditoria.auditor_equipe || [],
        data_inicio: auditoria.data_inicio ? new Date(auditoria.data_inicio) : null,
        data_fim_prevista: auditoria.data_fim_prevista ? new Date(auditoria.data_fim_prevista) : null,
        escopo: auditoria.escopo || '',
        objetivos: auditoria.objetivos || '',
        metodologia: auditoria.metodologia || '',
        framework: auditoria.framework || ''
      });
    } else {
      setFormData({
        nome: '',
        descricao: '',
        tipo: '',
        status: 'planejamento',
        prioridade: 'media',
        
        auditor_equipe: [],
        data_inicio: null,
        data_fim_prevista: null,
        escopo: '',
        objetivos: '',
        metodologia: '',
        framework: ''
      });
    }
    setErrors({});
  }, [auditoria]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.nome.trim()) {
      newErrors.nome = 'Nome é obrigatório';
    }

    if (!formData.tipo) {
      newErrors.tipo = 'Tipo é obrigatório';
    }

    if (formData.data_inicio && formData.data_fim_prevista) {
      if (formData.data_fim_prevista <= formData.data_inicio) {
        newErrors.data_fim_prevista = 'Data de conclusão deve ser posterior à data de início';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast.error('Por favor, corrija os erros no formulário');
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Usuário não autenticado');
        setIsSubmitting(false);
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('empresa_id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.empresa_id) {
        toast.error('Erro ao obter dados da empresa');
        setIsSubmitting(false);
        return;
      }

      const auditoriaData = {
        ...formData,
        empresa_id: profile.empresa_id,
        data_inicio: formData.data_inicio?.toISOString().split('T')[0] || null,
        data_fim_prevista: formData.data_fim_prevista?.toISOString().split('T')[0] || null,
        
      };

      if (auditoria) {
        const { error } = await supabase
          .from('auditorias')
          .update(auditoriaData)
          .eq('id', auditoria.id);

        if (error) throw error;
        toast.success('Auditoria atualizada com sucesso');
      } else {
        const { error } = await supabase
          .from('auditorias')
          .insert(auditoriaData);

        if (error) throw error;
        toast.success('Auditoria criada com sucesso');
      }

      onSuccess();
    } catch (error) {
      console.error('Erro ao salvar auditoria:', error);
      toast.error('Erro ao salvar auditoria');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DialogShell
        open={open}
        onOpenChange={onOpenChange}
        title={`${auditoria?.id ? "Editar" : "Nova"} Auditoria`}
        icon={ClipboardCheck}
        size="lg"
        onSubmit={() => handleSubmit({ preventDefault: () => {} } as React.FormEvent)}
        submitLabel={auditoria ? 'Atualizar' : 'Criar'}
        isSubmitting={isSubmitting}
      >
<form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome da Auditoria *</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                className={errors.nome ? "border-red-500" : ""}
              />
              {errors.nome && <p className="text-sm text-red-500">{errors.nome}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="tipo">Tipo *</Label>
              <Select
                value={formData.tipo}
                onValueChange={(value) => setFormData({ ...formData, tipo: value })}
              >
                <SelectTrigger className={errors.tipo ? "border-red-500" : ""}>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="interna">Auditoria Interna</SelectItem>
                  <SelectItem value="externa">Auditoria Externa</SelectItem>
                  <SelectItem value="compliance">Compliance</SelectItem>
                  <SelectItem value="operacional">Operacional</SelectItem>
                  <SelectItem value="ti">Auditoria de TI</SelectItem>
                </SelectContent>
              </Select>
              {errors.tipo && <p className="text-sm text-red-500">{errors.tipo}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="planejamento">Planejamento</SelectItem>
                  <SelectItem value="em_andamento">Em Andamento</SelectItem>
                  <SelectItem value="concluida">Concluída</SelectItem>
                  <SelectItem value="cancelada">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="prioridade">Prioridade</Label>
              <Select
                value={formData.prioridade}
                onValueChange={(value) => setFormData({ ...formData, prioridade: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixa">Baixa</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="critica">Crítica</SelectItem>
                </SelectContent>
              </Select>
            </div>


            <div className="space-y-2">
              <Label htmlFor="framework">Framework</Label>
              <Select
                value={formData.framework}
                onValueChange={(value) => setFormData({ ...formData, framework: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o framework" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="COSO">COSO</SelectItem>
                  <SelectItem value="ISO27001">ISO 27001</SelectItem>
                  <SelectItem value="SOX">Sarbanes-Oxley</SelectItem>
                  <SelectItem value="COBIT">COBIT</SelectItem>
                  <SelectItem value="Personalizado">Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Data de Início</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.data_inicio ? format(formData.data_inicio, "PPP", { locale: ptBR }) : "Selecione a data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={formData.data_inicio || undefined}
                    onSelect={(date) => setFormData({ ...formData, data_inicio: date || null })}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Data de Conclusão Prevista</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button 
                    variant="outline" 
                    className={`w-full justify-start text-left font-normal ${errors.data_fim_prevista ? "border-red-500" : ""}`}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.data_fim_prevista ? format(formData.data_fim_prevista, "PPP", { locale: ptBR }) : "Selecione a data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={formData.data_fim_prevista || undefined}
                    onSelect={(date) => setFormData({ ...formData, data_fim_prevista: date || null })}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              {errors.data_fim_prevista && <p className="text-sm text-red-500">{errors.data_fim_prevista}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea
              id="descricao"
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="escopo">Escopo da Auditoria</Label>
            <Textarea
              id="escopo"
              value={formData.escopo}
              onChange={(e) => setFormData({ ...formData, escopo: e.target.value })}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="objetivos">Objetivos</Label>
            <Textarea
              id="objetivos"
              value={formData.objetivos}
              onChange={(e) => setFormData({ ...formData, objetivos: e.target.value })}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="metodologia">Metodologia</Label>
            <Textarea
              id="metodologia"
              value={formData.metodologia}
              onChange={(e) => setFormData({ ...formData, metodologia: e.target.value })}
              rows={3}
            />
          </div>

        </form>
      </DialogShell>
  );
};

export default AuditoriaDialog;
