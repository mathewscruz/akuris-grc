import { useState, useEffect } from "react";
import { DialogShell } from "@/components/ui/dialog-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, FileText } from "lucide-react";
import { format, parse } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatDateForInput, parseDateForDB } from "@/lib/date-utils";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { useLanguage } from "@/contexts/LanguageContext";
import { RopaCamposDetalhados } from "@/components/dados/RopaCamposDetalhados";

interface RopaDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  ropa?: any;
}

export function RopaDialog({ isOpen, onClose, onSave, ropa }: RopaDialogProps) {
  const { t } = useLanguage();
  const [formData, setFormData] = useState({
    nome_tratamento: ropa?.nome_tratamento || "",
    finalidade: ropa?.finalidade || "",
    base_legal: ropa?.base_legal || "",
    categoria_titulares: ropa?.categoria_titulares || "",
    origem_dados: ropa?.origem_dados || "",
    compartilhamento_dados: ropa?.compartilhamento_dados || "",
    transferencia_internacional: ropa?.transferencia_internacional || false,
    pais_destino: ropa?.pais_destino || "",
    adequacao_destino: ropa?.adequacao_destino || "",
    prazo_retencao: ropa?.prazo_retencao || "",
    medidas_seguranca: ropa?.medidas_seguranca || "",
    responsavel_tratamento: ropa?.responsavel_tratamento || "",
    encarregado_dados: ropa?.encarregado_dados || "",
    controlador_conjunto: ropa?.controlador_conjunto || "",
    operador_dados: ropa?.operador_dados || "",
    data_inicio: ropa?.data_inicio ? new Date(ropa.data_inicio) : undefined,
    data_fim: ropa?.data_fim ? new Date(ropa.data_fim) : undefined,
    status: ropa?.status || "ativo",
    observacoes: ropa?.observacoes || "",
    codigo: ropa?.codigo || "",
    area_responsavel: ropa?.area_responsavel || "",
    dados_tratados: ropa?.dados_tratados || "",
    categoria_dados: ropa?.categoria_dados || "",
    fonte_dados: ropa?.fonte_dados || "",
    descricao_atividade: ropa?.descricao_atividade || "",
    operacoes_realizadas: ropa?.operacoes_realizadas || "",
    decisao_automatizada_detalhes: ropa?.decisao_automatizada_detalhes || "",
    justificativa_base_legal: ropa?.justificativa_base_legal || "",
    compartilhamento_interno: ropa?.compartilhamento_interno || "",
    compartilhamento_externo: ropa?.compartilhamento_externo || "",
    transferencia_detalhes: ropa?.transferencia_detalhes || "",
    criterio_descarte: ropa?.criterio_descarte || "",
    risco_probabilidade: ropa?.risco_probabilidade || "",
    risco_impacto: ropa?.risco_impacto || "",
    risco_nivel: ropa?.risco_nivel || "",
    evidencias_documentos: ropa?.evidencias_documentos || "",
    versao: ropa?.versao || "v1"
  });
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { empresaId } = useEmpresaId();

  useEffect(() => {
    if (isOpen) {
      loadUsuarios();
    }
  }, [isOpen]);

  const loadUsuarios = async () => {
    if (!empresaId) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, nome, email')
        .eq('empresa_id', empresaId)
        .order('nome');
      
      if (error) throw error;
      setUsuarios(data || []);
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
    }
  };

  const handleSave = async () => {
    try {
      setIsLoading(true);
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('empresa_id')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (!profile?.empresa_id) {
        throw new Error(t('dadosDashboard.common.errorEmpresaNaoEncontrada'));
      }

      const detalhesDecisao = (formData.decisao_automatizada_detalhes || '').trim().toLowerCase();
      const payload = {
        ...formData,
        decisao_automatizada: detalhesDecisao.length > 0 && !detalhesDecisao.startsWith('não') && !detalhesDecisao.startsWith('nao') && !detalhesDecisao.startsWith('no'),
        risco_probabilidade: formData.risco_probabilidade || null,
        risco_impacto: formData.risco_impacto || null,
        risco_nivel: formData.risco_nivel || null,
        data_inicio: formData.data_inicio ? parseDateForDB(format(formData.data_inicio, 'yyyy-MM-dd')) : null,
        data_fim: formData.data_fim ? parseDateForDB(format(formData.data_fim, 'yyyy-MM-dd')) : null,
        empresa_id: profile.empresa_id,
        ...(ropa?.id ? {} : { created_by: (await supabase.auth.getUser()).data.user?.id })
      };

      if (ropa?.id) {
        const { error } = await supabase
          .from('ropa_registros')
          .update(payload)
          .eq('id', ropa.id);
        
        if (error) throw error;
        toast({ title: t('dadosDashboard.ropaDialog.toastUpdated') });
      } else {
        const { error } = await supabase
          .from('ropa_registros')
          .insert([payload]);
        
        if (error) throw error;
        toast({ title: t('dadosDashboard.ropaDialog.toastCreated') });
      }
      
      onSave();
      onClose();
    } catch (error: any) {
      toast({
        title: t('dadosDashboard.ropaDialog.toastErrorTitle'),
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DialogShell
        open={isOpen}
        onOpenChange={onClose}
        title={ropa?.id ? t('dadosDashboard.ropaDialog.titleEdit') : t('dadosDashboard.ropaDialog.titleNew')}
        icon={FileText}
        size="xl"
        onSubmit={handleSave}
      >
<div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nome_tratamento">{t('dadosDashboard.ropaDialog.labelNomeTratamento')}</Label>
              <Input
                id="nome_tratamento"
                value={formData.nome_tratamento}
                onChange={(e) => setFormData({ ...formData, nome_tratamento: e.target.value })}
                placeholder={t('dadosDashboard.ropaDialog.placeholderNomeTratamento')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="categoria_titulares">{t('dadosDashboard.ropaDialog.labelCategoriaTitulares')}</Label>
              <Select value={formData.categoria_titulares} onValueChange={(value) => setFormData({ ...formData, categoria_titulares: value })}>
                <SelectTrigger>
                  <SelectValue placeholder={t('dadosDashboard.ropaDialog.placeholderCategoriaTitulares')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="clientes">{t('dadosDashboard.ropaDialog.categoriaClientes')}</SelectItem>
                  <SelectItem value="funcionarios">{t('dadosDashboard.ropaDialog.categoriaFuncionarios')}</SelectItem>
                  <SelectItem value="fornecedores">{t('dadosDashboard.ropaDialog.categoriaFornecedores')}</SelectItem>
                  <SelectItem value="prospects">{t('dadosDashboard.ropaDialog.categoriaProspects')}</SelectItem>
                  <SelectItem value="parceiros">{t('dadosDashboard.ropaDialog.categoriaParceiros')}</SelectItem>
                  <SelectItem value="visitantes">{t('dadosDashboard.ropaDialog.categoriaVisitantes')}</SelectItem>
                  <SelectItem value="outros">{t('dadosDashboard.ropaDialog.categoriaOutros')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="finalidade">{t('dadosDashboard.ropaDialog.labelFinalidade')}</Label>
            <Textarea
              id="finalidade"
              value={formData.finalidade}
              onChange={(e) => setFormData({ ...formData, finalidade: e.target.value })}
              placeholder={t('dadosDashboard.ropaDialog.placeholderFinalidade')}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="base_legal">{t('dadosDashboard.ropaDialog.labelBaseLegal')}</Label>
              <Select value={formData.base_legal} onValueChange={(value) => setFormData({ ...formData, base_legal: value })}>
                <SelectTrigger>
                  <SelectValue placeholder={t('dadosDashboard.ropaDialog.placeholderBaseLegal')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="consentimento">{t('dadosDashboard.common.baseLegalConsentimento')}</SelectItem>
                  <SelectItem value="legitimo_interesse">{t('dadosDashboard.common.baseLegalLegitimoInteresse')}</SelectItem>
                  <SelectItem value="execucao_contrato">{t('dadosDashboard.common.baseLegalExecucaoContrato')}</SelectItem>
                  <SelectItem value="cumprimento_obrigacao">{t('dadosDashboard.common.baseLegalCumprimentoObrigacao')}</SelectItem>
                  <SelectItem value="protecao_vida">{t('dadosDashboard.common.baseLegalProtecaoVida')}</SelectItem>
                  <SelectItem value="exercicio_direitos">{t('dadosDashboard.common.baseLegalExercicioDireitos')}</SelectItem>
                  <SelectItem value="politicas_publicas">{t('dadosDashboard.common.baseLegalPoliticasPublicas')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="origem_dados">{t('dadosDashboard.ropaDialog.labelOrigemDados')}</Label>
              <Select value={formData.origem_dados} onValueChange={(value) => setFormData({ ...formData, origem_dados: value })}>
                <SelectTrigger>
                  <SelectValue placeholder={t('dadosDashboard.ropaDialog.placeholderOrigemDados')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="diretamente_titular">{t('dadosDashboard.ropaDialog.origemDiretamenteTitular')}</SelectItem>
                  <SelectItem value="terceiros">{t('dadosDashboard.ropaDialog.origemTerceiros')}</SelectItem>
                  <SelectItem value="publico">{t('dadosDashboard.ropaDialog.origemPublico')}</SelectItem>
                  <SelectItem value="misto">{t('dadosDashboard.ropaDialog.origemMisto')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="compartilhamento_dados">{t('dadosDashboard.ropaDialog.labelCompartilhamentoDados')}</Label>
              <Select value={formData.compartilhamento_dados} onValueChange={(value) => setFormData({ ...formData, compartilhamento_dados: value })}>
                <SelectTrigger>
                  <SelectValue placeholder={t('dadosDashboard.ropaDialog.placeholderCompartilhamentoDados')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nao_compartilha">{t('dadosDashboard.ropaDialog.compartilhamentoNaoCompartilha')}</SelectItem>
                  <SelectItem value="interno">{t('dadosDashboard.ropaDialog.compartilhamentoInterno')}</SelectItem>
                  <SelectItem value="terceiros">{t('dadosDashboard.ropaDialog.compartilhamentoTerceiros')}</SelectItem>
                  <SelectItem value="subsidiarias">{t('dadosDashboard.ropaDialog.compartilhamentoSubsidiarias')}</SelectItem>
                  <SelectItem value="parceiros">{t('dadosDashboard.ropaDialog.compartilhamentoParceiros')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="prazo_retencao">{t('dadosDashboard.ropaDialog.labelPrazoRetencao')}</Label>
              <Input
                id="prazo_retencao"
                value={formData.prazo_retencao}
                onChange={(e) => setFormData({ ...formData, prazo_retencao: e.target.value })}
                placeholder={t('dadosDashboard.ropaDialog.placeholderPrazoRetencao')}
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="transferencia_internacional"
              checked={formData.transferencia_internacional}
              onCheckedChange={(checked) => setFormData({ ...formData, transferencia_internacional: !!checked })}
            />
            <Label htmlFor="transferencia_internacional">{t('dadosDashboard.ropaDialog.labelTransferenciaInternacional')}</Label>
          </div>

          {formData.transferencia_internacional && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="pais_destino">{t('dadosDashboard.ropaDialog.labelPaisDestino')}</Label>
                <Input
                  id="pais_destino"
                  value={formData.pais_destino}
                  onChange={(e) => setFormData({ ...formData, pais_destino: e.target.value })}
                  placeholder={t('dadosDashboard.ropaDialog.placeholderPaisDestino')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="adequacao_destino">{t('dadosDashboard.ropaDialog.labelAdequacaoDestino')}</Label>
                <Select value={formData.adequacao_destino} onValueChange={(value) => setFormData({ ...formData, adequacao_destino: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('dadosDashboard.ropaDialog.placeholderAdequacaoDestino')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="adequado">{t('dadosDashboard.ropaDialog.adequacaoAdequado')}</SelectItem>
                    <SelectItem value="garantias">{t('dadosDashboard.ropaDialog.adequacaoGarantias')}</SelectItem>
                    <SelectItem value="autorizacao_anpd">{t('dadosDashboard.ropaDialog.adequacaoAutorizacaoAnpd')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="responsavel_tratamento">{t('dadosDashboard.ropaDialog.labelResponsavelTratamento')}</Label>
              <Select value={formData.responsavel_tratamento} onValueChange={(value) => setFormData({ ...formData, responsavel_tratamento: value })}>
                <SelectTrigger>
                  <SelectValue placeholder={t('dadosDashboard.ropaDialog.placeholderResponsavelTratamento')} />
                </SelectTrigger>
                <SelectContent>
                  {usuarios.map((usuario) => (
                    <SelectItem key={usuario.user_id} value={usuario.user_id}>
                      {usuario.nome} ({usuario.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="encarregado_dados">{t('dadosDashboard.ropaDialog.labelEncarregadoDados')}</Label>
              <Select value={formData.encarregado_dados} onValueChange={(value) => setFormData({ ...formData, encarregado_dados: value })}>
                <SelectTrigger>
                  <SelectValue placeholder={t('dadosDashboard.ropaDialog.placeholderEncarregadoDados')} />
                </SelectTrigger>
                <SelectContent>
                  {usuarios.map((usuario) => (
                    <SelectItem key={usuario.user_id} value={usuario.user_id}>
                      {usuario.nome} ({usuario.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('dadosDashboard.ropaDialog.labelDataInicio')}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.data_inicio ? format(formData.data_inicio, "dd/MM/yyyy", { locale: ptBR }) : t('dadosDashboard.ropaDialog.placeholderSelecionarData')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={formData.data_inicio}
                    onSelect={(date) => setFormData({ ...formData, data_inicio: date })}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>{t('dadosDashboard.ropaDialog.labelDataFim')}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.data_fim ? format(formData.data_fim, "dd/MM/yyyy", { locale: ptBR }) : t('dadosDashboard.ropaDialog.placeholderSelecionarData')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={formData.data_fim}
                    onSelect={(date) => setFormData({ ...formData, data_fim: date })}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="medidas_seguranca">{t('dadosDashboard.ropaDialog.labelMedidasSeguranca')}</Label>
            <Textarea
              id="medidas_seguranca"
              value={formData.medidas_seguranca}
              onChange={(e) => setFormData({ ...formData, medidas_seguranca: e.target.value })}
              placeholder={t('dadosDashboard.ropaDialog.placeholderMedidasSeguranca')}
            />
          </div>

          <div className="rounded-lg border border-border/60 p-4">
            <RopaCamposDetalhados
              values={formData}
              onChange={(key, value) => setFormData((prev) => ({ ...prev, [key]: value }))}
            />
          </div>


          <div className="space-y-2">
            <Label htmlFor="observacoes">{t('dadosDashboard.ropaDialog.labelObservacoes')}</Label>
            <Textarea
              id="observacoes"
              value={formData.observacoes}
              onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
              placeholder={t('dadosDashboard.ropaDialog.placeholderObservacoes')}
            />
          </div>
        </div>

        </DialogShell>
  );
}