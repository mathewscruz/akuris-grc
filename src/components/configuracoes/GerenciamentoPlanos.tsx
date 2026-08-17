import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Plus, Edit, Star, Users, Sparkles, Building2 } from 'lucide-react';
import { fetchPlanos, formatBRL, MODULOS_DISPONIVEIS, type Plano } from '@/lib/planos-utils';
import { PlanoFormDialog } from './PlanoFormDialog';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useLanguage } from '@/contexts/LanguageContext';

import { AkurisPulse } from '@/components/ui/AkurisPulse';
interface PlanoWithCount extends Plano {
  empresas_count: number;
}

export const GerenciamentoPlanos: React.FC = () => {
  const { t } = useLanguage();
  const [planos, setPlanos] = useState<PlanoWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlano, setEditingPlano] = useState<Plano | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState<{ plano: PlanoWithCount; nextValue: boolean } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchPlanos(true);
      const { data: empresas } = await supabase
        .from('empresas')
        .select('plano_id')
        .not('plano_id', 'is', null);
      const counts = new Map<string, number>();
      (empresas || []).forEach((e: any) => {
        if (e.plano_id) counts.set(e.plano_id, (counts.get(e.plano_id) || 0) + 1);
      });
      setPlanos(data.map(p => ({ ...p, empresas_count: counts.get(p.id) || 0 })));
    } catch (err: any) {
      toast.error(err.message || t('configPlanos.gerenciamentoPlanos.loadError'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleNew = () => {
    setEditingPlano(null);
    setDialogOpen(true);
  };

  const handleEdit = (plano: Plano) => {
    setEditingPlano(plano);
    setDialogOpen(true);
  };

  const handleToggleAtivo = async (plano: PlanoWithCount, nextValue: boolean) => {
    if (!nextValue && plano.empresas_count > 0) {
      setConfirmDeactivate({ plano, nextValue });
      return;
    }
    await applyToggle(plano.id, nextValue);
  };

  const applyToggle = async (id: string, ativo: boolean) => {
    const { error } = await supabase.from('planos').update({ ativo }).eq('id', id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(ativo ? t('configPlanos.gerenciamentoPlanos.toggleOnSuccess') : t('configPlanos.gerenciamentoPlanos.toggleOffSuccess'));
    load();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <AkurisPulse size={32} className="text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start gap-3 flex-wrap">
        <div>
          <h3 className="text-lg font-semibold text-foreground">{t('configPlanos.gerenciamentoPlanos.headerTitle')}</h3>
          <p className="text-sm text-muted-foreground">
            {t('configPlanos.gerenciamentoPlanos.headerSubtitle')}
          </p>
        </div>
        <Button onClick={handleNew}>
          <Plus className="h-4 w-4 mr-2" /> {t('configPlanos.gerenciamentoPlanos.newPlano')}
        </Button>
      </div>

      {planos.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {t('configPlanos.gerenciamentoPlanos.emptyState')}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {planos.map(plano => (
            <Card key={plano.id} className={plano.is_destaque ? 'border-primary' : ''}>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start gap-2">
                  <div className="space-y-1">
                    <CardTitle className="text-base flex items-center gap-2">
                      {plano.nome}
                      {plano.is_destaque && <Star className="h-4 w-4 text-primary fill-primary" />}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground font-mono">{plano.codigo}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={plano.ativo}
                      onCheckedChange={(v) => handleToggleAtivo(plano, v)}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {plano.descricao && (
                  <p className="text-sm text-muted-foreground line-clamp-2">{plano.descricao}</p>
                )}
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-foreground">{formatBRL(plano.preco_mensal)}</span>
                  <span className="text-sm text-muted-foreground">{t('configPlanos.gerenciamentoPlanos.porMes')}</span>
                  {plano.preco_anual > 0 && (
                    <span className="text-xs text-muted-foreground ml-2">{t('configPlanos.gerenciamentoPlanos.porAno', { valor: formatBRL(plano.preco_anual) })}</span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  <div className="space-y-0.5">
                    <p className="text-muted-foreground">{t('configPlanos.gerenciamentoPlanos.usuarios')}</p>
                    <p className="font-medium text-foreground flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {plano.limite_usuarios ?? '∞'}
                    </p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-muted-foreground">{t('configPlanos.gerenciamentoPlanos.creditosIA')}</p>
                    <p className="font-medium text-foreground flex items-center gap-1">
                      <Sparkles className="h-3 w-3" />
                      {plano.creditos_franquia}
                    </p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-muted-foreground">{t('configPlanos.gerenciamentoPlanos.empresas')}</p>
                    <p className="font-medium text-foreground flex items-center gap-1">
                      <Building2 className="h-3 w-3" />
                      {plano.empresas_count}
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground">{t('configPlanos.gerenciamentoPlanos.modulosLiberados', { count: plano.modulos_habilitados.length })}</p>
                  <div className="flex flex-wrap gap-1">
                    {plano.modulos_habilitados.length === 0 ? (
                      <span className="text-xs text-muted-foreground">{t('configPlanos.gerenciamentoPlanos.nenhum')}</span>
                    ) : (
                      plano.modulos_habilitados.slice(0, 6).map(key => {
                        const mod = MODULOS_DISPONIVEIS.find(m => m.key === key);
                        return (
                          <Badge key={key} variant="secondary" className="text-[10px]">
                            {mod?.label || key}
                          </Badge>
                        );
                      })
                    )}
                    {plano.modulos_habilitados.length > 6 && (
                      <Badge variant="outline" className="text-[10px]">
                        +{plano.modulos_habilitados.length - 6}
                      </Badge>
                    )}
                  </div>
                </div>

                <Button variant="outline" size="sm" className="w-full" onClick={() => handleEdit(plano)}>
                  <Edit className="h-3.5 w-3.5 mr-1.5" /> {t('configPlanos.gerenciamentoPlanos.editar')}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <PlanoFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        plano={editingPlano}
        onSaved={load}
      />

      <ConfirmDialog
        open={!!confirmDeactivate}
        onOpenChange={(open) => !open && setConfirmDeactivate(null)}
        title={t('residuos.geral.desativarPlanoTitulo')}
        description={confirmDeactivate
          ? `O plano "${confirmDeactivate.plano.nome}" tem ${confirmDeactivate.plano.empresas_count} empresa(s) usando. Desativar não remove dessas empresas, mas impede novas atribuições. Continuar?`
          : ''}
        confirmText="Desativar"
        variant="destructive"
        onConfirm={async () => {
          if (confirmDeactivate) {
            await applyToggle(confirmDeactivate.plano.id, confirmDeactivate.nextValue);
            setConfirmDeactivate(null);
          }
        }}
      />
    </div>
  );
};
