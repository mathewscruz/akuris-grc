
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TrendingDown, TrendingUp, Minus, Clock, User } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { StatusBadge } from '@/components/ui/status-badge';
import { resolveNivelRiscoTone } from '@/lib/status-tone';

import { AkurisPulse } from '@/components/ui/AkurisPulse';
interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  riscoId: string;
  riscoNome: string;
}

interface HistoricoAvaliacao {
  id: string;
  probabilidade: string;
  impacto: string;
  nivel_risco: string;
  tipo: string;
  observacoes: string | null;
  created_at: string;
  avaliado_por: string | null;
  profiles?: { nome: string } | null;
}

export function HistoricoAvaliacoesDialog({ open, onOpenChange, riscoId, riscoNome }: Props) {
  const { data: historico, isLoading } = useQuery({
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
    if (curr < prev) return <TrendingDown className="h-4 w-4 text-green-600" />;
    if (curr > prev) return <TrendingUp className="h-4 w-4 text-red-600" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" strokeWidth={1.5} />
            Histórico de Avaliações - {riscoNome}
          </DialogTitle>
          <DialogDescription>
            Linha do tempo das reavaliações de probabilidade, impacto e nível do risco.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <AkurisPulse size={32} />
          </div>
        ) : !historico || historico.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
            Nenhum histórico de reavaliação encontrado.
          </div>
        ) : (
          <ScrollArea className="h-[500px]">
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
                              {item.tipo === 'inicial' ? 'Inicial' : 'Residual'}
                            </Badge>
                            <StatusBadge size="sm" {...resolveNivelRiscoTone(item.nivel_risco)}>
                              {item.nivel_risco}
                            </StatusBadge>
                            {getTrendIcon(item.nivel_risco, previousItem?.nivel_risco)}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(item.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
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
                            <User className="h-3 w-3" />
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
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
