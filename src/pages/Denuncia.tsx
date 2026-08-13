import { useState, useEffect } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { DenunciasDashboard } from '@/components/denuncia/DenunciasDashboard';
import { RelatoriosDenuncia } from '@/components/denuncia/RelatoriosDenuncia';
import { useDenunciasStats } from '@/hooks/useDenunciasStats';
import { Shield, AlertTriangle, Clock, CheckCircle, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useLanguage } from '@/contexts/LanguageContext';

export default function Denuncia() {
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const [denunciaIdToOpen, setDenunciaIdToOpen] = useState<string | null>(null);
  const [relatoriosOpen, setRelatoriosOpen] = useState(false);
  const { data: stats, isLoading: statsLoading } = useDenunciasStats();

  // Detectar se veio com itemId do dashboard
  useEffect(() => {
    const itemId = location.state?.itemId;
    if (itemId) {
      setDenunciaIdToOpen(itemId);
    }
  }, [location.state]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('modules.denuncia.title')}
        description={t('modules.denuncia.description')}
        actions={
          <Button variant="outline" onClick={() => setRelatoriosOpen(true)}>
            <BarChart3 className="h-4 w-4 mr-2" />
            Relatórios
          </Button>
        }
      />

      {/* StatCards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          title="Total"
          value={stats?.total ?? 0}
          icon={<Shield />}
          description={t('cardsKpi.denuncias.denunciasRegistradas')}
          loading={statsLoading}
          drillDown="denuncias"
          showAccent
          emptyHint="As denúncias aparecerão conforme forem recebidas."
        />
        
        <StatCard
          title="Novas"
          value={stats?.novas ?? 0}
          icon={<AlertTriangle />}
          description={t('cardsKpi.denuncias.aguardandoAnalise')}
          loading={statsLoading}
          variant="warning"
          drillDown="denuncias"
        />
        
        <StatCard
          title="Em Andamento"
          value={stats?.em_andamento ?? 0}
          icon={<Clock />}
          description="Sendo investigadas"
          loading={statsLoading}
          variant="info"
          drillDown="denuncias"
        />
        
        <StatCard
          title="Resolvidas"
          value={stats?.resolvidas ?? 0}
          icon={<CheckCircle />}
          description={t('cardsKpi.denuncias.concluidas')}
          loading={statsLoading}
          variant="success"
        />
      </div>

      <DenunciasDashboard itemIdToOpen={denunciaIdToOpen} />

      {/* Relatórios Dialog */}
      <Dialog open={relatoriosOpen} onOpenChange={setRelatoriosOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('cardsKpi.denuncias.relatorios')}</DialogTitle>
          </DialogHeader>
          <RelatoriosDenuncia />
        </DialogContent>
      </Dialog>
    </div>
  );
}