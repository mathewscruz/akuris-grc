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

  useEffect(() => {
    if (template && (mode === 'edit' || mode === 'duplicate')) {
      setFormData({
        nome: mode === 'duplicate' ? `${template.nome} (Cópia)` : template.nome,
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
        title: "Erro",
        description: "O nome do template é obrigatório.",
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
          title: "Template criado",
          description: `Template "${formData.nome}" criado com sucesso.`,
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
          title: "Template atualizado",
          description: `Template "${formData.nome}" atualizado com sucesso.`,
        });
      }

      onSuccess();
    } catch (error: any) {
      console.error('Erro ao salvar template:', error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível salvar o template.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getDialogTitle = () => {
    switch (mode) {
      case 'create': return 'Novo Template';
      case 'edit': return 'Editar Template';
      case 'duplicate': return 'Duplicar Template';
      case 'questions': return 'Gerenciar Perguntas';
      default: return 'Template';
    }
  };

  const getDialogDescription = () => {
    switch (mode) {
      case 'create': return 'Crie um novo template de questionário para avaliações de fornecedores.';
      case 'edit': return 'Edite as informações básicas do template.';
      case 'duplicate': return 'Crie uma cópia do template com todas as perguntas.';
      case 'questions': return 'Adicione e organize as perguntas do questionário.';
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
      submitLabel="Salvar"
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
            <Label htmlFor="nome">Nome do Template</Label>
            <Input
              id="nome"
              value={formData.nome}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              placeholder="Ex: Avaliação de Segurança"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea
              id="descricao"
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              placeholder="Descreva o propósito deste template..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="categoria">Categoria</Label>
            <Select
              value={formData.categoria}
              onValueChange={(value) => setFormData({ ...formData, categoria: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="geral">Geral</SelectItem>
                <SelectItem value="seguranca">Segurança</SelectItem>
                <SelectItem value="compliance">Compliance</SelectItem>
                <SelectItem value="financeiro">Financeiro</SelectItem>
                <SelectItem value="operacional">Operacional</SelectItem>
              </SelectContent>
            </Select>
          </div>

        </form>
        )}
    </DialogShell>
  );
}