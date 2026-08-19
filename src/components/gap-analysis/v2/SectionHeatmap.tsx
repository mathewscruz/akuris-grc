/**
 * SectionHeatmap — grade compacta de seções/categorias com aderência %.
 * Cada célula clicável filtra a tabela de requisitos.
 * Substitui CategoryBarChart em densidade alta — mostra mais info em menos espaço.
 */
import { cn } from '@/lib/utils';
import { SectionHead } from './SectionHead';
import { useLanguage } from '@/contexts/LanguageContext';

export interface HeatCell {
  id: string;
  label: string;
  /** Requisitos da categoria, incluindo os fora do escopo. */
  total: number;
  /**
   * Aderência 0–100 **já calculada** por `calcularScoreFramework`.
   *
   * Este componente calculava o seu próprio score a partir das contagens, com
   * `(conforme*100 + parcial*50)/aplicáveis` — enquanto a barra de progresso da
   * aba de categoria, quarenta pixels abaixo, usava `conforme/aplicáveis`. Dois
   * números diferentes para a mesma categoria na mesma tela. Agora a conta vem
   * de fora, de um sítio só, e aqui só se desenha.
   */
  score: number;
  /** Requisitos dentro do escopo do SoA. */
  aplicaveis: number;
  /** Dentro do escopo, quantos já têm avaliação. */
  avaliados: number;
}

interface SectionHeatmapProps {
  cells: HeatCell[];
  activeId?: string;
  onCellClick?: (id: string) => void;
  title?: string;
}

/** Quanto da categoria já foi avaliado, dentro do escopo aplicável. */
function cobertura(c: HeatCell): number {
  return c.aplicaveis > 0 ? Math.round((c.avaliados / c.aplicaveis) * 100) : 0;
}

/**
 * Superfície branca; a cor fica na borda esquerda e no número.
 *
 * Estes cartões vinham com o fundo inteiro tingido — verde, âmbar, vermelho a
 * 15% — enquanto todo o resto do produto é branco separado por fio. Numa tela
 * que já tem donut colorido, chips de estado e fila de prioridades, mais seis
 * blocos de cor chapada é o que faz a página parecer um semáforo: tudo grita
 * e nada se destaca.
 *
 * A informação não se perde: a mesma escala continua legível pela aresta e
 * pelo número, que é onde o olho vai primeiro.
 */
function getToneBg(score: number, coverage: number): string {
  const base = 'bg-card hover:bg-accent';
  if (coverage === 0) return `${base} border-l-[3px] border-l-border`;
  if (score >= 80) return `${base} border-l-[3px] border-l-success`;
  if (score >= 60) return `${base} border-l-[3px] border-l-primary`;
  if (score >= 40) return `${base} border-l-[3px] border-l-warning`;
  return `${base} border-l-[3px] border-l-destructive`;
}

function getToneText(score: number, coverage: number): string {
  if (coverage === 0) return 'text-muted-foreground';
  if (score >= 80) return 'text-success';
  if (score >= 60) return 'text-primary';
  if (score >= 40) return 'text-warning';
  return 'text-destructive';
}

export function SectionHeatmap({
  cells,
  activeId,
  onCellClick,
  title,
}: SectionHeatmapProps) {
  const { t } = useLanguage();
  if (!cells.length) return null;
  const resolvedTitle = title ?? t('sweepRiscos.gap.heatmap.tituloPadrao');

  return (
    <section>
      <SectionHead
        title={resolvedTitle}
        count={cells.length}
        right={
          <span className="text-xs text-muted-foreground">
            {t('sweepRiscos.gap.heatmap.cliqueParaFiltrar')}
          </span>
        }
      />
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
        {cells.map((c) => {
          const score = c.score;
          const coverage = cobertura(c);
          const isActive = activeId === c.id;
          const toneBg = getToneBg(score, coverage);
          const toneText = getToneText(score, coverage);

          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onCellClick?.(c.id)}
              className={cn(
                'group relative text-left rounded-lg border transition-ui duration-200 p-3 min-h-[88px] flex flex-col justify-between',
                toneBg,
                isActive ? 'ring-2 ring-primary border-primary' : 'border-border'
              )}
              title={c.label}
            >
              <div className="text-xs font-medium text-foreground/80 line-clamp-2 leading-tight">
                {c.label}
              </div>
              {/* O número grande era só "56", ao lado de outro número solto —
                  nada na célula dizia qual era percentagem e qual era
                  contagem. E o rótulo da categoria estava a 10,9px, que é
                  conteúdo, não legenda. */}
              <div className="flex items-baseline justify-between gap-1">
                <span className={cn('font-mono text-xl font-semibold tabular-nums leading-none', toneText)}>
                  {coverage === 0 ? '—' : `${score}%`}
                </span>
                <span className="text-xs font-mono tabular-nums text-muted-foreground">
                  {/* Aplicáveis, não o total: o score é calculado sobre eles,
                      e mostrar 4 ao lado de um número que só conta 3 é a mesma
                      divergência que já existia entre o cartão e a aba. */}
                  {t('gapV2.heatmap.requisitos', { count: c.aplicaveis })}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
