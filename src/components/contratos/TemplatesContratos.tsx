import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { FileText, Plus, Edit, Trash2, Copy, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';

interface TemplateContrato {
  id?: string;
  nome: string;
  tipo: string;
  descricao: string;
  clausulas_padrao: string;
  campos_obrigatorios: string[];
  objeto_padrao: string;
  sla_padrao?: string;
  penalidades_padrao?: string;
  prazo_pagamento_padrao?: number;
  valor_estimado?: number;
  created_at?: string;
}

interface TemplatesContratosProps {
  onTemplateSelect?: (template: TemplateContrato) => void;
}

const tiposContratoValues = [
  'prestacao_servicos',
  'fornecimento',
  'locacao',
  'licenciamento',
  'manutencao',
  'consultoria',
  'outros'
];

const camposDisponiveis = [
  'numero_contrato',
  'fornecedor_id',
  'valor',
  'data_inicio',
  'data_fim',
  'gestor_contrato',
  'area_solicitante',
  'objeto',
  'clausulas_especiais',
  'penalidades',
  'sla_principal'
];

export default function TemplatesContratos({ onTemplateSelect }: TemplatesContratosProps) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [templates, setTemplates] = useState<TemplateContrato[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TemplateContrato | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState<TemplateContrato>({
    nome: '',
    tipo: '',
    descricao: '',
    clausulas_padrao: '',
    campos_obrigatorios: [],
    objeto_padrao: '',
    sla_padrao: '',
    penalidades_padrao: '',
    prazo_pagamento_padrao: 30
  });

  const tiposContrato = tiposContratoValues.map(value => ({
    value,
    label: t(`contratosAtivos.templatesContratos.${{
      prestacao_servicos: 'typePrestacaoServicos',
      fornecimento: 'typeFornecimento',
      locacao: 'typeLocacao',
      licenciamento: 'typeLicenciamento',
      manutencao: 'typeManutencao',
      consultoria: 'typeConsultoria',
      outros: 'typeOutros',
    }[value]}`)
  }));

  useEffect(() => {
    if (open) {
      carregarTemplates();
    }
  }, [open]);

  useEffect(() => {
    if (editingTemplate) {
      setFormData(editingTemplate);
      setFormOpen(true);
    }
  }, [editingTemplate]);

  const carregarTemplates = async () => {
    setLoading(true);
    try {
      // Como não temos tabela de templates ainda, vamos simular com dados locais
      const templatesLocais = getTemplatesPadrao();
      setTemplates(templatesLocais);
    } catch (error) {
      console.error('Erro ao carregar templates:', error);
      toast({
        title: t('contratosAtivos.common.error'),
        description: t('contratosAtivos.templatesContratos.toastLoadError'),
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getTemplatesPadrao = (): TemplateContrato[] => {
    return [
      {
        id: '1',
        nome: 'Prestação de Serviços - TI',
        tipo: 'prestacao_servicos',
        descricao: 'Template para contratos de prestação de serviços de TI',
        clausulas_padrao: `CLÁUSULA 1ª - DO OBJETO
O presente contrato tem por objeto a prestação de serviços de tecnologia da informação, conforme especificações técnicas detalhadas no Anexo I.

CLÁUSULA 2ª - DA VIGÊNCIA
O presente contrato terá vigência de [PRAZO] meses, iniciando-se em [DATA_INICIO] e encerrando-se em [DATA_FIM].

CLÁUSULA 3ª - DO VALOR E FORMA DE PAGAMENTO
Pelo objeto do presente contrato, a CONTRATANTE pagará à CONTRATADA o valor total de R$ [VALOR], conforme cronograma de pagamento estabelecido no Anexo II.

CLÁUSULA 4ª - DOS NÍVEIS DE SERVIÇO
A CONTRATADA deverá manter os seguintes níveis de serviço:
- Disponibilidade: [SLA_DISPONIBILIDADE]%
- Tempo de resposta: [SLA_RESPOSTA]
- Tempo de resolução: [SLA_RESOLUCAO]`,
        campos_obrigatorios: ['fornecedor_id', 'valor', 'data_inicio', 'data_fim', 'gestor_contrato'],
        objeto_padrao: 'Prestação de serviços de tecnologia da informação',
        sla_padrao: 'Disponibilidade: 99.5% | Tempo de resposta: 4 horas | Tempo de resolução: 24 horas',
        penalidades_padrao: 'Multa de 0,1% sobre o valor mensal por descumprimento de SLA',
        prazo_pagamento_padrao: 30
      },
      {
        id: '2',
        nome: 'Fornecimento de Materiais',
        tipo: 'fornecimento',
        descricao: 'Template para contratos de fornecimento de materiais e equipamentos',
        clausulas_padrao: `CLÁUSULA 1ª - DO OBJETO
O presente contrato tem por objeto o fornecimento de materiais e/ou equipamentos, conforme especificações técnicas e quantidades detalhadas no Anexo I.

CLÁUSULA 2ª - DAS ENTREGAS
As entregas deverão ser realizadas conforme cronograma estabelecido, respeitando prazos, locais e quantidades especificadas.

CLÁUSULA 3ª - DA GARANTIA
Todos os materiais/equipamentos fornecidos deverão ter garantia mínima de [PRAZO_GARANTIA] contra defeitos de fabricação.`,
        campos_obrigatorios: ['fornecedor_id', 'valor', 'data_inicio', 'data_fim'],
        objeto_padrao: 'Fornecimento de materiais e equipamentos',
        penalidades_padrao: 'Multa de 1% sobre o valor da entrega por atraso',
        prazo_pagamento_padrao: 45
      },
      {
        id: '3',
        nome: 'Locação de Equipamentos',
        tipo: 'locacao',
        descricao: 'Template para contratos de locação de equipamentos',
        clausulas_padrao: `CLÁUSULA 1ª - DO OBJETO
O presente contrato tem por objeto a locação de equipamentos conforme especificado no Anexo I.

CLÁUSULA 2ª - DO ALUGUEL
O valor mensal do aluguel é de R$ [VALOR_MENSAL], sendo reajustado anualmente pelo IPCA.

CLÁUSULA 3ª - DA MANUTENÇÃO
A manutenção preventiva e corretiva dos equipamentos será de responsabilidade da LOCADORA.`,
        campos_obrigatorios: ['fornecedor_id', 'valor', 'data_inicio', 'data_fim', 'gestor_contrato'],
        objeto_padrao: 'Locação de equipamentos',
        sla_padrao: 'Manutenção corretiva em até 24 horas',
        penalidades_padrao: 'Desconto proporcional no aluguel por indisponibilidade',
        prazo_pagamento_padrao: 30
      }
    ];
  };

  const salvarTemplate = async () => {
    try {
      // Aqui implementaríamos a lógica de salvar no banco
      toast({
        title: t('contratosAtivos.common.success'),
        description: editingTemplate ? t('contratosAtivos.templatesContratos.toastSaveSuccessUpdate') : t('contratosAtivos.templatesContratos.toastSaveSuccessCreate'),
      });
      
      setFormOpen(false);
      setEditingTemplate(null);
      setFormData({
        nome: '',
        tipo: '',
        descricao: '',
        clausulas_padrao: '',
        campos_obrigatorios: [],
        objeto_padrao: '',
        sla_padrao: '',
        penalidades_padrao: '',
        prazo_pagamento_padrao: 30
      });
      carregarTemplates();
    } catch (error) {
      toast({
        title: t('contratosAtivos.common.error'),
        description: t('contratosAtivos.templatesContratos.toastSaveError'),
        variant: "destructive"
      });
    }
  };

  const excluirTemplate = async (templateId: string) => {
    try {
      // Aqui implementaríamos a lógica de excluir do banco
      toast({
        title: t('contratosAtivos.common.success'),
        description: t('contratosAtivos.templatesContratos.toastDeleteSuccess'),
      });
      carregarTemplates();
    } catch (error) {
      toast({
        title: t('contratosAtivos.common.error'),
        description: t('contratosAtivos.templatesContratos.toastDeleteError'),
        variant: "destructive"
      });
    }
  };

  const duplicarTemplate = (template: TemplateContrato) => {
    setFormData({
      ...template,
      nome: `${template.nome}${t('contratosAtivos.templatesContratos.copySuffix')}`,
      id: undefined
    });
    setFormOpen(true);
  };

  const aplicarTemplate = (template: TemplateContrato) => {
    if (onTemplateSelect) {
      onTemplateSelect(template);
      setOpen(false);
      toast({
        title: t('contratosAtivos.templatesContratos.toastTemplateApplied'),
        description: t('contratosAtivos.templatesContratos.toastTemplateAppliedDescription'),
      });
    }
  };

  const exportarTemplate = (template: TemplateContrato) => {
    const dataStr = JSON.stringify(template, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `template-${template.nome.toLowerCase().replace(/\s+/g, '-')}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleCampoObrigatorioChange = (campo: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      campos_obrigatorios: checked
        ? [...prev.campos_obrigatorios, campo]
        : prev.campos_obrigatorios.filter(c => c !== campo)
    }));
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline">
            <FileText className="h-4 w-4 mr-2" />
            {t('contratosAtivos.templatesContratos.triggerButton')}
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle>{t('contratosAtivos.templatesContratos.title')}</DialogTitle>
                <DialogDescription>
                  {t('contratosAtivos.templatesContratos.description')}
                </DialogDescription>
              </div>
              <Button onClick={() => setFormOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                {t('contratosAtivos.templatesContratos.newButton')}
              </Button>
            </div>
          </DialogHeader>

          {loading ? (
            <div className="text-center py-8">{t('contratosAtivos.templatesContratos.loading')}</div>
          ) : (
            <div className="space-y-4">
              {templates.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {t('contratosAtivos.templatesContratos.emptyState')}
                </div>
              ) : (
                <div className="grid gap-4">
                  {templates.map((template) => (
                    <Card key={template.id}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-lg">{template.nome}</CardTitle>
                            <CardDescription>{template.descricao}</CardDescription>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="outline">
                                {tiposContrato.find(t => t.value === template.tipo)?.label}
                              </Badge>
                              <Badge variant="secondary">
                                {t('contratosAtivos.templatesContratos.requiredFieldsBadge', { count: template.campos_obrigatorios.length })}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            {onTemplateSelect && (
                              <Button 
                                size="sm" 
                                onClick={() => aplicarTemplate(template)}
                              >
                                {t('contratosAtivos.templatesContratos.useTemplateButton')}
                              </Button>
                            )}
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => duplicarTemplate(template)}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => exportarTemplate(template)}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => setEditingTemplate(template)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => excluirTemplate(template.id!)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div>
                            <h4 className="font-medium text-sm mb-1">{t('contratosAtivos.templatesContratos.defaultObjectTitle')}</h4>
                            <p className="text-sm text-muted-foreground">{template.objeto_padrao}</p>
                          </div>
                          
                          {template.sla_padrao && (
                            <div>
                              <h4 className="font-medium text-sm mb-1">{t('contratosAtivos.templatesContratos.defaultSlaTitle')}</h4>
                              <p className="text-sm text-muted-foreground">{template.sla_padrao}</p>
                            </div>
                          )}
                          
                          <div>
                            <h4 className="font-medium text-sm mb-1">{t('contratosAtivos.templatesContratos.requiredFieldsTitle')}</h4>
                            <div className="flex flex-wrap gap-1">
                              {template.campos_obrigatorios.map(campo => (
                                <Badge key={campo} variant="outline" className="text-xs">
                                  {campo}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de Formulário */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? t('contratosAtivos.templatesContratos.dialogTitleEdit') : t('contratosAtivos.templatesContratos.dialogTitleNew')}
            </DialogTitle>
            <DialogDescription>
              {t('contratosAtivos.templatesContratos.dialogDescription')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">{t('contratosAtivos.templatesContratos.labelTemplateName')}</label>
                <Input
                  value={formData.nome}
                  onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                  placeholder={t('contratosAtivos.templatesContratos.templateNamePlaceholder')}
                />
              </div>
              
              <div>
                <label className="text-sm font-medium mb-2 block">{t('contratosAtivos.templatesContratos.labelType')}</label>
                <Select value={formData.tipo} onValueChange={(value) => setFormData(prev => ({ ...prev, tipo: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('contratosAtivos.templatesContratos.typePlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {tiposContrato.map(tipo => (
                      <SelectItem key={tipo.value} value={tipo.value}>
                        {tipo.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">{t('contratosAtivos.templatesContratos.labelDescription')}</label>
              <Textarea
                value={formData.descricao}
                onChange={(e) => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
                placeholder={t('contratosAtivos.templatesContratos.descriptionPlaceholder')}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">{t('contratosAtivos.templatesContratos.labelDefaultObject')}</label>
              <Textarea
                value={formData.objeto_padrao}
                onChange={(e) => setFormData(prev => ({ ...prev, objeto_padrao: e.target.value }))}
                placeholder={t('contratosAtivos.templatesContratos.defaultObjectPlaceholder')}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">{t('contratosAtivos.templatesContratos.labelDefaultSla')}</label>
                <Input
                  value={formData.sla_padrao || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, sla_padrao: e.target.value }))}
                  placeholder={t('contratosAtivos.templatesContratos.defaultSlaPlaceholder')}
                />
              </div>
              
              <div>
                <label className="text-sm font-medium mb-2 block">{t('contratosAtivos.templatesContratos.labelDefaultPaymentTerm')}</label>
                <Input
                  type="number"
                  value={formData.prazo_pagamento_padrao || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, prazo_pagamento_padrao: Number(e.target.value) }))}
                  placeholder="30"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">{t('contratosAtivos.templatesContratos.labelDefaultPenalty')}</label>
              <Textarea
                value={formData.penalidades_padrao || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, penalidades_padrao: e.target.value }))}
                placeholder={t('contratosAtivos.templatesContratos.defaultPenaltyPlaceholder')}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">{t('contratosAtivos.templatesContratos.labelRequiredFieldsForm')}</label>
              <div className="grid grid-cols-2 gap-2">
                {camposDisponiveis.map(campo => (
                  <label key={campo} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.campos_obrigatorios.includes(campo)}
                      onChange={(e) => handleCampoObrigatorioChange(campo, e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-sm">{campo}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">{t('contratosAtivos.templatesContratos.labelDefaultClauses')}</label>
              <Textarea
                value={formData.clausulas_padrao}
                onChange={(e) => setFormData(prev => ({ ...prev, clausulas_padrao: e.target.value }))}
                placeholder={t('contratosAtivos.templatesContratos.defaultClausesPlaceholder')}
                rows={8}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setFormOpen(false)}>
                {t('contratosAtivos.common.cancel')}
              </Button>
              <Button onClick={salvarTemplate}>
                {editingTemplate ? t('contratosAtivos.templatesContratos.submitUpdateTemplate') : t('contratosAtivos.templatesContratos.submitCreateTemplate')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}