import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Rocket, CheckCircle2, Circle, AlertTriangle, Database, Shield, FileCheck, Lock, BarChart3, ArrowRight, ArrowLeft, X } from 'lucide-react';
import { AkurisAIIcon } from '@/components/icons';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  route: string;
  completed: boolean;
}

export function OnboardingWizard() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [stepsCompleted, setStepsCompleted] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  const steps: OnboardingStep[] = [
    { id: 'ativos', title: 'Cadastrar Ativos', description: 'Registre seus primeiros ativos de TI para ter visibilidade do inventário', icon: <Database className="h-5 w-5" />, route: '/ativos', completed: stepsCompleted.includes('ativos') },
    { id: 'riscos', title: 'Identificar Riscos', description: 'Crie pelo menos um risco para iniciar a gestão de riscos', icon: <AlertTriangle className="h-5 w-5" />, route: '/riscos', completed: stepsCompleted.includes('riscos') },
    { id: 'controles', title: 'Implementar Controles', description: 'Defina controles internos para mitigar os riscos identificados', icon: <Shield className="h-5 w-5" />, route: '/governanca?tab=controles', completed: stepsCompleted.includes('controles') },
    { id: 'frameworks', title: 'Ativar Frameworks', description: 'Selecione os frameworks de compliance relevantes (ISO 27001, LGPD, etc.)', icon: <BarChart3 className="h-5 w-5" />, route: '/gap-analysis/frameworks', completed: stepsCompleted.includes('frameworks') },
    { id: 'documentos', title: 'Adicionar Documentos', description: 'Faça upload das políticas e documentos de segurança existentes', icon: <FileCheck className="h-5 w-5" />, route: '/documentos', completed: stepsCompleted.includes('documentos') },
  ];

  const completedCount = stepsCompleted.length;
  const progress = (completedCount / steps.length) * 100;

  useEffect(() => {
    if (user && profile?.empresa_id) {
      checkOnboardingStatus();
    }
  }, [user, profile?.empresa_id]);

  const checkOnboardingStatus = async () => {
    if (!user || !profile?.empresa_id) return;
    try {
      const { data } = await supabase
        .from('onboarding_progress')
        .select('*')
        .eq('user_id', user.id)
        .eq('empresa_id', profile.empresa_id)
        .maybeSingle();

      if (data) {
        setStepsCompleted(Array.isArray(data.steps_completed) ? data.steps_completed as string[] : []);
        setDismissed(data.dismissed || data.completed);
        if (!data.dismissed && !data.completed) {
          // Check actual data to auto-complete steps
          await autoDetectProgress();
        }
      } else {
        // First time - create record and show wizard
        await supabase.from('onboarding_progress').insert({
          user_id: user.id,
          empresa_id: profile.empresa_id,
        });
        await autoDetectProgress();
        setOpen(true);
      }
    } catch (err) {
      console.error('Onboarding check error:', err);
    } finally {
      setLoading(false);
    }
  };

  const autoDetectProgress = async () => {
    if (!profile?.empresa_id) return;
    const completed: string[] = [];

    const [ativos, riscos, controles, frameworks, docs] = await Promise.all([
      supabase.from('ativos').select('id', { count: 'exact', head: true }).eq('empresa_id', profile.empresa_id),
      supabase.from('riscos').select('id', { count: 'exact', head: true }).eq('empresa_id', profile.empresa_id),
      supabase.from('controles').select('id', { count: 'exact', head: true }).eq('empresa_id', profile.empresa_id),
      supabase.from('gap_analysis_frameworks').select('id', { count: 'exact', head: true }),
      supabase.from('documentos').select('id', { count: 'exact', head: true }).eq('empresa_id', profile.empresa_id),
    ]);

    if ((ativos.count || 0) > 0) completed.push('ativos');
    if ((riscos.count || 0) > 0) completed.push('riscos');
    if ((controles.count || 0) > 0) completed.push('controles');
    if ((frameworks.count || 0) > 0) completed.push('frameworks');
    if ((docs.count || 0) > 0) completed.push('documentos');

    setStepsCompleted(completed);
    
    const allDone = completed.length >= steps.length;
    if (user && profile?.empresa_id) {
      await supabase.from('onboarding_progress')
        .update({ steps_completed: completed, completed: allDone, current_step: completed.length })
        .eq('user_id', user.id)
        .eq('empresa_id', profile.empresa_id);
    }

    if (!allDone && completed.length < steps.length) {
      setOpen(true);
    }
  };

  const handleDismiss = async () => {
    setOpen(false);
    setDismissed(true);
    if (user && profile?.empresa_id) {
      await supabase.from('onboarding_progress')
        .update({ dismissed: true })
        .eq('user_id', user.id)
        .eq('empresa_id', profile.empresa_id);
    }
  };

  const handleGoToStep = (step: OnboardingStep) => {
    setOpen(false);
    navigate(step.route);
  };

  if (loading || dismissed || completedCount >= steps.length) return null;

  return (
    <>
      {/* Floating trigger button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-primary text-primary-foreground rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-105 animate-fade-in"
        >
          <Rocket className="h-5 w-5" />
          <span className="text-sm font-medium hidden sm:inline">Setup {completedCount}/{steps.length}</span>
          <div className="w-8 h-8 rounded-full bg-primary-foreground/20 flex items-center justify-center text-xs font-bold">
            {Math.round(progress)}%
          </div>
        </button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10">
                <AkurisAIIcon className="h-6 w-6 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-xl">{t('cardsKpi.sweep.sistema.configureSuaPlataforma')}</DialogTitle>
                <DialogDescription>
                  {t('cardsKpi.sweep.sistema.configurePlataformaDesc')}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div className="flex items-center gap-3">
              <Progress value={progress} className="flex-1 h-2" />
              <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">
                {completedCount}/{steps.length}
              </span>
            </div>

            <div className="space-y-2">
              {steps.map((step, index) => (
                <Card
                  key={step.id}
                  className={`p-3 cursor-pointer transition-all hover:shadow-sm ${
                    step.completed 
                      ? 'bg-success/5 border-success/20' 
                      : index === currentStep 
                        ? 'border-primary/40 bg-primary/5' 
                        : 'hover:bg-muted/50'
                  }`}
                  onClick={() => !step.completed && setCurrentStep(index)}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${step.completed ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>
                      {step.completed ? <CheckCircle2 className="h-5 w-5" /> : step.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`text-sm font-medium ${step.completed ? 'line-through text-muted-foreground' : ''}`}>
                          {step.title}
                        </p>
                        {step.completed && <Badge variant="success" size="sm">Feito</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
                    </div>
                    {!step.completed && (
                      <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); handleGoToStep(step); }}>
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>

            <div className="flex justify-between pt-2">
              <Button variant="ghost" size="sm" onClick={handleDismiss} className="text-muted-foreground">
                <X className="h-4 w-4 mr-1" /> Pular por agora
              </Button>
              {!steps[currentStep]?.completed && (
                <Button size="sm" onClick={() => handleGoToStep(steps[currentStep])}>
                  Ir para {steps[currentStep]?.title} <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
