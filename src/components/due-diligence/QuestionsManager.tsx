import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { resolveQuestionTypeTone } from '@/lib/status-tone';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Edit, Trash2, MoveUp, MoveDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { DialogShell } from '@/components/ui/dialog-shell';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useLanguage } from '@/contexts/LanguageContext';

interface Question {
  id: string;
  template_id: string;
  titulo: string;
  descricao?: string;
  tipo: 'text' | 'textarea' | 'select' | 'checkbox' | 'radio' | 'file' | 'score' | 'date';
  opcoes?: string[];
  obrigatoria: boolean;
  peso: number;
  ordem: number;
  configuracoes?: any;
}

interface QuestionsManagerProps {
  templateId: string;
  templateName: string;
}

export function QuestionsManager({ templateId, templateName }: QuestionsManagerProps) {
  const { t } = useLanguage();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; question: Question | null }>({
    open: false,
    question: null
  });
  const { toast } = useToast();

  // Form state
  const [formData, setFormData] = useState({
    titulo: '',
    descricao: '',
    tipo: 'text' as Question['tipo'],
    opcoes: [''],
    obrigatoria: true,
    peso: 1,
    secao: 'Geral'
  });

  useEffect(() => {
    fetchQuestions();
  }, [templateId]);

  const fetchQuestions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('due_diligence_questions')
        .select('*')
        .eq('template_id', templateId)
        .order('ordem');

      if (error) throw error;
      setQuestions((data || []) as Question[]);
    } catch (error: any) {
      toast({
        title: t('dueDiligence.questionsManager.errorLoadTitle'),
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      titulo: '',
      descricao: '',
      tipo: 'text',
      opcoes: [''],
      obrigatoria: true,
      peso: 1,
      secao: 'Geral'
    });
    setEditingQuestion(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const questionData = {
        template_id: templateId,
        titulo: formData.titulo,
        descricao: formData.descricao || null,
        tipo: formData.tipo,
        opcoes: ['select', 'radio', 'checkbox'].includes(formData.tipo) ? 
          formData.opcoes.filter(o => o.trim()) : null,
        obrigatoria: formData.obrigatoria,
        peso: formData.peso,
        ordem: editingQuestion ? editingQuestion.ordem : questions.length + 1,
        secao: formData.secao || 'Geral'
      };

      let error;
      if (editingQuestion) {
        ({ error } = await supabase
          .from('due_diligence_questions')
          .update(questionData)
          .eq('id', editingQuestion.id));
      } else {
        ({ error } = await supabase
          .from('due_diligence_questions')
          .insert([questionData]));
      }

      if (error) throw error;

      toast({
        title: editingQuestion ? t('dueDiligence.questionsManager.updatedTitle') : t('dueDiligence.questionsManager.createdTitle'),
        description: editingQuestion ? t('dueDiligence.questionsManager.updatedDescription') : t('dueDiligence.questionsManager.createdDescription')
      });

      setShowDialog(false);
      resetForm();
      fetchQuestions();
    } catch (error: any) {
      toast({
        title: t('dueDiligence.questionsManager.errorSaveTitle'),
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleEdit = (question: Question) => {
    setEditingQuestion(question);
    setFormData({
      titulo: question.titulo,
      descricao: question.descricao || '',
      tipo: question.tipo,
      opcoes: question.opcoes || [''],
      obrigatoria: question.obrigatoria,
      peso: question.peso,
      secao: (question as any).secao || 'Geral'
    });
    setShowDialog(true);
  };

  const handleDelete = async () => {
    if (!deleteConfirm.question) return;

    try {
      const { error } = await supabase
        .from('due_diligence_questions')
        .delete()
        .eq('id', deleteConfirm.question.id);

      if (error) throw error;

      toast({
        title: t('dueDiligence.questionsManager.deletedTitle'),
        description: t('dueDiligence.questionsManager.deletedDescription')
      });

      setDeleteConfirm({ open: false, question: null });
      fetchQuestions();
    } catch (error: any) {
      toast({
        title: t('dueDiligence.questionsManager.errorDeleteTitle'),
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const moveQuestion = async (questionId: string, direction: 'up' | 'down') => {
    const currentIndex = questions.findIndex(q => q.id === questionId);
    if (currentIndex === -1) return;
    
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= questions.length) return;

    try {
      const updates = [
        { id: questions[currentIndex].id, ordem: newIndex + 1 },
        { id: questions[newIndex].id, ordem: currentIndex + 1 }
      ];

      for (const update of updates) {
        const { error } = await supabase
          .from('due_diligence_questions')
          .update({ ordem: update.ordem })
          .eq('id', update.id);
        
        if (error) throw error;
      }

      fetchQuestions();
    } catch (error: any) {
      toast({
        title: t('dueDiligence.questionsManager.errorReorderTitle'),
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const addOption = () => {
    setFormData(prev => ({
      ...prev,
      opcoes: [...prev.opcoes, '']
    }));
  };

  const updateOption = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      opcoes: prev.opcoes.map((opt, i) => i === index ? value : opt)
    }));
  };

  const removeOption = (index: number) => {
    setFormData(prev => ({
      ...prev,
      opcoes: prev.opcoes.filter((_, i) => i !== index)
    }));
  };

  const getTypeLabel = (type: string) => {
    const types = {
      'text': t('dueDiligence.questionsManager.typeText'),
      'textarea': t('dueDiligence.questionsManager.typeTextarea'),
      'select': t('dueDiligence.questionsManager.typeSelect'),
      'radio': t('dueDiligence.questionsManager.typeRadio'),
      'checkbox': t('dueDiligence.questionsManager.typeCheckbox'),
      'file': t('dueDiligence.questionsManager.typeFile'),
      'score': t('dueDiligence.questionsManager.typeScore'),
      'date': t('dueDiligence.questionsManager.typeDate')
    };
    return types[type as keyof typeof types] || type;
  };

  // Tipo de pergunta agora via resolveQuestionTypeTone (StatusBadge)

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24">
        <AkurisPulse size={40} />
        <p className="text-sm text-muted-foreground">{t('dueDiligence.questionsManager.loading')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{t('dueDiligence.questionsManager.pageTitle', { template: templateName })}</h2>
          <p className="text-muted-foreground">
            {t('dueDiligence.questionsManager.pageDescription')}
          </p>
        </div>

        <Button onClick={() => { resetForm(); setShowDialog(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          {t('dueDiligence.questionsManager.newQuestion')}
        </Button>
        <DialogShell
          open={showDialog}
          onOpenChange={setShowDialog}
          icon={Plus}
          title={editingQuestion ? t('dueDiligence.questionsManager.editTitle') : t('dueDiligence.questionsManager.createTitle')}
          size="md"
          onSubmit={() => handleSubmit(new Event('submit') as unknown as React.FormEvent)}
          submitLabel={editingQuestion ? t('dueDiligence.questionsManager.update') : t('dueDiligence.questionsManager.create')}
        >
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="titulo">{t('dueDiligence.questionsManager.fieldTitle')}</Label>
                  <Input
                    id="titulo"
                    value={formData.titulo}
                    onChange={(e) => setFormData(prev => ({ ...prev, titulo: e.target.value }))}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="secao">{t('dueDiligence.questionsManager.fieldSection')}</Label>
                  <Input
                    id="secao"
                    value={formData.secao}
                    onChange={(e) => setFormData(prev => ({ ...prev, secao: e.target.value }))}
                    placeholder={t('dueDiligence.questionsManager.sectionPlaceholder')}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="tipo">{t('dueDiligence.questionsManager.fieldType')}</Label>
                  <Select
                    value={formData.tipo}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, tipo: value as Question['tipo'] }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">{t('dueDiligence.questionsManager.typeText')}</SelectItem>
                      <SelectItem value="textarea">{t('dueDiligence.questionsManager.typeTextarea')}</SelectItem>
                      <SelectItem value="select">{t('dueDiligence.questionsManager.typeSelect')}</SelectItem>
                      <SelectItem value="radio">{t('dueDiligence.questionsManager.typeRadio')}</SelectItem>
                      <SelectItem value="checkbox">{t('dueDiligence.questionsManager.typeCheckbox')}</SelectItem>
                      <SelectItem value="file">{t('dueDiligence.questionsManager.typeFile')}</SelectItem>
                      <SelectItem value="score">{t('dueDiligence.questionsManager.typeScore')}</SelectItem>
                      <SelectItem value="date">{t('dueDiligence.questionsManager.typeDate')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="descricao">{t('dueDiligence.questionsManager.fieldDescription')}</Label>
                <Textarea
                  id="descricao"
                  value={formData.descricao}
                  onChange={(e) => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
                  rows={3}
                />
              </div>

              {['select', 'radio', 'checkbox'].includes(formData.tipo) && (
                <div className="space-y-2">
                  <Label>{t('dueDiligence.questionsManager.optionsLabel')}</Label>
                  {formData.opcoes.map((opcao, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        value={opcao}
                        onChange={(e) => updateOption(index, e.target.value)}
                        placeholder={t('dueDiligence.questionsManager.optionPlaceholder', { index: index + 1 })}
                      />
                      {formData.opcoes.length > 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removeOption(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button type="button" variant="outline" onClick={addOption}>
                    <Plus className="mr-2 h-4 w-4" />
                    {t('dueDiligence.questionsManager.addOption')}
                  </Button>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="obrigatoria"
                    checked={formData.obrigatoria}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, obrigatoria: checked }))}
                  />
                  <Label htmlFor="obrigatoria">{t('dueDiligence.questionsManager.fieldRequired')}</Label>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="peso">{t('dueDiligence.questionsManager.fieldWeight')}</Label>
                  <Input
                    id="peso"
                    type="number"
                    min="1"
                    max="10"
                    value={formData.peso}
                    onChange={(e) => setFormData(prev => ({ ...prev, peso: parseInt(e.target.value) || 1 }))}
                  />
                </div>
              </div>

            </form>
        </DialogShell>
      </div>

      {questions.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-muted-foreground mb-4">
              {t('dueDiligence.questionsManager.emptyDescription')}
            </p>
            <Button onClick={() => setShowDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              {t('dueDiligence.questionsManager.createFirst')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">{t('dueDiligence.questionsManager.questionsCount', { count: questions.length })}</CardTitle>
            <CardDescription>{t('dueDiligence.questionsManager.questionsListDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[600px]">
              <div className="p-4 space-y-1">
                {questions.map((question, index) => (
                  <div key={question.id} className="flex items-center justify-between p-3 rounded-lg border bg-background/50 hover:bg-accent/50 transition-colors">
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-medium text-sm truncate">{question.titulo}</h4>
                        <StatusBadge size="sm" {...resolveQuestionTypeTone(question.tipo)}>
                          {getTypeLabel(question.tipo)}
                        </StatusBadge>
                        {question.obrigatoria && (
                          <StatusBadge size="sm" tone="destructive">{t('dueDiligence.questionsManager.requiredBadge')}</StatusBadge>
                        )}
                        <StatusBadge size="sm" tone="neutral">{t('dueDiligence.questionsManager.weightBadge', { peso: question.peso })}</StatusBadge>
                      </div>
                      {question.descricao && (
                        <p className="text-xs text-muted-foreground truncate">{question.descricao}</p>
                      )}
                      {question.opcoes && question.opcoes.length > 0 && (
                        <p className="text-xs text-muted-foreground truncate">
                          {t('dueDiligence.questionsManager.optionsPrefix', { opcoes: question.opcoes.join(', ') })}
                        </p>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => moveQuestion(question.id, 'up')}
                        disabled={index === 0}
                        className="h-7 w-7 p-0"
                      >
                        <MoveUp className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => moveQuestion(question.id, 'down')}
                        disabled={index === questions.length - 1}
                        className="h-7 w-7 p-0"
                      >
                        <MoveDown className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(question)}
                        className="h-7 w-7 p-0"
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteConfirm({ open: true, question })}
                        className="h-7 w-7 p-0"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={deleteConfirm.open}
        onOpenChange={(open) => setDeleteConfirm({ open, question: null })}
        title={t('dueDiligence.questionsManager.deleteDialogTitle')}
        description={t('dueDiligence.questionsManager.deleteDialogDescription', { titulo: deleteConfirm.question?.titulo })}
        confirmText={t('dueDiligence.questionsManager.deleteConfirm')}
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}