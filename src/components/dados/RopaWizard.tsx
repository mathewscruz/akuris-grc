import { useState, useEffect } from "react";
import { DialogShell } from "@/components/ui/dialog-shell";
import { ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";
import { formatStatus } from "@/lib/text-utils";
import { StatusBadge } from "@/components/ui/status-badge";
import { resolveCriticidadeTone, resolveSensibilidadeTone } from "@/lib/status-tone";

interface RopaWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  preSelectedDadoId?: string;
}

export function RopaWizard({ isOpen, onClose, onSave, preSelectedDadoId }: RopaWizardProps) {
  const { empresaId } = useEmpresaId();
  const [step, setStep] = useState(1);
  const [selectedDados, setSelectedDados] = useState<string[]>(preSelectedDadoId ? [preSelectedDadoId] : []);
  const [selectedAtivos, setSelectedAtivos] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    nome_tratamento: "",
    finalidade: "",
    base_legal: "",
    categoria_titulares: "",
    prazo_retencao: "",
    medidas_seguranca: "",
    status: "ativo"
  });
  const [dadosPessoais, setDadosPessoais] = useState<any[]>([]);
  const [ativos, setAtivos] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      loadDados();
      loadAtivos();
    }
  }, [isOpen]);

  const loadDados = async () => {
    if (!empresaId) return;
    const { data } = await supabase
      .from('dados_pessoais')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('nome');
    setDadosPessoais(data || []);
  };

  const loadAtivos = async () => {
    if (!empresaId) return;
    const { data } = await supabase
      .from('ativos')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('nome');
    setAtivos(data || []);
  };

  const handleSave = async () => {
    try {
      setIsLoading(true);
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('empresa_id, user_id')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (!profile?.empresa_id) throw new Error('Empresa não encontrada');

      // Criar ROPA
      const { data: ropa, error: ropaError } = await supabase
        .from('ropa_registros')
        .insert([{
          ...formData,
          empresa_id: profile.empresa_id,
          created_by: profile.user_id
        }])
        .select()
        .single();

      if (ropaError) throw ropaError;

      // Vincular dados pessoais
      if (selectedDados.length > 0) {
        const vinculacoes = selectedDados.map(dado_id => ({
          ropa_id: ropa.id,
          dados_pessoais_id: dado_id
        }));
        
        const { error: vinculoError } = await supabase
          .from('ropa_dados_vinculados')
          .insert(vinculacoes);
        
        if (vinculoError) throw vinculoError;
      }

      // Criar mapeamentos com ativos (se selecionados)
      if (selectedAtivos.length > 0 && selectedDados.length > 0) {
        const mapeamentos = [];
        for (const dadoId of selectedDados) {
          for (const ativoId of selectedAtivos) {
            mapeamentos.push({
              dados_pessoais_id: dadoId,
              ativo_id: ativoId,
              tipo_armazenamento: 'primario',
              observacoes: `Vinculado via ROPA: ${formData.nome_tratamento}`
            });
          }
        }

        const { error: mapError } = await supabase
          .from('dados_mapeamento')
          .insert(mapeamentos);
        
        if (mapError) console.error('Erro ao criar mapeamentos:', mapError);
      }

      toast({ title: "ROPA criado com sucesso!", description: `${selectedDados.length} dados vinculados` });
      onSave();
      onClose();
      resetWizard();
    } catch (error: any) {
      toast({
        title: "Erro ao criar ROPA",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resetWizard = () => {
    setStep(1);
    setSelectedDados(preSelectedDadoId ? [preSelectedDadoId] : []);
    setSelectedAtivos([]);
    setFormData({
      nome_tratamento: "",
      finalidade: "",
      base_legal: "",
      categoria_titulares: "",
      prazo_retencao: "",
      medidas_seguranca: "",
      status: "ativo"
    });
  };

  const toggleDado = (id: string) => {
    setSelectedDados(prev =>
      prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]
    );
  };

  const toggleAtivo = (id: string) => {
    setSelectedAtivos(prev =>
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    );
  };

  const canProceed = () => {
    if (step === 1) return selectedDados.length > 0;
    if (step === 2) return formData.nome_tratamento && formData.finalidade && formData.base_legal;
    if (step === 3) return true; // Ativos são opcionais
    return false;
  };

  return (
    <DialogShell
      open={isOpen}
      onOpenChange={onClose}
      icon={ClipboardList}
      title="Novo ROPA — Wizard Guiado"
      size="lg"
      footer={
        <div className="flex justify-between w-full">
          <Button
            variant="outline"
            size="sm"
            onClick={() => step === 1 ? onClose() : setStep(step - 1)}
            disabled={isLoading}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            {step === 1 ? 'Cancelar' : 'Voltar'}
          </Button>

          {step < 4 ? (
            <Button size="sm" onClick={() => setStep(step + 1)} disabled={!canProceed()}>
              Próximo
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button size="sm" onClick={handleSave} disabled={isLoading}>
              <Check className="h-4 w-4 mr-1" />
              {isLoading ? 'Criando...' : 'Criar ROPA'}
            </Button>
          )}
        </div>
      }
    >
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground mb-1">
              <span>Etapa {step} de 4</span>
              <span>{Math.round((step / 4) * 100)}%</span>
            </div>
            <Progress value={(step / 4) * 100} />
          </div>

          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Passo 1: Selecione os Dados Pessoais</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Escolha quais dados pessoais serão tratados neste ROPA
                </p>
              </div>
              
              <div className="grid grid-cols-1 gap-2 max-h-[400px] overflow-y-auto border rounded-lg p-4">
                {dadosPessoais.map((dado) => (
                  <div
                    key={dado.id}
                    className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                    onClick={() => toggleDado(dado.id)}
                  >
                    <Checkbox checked={selectedDados.includes(dado.id)} />
                    <div className="flex-1">
                      <div className="font-medium">{dado.nome}</div>
                      <div className="text-sm text-muted-foreground">{dado.categoria_dados}</div>
                    </div>
                    <StatusBadge size="sm" {...resolveSensibilidadeTone(dado.sensibilidade)}>
                      {formatStatus(dado.sensibilidade)}
                    </StatusBadge>
                  </div>
                ))}
              </div>
              
              {selectedDados.length > 0 && (
                <div className="text-sm text-muted-foreground">
                  {selectedDados.length} dado(s) selecionado(s)
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Passo 2: Defina a Finalidade e Base Legal</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Informações principais do tratamento de dados
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="nome_tratamento">Nome do Tratamento *</Label>
                <Input
                  id="nome_tratamento"
                  value={formData.nome_tratamento}
                  onChange={(e) => setFormData({ ...formData, nome_tratamento: e.target.value })}
                  placeholder="Ex: Gestão de clientes"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="finalidade">Finalidade *</Label>
                <Textarea
                  id="finalidade"
                  value={formData.finalidade}
                  onChange={(e) => setFormData({ ...formData, finalidade: e.target.value })}
                  placeholder="Descreva a finalidade específica do tratamento"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="base_legal">Base Legal *</Label>
                  <Select value={formData.base_legal} onValueChange={(value) => setFormData({ ...formData, base_legal: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="consentimento">Consentimento</SelectItem>
                      <SelectItem value="legitimo_interesse">Legítimo Interesse</SelectItem>
                      <SelectItem value="execucao_contrato">Execução de Contrato</SelectItem>
                      <SelectItem value="cumprimento_obrigacao">Obrigação Legal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="categoria_titulares">Categoria de Titulares</Label>
                  <Select value={formData.categoria_titulares} onValueChange={(value) => setFormData({ ...formData, categoria_titulares: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="clientes">Clientes</SelectItem>
                      <SelectItem value="funcionarios">Funcionários</SelectItem>
                      <SelectItem value="fornecedores">Fornecedores</SelectItem>
                      <SelectItem value="prospects">Prospects</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="prazo_retencao">Prazo de Retenção</Label>
                <Input
                  id="prazo_retencao"
                  value={formData.prazo_retencao}
                  onChange={(e) => setFormData({ ...formData, prazo_retencao: e.target.value })}
                  placeholder="Ex: 5 anos após fim do contrato"
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Passo 3: Vincule aos Ativos (Opcional)</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Selecione onde estes dados são armazenados ou processados
                </p>
              </div>
              
              <div className="grid grid-cols-1 gap-2 max-h-[400px] overflow-y-auto border rounded-lg p-4">
                {ativos.map((ativo) => (
                  <div
                    key={ativo.id}
                    className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                    onClick={() => toggleAtivo(ativo.id)}
                  >
                    <Checkbox checked={selectedAtivos.includes(ativo.id)} />
                    <div className="flex-1">
                      <div className="font-medium">{ativo.nome}</div>
                      <div className="text-sm text-muted-foreground">{formatStatus(ativo.tipo)} - {ativo.localizacao}</div>
                    </div>
                    <StatusBadge size="sm" {...resolveCriticidadeTone(ativo.criticidade)}>
                      {formatStatus(ativo.criticidade)}
                    </StatusBadge>
                  </div>
                ))}
              </div>
              
              {selectedAtivos.length > 0 && (
                <div className="text-sm text-muted-foreground">
                  {selectedAtivos.length} ativo(s) selecionado(s)
                </div>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Passo 4: Revisão e Confirmação</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Revise as informações antes de criar o ROPA
                </p>
              </div>

              <div className="space-y-3 border rounded-lg p-4">
                <div>
                  <Label className="text-muted-foreground">Nome do Tratamento</Label>
                  <p className="font-medium">{formData.nome_tratamento}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Dados Pessoais Vinculados</Label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {selectedDados.map(id => {
                      const dado = dadosPessoais.find(d => d.id === id);
                      return <StatusBadge key={id} size="sm" tone="neutral">{dado?.nome}</StatusBadge>;
                    })}
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Ativos Vinculados</Label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {selectedAtivos.length > 0 ? (
                      selectedAtivos.map(id => {
                        const ativo = ativos.find(a => a.id === id);
                        return <StatusBadge key={id} size="sm" tone="neutral" variant="outline">{ativo?.nome}</StatusBadge>;
                      })
                    ) : (
                      <span className="text-sm text-muted-foreground">Nenhum ativo vinculado</span>
                    )}
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Base Legal</Label>
                  <p className="font-medium">{formData.base_legal}</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="medidas_seguranca">Medidas de Segurança (Opcional)</Label>
                <Textarea
                  id="medidas_seguranca"
                  value={formData.medidas_seguranca}
                  onChange={(e) => setFormData({ ...formData, medidas_seguranca: e.target.value })}
                  placeholder="Descreva as medidas de segurança aplicadas"
                  rows={3}
                />
              </div>
            </div>
          )}

        </div>
    </DialogShell>
  );
}
