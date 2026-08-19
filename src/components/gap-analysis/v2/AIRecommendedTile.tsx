/**
 * AIRecommendedTile — tile editorial de framework recomendado.
 * Mostra selo FwMono, nome, categoria, descrição e a ação de iniciar.
 */
import { useLanguage } from '@/contexts/LanguageContext';
import { FwMono } from './FwMono';
import { deriveFwMono, getFwCategory } from './fw-utils';
import { IconArrowRight } from '@/components/icons';

interface AIRecommendedTileProps {
  nome: string;
  versao: string;
  tipo_framework: string;
  descricao?: string;
  /** Reuso REAL: requisitos com equivalente já avaliado noutro framework. */
  reuso?: { percentagem: number; comEquivalente: number };
  /** Número de requisitos do framework. */
  requirementCount: number;
  onClick: () => void;
}

export function AIRecommendedTile({
  nome,
  versao,
  tipo_framework,
  descricao,
  reuso,
  requirementCount,
  onClick,
}: AIRecommendedTileProps) {
  const { t } = useLanguage();
  const mono = deriveFwMono(nome);
  const cat = getFwCategory(tipo_framework);
  const FW_CATEGORY_LABEL: Record<string, string> = {
    seguranca: t('gapV2.fwCategory.seguranca'),
    privacidade: t('gapV2.fwCategory.privacidade'),
    governanca: t('gapV2.fwCategory.governanca'),
    qualidade: t('gapV2.fwCategory.qualidade'),
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className="group text-left relative overflow-hidden rounded-lg border border-border bg-card hover:border-primary/40 hover:shadow-elegant transition-ui duration-200 p-4 flex flex-col gap-3"
    >
      <div className="flex items-start gap-3">
        <FwMono l1={mono.l1} l2={mono.l2} size="md" />
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors truncate">
            {nome} <span className="text-xs font-normal text-muted-foreground">{versao}</span>
          </h3>
          <div className="text-xs text-muted-foreground mt-0.5">
            {FW_CATEGORY_LABEL[cat]}
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 flex-1">
        {descricao || t('gapAnalysis.v2.aiRecommendedTile.defaultDescription')}
      </p>

      {/* Reuso — só aparece quando existe equivalência mapeada de fato.
          O número vem de `gap_reuso_do_framework`, sobre a tabela de
          equivalências entre requisitos. Antes isto era Math.random(). */}
      {reuso && reuso.percentagem > 0 && (
        <div className="space-y-1.5 pt-2 border-t border-border/60">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{t('gapAnalysis.v2.aiRecommendedTile.alreadyCovered')}</span>
            <span className="tabular-nums text-foreground font-semibold">{reuso.percentagem}%</span>
          </div>
          <div className="h-1 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-success transition-ui duration-500"
              style={{ width: `${Math.min(100, reuso.percentagem)}%` }}
            />
          </div>
          <p className="text-micro text-muted-foreground">
            {t('gapAnalysis.v2.aiRecommendedTile.reuseFoot', { count: reuso.comEquivalente })}
          </p>
        </div>
      )}

      <div className="flex items-center justify-between pt-1">
        <span className="text-micro text-muted-foreground tabular-nums">
          {t('gapAnalysis.v2.aiRecommendedTile.requirementsCount', { count: requirementCount })}
        </span>
        <span className="inline-flex items-center gap-1 text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity">
          {t('gapAnalysis.v2.aiRecommendedTile.start')}
          <IconArrowRight className="h-3 w-3" strokeWidth={1.5} />
        </span>
      </div>
    </button>
  );
}
