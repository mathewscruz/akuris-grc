import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { IconSuccess, IconWarning, IconFile, IconShield } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

interface IntegrationSuggestionsProps {
  assessment: {
    id: string;
    fornecedor_nome: string;
    score_final: number;
  };
}

export function IntegrationSuggestions({ assessment }: IntegrationSuggestionsProps) {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [isCreating, setIsCreating] = useState(false);
  
  const createRisk = async () => {
    try {
      setIsCreating(true);
      const { data: userData } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from('profiles')
        .select('empresa_id')
        .eq('user_id', userData.user?.id)
        .single();
      
      if (!profile?.empresa_id) {
        throw new Error('Empresa não encontrada');
      }

      // `score_final` já é percentagem — este risco ia para o registo com
      // um valor dez vezes maior do que a avaliação real.
      const scorePorcentagem = assessment.score_final;
      
      const { error } = await supabase
        .from('riscos')
        .insert({
          empresa_id: profile.empresa_id,
          nome: `Risco de Fornecedor - ${assessment.fornecedor_nome}`,
          descricao: t('dueDiligence.integrationSuggestions.riskDescription', { score: scorePorcentagem.toFixed(1) }),
          probabilidade_inicial: scorePorcentagem < 40 ? 'provavel' : scorePorcentagem < 60 ? 'possivel' : 'improvavel',
          impacto_inicial: scorePorcentagem < 40 ? 'maior' : scorePorcentagem < 60 ? 'moderado' : 'menor',
          nivel_risco_inicial: scorePorcentagem < 40 ? 'alto' : scorePorcentagem < 60 ? 'medio' : 'baixo',
          status: 'identificado',
          data_identificacao: new Date().toISOString()
        });
      
      if (error) throw error;
      
      toast({
        title: t('dueDiligence.integrationSuggestions.toastRiskCreatedTitle'),
        description: t('dueDiligence.integrationSuggestions.toastRiskCreatedDescription'),
      });
    } catch (error: any) {
      console.error('Erro ao criar risco:', error);
      toast({
        title: t('dueDiligence.integrationSuggestions.errorTitle'),
        description: error.message || t('dueDiligence.integrationSuggestions.errorRiskDescriptionFallback'),
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };
  
  const requestDocument = () => {
    toast({
      title: t('dueDiligence.integrationSuggestions.toastDocRequestTitle'),
      description: t('dueDiligence.integrationSuggestions.toastDocRequestDescription'),
    });
  };

  // Mesma escala do resto: `score_final` já é 0-100. Com o `* 10`, o aviso
  // de "score crítico abaixo de 50" nunca disparava — 5 já dava 50.
  const scorePorcentagem = assessment.score_final;

  return (
    <div className="space-y-4">
      {scorePorcentagem < 50 && (
        <Alert variant="destructive">
          <IconWarning className="h-4 w-4" />
          <AlertTitle>{t('dueDiligence.integrationSuggestions.criticalTitle')}</AlertTitle>
          <AlertDescription>
            {t('dueDiligence.integrationSuggestions.criticalDescription', { score: scorePorcentagem.toFixed(1) })}
          </AlertDescription>
        </Alert>
      )}
      
      {scorePorcentagem >= 50 && scorePorcentagem < 70 && (
        <Alert>
          <IconWarning className="h-4 w-4" />
          <AlertTitle>{t('dueDiligence.integrationSuggestions.attentionTitle')}</AlertTitle>
          <AlertDescription>
            {t('dueDiligence.integrationSuggestions.attentionDescription', { score: scorePorcentagem.toFixed(1) })}
          </AlertDescription>
        </Alert>
      )}

      {scorePorcentagem >= 80 && (
        <Alert className="border-success/30 bg-success/10">
          <IconSuccess className="h-4 w-4 text-success" />
          <AlertTitle className="text-success">{t('dueDiligence.integrationSuggestions.excellentTitle')}</AlertTitle>
          <AlertDescription className="text-success">
            {t('dueDiligence.integrationSuggestions.excellentDescription', { score: scorePorcentagem.toFixed(1) })}
          </AlertDescription>
        </Alert>
      )}
      
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('dueDiligence.integrationSuggestions.recommendedActionsTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            onClick={createRisk}
            disabled={isCreating}
            variant={scorePorcentagem < 50 ? 'default' : 'outline'}
            className="w-full justify-start"
          >
            <IconShield className="h-4 w-4 mr-2" />
            {isCreating ? t('dueDiligence.integrationSuggestions.creatingRisk') : t('dueDiligence.integrationSuggestions.createRiskInModule')}
          </Button>
          
          <Button
            onClick={requestDocument}
            variant="outline"
            className="w-full justify-start"
          >
            <IconFile className="h-4 w-4 mr-2" />
            {t('dueDiligence.integrationSuggestions.requestAdditionalDocs')}
          </Button>
          
          {scorePorcentagem >= 80 && (
            <Button
              variant="outline"
              className="w-full justify-start text-success hover:text-success hover:bg-success/10"
            >
              <IconSuccess className="h-4 w-4 mr-2" />
              {t('dueDiligence.integrationSuggestions.approveSupplier')}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
