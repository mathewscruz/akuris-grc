import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Crown, Shield, Zap, Sparkles, CreditCard, Calendar, Users, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { formatBRL, type Plano } from '@/lib/planos-utils';
import { Link } from 'react-router-dom';

import { AkurisPulse } from '@/components/ui/AkurisPulse';
interface EmpresaInfo {
  id: string;
  nome: string;
  status_licenca: 'trial' | 'em_operacao';
  data_inicio_trial: string | null;
  data_fim_assinatura: string | null;
  creditos_consumidos: number;
  plano: Plano | null;
  total_usuarios: number;
}

const planIcons: Record<string, React.ElementType> = {
  free: Sparkles,
  compliance_start: Shield,
  starter: Shield,
  grc_manager: Zap,
  professional: Zap,
  governaii_enterprise: Crown,
  enterprise: Crown,
};

export function AssinaturaTab() {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;
  const [info, setInfo] = useState<EmpresaInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!empresaId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data: empData } = await supabase
          .from('empresas')
          .select('id, nome, status_licenca, data_inicio_trial, data_fim_assinatura, creditos_consumidos, plano:planos(*)')
          .eq('id', empresaId)
          .maybeSingle();

        const { count: usuariosCount } = await supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('empresa_id', empresaId);

        if (cancelled) return;
        if (empData) {
          setInfo({
            id: empData.id,
            nome: empData.nome,
            status_licenca: (empData.status_licenca || 'em_operacao') as 'trial' | 'em_operacao',
            data_inicio_trial: empData.data_inicio_trial,
            data_fim_assinatura: empData.data_fim_assinatura,
            creditos_consumidos: empData.creditos_consumidos || 0,
            plano: (empData.plano as any) || null,
            total_usuarios: usuariosCount || 0,
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [empresaId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <AkurisPulse size={32} className="text-muted-foreground" />
      </div>
    );
  }

  if (!info) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Não foi possível carregar dados da assinatura.
        </CardContent>
      </Card>
    );
  }

  const Icon = planIcons[info.plano?.codigo || 'free'] || Shield;
  const trialDiasRestantes = info.data_inicio_trial
    ? Math.max(0, 14 - differenceInDays(new Date(), new Date(info.data_inicio_trial)))
    : 0;
  const trialFim = info.data_inicio_trial
    ? new Date(new Date(info.data_inicio_trial).getTime() + 14 * 24 * 60 * 60 * 1000)
    : null;

  const limiteUsuarios = info.plano?.limite_usuarios ?? null;
  const limiteCreditos = info.plano?.creditos_franquia ?? 0;
  const usuariosPercent = limiteUsuarios ? (info.total_usuarios / limiteUsuarios) * 100 : 0;
  const creditosPercent = limiteCreditos > 0 ? (info.creditos_consumidos / limiteCreditos) * 100 : 0;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-foreground">Assinatura</h3>
        <p className="text-sm text-muted-foreground">
          Acompanhe o plano da sua empresa, uso e vigência.
        </p>
      </div>

      {/* Trial banner */}
      {info.status_licenca === 'trial' && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardContent className="py-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/20 text-amber-600 shrink-0">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">
                Período de teste — {trialDiasRestantes} {trialDiasRestantes === 1 ? 'dia restante' : 'dias restantes'}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {trialFim
                  ? `Seu trial termina em ${trialFim.toLocaleDateString('pt-BR')}. Fale com o time comercial para escolher um plano.`
                  : 'Fale com o time comercial para escolher um plano.'}
              </p>
            </div>
            <Button asChild size="sm">
              <a href="mailto:contato@akuris.com.br?subject=Assinatura%20do%20plano%20Akuris">
                Falar com comercial
              </a>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Plano atual */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary')}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base">
                  Plano {info.plano?.nome || 'não atribuído'}
                </CardTitle>
                {info.plano?.publico_alvo && (
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground mt-0.5">
                    {info.plano.publico_alvo}
                  </p>
                )}
                {info.plano?.descricao && (
                  <p className="text-xs text-muted-foreground mt-0.5">{info.plano.descricao}</p>
                )}
              </div>
            </div>
            <Badge variant="outline" className={info.status_licenca === 'trial' ? 'border-amber-500 text-amber-600' : 'border-primary text-primary'}>
              {info.status_licenca === 'trial' ? 'Em teste' : 'Em operação'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {info.plano && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Valor mensal</p>
                  <p className="text-sm font-medium">{formatBRL(info.plano.preco_mensal)}/mês</p>
                  {(info.plano.preco_setup ?? 0) > 0 && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Setup: {info.plano.setup_observacao || `${formatBRL(info.plano.preco_setup ?? 0)} (único)`}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Créditos IA</p>
                  <p className="text-sm font-medium">
                    {info.creditos_consumidos} / {limiteCreditos}/mês
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Usuários</p>
                  <p className="text-sm font-medium">
                    {info.total_usuarios} / {limiteUsuarios ?? '∞'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {info.plano && (limiteUsuarios || limiteCreditos > 0) && (
            <div className="space-y-3 pt-2">
              {limiteUsuarios !== null && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Usuários</span>
                    <span>{info.total_usuarios}/{limiteUsuarios}</span>
                  </div>
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn('h-full transition-all', usuariosPercent >= 90 ? 'bg-destructive' : 'bg-primary')}
                      style={{ width: `${Math.min(100, usuariosPercent)}%` }}
                    />
                  </div>
                </div>
              )}
              {limiteCreditos > 0 && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Créditos IA do mês</span>
                    <span>{info.creditos_consumidos}/{limiteCreditos}</span>
                  </div>
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn('h-full transition-all', creditosPercent >= 90 ? 'bg-destructive' : 'bg-primary')}
                      style={{ width: `${Math.min(100, creditosPercent)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {info.data_fim_assinatura && (
            <>
              <Separator />
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Vigência até:</span>
                <span className="font-medium">{new Date(info.data_fim_assinatura).toLocaleDateString('pt-BR')}</span>
              </div>
            </>
          )}

          <Separator />
          <div className="flex flex-col sm:flex-row gap-3">
            <Button asChild>
              <a href="mailto:contato@akuris.com.br?subject=Mudança%20de%20plano%20Akuris">
                Solicitar mudança de plano
              </a>
            </Button>
            <Button asChild variant="outline">
              <Link to="/planos">Ver todos os planos</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
