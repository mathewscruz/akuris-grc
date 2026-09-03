import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import { useLocation, useNavigate } from 'react-router-dom';
import { IconClose, IconSuccess, IconWarning, IconDot, IconDatabase, IconShield, IconFileCheck, IconLock, IconChart, IconArrowRight, IconArrowLeft, IconBolt } from '@/components/icons';
import { useLanguage } from '@/contexts/LanguageContext';
import { exigirEscrita } from '@/lib/supabase-write';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  route: string;
  completed: boolean;
}

export function OnboardingWizard() {
  const { t } = useLanguage();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [stepsCompleted, setStepsCompleted] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  const steps: OnboardingStep[] = [
    { id: 'ativos', title: t('sweepCore.onboarding.ativosTitle'), description: t('sweepCore.onboarding.ativosDescription'), icon: <IconDatabase className="h-5 w-5" />, route: '/ativos', completed: stepsCompleted.includes('ativos') },
    { id: 'riscos', title: t('sweepCore.onboarding.riscosTitle'), description: t('sweepCore.onboarding.riscosDescription'), icon: <IconWarning className="h-5 w-5" />, route: '/riscos', completed: stepsCompleted.includes('riscos') },
    { id: 'controles', title: t('sweepCore.onboarding.controlesTitle'), description: t('sweepCore.onboarding.controlesDescription'), icon: <IconShield className="h-5 w-5" />, route: '/governanca/controles', completed: stepsCompleted.includes('controles') },
    { id: 'frameworks', title: t('sweepCore.onboarding.frameworksTitle'), description: t('sweepCore.onboarding.frameworksDescription'), icon: <IconChart className="h-5 w-5" />, route: '/gap-analysis/frameworks', completed: stepsCompleted.includes('frameworks') },
    { id: 'documentos', title: t('sweepCore.onboarding.documentosTitle'), description: t('sweepCore.onboarding.documentosDescription'), icon: <IconFileCheck className="h-5 w-5" />, route: '/documentos', completed: stepsCompleted.includes('documentos') },
  ];

  const completedCount = stepsCompleted.length;
  const progress = (completedCount / steps.length) * 100;

  useEffect(() => {
    if (user && profile?.empresa_id) {
      setLoading(true);
      setOpen(false);
      setDismissed(false);
      setStepsCompleted([]);
      checkOnboardingStatus();
    }
  }, [user, profile?.empresa_id]);

  // O assistente abre sozinho no máximo uma vez por sessão e empresa, e só
  // no dashboard. Nos demais módulos ele continua disponível pelo botão
  // flutuante, sem interromper o trabalho que a pessoa acabou de iniciar.
  useEffect(() => {
    if (loading || dismissed || completedCount >= steps.length) return;
    if (!user || !profile?.empresa_id || location.pathname !== '/dashboard') return;

    const key = `akuris_onboarding_seen:${user.id}:${profile.empresa_id}`;
    try {
      if (sessionStorage.getItem(key) === '1') return;
      sessionStorage.setItem(key, '1');
    } catch {
      // Sem sessionStorage, abrir uma vez durante a vida deste componente.
      if (open) return;
    }
    setOpen(true);
  }, [
    completedCount,
    dismissed,
    loading,
    location.pathname,
    open,
    profile?.empresa_id,
    steps.length,
    user,
  ]);

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
        // Primeiro acesso: cria o progresso. A abertura é decidida pelo efeito
        // acima, uma única vez e no contexto certo.
        await exigirEscrita(supabase.from('onboarding_progress').insert({
          user_id: user.id,
          empresa_id: profile.empresa_id,
        }));
        await autoDetectProgress();
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
      // Framework no catálogo não significa framework ativado pela empresa.
      // Uma avaliação (inclusive N/A criada pelo escopo) é o primeiro sinal de
      // que a empresa realmente começou a trabalhar naquele framework.
      supabase.from('gap_analysis_evaluations').select('id', { count: 'exact', head: true }).eq('empresa_id', profile.empresa_id),
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
      await exigirEscrita(supabase.from('onboarding_progress')
        .update({ steps_completed: completed, completed: allDone, current_step: completed.length })
        .eq('user_id', user.id)
        .eq('empresa_id', profile.empresa_id));
    }

  };

  const handleDismiss = async () => {
    setOpen(false);
    setDismissed(true);
    if (user && profile?.empresa_id) {
      await exigirEscrita(supabase.from('onboarding_progress')
        .update({ dismissed: true })
        .eq('user_id', user.id)
        .eq('empresa_id', profile.empresa_id));
    }
  };

  const handleGoToStep = (step: OnboardingStep) => {
    setOpen(false);
    navigate(step.route);
  };

  // O Gap Analysis tem onboarding próprio e sequencial já no catálogo. Exibir
  // o setup geral por cima dele cria dois assistentes concorrentes no mesmo
  // primeiro acesso.
  if (loading || dismissed || completedCount >= steps.length || location.pathname.startsWith('/gap-analysis')) return null;

  return (
    <>
      {/* Floating trigger button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-primary text-primary-foreground rounded-md shadow-lg hover:shadow-lg transition-ui hover:scale-105 animate-fade-in"
        >
          <IconBolt className="h-5 w-5" />
          <span className="text-sm font-medium hidden sm:inline">Setup {completedCount}/{steps.length}</span>
          <div className="w-8 h-8 flex items-center justify-center text-xs font-bold">
            {Math.round(progress)}%
          </div>
        </button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-3">
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
                  className={`p-3 cursor-pointer transition-ui hover:shadow-sm ${
                    step.completed 
                      ? 'bg-success/5 border-success/20' 
                      : index === currentStep 
                        ? 'border-primary/40 bg-primary/5' 
                        : 'hover:bg-accent'
                  }`}
                  onClick={() => !step.completed && setCurrentStep(index)}
                  role={step.completed ? undefined : 'button'}
                  tabIndex={step.completed ? undefined : 0}
                  onKeyDown={(event) => {
                    if (step.completed || (event.key !== 'Enter' && event.key !== ' ')) return;
                    event.preventDefault();
                    setCurrentStep(index);
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${step.completed ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>
                      {step.completed ? <IconSuccess className="h-5 w-5" /> : step.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`text-sm font-medium ${step.completed ? 'line-through text-muted-foreground' : ''}`}>
                          {step.title}
                        </p>
                        {step.completed && <Badge variant="success" size="sm">{t('sweepCore.onboarding.done')}</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
                    </div>
                    {!step.completed && (
                      <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); handleGoToStep(step); }}>
                        <IconArrowRight className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>

            <div className="flex justify-between pt-2">
              <Button variant="ghost" size="sm" onClick={handleDismiss} className="text-muted-foreground">
                <IconClose className="h-4 w-4 mr-1" /> {t('sweepCore.onboarding.skip')}
              </Button>
              {!steps[currentStep]?.completed && (
                <Button size="sm" onClick={() => handleGoToStep(steps[currentStep])}>
                  {t('sweepCore.onboarding.goTo', { title: steps[currentStep]?.title ?? '' })} <IconArrowRight className="h-4 w-4 ml-1" />
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
