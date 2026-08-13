import { useState, useEffect } from 'react';
import { DialogShell } from '@/components/ui/dialog-shell';
import { ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { QuestionsManager } from './QuestionsManager';
import { useLanguage } from '@/contexts/LanguageContext';

interface Template {
  id: string;
  nome: string;
  descricao: string;
  categoria: string;
  ativo: boolean;
  versao: number;
}

interface TemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: Template;
  mode?: 'create' | 'edit' | 'duplicate' | 'questions';
  onSuccess: () => void;
}

export function TemplateDialog({ 
  open, 
  onOpenChange, 
  template, 
  mode = 'create', 
  onSuccess 
}: TemplateDialogProps) {
  const [formData, setFormData] = useState({
    nome: '',
    descricao: '',
    categoria: 'geral'
  });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { t } = useLanguage();

  useEffect(() => {
    if (template && (mode === 'edit' || mode === 'duplicate')) {
      setFormData({
        nome: mode === 'duplicate' ? `${template.nome}${t('dueDiligence.templateDialog.copySuffix')}` : template.nome,
        descricao: template.descricao || '',
        categoria: template.categoria
      });
    } else {
      setFormData({
        nome: '',
        descricao: '',
        categoria: 'geral'
      });
    }
  }, [template, mode, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nome.trim()) {
      toast({
        title: t('dueDiligence.templateDialog.errorTitle'),
        description: t('dueDiligence.templateDialog.errorNameRequiredDescription'),
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

      if (mode === 'create' || mode === 'duplicate') {
        // Criar novo template
        const { data: newTemplate, error } = await supabase
          .from('due_diligence_templates')
          .insert({
            nome: formData.nome,
            descricao: formData.descricao,
            categoria: formData.categoria,
            empresa_id: profile.empresa_id,
            created_by: user.id,
            ativo: true,
            versao: 1
          })
          .select()
          .single();

        if (error) throw error;

        // Se for duplicação, copiar as perguntas
        if (mode === 'duplicate' && template) {
          const { data: questions, error: questionsError } = await supabase
            .from('due_diligence_questions')
            .select('*')
            .eq('template_id', template.id)
            .order('ordem');

          if (questionsError) throw questionsError;

          if (questions && questions.length > 0) {
            const questionsToInsert = questions.map(q => ({
              template_id: newTemplate.id,
              titulo: q.titulo,
              descricao: q.descricao,
              tipo: q.tipo,
              opcoes: q.opcoes,
              obrigatoria: q.obrigatoria,
              peso: q.peso,
              ordem: q.ordem,
              configuracoes: q.configuracoes
            }));

            const { error: insertError } = await supabase
              .from('due_diligence_questions')
              .insert(questionsToInsert);

            if (insertError) throw insertError;
          }
        }

        toast({
          title: t('dueDiligence.templateDialog.toastCreatedTitle'),
          description: t('dueDiligence.templateDialog.toastCreatedDescription', { nome: formData.nome }),
        });

      } else if (mode === 'edit') {
        // Atualizar template existente
        const { error } = await supabase
          .from('due_diligence_templates')
          .update({
            nome: formData.nome,
            descricao: formData.descricao,
            categoria: formData.categoria
          })
          .eq('id', template!.id);

        if (error) throw error;

        toast({
          title: t('dueDiligence.templateDialog.toastUpdatedTitle'),
          description: t('dueDiligence.templateDialog.toastUpdatedDescription', { nome: formData.nome }),
        });
      }

      onSuccess();
    } catch (error: any) {
      console.error('Erro ao salvar template:', error);
      toast({
        title: t('dueDiligence.templateDialog.errorTitle'),
        description: error.message || t('dueDiligence.templateDialog.errorSaveDescriptionFallback'),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getDialogTitle = () => {
    switch (mode) {
      case 'create': return t('dueDiligence.templateDialog.titleCreate');
      case 'edit': return t('dueDiligence.templateDialog.titleEdit');
      case 'duplicate': return t('dueDiligence.templateDialog.titleDuplicate');
      case 'questions': return t('dueDiligence.templateDialog.titleQuestions');
      default: return t('dueDiligence.templateDialog.titleFallback');
    }
  };

  const getDialogDescription = () => {
    switch (mode) {
      case 'create': return t('dueDiligence.templateDialog.descriptionCreate');
      case 'edit': return t('dueDiligence.templateDialog.descriptionEdit');
      case 'duplicate': return t('dueDiligence.templateDialog.descriptionDuplicate');
      case 'questions': return t('dueDiligence.templateDialog.descriptionQuestions');
      default: return '';
    }
  };

  const isQuestions = mode === 'questions';

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={ClipboardList}
      title={getDialogTitle()}
      description={getDialogDescription()}
      size={isQuestions ? 'xl' : 'sm'}
      hideFooter={isQuestions}
      onSubmit={isQuestions ? undefined : () => handleSubmit(new Event('submit') as unknown as React.FormEvent)}
      submitLabel={t('dueDiligence.templateDialog.submitLabel')}
      isSubmitting={loading}
    >
        {isQuestions ? (
          <QuestionsManager
            templateId={template?.id || ''}
            templateName={template?.nome || ''}
          />
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">{t('dueDiligence.templateDialog.fieldName')}</Label>
            <Input
              id="nome"
              value={formData.nome}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              placeholder={t('dueDiligence.templateDialog.namePlaceholder')}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="descricao">{t('dueDiligence.templateDialog.fieldDescription')}</Label>
            <Textarea
              id="descricao"
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              placeholder={t('dueDiligence.templateDialog.descriptionPlaceholder')}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="categoria">{t('dueDiligence.templateDialog.fieldCategory')}</Label>
            <Select
              value={formData.categoria}
              onValueChange={(value) => setFormData({ ...formData, categoria: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('dueDiligence.templateDialog.categoryPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="geral">{t('dueDiligence.templateDialog.categoryGeneral')}</SelectItem>
                <SelectItem value="seguranca">{t('dueDiligence.templateDialog.categorySecurity')}</SelectItem>
                <SelectItem value="compliance">{t('dueDiligence.templateDialog.categoryCompliance')}</SelectItem>
                <SelectItem value="financeiro">{t('dueDiligence.templateDialog.categoryFinancial')}</SelectItem>
                <SelectItem value="operacional">{t('dueDiligence.templateDialog.categoryOperational')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

        </form>
        )}
    </DialogShell>
  );
}