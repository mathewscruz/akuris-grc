import { useState, useEffect } from 'react';
import { IconExternal, IconChecklist, IconCopy, IconMail } from '@/components/icons';
import { useLanguage } from '@/contexts/LanguageContext';
import { DialogShell } from '@/components/ui/dialog-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { StatusBadge } from '@/components/ui/status-badge';
import { resolveDueDiligenceStatusTone } from '@/lib/status-tone';
import { formatStatus } from '@/lib/text-utils';
import { supabase } from '@/integrations/supabase/client';
import { FornecedorSelector } from './FornecedorSelector';
import { useToast } from '@/hooks/use-toast';
import { parseDataLocal } from '@/lib/date-utils';

interface Template {
  id: string;
  nome: string;
  categoria: string;
}

interface Assessment {
  id: string;
  fornecedor_id: string | null;
  fornecedor_nome: string;
  fornecedor_email: string;
  status: string;
  data_envio: string;
  data_conclusao: string | null;
  score_final: number | null;
  link_token: string;
  template: {
    nome: string;
    categoria: string;
  };
}

interface AssessmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assessment?: Assessment;
  mode?: 'create' | 'view';
  onSuccess: () => void;
}

export function AssessmentDialog({ 
  open, 
  onOpenChange, 
  assessment, 
  mode = 'create', 
  onSuccess 
}: AssessmentDialogProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [formData, setFormData] = useState({
    template_id: '',
    fornecedor_id: null,
    fornecedor_nome: '',
    fornecedor_email: '',
    observacoes: '',
    prazo_dias: '30'
  });
  const [loading, setLoading] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const { toast } = useToast();
  const { t } = useLanguage();

  useEffect(() => {
    if (open) {
      if (mode === 'create') {
        fetchTemplates();
        setFormData({
          template_id: '',
          fornecedor_id: null,
          fornecedor_nome: '',
          fornecedor_email: '',
          observacoes: '',
          prazo_dias: '30'
        });
      } else if (mode === 'view' && assessment) {
        setFormData({
          template_id: '',
          fornecedor_id: assessment.fornecedor_id ?? null,
          fornecedor_nome: assessment.fornecedor_nome,
          fornecedor_email: assessment.fornecedor_email,
          observacoes: '',
          prazo_dias: '30'
        });
      }
    }
  }, [open, mode, assessment]);

  const fetchTemplates = async () => {
    try {
      setLoadingTemplates(true);
      
      const { data, error } = await supabase
        .from('due_diligence_templates')
        .select('id, nome, categoria')
        .eq('ativo', true)
        .order('nome');

      if (error) throw error;
      setTemplates(data || []);
    } catch (error: any) {
      console.error('Erro ao buscar templates:', error);
      toast({
        title: t('dueDiligence.assessmentDialog.errorTitle'),
        description: t('dueDiligence.assessmentDialog.errorTemplatesDescription'),
        variant: "destructive",
      });
    } finally {
      setLoadingTemplates(false);
    }
  };

  const generateUniqueToken = () => {
    return crypto.randomUUID().replace(/-/g, '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.template_id || !formData.fornecedor_nome.trim() || !formData.fornecedor_email.trim()) {
      toast({
        title: t('dueDiligence.assessmentDialog.errorTitle'),
        description: t('dueDiligence.assessmentDialog.errorRequiredFieldsDescription'),
        variant: "destructive",
      });
      return;
    }

    // Validar email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.fornecedor_email)) {
      toast({
        title: t('dueDiligence.assessmentDialog.errorTitle'),
        description: t('dueDiligence.assessmentDialog.errorInvalidEmailDescription'),
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      // Buscar dados do usuário
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error('Usuário não autenticado');

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('empresa_id')
        .eq('user_id', user.id)
        .single();

      if (profileError || !profile?.empresa_id) throw new Error('Empresa não encontrada');

      // Gerar token único
      const linkToken = generateUniqueToken();

      // Calcular data de expiração baseada na seleção do usuário
      const dataExpiracao = new Date();
      dataExpiracao.setDate(dataExpiracao.getDate() + parseInt(formData.prazo_dias));

      // Criar avaliação
      const { data: newAssessment, error } = await supabase
        .from('due_diligence_assessments')
        .insert({
          template_id: formData.template_id,
          // A relação com o cadastro. As colunas de texto continuam a ser o
          // registo de para quem e para onde o convite foi enviado.
          fornecedor_id: formData.fornecedor_id,
          fornecedor_nome: formData.fornecedor_nome,
          fornecedor_email: formData.fornecedor_email,
          link_token: linkToken,
          observacoes: formData.observacoes || null,
          data_expiracao: dataExpiracao.toISOString(),
          empresa_id: profile.empresa_id,
          created_by: user.id
        })
        .select()
        .single();

      if (error) throw error;

      // Buscar nome do template selecionado
      const selectedTemplate = templates.find(t => t.id === formData.template_id);
      const templateNome = selectedTemplate?.nome || 'Due Diligence';

      // Buscar dados da empresa atual
      const { data: profileData } = await supabase
        .from('profiles')
        .select('empresa_id')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      let empresaNome = 'Akuris';
      let empresaLogoUrl = null;

      if (profileData?.empresa_id) {
        const { data: empresaData } = await supabase
          .from('empresas')
          .select('nome, logo_url')
          .eq('id', profileData.empresa_id)
          .single();
        
        if (empresaData) {
          empresaNome = empresaData.nome;
          empresaLogoUrl = empresaData.logo_url;
        }
      }

      // Enviar email de convite automaticamente
      const assessmentLink = `${window.location.origin}/assessment/${linkToken}`;
      
      console.log('Enviando email de convite...', {
        type: 'send',
        assessment_id: newAssessment.id,
        fornecedor_nome: formData.fornecedor_nome,
        fornecedor_email: formData.fornecedor_email,
        template_nome: templateNome,
        assessment_link: assessmentLink,
        empresa_nome: empresaNome,
        empresa_logo_url: empresaLogoUrl
      });

      try {
        const emailResponse = await supabase.functions.invoke('send-due-diligence-email', {
          body: {
            type: 'send',
            assessment_id: newAssessment.id,
            fornecedor_nome: formData.fornecedor_nome,
            fornecedor_email: formData.fornecedor_email,
            template_nome: templateNome,
            assessment_link: assessmentLink,
            data_expiracao: dataExpiracao.toISOString(),
            empresa_nome: empresaNome,
            empresa_logo_url: empresaLogoUrl
          }
        });

        console.log('Resposta do email:', emailResponse);

        toast({
          title: t('dueDiligence.assessmentDialog.toastCreatedSentTitle'),
          description: t('dueDiligence.assessmentDialog.toastCreatedSentDescription', { fornecedor: formData.fornecedor_nome }),
        });
      } catch (emailError: any) {
        console.error('Erro ao enviar email:', emailError);
        toast({
          title: t('dueDiligence.assessmentDialog.toastCreatedOnlyTitle'),
          description: t('dueDiligence.assessmentDialog.toastCreatedEmailErrorDescription', { error: emailError.message }),
          variant: "destructive",
        });
      }

      onSuccess();
    } catch (error: any) {
      console.error('Erro ao criar avaliação:', error);
      toast({
        title: t('dueDiligence.assessmentDialog.errorTitle'),
        description: error.message || t('dueDiligence.assessmentDialog.errorCreateDescriptionFallback'),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const copyAssessmentLink = async () => {
    if (!assessment?.link_token) return;
    
    const link = `${window.location.origin}/assessment/${assessment.link_token}`;
    
    try {
      await navigator.clipboard.writeText(link);
      toast({
        title: t('dueDiligence.assessmentDialog.toastLinkCopiedTitle'),
        description: t('dueDiligence.assessmentDialog.toastLinkCopiedDescription'),
      });
    } catch (error) {
      toast({
        title: t('dueDiligence.assessmentDialog.errorTitle'),
        description: t('dueDiligence.assessmentDialog.errorCopyLinkDescription'),
        variant: "destructive",
      });
    }
  };

  // status badge handled via StatusBadge + resolveDueDiligenceStatusTone

  if (mode === 'view' && assessment) {
    return (
      <DialogShell
        open={open}
        onOpenChange={onOpenChange}
        icon={IconChecklist}
        title={t('dueDiligence.assessmentDialog.viewTitle')}
        description={t('dueDiligence.assessmentDialog.viewDescription')}
        size="md"
        footer={
          <div className="flex justify-end">
            <Button size="sm" onClick={() => onOpenChange(false)}>{t('dueDiligence.assessmentDialog.close')}</Button>
          </div>
        }
      >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('dueDiligence.assessmentDialog.fieldSupplier')}</Label>
                <p className="font-medium">{assessment.fornecedor_nome}</p>
              </div>
              <div className="space-y-2">
                <Label>{t('dueDiligence.assessmentDialog.fieldEmail')}</Label>
                <p className="text-sm text-muted-foreground">{assessment.fornecedor_email}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('dueDiligence.assessmentDialog.fieldTemplate')}</Label>
                <p className="font-medium">{assessment.template.nome}</p>
              </div>
              <div className="space-y-2">
                <Label>{t('dueDiligence.assessmentDialog.fieldStatus')}</Label>
                <div className="mt-1">
                  <StatusBadge {...resolveDueDiligenceStatusTone(assessment.status)}>{formatStatus(assessment.status)}</StatusBadge>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('dueDiligence.assessmentDialog.fieldSentDate')}</Label>
                <p className="text-sm">{new Date(assessment.data_envio).toLocaleString('pt-BR')}</p>
              </div>
              {assessment.data_conclusao && (
                <div className="space-y-2">
                  <Label>{t('dueDiligence.assessmentDialog.fieldCompletionDate')}</Label>
                  <p className="text-sm">{parseDataLocal(assessment.data_conclusao).toLocaleString('pt-BR')}</p>
                </div>
              )}
            </div>

            {assessment.score_final && (
              <div className="space-y-2">
                <Label>{t('dueDiligence.assessmentDialog.fieldFinalScore')}</Label>
                <p className="text-2xl font-bold text-primary">{assessment.score_final.toFixed(1)}%</p>
              </div>
            )}

            <div className="space-y-2">
              <Label>{t('dueDiligence.assessmentDialog.fieldAssessmentLink')}</Label>
              <div className="flex gap-2 mt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyAssessmentLink}
                  className="flex items-center gap-2"
                >
                  <IconCopy className="h-4 w-4" />
                  {t('dueDiligence.assessmentDialog.copyLink')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(`/assessment/${assessment.link_token}`, '_blank')}
                  className="flex items-center gap-2"
                >
                  <IconExternal className="h-4 w-4" />
                  {t('dueDiligence.assessmentDialog.open')}
                </Button>
              </div>
            </div>
          </div>
      </DialogShell>
    );
  }

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={IconChecklist}
      title={t('dueDiligence.assessmentDialog.createTitle')}
      description={t('dueDiligence.assessmentDialog.createDescription')}
      size="sm"
      onSubmit={() => handleSubmit(new Event('submit') as unknown as React.FormEvent)}
      submitLabel={t('dueDiligence.assessmentDialog.submitLabel')}
      isSubmitting={loading}
    >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="template">{t('dueDiligence.assessmentDialog.fieldTemplateRequired')}</Label>
            <Select
              value={formData.template_id}
              onValueChange={(value) => setFormData({ ...formData, template_id: value })}
              disabled={loadingTemplates}
            >
              <SelectTrigger>
                <SelectValue placeholder={loadingTemplates ? t('dueDiligence.assessmentDialog.loadingTemplates') : t('dueDiligence.assessmentDialog.selectTemplatePlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {templates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.nome} ({template.categoria})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

            <FornecedorSelector
              value={{
                id: formData.fornecedor_id,
                nome: formData.fornecedor_nome,
                email: formData.fornecedor_email
              }}
              onChange={(fornecedor) => setFormData(prev => ({
                ...prev,
                fornecedor_id: fornecedor.id ?? null,
                fornecedor_nome: fornecedor.nome,
                fornecedor_email: fornecedor.email
              }))}
            />

          <div className="space-y-2">
            <Label htmlFor="prazo">{t('dueDiligence.assessmentDialog.fieldDeadlineRequired')}</Label>
            <Select
              value={formData.prazo_dias}
              onValueChange={(value) => setFormData({ ...formData, prazo_dias: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('dueDiligence.assessmentDialog.selectDeadlinePlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">{t('dueDiligence.assessmentDialog.deadline7')}</SelectItem>
                <SelectItem value="15">{t('dueDiligence.assessmentDialog.deadline15')}</SelectItem>
                <SelectItem value="30">{t('dueDiligence.assessmentDialog.deadline30')}</SelectItem>
                <SelectItem value="60">{t('dueDiligence.assessmentDialog.deadline60')}</SelectItem>
                <SelectItem value="90">{t('dueDiligence.assessmentDialog.deadline90')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacoes">{t('dueDiligence.assessmentDialog.fieldObservations')}</Label>
            <Textarea
              id="observacoes"
              value={formData.observacoes}
              onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
              placeholder={t('dueDiligence.assessmentDialog.observationsPlaceholder')}
              rows={3}
            />
          </div>

        </form>
    </DialogShell>
  );
}