import { useState, useEffect } from "react";
import { DialogShell } from "@/components/ui/dialog-shell";
import { GitBranch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { logger } from "@/lib/logger";
import { useLanguage } from "@/contexts/LanguageContext";

interface FluxoDadosDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  fluxo?: any;
}

export function FluxoDadosDialog({ isOpen, onClose, onSave, fluxo }: FluxoDadosDialogProps) {
  const { t } = useLanguage();
  const [formData, setFormData] = useState({
    nome_fluxo: fluxo?.nome_fluxo || "",
    dados_pessoais_id: fluxo?.dados_pessoais_id || "",
    sistema_origem: fluxo?.sistema_origem || "",
    sistema_destino: fluxo?.sistema_destino || "",
    tipo_transferencia: fluxo?.tipo_transferencia || "",
    frequencia: fluxo?.frequencia || "",
    volume_aproximado: fluxo?.volume_aproximado || "",
    criptografia_transit: fluxo?.criptografia_transit || false,
    aprovacao_necessaria: fluxo?.aprovacao_necessaria || false,
    responsavel_fluxo: fluxo?.responsavel_fluxo || "",
    mapeamento_campos: fluxo?.mapeamento_campos || "",
    observacoes: fluxo?.observacoes || "",
    status: fluxo?.status || "ativo"
  });
  const [dadosPessoais, setDadosPessoais] = useState<any[]>([]);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { empresaId } = useEmpresaId();

  useEffect(() => {
    if (isOpen) {
      loadDadosPessoais();
      loadUsuarios();
    }
  }, [isOpen]);

  const loadDadosPessoais = async () => {
    try {
      if (!empresaId) return;
      const { data, error } = await supabase
        .from('dados_pessoais')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('nome');
      
      if (error) throw error;
      setDadosPessoais(data || []);
    } catch (error) {
      logger.error('Erro ao carregar dados pessoais', { error });
    }
  };

  const loadUsuarios = async () => {
    try {
      if (!empresaId) return;
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, nome, email')
        .eq('empresa_id', empresaId)
        .eq('ativo', true)
        .order('nome');
      
      if (error) throw error;
      setUsuarios(data || []);
    } catch (error) {
      logger.error('Erro ao carregar usuários', { error });
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

      const payload = {
        ...formData,
        empresa_id: profile.empresa_id,
        mapeamento_campos: formData.mapeamento_campos ? JSON.parse(formData.mapeamento_campos) : null
      };

      if (fluxo?.id) {
        const { error } = await supabase
          .from('dados_fluxos')
          .update(payload)
          .eq('id', fluxo.id);
        
        if (error) throw error;
        toast({ title: t('dadosDashboard.fluxoDadosDialog.toastUpdated') });
      } else {
        const { error } = await supabase
          .from('dados_fluxos')
          .insert([payload]);
        
        if (error) throw error;
        toast({ title: t('dadosDashboard.fluxoDadosDialog.toastCreated') });
      }
      
      onSave();
      onClose();
    } catch (error: any) {
      toast({
        title: t('dadosDashboard.fluxoDadosDialog.toastErrorTitle'),
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
        title={fluxo?.id ? t('dadosDashboard.fluxoDadosDialog.titleEdit') : t('dadosDashboard.fluxoDadosDialog.titleNew')}
        icon={GitBranch}
        size="lg"
        onSubmit={handleSave}
      >
<div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nome_fluxo">{t('dadosDashboard.fluxoDadosDialog.labelNomeFluxo')}</Label>
              <Input
                id="nome_fluxo"
                value={formData.nome_fluxo}
                onChange={(e) => setFormData({ ...formData, nome_fluxo: e.target.value })}
                placeholder={t('dadosDashboard.fluxoDadosDialog.placeholderNomeFluxo')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dados_pessoais_id">{t('dadosDashboard.fluxoDadosDialog.labelDadosPessoais')}</Label>
              <Select value={formData.dados_pessoais_id} onValueChange={(value) => setFormData({ ...formData, dados_pessoais_id: value })}>
                <SelectTrigger>
                  <SelectValue placeholder={t('dadosDashboard.fluxoDadosDialog.placeholderDadosPessoais')} />
                </SelectTrigger>
                <SelectContent>
                  {dadosPessoais.map((dado) => (
                    <SelectItem key={dado.id} value={dado.id}>
                      {dado.nome} ({dado.categoria_dados})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sistema_origem">{t('dadosDashboard.fluxoDadosDialog.labelSistemaOrigem')}</Label>
              <Input
                id="sistema_origem"
                value={formData.sistema_origem}
                onChange={(e) => setFormData({ ...formData, sistema_origem: e.target.value })}
                placeholder={t('dadosDashboard.fluxoDadosDialog.placeholderSistemaOrigem')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sistema_destino">{t('dadosDashboard.fluxoDadosDialog.labelSistemaDestino')}</Label>
              <Input
                id="sistema_destino"
                value={formData.sistema_destino}
                onChange={(e) => setFormData({ ...formData, sistema_destino: e.target.value })}
                placeholder={t('dadosDashboard.fluxoDadosDialog.placeholderSistemaDestino')}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tipo_transferencia">{t('dadosDashboard.fluxoDadosDialog.labelTipoTransferencia')}</Label>
              <Select value={formData.tipo_transferencia} onValueChange={(value) => setFormData({ ...formData, tipo_transferencia: value })}>
                <SelectTrigger>
                  <SelectValue placeholder={t('dadosDashboard.fluxoDadosDialog.placeholderTipoTransferencia')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="api">{t('dadosDashboard.fluxoDadosDialog.tipoApi')}</SelectItem>
                  <SelectItem value="arquivo">{t('dadosDashboard.fluxoDadosDialog.tipoArquivo')}</SelectItem>
                  <SelectItem value="manual">{t('dadosDashboard.fluxoDadosDialog.tipoManual')}</SelectItem>
                  <SelectItem value="automatico">{t('dadosDashboard.fluxoDadosDialog.tipoAutomatico')}</SelectItem>
                  <SelectItem value="etl">{t('dadosDashboard.fluxoDadosDialog.tipoEtl')}</SelectItem>
                  <SelectItem value="sync">{t('dadosDashboard.fluxoDadosDialog.tipoSync')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="frequencia">{t('dadosDashboard.fluxoDadosDialog.labelFrequencia')}</Label>
              <Select value={formData.frequencia} onValueChange={(value) => setFormData({ ...formData, frequencia: value })}>
                <SelectTrigger>
                  <SelectValue placeholder={t('dadosDashboard.fluxoDadosDialog.placeholderFrequencia')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tempo_real">{t('dadosDashboard.fluxoDadosDialog.frequenciaTempoReal')}</SelectItem>
                  <SelectItem value="diaria">{t('dadosDashboard.fluxoDadosDialog.frequenciaDiaria')}</SelectItem>
                  <SelectItem value="semanal">{t('dadosDashboard.fluxoDadosDialog.frequenciaSemanal')}</SelectItem>
                  <SelectItem value="mensal">{t('dadosDashboard.fluxoDadosDialog.frequenciaMensal')}</SelectItem>
                  <SelectItem value="eventual">{t('dadosDashboard.fluxoDadosDialog.frequenciaEventual')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="volume_aproximado">{t('dadosDashboard.fluxoDadosDialog.labelVolumeAproximado')}</Label>
              <Input
                id="volume_aproximado"
                value={formData.volume_aproximado}
                onChange={(e) => setFormData({ ...formData, volume_aproximado: e.target.value })}
                placeholder={t('dadosDashboard.fluxoDadosDialog.placeholderVolumeAproximado')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="responsavel_fluxo">{t('dadosDashboard.fluxoDadosDialog.labelResponsavelFluxo')}</Label>
              <Select value={formData.responsavel_fluxo} onValueChange={(value) => setFormData({ ...formData, responsavel_fluxo: value })}>
                <SelectTrigger>
                  <SelectValue placeholder={t('dadosDashboard.fluxoDadosDialog.placeholderResponsavelFluxo')} />
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
            <div className="flex items-center space-x-2">
              <Checkbox
                id="criptografia_transit"
                checked={formData.criptografia_transit}
                onCheckedChange={(checked) => setFormData({ ...formData, criptografia_transit: !!checked })}
              />
              <Label htmlFor="criptografia_transit">{t('dadosDashboard.fluxoDadosDialog.labelCriptografiaTransit')}</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="aprovacao_necessaria"
                checked={formData.aprovacao_necessaria}
                onCheckedChange={(checked) => setFormData({ ...formData, aprovacao_necessaria: !!checked })}
              />
              <Label htmlFor="aprovacao_necessaria">{t('dadosDashboard.fluxoDadosDialog.labelAprovacaoNecessaria')}</Label>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">{t('dadosDashboard.fluxoDadosDialog.labelStatus')}</Label>
            <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
              <SelectTrigger>
                <SelectValue placeholder={t('dadosDashboard.fluxoDadosDialog.placeholderStatus')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ativo">{t('dadosDashboard.fluxoDadosDialog.statusAtivo')}</SelectItem>
                <SelectItem value="inativo">{t('dadosDashboard.fluxoDadosDialog.statusInativo')}</SelectItem>
                <SelectItem value="suspenso">{t('dadosDashboard.fluxoDadosDialog.statusSuspenso')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="mapeamento_campos">{t('dadosDashboard.fluxoDadosDialog.labelMapeamentoCampos')}</Label>
            <Textarea
              id="mapeamento_campos"
              value={formData.mapeamento_campos}
              onChange={(e) => setFormData({ ...formData, mapeamento_campos: e.target.value })}
              placeholder={t('dadosDashboard.fluxoDadosDialog.placeholderMapeamentoCampos')}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacoes">{t('dadosDashboard.fluxoDadosDialog.labelObservacoes')}</Label>
            <Textarea
              id="observacoes"
              value={formData.observacoes}
              onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
              placeholder={t('dadosDashboard.fluxoDadosDialog.placeholderObservacoes')}
            />
          </div>
        </div>

        </DialogShell>
  );
}
