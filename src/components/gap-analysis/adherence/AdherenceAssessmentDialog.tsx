import { useState, useEffect } from 'react';
import { IconClose, IconUpload, IconFile, IconShield, IconSearch } from '@/components/icons';
import { DialogShell } from '@/components/ui/dialog-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresaId } from '@/hooks/useEmpresaId';
import { useOptimizedQuery } from '@/hooks/useOptimizedQuery';
import { AdherenceAnalysisProgress } from './AdherenceAnalysisProgress';
import { logger } from '@/lib/logger';

import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { AiCostHint } from '@/components/ui/ai-cost-hint';
import { useLanguage } from '@/contexts/LanguageContext';
interface AdherenceAssessmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  preSelectedFrameworkId?: string;
  preSelectedFrameworkNome?: string;
}

export function AdherenceAssessmentDialog({ open, onOpenChange, onSuccess, preSelectedFrameworkId, preSelectedFrameworkNome }: AdherenceAssessmentDialogProps) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { empresaId, loading: loadingEmpresa } = useEmpresaId();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [formData, setFormData] = useState({
    nome_analise: '',
    descricao: '',
    framework_id: preSelectedFrameworkId || ''
  });

  // Atualizar framework_id quando preSelectedFrameworkId mudar
  useEffect(() => {
    if (preSelectedFrameworkId) {
      setFormData(prev => ({ ...prev, framework_id: preSelectedFrameworkId }));
    }
  }, [preSelectedFrameworkId]);

  // Estado para controlar o progresso da análise
  const [analysisState, setAnalysisState] = useState<{
    isAnalyzing: boolean;
    assessmentId: string | null;
    currentStep: string;
    progress: number;
    isError: boolean;
    errorMessage: string;
  }>({
    isAnalyzing: false,
    assessmentId: null,
    currentStep: '',
    progress: 0,
    isError: false,
    errorMessage: ''
  });

  // Buscar frameworks disponíveis
  const { data: frameworks, loading: loadingFrameworks } = useOptimizedQuery(
    async () => {
      const { data, error } = await supabase
        .from('gap_analysis_frameworks')
        .select('id, nome, versao')
        .order('nome');
      
      if (error) throw error;
      return { data, error: null };
    },
    [],
    { cacheKey: 'frameworks-for-adherence', cacheDuration: 60000 }
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validar tipo de arquivo (PDF, DOCX, DOC, TXT)
      const allowedTypes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword',
        'text/plain'
      ];
      
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: t('gapAnalysis.adherenceUi.dialog.invalidFileTitle'),
          description: t('gapAnalysis.adherenceUi.dialog.invalidFileDescription'),
          variant: "destructive"
        });
        return;
      }
      
      // Validar tamanho (máximo 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: t('gapAnalysis.adherenceUi.dialog.fileTooBigTitle'),
          description: t('gapAnalysis.adherenceUi.dialog.fileTooBigDescription'),
          variant: "destructive"
        });
        return;
      }
      
      setUploadedFile(file);
    }
  };

  const removeFile = () => {
    setUploadedFile(null);
  };

  // Extrair texto de PDF
  const extractTextFromPDF = async (file: File): Promise<string> => {
    // PDF.js é grande; só o descarregamos quando um PDF realmente é enviado.
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
      fullText += pageText + '\n\n';
    }
    
    return fullText.trim();
  };

  // Extrair texto de DOCX
  const extractTextFromDOCX = async (file: File): Promise<string> => {
    // Mammoth segue a mesma regra: Word não pesa na abertura do framework.
    const { default: mammoth } = await import('mammoth');
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  };

  // Polling para verificar status da análise
  useEffect(() => {
    if (!analysisState.isAnalyzing || !analysisState.assessmentId) return;

    const pollInterval = setInterval(async () => {
      try {
        const { data, error } = await supabase
          .from('gap_analysis_adherence_assessments')
          .select('status, percentual_conformidade, metadados_analise')
          .eq('id', analysisState.assessmentId)
          .single();

        if (error) throw error;

        if (data.status === 'concluido') {
          setAnalysisState(prev => ({
            ...prev,
            progress: 100,
            currentStep: 'finalizing',
            isAnalyzing: false
          }));
          
          toast({
            title: t('gapAnalysis.adherenceUi.dialog.analysisCompleteTitle'),
            description: t('gapAnalysis.adherenceUi.dialog.analysisCompleteDescription', { pct: data.percentual_conformidade?.toFixed(1) }),
          });

          // Aguardar 2 segundos e fechar dialog
          setTimeout(() => {
            onSuccess();
            onOpenChange(false);
            
            // Resetar estados
            setAnalysisState({
              isAnalyzing: false,
              assessmentId: null,
              currentStep: '',
              progress: 0,
              isError: false,
              errorMessage: ''
            });
            setFormData({ nome_analise: '', descricao: '', framework_id: '' });
            setUploadedFile(null);
          }, 2000);

          clearInterval(pollInterval);
        } else if (data.status === 'erro') {
          const metadados = data.metadados_analise as any;
          const rawError = String(metadados?.erro || '');
          const errorMsg = /LOVABLE_API_KEY|API.?key|edge function/i.test(rawError)
            ? t('gapAnalysis.adherenceUi.dialog.aiUnavailableError')
            : rawError || t('gapAnalysis.adherenceUi.dialog.unknownError');
          
          setAnalysisState(prev => ({
            ...prev,
            isAnalyzing: false,
            isError: true,
            errorMessage: errorMsg
          }));

          toast({
            title: t('gapAnalysis.adherenceUi.dialog.analysisErrorTitle'),
            description: errorMsg,
            variant: "destructive"
          });

          clearInterval(pollInterval);
        } else if (data.status === 'processando') {
          // Atualizar progresso estimado baseado no tempo (entre 35% e 90%)
          setAnalysisState(prev => {
            const timeSinceStart = Date.now() - (prev as any).startTime || 0;
            const estimatedProgress = Math.min(35 + (timeSinceStart / 120000) * 55, 90); // 2 minutos para ir de 35% a 90%
            
            return {
              ...prev,
              progress: Math.round(estimatedProgress),
              currentStep: estimatedProgress < 60 ? 'identifying' : 'analyzing'
            };
          });
        }
      } catch (error: any) {
        logger.error('Error polling assessment status:', { error: error instanceof Error ? error.message : String(error) });
        clearInterval(pollInterval);
      }
    }, 3000); // Verificar a cada 3 segundos

    return () => clearInterval(pollInterval);
  }, [analysisState.isAnalyzing, analysisState.assessmentId, onSuccess, onOpenChange, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nome_analise || !formData.framework_id || !uploadedFile) {
      toast({
        title: t('gapAnalysis.adherenceUi.dialog.requiredFieldsTitle'),
        description: t('gapAnalysis.adherenceUi.dialog.requiredFieldsDescription'),
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);

    // Ativar estado de análise
    setAnalysisState({
      isAnalyzing: true,
      assessmentId: null,
      currentStep: 'extracting',
      progress: 0,
      isError: false,
      errorMessage: '',
      startTime: Date.now()
    } as any);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Buscar informações do framework para cache
      const framework = frameworks?.find(f => f.id === formData.framework_id);

      // Extrair texto do documento baseado no tipo
      setIsExtracting(true);
      let textContent = '';
      const originalFileType = uploadedFile.type;
      
      try {
        // Atualizar progresso: extração de texto (0-15%)
        setAnalysisState(prev => ({ ...prev, progress: 5, currentStep: 'extracting' }));

        if (originalFileType === 'application/pdf') {
          textContent = await extractTextFromPDF(uploadedFile);
        } else if (originalFileType.includes('wordprocessingml') || originalFileType === 'application/msword') {
          textContent = await extractTextFromDOCX(uploadedFile);
        } else if (originalFileType === 'text/plain') {
          textContent = await uploadedFile.text();
        } else {
          throw new Error(t('gapAnalysis.adherenceUi.dialog.unsupportedFileType'));
        }

        // Validar se o texto extraído tem conteúdo
        if (!textContent || textContent.trim().length < 100) {
          throw new Error(t('gapAnalysis.adherenceUi.dialog.insufficientText'));
        }

        logger.debug(`Texto extraído: ${textContent.length} caracteres`);
        
        // Atualizar progresso: texto extraído (15%)
        setAnalysisState(prev => ({ ...prev, progress: 15, currentStep: 'uploading' }));
      } catch (extractError: any) {
        logger.error('Error extracting text:', { error: extractError instanceof Error ? extractError.message : String(extractError) });
        
        setAnalysisState(prev => ({
          ...prev,
          isAnalyzing: false,
          isError: true,
          errorMessage: extractError.message || t('gapAnalysis.adherenceUi.dialog.extractErrorGeneric')
        }));

        toast({
          title: t('gapAnalysis.adherenceUi.dialog.extractErrorTitle'),
          description: extractError.message || t('gapAnalysis.adherenceUi.dialog.extractErrorGeneric'),
          variant: "destructive"
        });
        return;
      } finally {
        setIsExtracting(false);
      }

      // Criar arquivo TXT com o texto extraído
      const originalFileName = uploadedFile.name.split('.').slice(0, -1).join('.');
      const txtFile = new File([textContent], `${originalFileName}.txt`, { type: 'text/plain' });
      const fileExt = 'txt';
      
      // Sanitizar nome do arquivo - remover espaços, acentos e caracteres especiais
      const sanitizedFileName = uploadedFile.name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove acentos
        .replace(/[^a-zA-Z0-9.-]/g, '_') // Substitui caracteres especiais por underscore
        .replace(/_{2,}/g, '_'); // Remove múltiplos underscores consecutivos
      
      const txtFileName = `${empresaId}/${Date.now()}_${sanitizedFileName.replace(/\.[^/.]+$/, '.txt')}`;
      
      const { error: uploadError, data: uploadData } = await supabase.storage
        .from('adherence-documents')
        .upload(txtFileName, txtFile);

      if (uploadError) throw uploadError;

      // Atualizar progresso: documento enviado (25%)
      setAnalysisState(prev => ({ ...prev, progress: 25, currentStep: 'preparing' }));

      // Obter URL pública do arquivo
      const { data: { publicUrl } } = supabase.storage
        .from('adherence-documents')
        .getPublicUrl(txtFileName);

      // Criar registro inicial com status "processando"
      const { data: assessment, error: insertError } = await supabase
        .from('gap_analysis_adherence_assessments')
        .insert([{
          empresa_id: empresaId,
          framework_id: formData.framework_id,
          documento_id: null, // Não vinculado a documento do sistema
          nome_analise: formData.nome_analise,
          descricao: formData.descricao || null,
          status: 'processando',
          framework_nome: framework?.nome,
          framework_versao: framework?.versao,
          documento_nome: uploadedFile.name,
          documento_tipo: fileExt,
          metadados_analise: {
            arquivo_storage: txtFileName,
            arquivo_url: publicUrl,
            arquivo_tamanho: txtFile.size,
            arquivo_original: uploadedFile.name,
            arquivo_original_tipo: originalFileType
          },
          created_by: user?.id
        }])
        .select()
        .single();

      if (insertError) throw insertError;

      // Atualizar progresso: análise preparada (35%)
      setAnalysisState(prev => ({ 
        ...prev, 
        progress: 35, 
        currentStep: 'identifying',
        assessmentId: assessment.id
      }));

      // Chamar edge function para processar a análise (assíncrono)
      supabase.functions.invoke('analyze-document-adherence', {
        body: {
          assessmentId: assessment.id,
          frameworkId: formData.framework_id,
          storageFileName: txtFileName,
          empresaId
        }
      }).then(({ error: functionError }) => {
        if (functionError) {
          logger.error('Edge function error:', { error: functionError instanceof Error ? functionError.message : String(functionError) });
          // O polling vai detectar o erro no banco
        }
      });

      // Não fechar o dialog - deixar o polling monitorar
      // O dialog será fechado automaticamente quando o polling detectar conclusão

    } catch (error: any) {
      logger.error('Error creating adherence assessment:', { error: error instanceof Error ? error.message : String(error) });
      const rawError = String(error?.message || '');
      const errorMessage = /LOVABLE_API_KEY|API.?key|edge function/i.test(rawError)
        ? t('gapAnalysis.adherenceUi.dialog.aiUnavailableError')
        : rawError || t('gapAnalysis.adherenceUi.dialog.startErrorGeneric');
      
      setAnalysisState(prev => ({
        ...prev,
        isAnalyzing: false,
        isError: true,
        errorMessage
      }));

      toast({
        title: t('gapAnalysis.adherenceUi.dialog.startErrorTitle'),
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DialogShell
      open={open}
      onOpenChange={(newOpen) => {
        // Prevenir fechamento durante análise
        if (analysisState.isAnalyzing && !analysisState.isError) {
          toast({
            title: t('gapAnalysis.adherenceUi.dialog.analysisInProgressTitle'),
            description: t('gapAnalysis.adherenceUi.dialog.analysisInProgressDescription'),
          });
          return;
        }
        onOpenChange(newOpen);
      }}
      icon={IconSearch}
      title={analysisState.isAnalyzing ? t('gapAnalysis.adherenceUi.dialog.analyzingTitle') : t('gapAnalysis.adherenceUi.dialog.newAssessmentTitle')}
      description={analysisState.isAnalyzing
        ? t('gapAnalysis.adherenceUi.dialog.analyzingDescription')
        : t('gapAnalysis.adherenceUi.dialog.newAssessmentDescription')}
      size="md"
      hideFooter
    >
        {/* Mostrar progresso ou formulário */}
        {analysisState.isAnalyzing || analysisState.progress > 0 ? (
          <div className="min-h-[400px]">
            <AdherenceAnalysisProgress 
              currentProgress={analysisState.progress}
              currentStep={analysisState.currentStep}
              isError={analysisState.isError}
              errorMessage={analysisState.errorMessage}
            />
            
            {/* Botão de fechar em caso de erro */}
            {analysisState.isError && (
              <div className="flex justify-end gap-2 pt-4 mt-4 border-t">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setAnalysisState({
                      isAnalyzing: false,
                      assessmentId: null,
                      currentStep: '',
                      progress: 0,
                      isError: false,
                      errorMessage: ''
                    });
                    onOpenChange(false);
                  }}
                >
                  {t('gapAnalysis.adherenceUi.dialog.close')}
                </Button>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome_analise">{t('gapAnalysis.adherenceUi.dialog.nameLabel')}</Label>
            <Input
              id="nome_analise"
              value={formData.nome_analise}
              onChange={(e) => setFormData({ ...formData, nome_analise: e.target.value })}
              placeholder={t('gapAnalysis.adherenceUi.dialog.namePlaceholder')}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="descricao">{t('gapAnalysis.adherenceUi.dialog.descriptionLabel')}</Label>
            <Textarea
              id="descricao"
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              placeholder={t('gapAnalysis.adherenceUi.dialog.descriptionPlaceholder')}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="framework_id">{t('gapAnalysis.adherenceUi.dialog.frameworkLabel')}</Label>
            {preSelectedFrameworkId ? (
              <div
                id="framework_id"
                className="flex h-10 items-center gap-2 rounded-md border border-input bg-muted/40 px-3 text-sm"
              >
                <IconShield className="h-4 w-4 text-primary" strokeWidth={1.5}/>
                <span>{preSelectedFrameworkNome || t('gapAnalysis.adherenceUi.dialog.frameworkLabel')}</span>
              </div>
            ) : (
              <Select
                value={formData.framework_id}
                onValueChange={(value) => setFormData({ ...formData, framework_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('gapAnalysis.adherenceUi.dialog.frameworkPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {loadingFrameworks ? (
                    <SelectItem value="loading" disabled>{t('gapAnalysis.adherenceUi.dialog.loadingOption')}</SelectItem>
                  ) : frameworks && frameworks.length > 0 ? (
                    frameworks.map((framework: any) => (
                      <SelectItem key={framework.id} value={framework.id}>
                        <div className="flex items-center gap-2">
                          <IconShield className="h-4 w-4" strokeWidth={1.5}/>
                          {framework.nome} {framework.versao && `(${framework.versao})`}
                        </div>
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="none" disabled>{t('gapAnalysis.adherenceUi.dialog.noFrameworksOption')}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="documento">{t('gapAnalysis.adherenceUi.dialog.documentLabel')}</Label>
            <div className="mt-2">
              {!uploadedFile ? (
                <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
                  <input
                    type="file"
                    id="documento"
                    accept=".pdf,.docx,.doc,.txt"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <label htmlFor="documento" className="cursor-pointer">
                    <IconUpload className="h-10 w-10 mx-auto text-muted-foreground mb-2" strokeWidth={1.5}/>
                    <p className="text-sm font-medium">{t('gapAnalysis.adherenceUi.dialog.clickToUpload')}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t('gapAnalysis.adherenceUi.dialog.allowedTypesHint')}
                    </p>
                  </label>
                </div>
              ) : (
                <div className="border rounded-lg p-4 flex items-center justify-between bg-card">
                  <div className="flex items-center gap-3">
                    <IconFile className="h-8 w-8 text-primary" strokeWidth={1.5}/>
                    <div>
                      <p className="text-sm font-medium">{uploadedFile.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={removeFile}
                    aria-label={t('common.remove')}
                    title={t('common.remove')}
                  >
                    <IconClose className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {t('gapAnalysis.adherenceUi.dialog.uploadHint')}
            </p>
          </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-4">
              <AiCostHint variant="block" className="w-full mb-1" action={t('gapAnalysis.adherenceUi.dialog.costHintAction')} />
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t('gapAnalysis.adherenceUi.dialog.cancel')}
              </Button>
              <Button type="submit" disabled={isSubmitting || isExtracting || loadingFrameworks || !uploadedFile}>
                {(isSubmitting || isExtracting) && <AkurisPulse size={16} className="mr-2" />}
                {isExtracting ? t('gapAnalysis.adherenceUi.dialog.extractingText') : t('gapAnalysis.adherenceUi.dialog.startAnalysis')}
              </Button>
            </div>
          </form>
        )}
    </DialogShell>
  );
}
