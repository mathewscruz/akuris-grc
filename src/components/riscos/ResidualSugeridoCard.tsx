/**
 * ResidualSugeridoCard — mostra, de forma auditável, o residual SUGERIDO a
 * partir dos controlos (requisitos) vinculados ao risco.
 *
 * Regras: Conforme 100%, Parcial 50%, Não Conforme 0%, Não Avaliado 0%,
 * N/A excluído. A sugestão nunca é aplicada automaticamente — só com o botão
 * "Aplicar sugestão". Se a conformidade mudar depois de aplicada, o cartão
 * assinala "residual desactualizado" em vez de reescrever o valor em silêncio.
 */
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { nivelRiscoFromConfig, type MatrizConfiguracao } from '@/components/riscos/matriz-config';
import { scoreFromMatriz } from '@/components/riscos/risk-utils';
import {
  computeMitigacao,
  isSnapshot,
  mitigacaoFingerprint,
  sugerirResidual,
} from '@/lib/riscos-controles';
import type { RequisitoVinculado } from '@/hooks/useRiscoRequisitos';
import { IconWarning, IconArrowRight } from '@/components/icons';

interface Props {
  riscoId: string;
  vinculados: RequisitoVinculado[];
  probabilidadeInicial?: string | number | null;
  impactoInicial?: string | number | null;
  probabilidadeResidual?: string | number | null;
  impactoResidual?: string | number | null;
  /** Snapshot guardado em riscos.mitigacao_snapshot. */
  snapshot?: unknown;
  /** Risco tem aceite formal vigente? */
  aceito?: boolean;
  config?: MatrizConfiguracao | null;
  onApplied?: () => void;
}

export function ResidualSugeridoCard({
  riscoId,
  vinculados,
  probabilidadeInicial,
  impactoInicial,
  probabilidadeResidual,
  impactoResidual,
  snapshot,
  aceito,
  config,
  onApplied,
}: Props) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

  const metodo = config?.metodo_calculo === 'soma' ? 'soma' : 'multiplicacao';
  const maxEscala = Math.max(
    config?.escala_probabilidade?.length || 5,
    config?.escala_impacto?.length || 5,
  );

  const resumo = useMemo(
    () => computeMitigacao(vinculados.map((v) => v.conformity_status)),
    [vinculados],
  );

  const sugestao = useMemo(
    () => sugerirResidual(probabilidadeInicial, impactoInicial, resumo.fator, metodo, maxEscala),
    [probabilidadeInicial, impactoInicial, resumo.fator, metodo, maxEscala],
  );

  const fingerprint = useMemo(() => mitigacaoFingerprint(vinculados), [vinculados]);
  const snap = isSnapshot(snapshot) ? snapshot : null;
  const desactualizado = !!snap && snap.fingerprint !== fingerprint;

  if (vinculados.length === 0 || !sugestao) return null;

  const residualAtualScore =
    Number(probabilidadeResidual) && Number(impactoResidual)
      ? scoreFromMatriz(Number(probabilidadeResidual), Number(impactoResidual), metodo)
      : null;

  const nivelSugerido = nivelRiscoFromConfig(sugestao.probabilidade, sugestao.impacto, config);
  const nivelAtual =
    residualAtualScore !== null
      ? nivelRiscoFromConfig(Number(probabilidadeResidual), Number(impactoResidual), config)
      : null;
  const subiuDeFaixa =
    !!nivelAtual && !!nivelSugerido && residualAtualScore !== null && sugestao.score > residualAtualScore;

  const aplicar = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('riscos')
        .update({
          probabilidade_residual: String(sugestao.probabilidade),
          impacto_residual: String(sugestao.impacto),
          nivel_risco_residual: nivelSugerido,
          mitigacao_snapshot: {
            fingerprint,
            fator: resumo.fator,
            score: sugestao.score,
            aplicado_em: new Date().toISOString(),
          },
        })
        .eq('id', riscoId);
      if (error) throw error;
      toast({
        title: t('riscosControles.residual.aplicadoTitulo'),
        description: t('riscosControles.residual.aplicadoDesc', { score: sugestao.score }),
      });
      await queryClient.invalidateQueries({ queryKey: ['riscos'] });
      await queryClient.invalidateQueries({ queryKey: ['risco-detail', riscoId] });
      onApplied?.();
    } catch (e: any) {
      toast({
        title: t('riscosControles.residual.erroTitulo'),
        description: e?.message || '',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-lg border border-border bg-card p-3 space-y-2.5">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        {t('riscosControles.residual.titulo')}
      </div>

      <p className="text-xs text-foreground/85 leading-relaxed">
        {t('riscosControles.residual.conta', {
          total: resumo.total,
          conforme: resumo.conforme,
          parcial: resumo.parcial,
          naoConforme: resumo.naoConforme,
          naoAvaliado: resumo.naoAvaliado,
          naoAplicavel: resumo.naoAplicavel,
          fator: Math.round(resumo.fator * 100),
        })}
      </p>

      <div className="flex items-center gap-2 text-sm">
        <span className="tabular-nums font-semibold">{sugestao.scoreInerente}</span>
        <IconArrowRight className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
        <span className="tabular-nums font-semibold text-primary">{sugestao.score}</span>
        <span className="text-micro text-muted-foreground">
          (P{sugestao.probabilidade} × I{sugestao.impacto})
        </span>
        {nivelSugerido && (
          <StatusBadge tone="neutral">{nivelSugerido}</StatusBadge>
        )}
      </div>

      {residualAtualScore !== null && (
        <p className="text-micro text-muted-foreground">
          {t('riscosControles.residual.avaliado', { score: residualAtualScore })}
        </p>
      )}

      {desactualizado && (
        <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/5 p-2 text-micro text-warning">
          <IconWarning className="h-3.5 w-3.5 mt-0.5 shrink-0" strokeWidth={1.5} />
          <div className="space-y-1">
            <p className="font-semibold">{t('riscosControles.residual.desactualizado')}</p>
            {aceito && subiuDeFaixa && <p>{t('riscosControles.residual.aceiteReavaliar')}</p>}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 pt-0.5">
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={aplicar} disabled={saving}>
          {t('riscosControles.residual.aplicar')}
        </Button>
        <span className="text-micro text-muted-foreground">
          {t('riscosControles.residual.naoImposto')}
        </span>
      </div>
    </section>
  );
}
