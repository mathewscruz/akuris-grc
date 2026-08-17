import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { DataTable } from '@/components/ui/data-table';
import { toast } from 'sonner';
import { Building2, RotateCcw, TrendingUp, History, MoreHorizontal } from 'lucide-react';
import { AkurisAIIcon } from '@/components/icons';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { formatDateOnly } from '@/lib/date-utils';
import ConfirmDialog from '@/components/ConfirmDialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useLanguage } from '@/contexts/LanguageContext';
import { aiFeatureLabel, aiFeatureModuleLabel, aiModelForFuncionalidade } from '@/lib/ai-usage-catalog';

interface EmpresaCredito {
  id: string;
  nome: string;
  creditos_consumidos: number;
  plano_nome: string;
  creditos_franquia: number;
}

interface ConsumoHistorico {
  id: string;
  user_id: string;
  funcionalidade: string;
  descricao: string | null;
  created_at: string;
  user_nome?: string;
}

export function CreditosIAManager() {
  const { t, locale } = useLanguage();
  const [empresas, setEmpresas] = useState<EmpresaCredito[]>([]);
  const [loading, setLoading] = useState(true);
  const [resetConfirm, setResetConfirm] = useState<{ open: boolean; empresaId: string; empresaNome: string }>({
    open: false, empresaId: '', empresaNome: ''
  });
  const [historico, setHistorico] = useState<ConsumoHistorico[]>([]);
  const [historicoSheet, setHistoricoSheet] = useState<{ open: boolean; empresaNome: string }>({
    open: false, empresaNome: ''
  });
  const [historicoLoading, setHistoricoLoading] = useState(false);

  useEffect(() => {
    fetchEmpresas();
  }, []);

  const fetchEmpresas = async () => {
    try {
      const { data, error } = await supabase
        .from('empresas')
        .select(`
          id,
          nome,
          creditos_consumidos,
          plano:planos (
            nome,
            creditos_franquia
          )
        `)
        .order('nome');

      if (error) throw error;

      const mapped: EmpresaCredito[] = (data || []).map((e: any) => ({
        id: e.id,
        nome: e.nome,
        creditos_consumidos: e.creditos_consumidos || 0,
        plano_nome: e.plano?.nome || t('configPlanos.creditosIA.semPlano'),
        creditos_franquia: e.plano?.creditos_franquia || 0,
      }));

      setEmpresas(mapped);
    } catch (error) {
      console.error(t('configPlanos.creditosIA.errorFetch'), error);
      toast.error(t('configPlanos.creditosIA.errorLoad'));
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    try {
      const { error } = await supabase
        .from('empresas')
        .update({ creditos_consumidos: 0 })
        .eq('id', resetConfirm.empresaId);

      if (error) throw error;

      toast.success(t('configPlanos.creditosIA.resetSuccess', { nome: resetConfirm.empresaNome }));
      setResetConfirm({ open: false, empresaId: '', empresaNome: '' });
      fetchEmpresas();
    } catch (error) {
      toast.error(t('configPlanos.creditosIA.resetError'));
    }
  };

  const openHistorico = async (empresaId: string, empresaNome: string) => {
    setHistoricoSheet({ open: true, empresaNome });
    setHistoricoLoading(true);
    try {
      const { data, error } = await supabase
        .from('creditos_consumo')
        .select('id, user_id, funcionalidade, descricao, created_at')
        .eq('empresa_id', empresaId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      // Fetch user names
      const userIds = [...new Set((data || []).map((d: any) => d.user_id).filter(Boolean))];
      let profilesMap: Record<string, string> = {};
      
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, nome')
          .in('user_id', userIds);
        
        (profiles || []).forEach((p: any) => {
          profilesMap[p.user_id] = p.nome;
        });
      }

      setHistorico((data || []).map((d: any) => ({
        ...d,
        user_nome: profilesMap[d.user_id] || t('configPlanos.creditosIA.desconhecido')
      })));
    } catch (error) {
      toast.error(t('configPlanos.creditosIA.historicoError'));
    } finally {
      setHistoricoLoading(false);
    }
  };

  const totalConsumo = empresas.reduce((sum, e) => sum + e.creditos_consumidos, 0);
  const empresaMaisConsumo = empresas.length > 0 
    ? empresas.reduce((max, e) => e.creditos_consumidos > max.creditos_consumidos ? e : max, empresas[0])
    : null;

  const columns = [
    {
      key: 'nome',
      label: t('configPlanos.creditosIA.colEmpresa'),
      sortable: true,
      render: (value: string) => <span className="font-medium">{value}</span>
    },
    {
      key: 'plano_nome',
      label: t('configPlanos.creditosIA.colPlano'),
      render: (value: string) => <Badge variant="outline">{value}</Badge>
    },
    {
      key: 'creditos_consumidos',
      label: t('configPlanos.creditosIA.colConsumo'),
      sortable: true,
      render: (value: number, row: EmpresaCredito) => {
        const percent = row.creditos_franquia > 0 ? (value / row.creditos_franquia) * 100 : 0;
        return (
          <div className="space-y-1 min-w-[140px]">
            <div className="flex items-center justify-between text-xs">
              <span>{value} / {row.creditos_franquia}</span>
              <span className="text-muted-foreground">{percent.toFixed(0)}%</span>
            </div>
            <Progress value={Math.min(percent, 100)} className="h-1.5" />
          </div>
        );
      }
    },
    {
      key: 'actions',
      label: t('configPlanos.creditosIA.colAcoes'),
      render: (_: any, row: EmpresaCredito) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => openHistorico(row.id, row.nome)}>
              <History className="h-4 w-4 mr-2" />
              {t('configPlanos.creditosIA.historicoAction')}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setResetConfirm({ open: true, empresaId: row.id, empresaNome: row.nome })}
              className="text-destructive focus:text-destructive"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              {t('configPlanos.creditosIA.resetAction')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    }
  ];

  const historicoColumns = [
    {
      key: 'created_at',
      label: t('configPlanos.creditosIA.colData'),
      render: (value: string) => formatDateOnly(value)
    },
    {
      key: 'user_nome',
      label: t('configPlanos.creditosIA.colUsuario'),
      render: (value: string) => <span className="font-medium">{value}</span>
    },
    {
      key: 'funcionalidade',
      label: t('configPlanos.creditosIA.colFuncionalidade'),
      render: (value: string) => {
        const modulo = aiFeatureModuleLabel(value, locale);
        return (
          <div className="space-y-1">
            <Badge variant="secondary">{aiFeatureLabel(value, locale)}</Badge>
            {modulo && <div className="text-[11px] text-muted-foreground">{modulo}</div>}
          </div>
        );
      }
    },
    {
      key: 'modelo',
      label: t('configPlanos.creditosIA.colModelo'),
      render: (_: unknown, row: ConsumoHistorico) => {
        const model = aiModelForFuncionalidade(row.funcionalidade);
        return model
          ? <Badge variant="outline" className="text-xs">{model.label}</Badge>
          : <span className="text-muted-foreground">-</span>;
      }
    },
    {
      key: 'descricao',
      label: t('configPlanos.creditosIA.colDescricao'),
      render: (value: string | null) => value || <span className="text-muted-foreground">-</span>
    }
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title={t('configPlanos.creditosIA.statTotalEmpresas')}
          value={empresas.length}
          description={t('configPlanos.creditosIA.statTotalEmpresasDesc')}
          icon={<Building2 className="h-4 w-4" />}
        />
        <StatCard
          title={t('configPlanos.creditosIA.statCreditosConsumidos')}
          value={totalConsumo}
          description={t('configPlanos.creditosIA.statCreditosConsumidosDesc')}
          icon={<AkurisAIIcon className="h-4 w-4" />}
        />
        <StatCard
          title={t('configPlanos.creditosIA.statMaiorConsumo')}
          value={empresaMaisConsumo?.creditos_consumidos || 0}
          description={empresaMaisConsumo?.nome || '-'}
          icon={<TrendingUp className="h-4 w-4" />}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AkurisAIIcon className="h-5 w-5" />
            {t('configPlanos.creditosIA.cardTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            data={empresas}
            columns={columns}
            loading={loading}
            searchPlaceholder={t('configPlanos.creditosIA.searchPlaceholder')}
            paginated
            emptyState={{
              icon: <AkurisAIIcon className="h-8 w-8" />,
              title: t('configPlanos.creditosIA.emptyTitle'),
              description: t('configPlanos.creditosIA.emptyDescription')
            }}
          />
        </CardContent>
      </Card>

      <ConfirmDialog
        open={resetConfirm.open}
        onOpenChange={(open) => setResetConfirm(prev => ({ ...prev, open }))}
        title={t('configPlanos.creditosIA.resetDialogTitle')}
        description={t('configPlanos.creditosIA.resetDialogDescription', { nome: resetConfirm.empresaNome })}
        confirmText={t('configPlanos.creditosIA.resetConfirm')}
        variant="destructive"
        onConfirm={handleReset}
      />

      <Sheet open={historicoSheet.open} onOpenChange={(open) => setHistoricoSheet(prev => ({ ...prev, open }))}>
        <SheetContent className="w-[600px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{t('configPlanos.creditosIA.sheetTitle', { nome: historicoSheet.empresaNome })}</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            <DataTable
              data={historico}
              columns={historicoColumns}
              loading={historicoLoading}
              searchPlaceholder={t('configPlanos.creditosIA.historicoSearchPlaceholder')}
              paginated
              emptyState={{
                icon: <History className="h-8 w-8" />,
                title: t('configPlanos.creditosIA.historicoEmptyTitle'),
                description: t('configPlanos.creditosIA.historicoEmptyDescription')
              }}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
