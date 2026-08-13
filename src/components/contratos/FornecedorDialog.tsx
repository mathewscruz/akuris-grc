import { useState, useEffect } from 'react';
import { DialogShell } from '@/components/ui/dialog-shell';
import { Building2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';

interface Fornecedor {
  id: string;
  nome: string;
  cnpj: string;
  email: string;
  telefone: string;
  endereco: string;
  contato_responsavel: string;
  tipo: string;
  status: string;
  categoria: string;
  avaliacao_risco: string;
  data_cadastro: string;
  observacoes: string;
}

interface FornecedorDialogProps {
  fornecedor: Fornecedor | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function FornecedorDialog({ fornecedor, open, onOpenChange, onSuccess }: FornecedorDialogProps) {
  const [formData, setFormData] = useState({
    nome: '',
    cnpj: '',
    email: '',
    telefone: '',
    endereco: '',
    contato_responsavel: '',
    tipo: 'pessoa_juridica',
    status: 'ativo',
    categoria: '',
    avaliacao_risco: 'baixo',
    data_cadastro: '',
    observacoes: ''
  });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { t } = useLanguage();

  useEffect(() => {
    if (open) {
      if (fornecedor) {
        setFormData({
          nome: fornecedor.nome || '',
          cnpj: fornecedor.cnpj || '',
          email: fornecedor.email || '',
          telefone: fornecedor.telefone || '',
          endereco: fornecedor.endereco || '',
          contato_responsavel: fornecedor.contato_responsavel || '',
          tipo: fornecedor.tipo || 'pessoa_juridica',
          status: fornecedor.status || 'ativo',
          categoria: fornecedor.categoria || '',
          avaliacao_risco: fornecedor.avaliacao_risco || 'baixo',
          data_cadastro: fornecedor.data_cadastro || '',
          observacoes: fornecedor.observacoes || ''
        });
      } else {
        setFormData({
          nome: '',
          cnpj: '',
          email: '',
          telefone: '',
          endereco: '',
          contato_responsavel: '',
          tipo: 'pessoa_juridica',
          status: 'ativo',
          categoria: '',
          avaliacao_risco: 'baixo',
          data_cadastro: new Date().toISOString().split('T')[0],
          observacoes: ''
        });
      }
    }
  }, [fornecedor, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nome) {
      toast({
        title: "Erro",
        description: t('contratosAtivos.fornecedorDialog.toastNameRequired'),
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from('profiles')
        .select('empresa_id')
        .eq('user_id', user?.id)
        .single();

      const fornecedorData = {
        nome: formData.nome,
        cnpj: formData.cnpj,
        email: formData.email,
        telefone: formData.telefone,
        endereco: formData.endereco,
        contato_responsavel: formData.contato_responsavel,
        tipo: formData.tipo,
        status: formData.status,
        categoria: formData.categoria,
        avaliacao_risco: formData.avaliacao_risco,
        data_cadastro: formData.data_cadastro || null,
        observacoes: formData.observacoes,
        empresa_id: profile?.empresa_id
      };

      let error;
      
      if (fornecedor) {
        const { error: updateError } = await supabase
          .from('fornecedores')
          .update(fornecedorData)
          .eq('id', fornecedor.id);
        error = updateError;
      } else {
        const { error: insertError } = await supabase
          .from('fornecedores')
          .insert([fornecedorData]);
        error = insertError;
      }

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: t('contratosAtivos.fornecedorDialog.toastSaveSuccess').replace('{action}', fornecedor ? t('contratosAtivos.fornecedorDialog.actionUpdated') : t('contratosAtivos.fornecedorDialog.actionCreated')),
      });

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao salvar fornecedor:', error);
      toast({
        title: "Erro",
        description: t('contratosAtivos.fornecedorDialog.toastSaveError'),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={Building2}
      title={fornecedor ? t('contratosAtivos.fornecedorDialog.titleEdit') : t('contratosAtivos.fornecedorDialog.titleNew')}
      size="md"
      onSubmit={() => handleSubmit(new Event('submit') as unknown as React.FormEvent)}
      submitLabel={fornecedor ? t('contratosAtivos.fornecedorDialog.submitUpdate') : t('contratosAtivos.fornecedorDialog.submitCreate')}
      isSubmitting={loading}
    >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="nome">{t('contratosAtivos.fornecedorDialog.labelName')}</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                placeholder={t('contratosAtivos.fornecedorDialog.namePlaceholder')}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cnpj">{t('contratosAtivos.fornecedorDialog.labelDocument')}</Label>
              <Input
                id="cnpj"
                value={formData.cnpj}
                onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                placeholder={t('contratosAtivos.fornecedorDialog.documentPlaceholder')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tipo">{t('contratosAtivos.fornecedorDialog.labelType')}</Label>
              <Select value={formData.tipo} onValueChange={(value) => setFormData({ ...formData, tipo: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pessoa_juridica">{t('contratosAtivos.fornecedorDialog.typePessoaJuridica')}</SelectItem>
                  <SelectItem value="pessoa_fisica">{t('contratosAtivos.fornecedorDialog.typePessoaFisica')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">{t('contratosAtivos.fornecedorDialog.labelEmail')}</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder={t('contratosAtivos.fornecedorDialog.emailPlaceholder')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="telefone">{t('contratosAtivos.fornecedorDialog.labelPhone')}</Label>
              <Input
                id="telefone"
                value={formData.telefone}
                onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                placeholder={t('contratosAtivos.fornecedorDialog.phonePlaceholder')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contato_responsavel">{t('contratosAtivos.fornecedorDialog.labelContact')}</Label>
              <Input
                id="contato_responsavel"
                value={formData.contato_responsavel}
                onChange={(e) => setFormData({ ...formData, contato_responsavel: e.target.value })}
                placeholder={t('contratosAtivos.fornecedorDialog.contactPlaceholder')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="categoria">{t('contratosAtivos.fornecedorDialog.labelCategory')}</Label>
              <Select value={formData.categoria} onValueChange={(value) => setFormData({ ...formData, categoria: value })}>
                <SelectTrigger>
                  <SelectValue placeholder={t('contratosAtivos.fornecedorDialog.categoryPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tecnologia">{t('contratosAtivos.fornecedorDialog.categoryTecnologia')}</SelectItem>
                  <SelectItem value="consultoria">{t('contratosAtivos.fornecedorDialog.categoryConsultoria')}</SelectItem>
                  <SelectItem value="servicos">{t('contratosAtivos.fornecedorDialog.categoryServicos')}</SelectItem>
                  <SelectItem value="produtos">{t('contratosAtivos.fornecedorDialog.categoryProdutos')}</SelectItem>
                  <SelectItem value="manutencao">{t('contratosAtivos.fornecedorDialog.categoryManutencao')}</SelectItem>
                  <SelectItem value="terceirizacao">{t('contratosAtivos.fornecedorDialog.categoryTerceirizacao')}</SelectItem>
                  <SelectItem value="outros">{t('contratosAtivos.fornecedorDialog.categoryOutros')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">{t('contratosAtivos.fornecedorDialog.labelStatus')}</Label>
              <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">{t('contratosAtivos.fornecedorDialog.statusAtivo')}</SelectItem>
                  <SelectItem value="inativo">{t('contratosAtivos.fornecedorDialog.statusInativo')}</SelectItem>
                  <SelectItem value="suspenso">{t('contratosAtivos.fornecedorDialog.statusSuspenso')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="avaliacao_risco">{t('contratosAtivos.fornecedorDialog.labelRiskAssessment')}</Label>
              <Select value={formData.avaliacao_risco} onValueChange={(value) => setFormData({ ...formData, avaliacao_risco: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixo">{t('contratosAtivos.fornecedorDialog.riskBaixo')}</SelectItem>
                  <SelectItem value="medio">{t('contratosAtivos.fornecedorDialog.riskMedio')}</SelectItem>
                  <SelectItem value="alto">{t('contratosAtivos.fornecedorDialog.riskAlto')}</SelectItem>
                  <SelectItem value="critico">{t('contratosAtivos.fornecedorDialog.riskCritico')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="data_cadastro">{t('contratosAtivos.fornecedorDialog.labelRegistrationDate')}</Label>
              <Input
                id="data_cadastro"
                type="date"
                value={formData.data_cadastro}
                onChange={(e) => setFormData({ ...formData, data_cadastro: e.target.value })}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="endereco">{t('contratosAtivos.fornecedorDialog.labelAddress')}</Label>
              <Input
                id="endereco"
                value={formData.endereco}
                onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                placeholder={t('contratosAtivos.fornecedorDialog.addressPlaceholder')}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="observacoes">{t('contratosAtivos.fornecedorDialog.labelObservations')}</Label>
              <Textarea
                id="observacoes"
                value={formData.observacoes}
                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                placeholder={t('contratosAtivos.fornecedorDialog.observationsPlaceholder')}
                rows={3}
              />
            </div>
          </div>

        </form>
    </DialogShell>
  );
}