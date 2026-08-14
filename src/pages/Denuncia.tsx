import { useState, useEffect } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { PageHeader } from '@/components/ui/page-header';
import { StatStrip } from '@/components/ui/stat-strip';
import { DenunciasDashboard } from '@/components/denuncia/DenunciasDashboard';
import { RelatoriosDenuncia } from '@/components/denuncia/RelatoriosDenuncia';
import { useDenunciasStats } from '@/hooks/useDenunciasStats';
import { BarChart3 } from 'lucide-react';
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
        secondaryActions={[
          {
            label: t('cardsKpi.denuncias.abrirRelatorios'),
            icon: <BarChart3 className="h-4 w-4" />,
            onClick: () => setRelatoriosOpen(true),
          },
        ]}
      />

      <StatStrip
        loading={statsLoading}
        items={[
          { key: 'total', label: t('cardsKpi.denuncias.total'), value: stats?.total ?? 0, drillDown: 'denuncias' },
          { key: 'novas', label: t('cardsKpi.denuncias.novas'), value: stats?.novas ?? 0, tone: 'warning', drillDown: 'denuncias' },
          { key: 'emAndamento', label: t('cardsKpi.denuncias.emAndamento'), value: stats?.em_andamento ?? 0, drillDown: 'denuncias' },
          { key: 'resolvidas', label: t('cardsKpi.denuncias.resolvidas'), value: stats?.resolvidas ?? 0, drillDown: 'denuncias' },
        ]}
      />

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