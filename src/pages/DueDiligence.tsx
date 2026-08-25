import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { TemplatesManager } from '@/components/due-diligence/TemplatesManager';
import { AssessmentsManagerEnhanced } from '@/components/due-diligence/AssessmentsManagerEnhanced';
import { FornecedoresManager } from '@/components/due-diligence/FornecedoresManager';
import { DueDiligenceDashboard } from '@/components/due-diligence/DueDiligenceDashboard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/ui/page-header';
import { useLanguage } from '@/contexts/LanguageContext';

export default function DueDiligence() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('fornecedores');
  const [assessmentFilter, setAssessmentFilter] = useState<{ fornecedorId?: string; fornecedorNome?: string } | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [focoAvaliacao, setFocoAvaliacao] = useState<string | null>(null);

  /*
    A avaliação vive atrás de uma aba, e a aba de entrada é a de fornecedores.

    O `?focus=<id>` que a busca global emite para aqui não tinha leitor: quem
    clicava numa avaliação no ⌘K aterrava na lista de FORNECEDORES, que nem
    sequer é onde a avaliação está. Trocar de aba é metade — o id segue para
    o gestor de avaliações, que abre a ficha (as avaliações são cartões
    paginados, e destacar um cartão da página 3 não bastava).
  */
  useEffect(() => {
    const alvo = searchParams.get('focus');
    if (!alvo) return;
    setActiveTab('assessments');
    setFocoAvaliacao(alvo);
    const proximo = new URLSearchParams(searchParams);
    proximo.delete('focus');
    setSearchParams(proximo, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    // Vindo de um template: abre a aba de avaliações e pede a criação já com o
    // template escolhido. (A navegação por fornecedor deixou de passar pelo
    // `window`: o gestor de fornecedores chama as acções directamente.)
    const handleCreateAssessmentFromTemplate = (event: CustomEvent) => {
      setActiveTab('assessments');
      setTimeout(() => {
        const createEvent = new CustomEvent('createAssessment', {
          detail: { templateId: event.detail.templateId, templateNome: event.detail.templateNome }
        });
        window.dispatchEvent(createEvent);
      }, 100);
    };

    window.addEventListener('createAssessmentFromTemplate', handleCreateAssessmentFromTemplate as EventListener);

    return () => {
      window.removeEventListener('createAssessmentFromTemplate', handleCreateAssessmentFromTemplate as EventListener);
    };
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('modules.dueDiligence.title')}
        description={t('modules.dueDiligence.description')}
      />

      {/* Dashboard always visible on top */}
      <DueDiligenceDashboard />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="fornecedores">{t('modules.dueDiligence.suppliers')}</TabsTrigger>
          <TabsTrigger value="assessments">{t('modules.dueDiligence.newAssessment')}</TabsTrigger>
          <TabsTrigger value="templates">{t('modules.dueDiligence.templates')}</TabsTrigger>
        </TabsList>

        <TabsContent value="fornecedores" className="space-y-6">
          <FornecedoresManager
            acoesAvaliacao={{
              ver: (f) => {
                setAssessmentFilter({ fornecedorId: f.id, fornecedorNome: f.nome });
                setActiveTab('assessments');
              },
              nova: (f) => {
                setAssessmentFilter({ fornecedorId: f.id, fornecedorNome: f.nome });
                setActiveTab('assessments');
                // A aba de avaliações só monta ao trocar; o pedido de "nova"
                // chega logo a seguir, quando já há quem o ouça.
                setTimeout(() => {
                  window.dispatchEvent(
                    new CustomEvent('createAssessment', {
                      detail: { fornecedorId: f.id, fornecedorNome: f.nome },
                    }),
                  );
                }, 100);
              },
            }}
          />
        </TabsContent>

        <TabsContent value="assessments" className="space-y-6">
          <AssessmentsManagerEnhanced filter={assessmentFilter} focoId={focoAvaliacao} />
        </TabsContent>

        <TabsContent value="templates" className="space-y-6">
          <TemplatesManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
