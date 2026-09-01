
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DialogShell } from '@/components/ui/dialog-shell';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { StatusBadge } from '@/components/ui/status-badge';
import { resolveNivelRiscoTone } from '@/lib/status-tone';

import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { useLanguage } from '@/contexts/LanguageContext';
import { IconTime, IconTrendDown, IconTrendUp, IconMinus, IconPerson, IconInfo } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { dateFnsLocale } from '@/lib/date-utils';
interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  riscoId: string;
  riscoNome: string;
}

interface HistoricoAvaliacao {
  id: string;
  probabilidade: number | null;
  impacto: number | null;
  nivel_risco: string;
  tipo: string;
  observacoes: string | null;
  created_at: string;
  avaliado_por: string | null;
  profiles?: { nome: string } | null;
}

export function HistoricoAvaliacoesDialog({ open, onOpenChange, riscoId, riscoNome }: Props) {
  const { t } = useLanguage();
  const { data: historico, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['risco-historico-avaliacoes', riscoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('riscos_historico_avaliacoes')
        .select('id, probabilidade, impacto, nivel_risco, tipo, observacoes, created_at, avaliado_por, profiles:avaliado_por(nome)')
        .eq('risco_id', riscoId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map(item => ({
        ...item,
        profiles: Array.isArray(item.profiles) && item.profiles.length > 0 ? item.profiles[0] : item.profiles
      })) as HistoricoAvaliacao[];
    },
    enabled: open && !!riscoId,
  });

  const getTrendIcon = (current: string, previous: string | undefined) => {
    if (!previous) return null;
    const nivelOrder: Record<string, number> = { 'muito baixo': 1, 'baixo': 2, 'médio': 3, 'alto': 4, 'muito alto': 5, 'crítico': 6 };
    const curr = nivelOrder[current.toLowerCase()] || 0;
    const prev = nivelOrder[previous.toLowerCase()] || 0;
    if (curr < prev) return <IconTrendDown className="h-4 w-4 text-success" strokeWidth={1.5} />;
    if (curr > prev) return <IconTrendUp className="h-4 w-4 text-destructive" strokeWidth={1.5} />;
    return <IconMinus className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />;
  };

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={IconTime}
      title={t('fin.riscos.historicoAval.title')}
      description={riscoNome}
      size="md"
      hideFooter
    >
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <AkurisPulse size={32} />
          </div>
        ) : isError ? (
          /*
              Falhar a ler não é o mesmo que não haver nada.

              Este ecrã mostrava «Nenhum histórico de reavaliação
              encontrado» sempre que a consulta falhava. E falhava sempre:
              faltava a chave estrangeira de `avaliado_por`, o PostgREST
              devolvia 400 e o utilizador lia que não tinha avaliado nada
              — com a avaliação residual gravada na base.
          */
          <div className="flex flex-col items-center gap-3 py-8">
            <EmptyState
              title={t('fin.riscos.historicoAval.erroTitulo')}
              description={t('fin.riscos.historicoAval.erroDesc')}
              icon={<IconInfo className="h-8 w-8" strokeWidth={1.5} />}
            />
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              {t('fin.riscos.historicoAval.tentarNovamente')}
            </Button>
          </div>
        ) : !historico || historico.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <IconTime className="h-12 w-12 mx-auto mb-4 opacity-50" strokeWidth={1.5} />{t('fin.riscos.historicoAval.vazio')}</div>
        ) : (
            <div className="relative pl-6">
              {/* Timeline line */}
              <div className="absolute left-2.5 top-0 bottom-0 w-0.5 bg-border" />

              <div className="space-y-6">
                {historico.map((item, index) => {
                  const previousItem = index < historico.length - 1 ? historico[index + 1] : undefined;
                  return (
                    <div key={item.id} className="relative">
                      {/* Timeline dot */}
                      <div className="absolute -left-3.5 top-1 w-3 h-3 rounded-full bg-primary border-2 border-background" />

                      <div className="bg-card border rounded-lg p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {item.tipo === 'inicial'
                                ? t('fin.riscos.historicoAval.tipoInicial')
                                : t('fin.riscos.historicoAval.tipoResidual')}
                            </Badge>
                            <StatusBadge {...resolveNivelRiscoTone(item.nivel_risco)}>
                              {item.nivel_risco}
                            </StatusBadge>
                            {getTrendIcon(item.nivel_risco, previousItem?.nivel_risco)}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(item.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: dateFnsLocale() })}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-muted-foreground">Probabilidade:</span>{' '}
                            <span className="font-medium">{item.probabilidade}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Impacto:</span>{' '}
                            <span className="font-medium">{item.impacto}</span>
                          </div>
                        </div>

                        {item.profiles?.nome && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <IconPerson className="h-3 w-3" />
                            {item.profiles.nome}
                          </div>
                        )}

                        {item.observacoes && (
                          <p className="text-sm text-muted-foreground italic">
                            "{item.observacoes}"
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
        )}
    </DialogShell>
  );
}
