/**
 * CertificationReadinessCard — veredito de prontidão para certificação/auditoria.
 *
 * Responde à pergunta central do módulo: "estou pronto para certificar?".
 * É 100% data-driven a partir das contagens de conformidade já computadas na
 * aba Avaliação — não faz chamada extra. A lógica segue o critério de auditoria:
 * não conformidades ("nao_conforme") são bloqueadores maiores; parciais são
 * pontos menores a fechar; N/A não contam; requisitos não avaliados reduzem a
 * confiança do veredito (cobertura incompleta).
 */
import { ShieldCheck, ShieldAlert, ShieldQuestion, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Props {
  /** ISO-like (com SoA) usa "certificação"; demais usam "conformidade". */
  certifiable?: boolean;
  total: number;
  conforme: number;
  parcial: number;
  naoConforme: number;
  naoAplicavel: number;
  naoAvaliado: number;
  /** Filtra a tabela para as não conformidades e rola até ela. */
  onViewBlockers?: () => void;
  /** Abre a aba de Remediação. */
  onGoToRemediation?: () => void;
}

type Verdict = 'incompleto' | 'nao_pronto' | 'quase' | 'pronto';

const VERDICT_STYLE: Record<
  Verdict,
  { ring: string; iconWrap: string; Icon: typeof ShieldCheck; badge: string }
> = {
  incompleto: {
    ring: 'border-info/40',
    iconWrap: 'bg-info/10 text-info',
    Icon: ShieldQuestion,
    badge: 'bg-info/10 text-info',
  },
  nao_pronto: {
    ring: 'border-destructive/40',
    iconWrap: 'bg-destructive/10 text-destructive',
    Icon: ShieldAlert,
    badge: 'bg-destructive/10 text-destructive',
  },
  quase: {
    ring: 'border-warning/40',
    iconWrap: 'bg-warning/10 text-warning',
    Icon: ShieldCheck,
    badge: 'bg-warning/10 text-warning',
  },
  pronto: {
    ring: 'border-success/40',
    iconWrap: 'bg-success/10 text-success',
    Icon: ShieldCheck,
    badge: 'bg-success/10 text-success',
  },
};

export function CertificationReadinessCard({
  certifiable = false,
  total,
  conforme,
  parcial,
  naoConforme,
  naoAplicavel,
  naoAvaliado,
  onViewBlockers,
  onGoToRemediation,
}: Props) {
  const alvo = certifiable ? 'certificação' : 'conformidade';
  const aplicaveis = Math.max(0, conforme + parcial + naoConforme);

  // Cobertura: quanto dos aplicáveis já foi avaliado. Veredito só é confiável
  // acima de 80% de cobertura.
  const totalAplicaveis = Math.max(1, total - naoAplicavel);
  const avaliados = conforme + parcial + naoConforme;
  const cobertura = Math.round((avaliados / totalAplicaveis) * 100);

  let verdict: Verdict;
  if (cobertura < 80) verdict = 'incompleto';
  else if (naoConforme > 0) verdict = 'nao_pronto';
  else if (parcial > 0) verdict = 'quase';
  else verdict = 'pronto';

  const style = VERDICT_STYLE[verdict];

  const headline: Record<Verdict, string> = {
    incompleto: 'Avaliação incompleta',
    nao_pronto: `Ainda não pronto para ${alvo}`,
    quase: `Quase pronto para ${alvo}`,
    pronto: `Pronto para a auditoria de ${alvo}`,
  };

  const verdictTag: Record<Verdict, string> = {
    incompleto: 'Cobertura incompleta',
    nao_pronto: 'Com bloqueadores',
    quase: 'Quase lá',
    pronto: 'Sem bloqueadores',
  };

  const detail: Record<Verdict, string> = {
    incompleto: `Apenas ${cobertura}% dos requisitos aplicáveis foram avaliados. Complete a avaliação para medir a prontidão com confiança.`,
    nao_pronto: `${naoConforme} não conformidade${naoConforme === 1 ? '' : 's'} maior${naoConforme === 1 ? '' : 'es'} bloqueia${naoConforme === 1 ? '' : 'm'} a ${alvo}${parcial > 0 ? ` — e ${parcial} ${parcial === 1 ? 'ponto parcial' : 'pontos parciais'} a fechar` : ''}.`,
    quase: `Nenhuma não conformidade maior. Feche ${parcial} ${parcial === 1 ? 'ponto parcial' : 'pontos parciais'} para atingir 100%.`,
    pronto: `Todos os ${aplicaveis} requisitos aplicáveis estão conformes. Nenhum bloqueador para a ${alvo}.`,
  };

  return (
    <article
      className={cn(
        'relative overflow-hidden rounded-2xl border bg-card p-5',
        style.ring,
      )}
    >
      <div className="flex items-start gap-4 flex-wrap sm:flex-nowrap">
        {/* Ícone de veredito */}
        <div className={cn('shrink-0 grid place-items-center h-12 w-12 rounded-xl', style.iconWrap)}>
          <style.Icon className="h-6 w-6" strokeWidth={1.75} />
        </div>

        {/* Texto */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-sans uppercase tracking-wider text-muted-foreground">
              Prontidão para {alvo}
            </span>
            <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide', style.badge)}>
              {verdictTag[verdict]}
            </span>
          </div>
          <h3 className="mt-1 text-base font-semibold text-foreground">{headline[verdict]}</h3>
          <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{detail[verdict]}</p>

          {/* Contadores de bloqueadores */}
          <div className="mt-3 flex items-center gap-4 text-xs flex-wrap">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-success" />
              <span className="text-muted-foreground">Totalmente conformes</span>
              <span className="font-semibold tabular-nums text-foreground">{conforme} de {aplicaveis}</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-destructive" />
              <span className="text-muted-foreground">Não conformidades</span>
              <span className="font-semibold tabular-nums text-foreground">{naoConforme}</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-warning" />
              <span className="text-muted-foreground">Parciais</span>
              <span className="font-semibold tabular-nums text-foreground">{parcial}</span>
            </span>
          </div>

          {/* Ações */}
          {(onViewBlockers || onGoToRemediation) && (verdict === 'nao_pronto' || verdict === 'quase') && (
            <div className="mt-4 flex flex-wrap gap-2">
              {naoConforme > 0 && onViewBlockers && (
                <Button variant="outline" size="sm" onClick={onViewBlockers} className="gap-1.5">
                  Ver não conformidades
                  <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.5} />
                </Button>
              )}
              {onGoToRemediation && (
                <Button variant="ghost" size="sm" onClick={onGoToRemediation}>
                  Plano de remediação
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
