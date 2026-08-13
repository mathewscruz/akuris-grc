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
import { useLanguage } from "@/contexts/LanguageContext";

interface RopaWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  preSelectedDadoId?: string;
}

export function RopaWizard({ isOpen, onClose, onSave, preSelectedDadoId }: RopaWizardProps) {
  const { t } = useLanguage();
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

      if (!profile?.empresa_id) throw new Error(t('dadosDashboard.ropaWizard.errorEmpresaNaoEncontrada'));

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

      toast({ title: t('dadosDashboard.ropaWizard.toastSuccessTitle'), description: t('dadosDashboard.ropaWizard.toastSuccessDescription', { count: selectedDados.length }) });
      onSave();
      onClose();
      resetWizard();
    } catch (error: any) {
      toast({
        title: t('dadosDashboard.ropaWizard.toastErrorTitle'),
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
      title={t('dadosDashboard.ropaWizard.dialogTitle')}
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
            {step === 1 ? t('dadosDashboard.ropaWizard.buttonCancelar') : t('dadosDashboard.ropaWizard.buttonVoltar')}
          </Button>

          {step < 4 ? (
            <Button size="sm" onClick={() => setStep(step + 1)} disabled={!canProceed()}>
              {t('dadosDashboard.ropaWizard.buttonProximo')}
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button size="sm" onClick={handleSave} disabled={isLoading}>
              <Check className="h-4 w-4 mr-1" />
              {isLoading ? t('dadosDashboard.ropaWizard.buttonCriando') : t('dadosDashboard.ropaWizard.buttonCriarRopa')}
            </Button>
          )}
        </div>
      }
    >
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground mb-1">
              <span>{t('dadosDashboard.ropaWizard.stepLabel', { step })}</span>
              <span>{Math.round((step / 4) * 100)}%</span>
            </div>
            <Progress value={(step / 4) * 100} />
          </div>

          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">{t('dadosDashboard.ropaWizard.step1Title')}</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {t('dadosDashboard.ropaWizard.step1Description')}
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
                  {selectedDados.length} {t('dadosDashboard.ropaWizard.step1SelectedSuffix')}
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">{t('dadosDashboard.ropaWizard.step2Title')}</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {t('dadosDashboard.ropaWizard.step2Description')}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="nome_tratamento">{t('dadosDashboard.ropaWizard.labelNomeTratamento')}</Label>
                <Input
                  id="nome_tratamento"
                  value={formData.nome_tratamento}
                  onChange={(e) => setFormData({ ...formData, nome_tratamento: e.target.value })}
                  placeholder={t('dadosDashboard.ropaWizard.placeholderNomeTratamento')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="finalidade">{t('dadosDashboard.ropaWizard.labelFinalidade')}</Label>
                <Textarea
                  id="finalidade"
                  value={formData.finalidade}
                  onChange={(e) => setFormData({ ...formData, finalidade: e.target.value })}
                  placeholder={t('dadosDashboard.ropaWizard.placeholderFinalidade')}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="base_legal">{t('dadosDashboard.ropaWizard.labelBaseLegal')}</Label>
                  <Select value={formData.base_legal} onValueChange={(value) => setFormData({ ...formData, base_legal: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('dadosDashboard.ropaWizard.placeholderSelecione')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="consentimento">{t('dadosDashboard.ropaWizard.baseLegalConsentimento')}</SelectItem>
                      <SelectItem value="legitimo_interesse">{t('dadosDashboard.ropaWizard.baseLegalLegitimoInteresse')}</SelectItem>
                      <SelectItem value="execucao_contrato">{t('dadosDashboard.ropaWizard.baseLegalExecucaoContrato')}</SelectItem>
                      <SelectItem value="cumprimento_obrigacao">{t('dadosDashboard.ropaWizard.baseLegalObrigacaoLegal')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="categoria_titulares">{t('dadosDashboard.ropaWizard.labelCategoriaTitulares')}</Label>
                  <Select value={formData.categoria_titulares} onValueChange={(value) => setFormData({ ...formData, categoria_titulares: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('dadosDashboard.ropaWizard.placeholderSelecione')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="clientes">{t('dadosDashboard.ropaWizard.categoriaClientes')}</SelectItem>
                      <SelectItem value="funcionarios">{t('dadosDashboard.ropaWizard.categoriaFuncionarios')}</SelectItem>
                      <SelectItem value="fornecedores">{t('dadosDashboard.ropaWizard.categoriaFornecedores')}</SelectItem>
                      <SelectItem value="prospects">{t('dadosDashboard.ropaWizard.categoriaProspects')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="prazo_retencao">{t('dadosDashboard.ropaWizard.labelPrazoRetencao')}</Label>
                <Input
                  id="prazo_retencao"
                  value={formData.prazo_retencao}
                  onChange={(e) => setFormData({ ...formData, prazo_retencao: e.target.value })}
                  placeholder={t('dadosDashboard.ropaWizard.placeholderPrazoRetencao')}
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">{t('dadosDashboard.ropaWizard.step3Title')}</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {t('dadosDashboard.ropaWizard.step3Description')}
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
                  {selectedAtivos.length} {t('dadosDashboard.ropaWizard.step3SelectedSuffix')}
                </div>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">{t('dadosDashboard.ropaWizard.step4Title')}</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {t('dadosDashboard.ropaWizard.step4Description')}
                </p>
              </div>

              <div className="space-y-3 border rounded-lg p-4">
                <div>
                  <Label className="text-muted-foreground">{t('dadosDashboard.ropaWizard.labelNomeTratamentoReview')}</Label>
                  <p className="font-medium">{formData.nome_tratamento}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">{t('dadosDashboard.ropaWizard.labelDadosVinculados')}</Label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {selectedDados.map(id => {
                      const dado = dadosPessoais.find(d => d.id === id);
                      return <StatusBadge key={id} size="sm" tone="neutral">{dado?.nome}</StatusBadge>;
                    })}
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">{t('dadosDashboard.ropaWizard.labelAtivosVinculados')}</Label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {selectedAtivos.length > 0 ? (
                      selectedAtivos.map(id => {
                        const ativo = ativos.find(a => a.id === id);
                        return <StatusBadge key={id} size="sm" tone="neutral" variant="outline">{ativo?.nome}</StatusBadge>;
                      })
                    ) : (
                      <span className="text-sm text-muted-foreground">{t('dadosDashboard.ropaWizard.nenhumAtivoVinculado')}</span>
                    )}
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">{t('dadosDashboard.ropaWizard.labelBaseLegalReview')}</Label>
                  <p className="font-medium">{formData.base_legal}</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="medidas_seguranca">{t('dadosDashboard.ropaWizard.labelMedidasSegurancaOpcional')}</Label>
                <Textarea
                  id="medidas_seguranca"
                  value={formData.medidas_seguranca}
                  onChange={(e) => setFormData({ ...formData, medidas_seguranca: e.target.value })}
                  placeholder={t('dadosDashboard.ropaWizard.placeholderMedidasSeguranca')}
                  rows={3}
                />
              </div>
            </div>
          )}

        </div>
    </DialogShell>
  );
}
