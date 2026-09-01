import { useState, useEffect } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { PageHeader } from '@/components/ui/page-header';
import { StatStrip } from '@/components/ui/stat-strip';
import { DenunciasDashboard } from '@/components/denuncia/DenunciasDashboard';
import { RelatoriosDenuncia } from '@/components/denuncia/RelatoriosDenuncia';
import { NovaDenunciaDialog } from '@/components/denuncia/NovaDenunciaDialog';
import { useDenunciasStats } from '@/hooks/useDenunciasStats';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useLanguage } from '@/contexts/LanguageContext';
import { IconChart, IconOrg } from '@/components/icons';
import { useEmpresasDoCanal } from '@/hooks/useEmpresasDoCanal';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function Denuncia() {
  const { t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const [denunciaIdToOpen, setDenunciaIdToOpen] = useState<string | null>(null);
  const [relatoriosOpen, setRelatoriosOpen] = useState(false);
  const [dashboardRefreshKey, setDashboardRefreshKey] = useState(0);
  /*
    A consola multi-cliente.

    Uma consultoria que licencia o canal de várias empresas trata do canal de
    todas — é o modelo de receita de quem vende só canal. Para quem gere uma
    empresa só, o seletor não aparece e nada muda.
  */
  const { empresas, ehConsultoria } = useEmpresasDoCanal();
  const [empresaSelecionada, setEmpresaSelecionada] = useState<string | null>(null);
  const empresaAtiva = empresaSelecionada ?? empresas[0]?.empresa_id ?? null;
  const ehCliente = empresas.find((e) => e.empresa_id === empresaAtiva)?.propria === false;
  const { data: stats, isLoading: statsLoading } = useDenunciasStats(empresaAtiva);

  /*
    Duas maneiras de chegar à mesma denúncia.

    `location.state` só existe quando a navegação foi feita em JS na mesma
    sessão — é o caminho do painel. O `?focus=<id>` da busca global, do
    `EntidadeSelect` e do sino sobrevive a link colado e a recarregamento, e
    não tinha aqui quem o lesse: `searchParams` estava declarado e nunca
    usado, e o link caía na lista inteira. Consumido uma vez e limpo, para
    que voltar atrás não reabra a ficha.
  */
  useEffect(() => {
    const doEndereco = searchParams.get('focus');
    const alvo = location.state?.itemId ?? doEndereco;
    if (!alvo) return;
    setDenunciaIdToOpen(alvo);
    if (doEndereco) {
      const proximo = new URLSearchParams(searchParams);
      proximo.delete('focus');
      setSearchParams(proximo, { replace: true });
    }
  }, [location.state, searchParams, setSearchParams]);

  const handleDenunciaCriada = () => {
    setDashboardRefreshKey((prev) => prev + 1);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('modules.denuncia.title')}
        description={t('modules.denuncia.description')}
        /* Registar denúncia é acto de quem trabalha na empresa. Uma
           consultoria a ver o canal de um cliente não regista por ele. */
        actions={ehCliente ? undefined : <NovaDenunciaDialog onDenunciaCriada={handleDenunciaCriada} />}
        secondaryActions={[
          {
            label: t('cardsKpi.denuncias.abrirRelatorios'),
            icon: <IconChart className="h-4 w-4" />,
            onClick: () => setRelatoriosOpen(true),
          },
        ]}
      />

      {ehConsultoria && (
        <div className="flex flex-wrap items-center gap-2">
          <IconOrg className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
          <span className="text-xs text-muted-foreground">
            {t('denunciasAdmin.consultoria.aVer')}
          </span>
          <Select
            value={empresaAtiva ?? ''}
            onValueChange={(v) => setEmpresaSelecionada(v)}
          >
            <SelectTrigger className="h-8 w-auto min-w-[14rem]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {empresas.map((e) => (
                <SelectItem key={e.empresa_id} value={e.empresa_id}>
                  {e.nome}
                  {e.propria ? '' : ` — ${t('denunciasAdmin.consultoria.cliente')}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <StatStrip
        loading={statsLoading}
        items={[
          { key: 'total', label: t('cardsKpi.denuncias.total'), value: stats?.total ?? 0, drillDown: 'denuncias' },
          { key: 'novas', label: t('cardsKpi.denuncias.novas'), value: stats?.novas ?? 0, tone: 'warning', drillDown: 'denuncias_novas' },
          { key: 'emAndamento', label: t('cardsKpi.denuncias.emAndamento'), value: stats?.em_andamento ?? 0, drillDown: 'denuncias_andamento' },
          /* O único número com consequência legal, e o que faltava: a Diretiva
             dá três meses para dar retorno a quem denunciou. */
          { key: 'prazoVencido', label: t('cardsKpi.denuncias.prazoVencido'), value: stats?.prazo_vencido ?? 0, tone: 'destructive' as const },
          { key: 'resolvidas', label: t('cardsKpi.denuncias.resolvidas'), value: stats?.resolvidas ?? 0, drillDown: 'denuncias_resolvidas' },
        ]}
      />

      <DenunciasDashboard
        itemIdToOpen={denunciaIdToOpen}
        refreshKey={dashboardRefreshKey}
        empresaSelecionada={empresaAtiva}
      />

      {/* Relatórios Dialog */}
      <Dialog open={relatoriosOpen} onOpenChange={setRelatoriosOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('cardsKpi.denuncias.relatorios')}</DialogTitle>
          </DialogHeader>
          <RelatoriosDenuncia />
        </DialogContent>
      </Dialog>
    </div>
  );
}