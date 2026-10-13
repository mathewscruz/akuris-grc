import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { useLanguage } from '@/contexts/LanguageContext';
import { useIncidentAssets } from '@/hooks/useIncidentAssets';
import { routeForEntity } from '@/lib/entity-search';

interface Props {
  empresaId?: string | null;
  ids: string[];
  onNavigate: () => void;
}

export function IncidenteAtivosVinculados({ empresaId, ids, onNavigate }: Props) {
  const { t } = useLanguage();
  const { data = [], isPending, isError, refetch } = useIncidentAssets(empresaId, ids);

  if (!empresaId) return <span className="text-muted-foreground">{t('experience.unavailable')}</span>;
  if (isPending) return <AkurisPulse size={24} />;
  if (isError) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground">{t('experience.loadError')}</span>
        <Button variant="link" size="sm" className="h-auto p-0" onClick={() => void refetch()}>
          {t('experience.retryLink')}
        </Button>
      </div>
    );
  }

  const byId = new Map(data.map((asset) => [asset.id, asset]));
  return (
    <div className="flex flex-col items-start gap-2">
      {[...new Set(ids)].map((id, index) => {
        const asset = byId.get(id);
        return asset ? (
          <Button key={id} asChild variant="link" size="sm" className="h-auto max-w-full whitespace-normal break-words p-0 text-left">
            <Link to={routeForEntity('ativo', asset)} onClick={onNavigate}>{asset.titulo}</Link>
          </Button>
        ) : (
          <span key={id} className="text-muted-foreground">{t('experience.missingLink', { number: index + 1 })}</span>
        );
      })}
    </div>
  );
}