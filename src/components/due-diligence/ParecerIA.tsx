/**
 * O parecer da IA sobre o questionário que o fornecedor devolveu.
 *
 * ## O que este painel resolve
 *
 * Ao terminar o questionário ficava um número — «72%» — e mais nada. Quem
 * tinha de ler as respostas, abrir as evidências e decidir se aquilo servia era
 * a pessoa, avaliação a avaliação.
 *
 * ## Porque o número e o parecer aparecem separados
 *
 * O `score_final` é aritmética: média ponderada das notas, reproduzível.
 * O parecer é interpretação. Fundi-los faria o cliente exportar uma opinião com
 * aparência de cálculo — e num produto de compliance essa diferença é tudo.
 * Por isso este painel identifica-se como leitura da IA e mostra a confiança
 * que ela própria declara.
 */
import { IconBolt, IconSuccess, IconWarning, IconInfo, IconFile, IconRefresh } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { resolveCriticidadeTone } from '@/lib/status-tone';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatDateOnly } from '@/lib/date-utils';

export interface ParecerDaIA {
  nivelRisco?: string;
  resumo?: string;
  pontosFortes?: string[];
  pontosAtencao?: string[];
  recomendacoes?: string[];
  evidenciasEmFalta?: string[];
  confianca?: string;
  modelo?: string;
  respostasAnalisadas?: number;
}

interface Props {
  parecer: ParecerDaIA | null;
  avaliadoEm?: string | null;
  aAvaliar?: boolean;
  onReavaliar?: () => void;
}

/** Uma lista do parecer, só desenhada quando tem conteúdo. */
function Bloco({
  titulo,
  itens,
  Icone,
  tomDoIcone,
}: {
  titulo: string;
  itens?: string[];
  Icone: typeof IconSuccess;
  tomDoIcone: string;
}) {
  if (!itens?.length) return null;
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{titulo}</p>
      <ul className="space-y-1.5">
        {itens.map((item, i) => (
          <li key={i} className="flex gap-2 text-sm leading-relaxed">
            <Icone className={`h-4 w-4 shrink-0 mt-0.5 ${tomDoIcone}`} strokeWidth={1.5} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ParecerIA({ parecer, avaliadoEm, aAvaliar, onReavaliar }: Props) {
  const { t } = useLanguage();

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-base flex items-center gap-2">
            <IconBolt className="h-4 w-4" strokeWidth={1.5} />
            {t('dueDiligence.parecerIA.titulo')}
          </CardTitle>
          {onReavaliar && (
            <Button variant="ghost" size="sm" onClick={onReavaliar} disabled={aAvaliar}>
              <IconRefresh className={`h-4 w-4 mr-1.5 ${aAvaliar ? 'animate-spin' : ''}`} strokeWidth={1.5} />
              {aAvaliar ? t('dueDiligence.parecerIA.aAvaliar') : t('dueDiligence.parecerIA.reavaliar')}
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {aAvaliar && !parecer ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ) : !parecer ? (
          /*
            Sem parecer não se finge que há: diz-se o que falta e oferece-se a
            acção. É o mesmo princípio dos estados vazios do resto do produto.
          */
          <p className="text-sm text-muted-foreground leading-relaxed">
            {t('dueDiligence.parecerIA.vazio')}
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge {...resolveCriticidadeTone(parecer.nivelRisco)}>
                {t(`campos.opcoes.${parecer.nivelRisco === 'critico' ? 'critico' : parecer.nivelRisco ?? 'medio'}`)}
              </StatusBadge>
              {parecer.confianca && (
                <span className="text-xs text-muted-foreground">
                  {t('dueDiligence.parecerIA.confianca', { nivel: t(`dueDiligence.parecerIA.confianca_${parecer.confianca}`) })}
                </span>
              )}
            </div>

            {parecer.resumo && <p className="text-sm leading-relaxed">{parecer.resumo}</p>}

            <Bloco
              titulo={t('dueDiligence.parecerIA.pontosFortes')}
              itens={parecer.pontosFortes}
              Icone={IconSuccess}
              tomDoIcone="text-success"
            />
            <Bloco
              titulo={t('dueDiligence.parecerIA.pontosAtencao')}
              itens={parecer.pontosAtencao}
              Icone={IconWarning}
              tomDoIcone="text-warning"
            />
            <Bloco
              titulo={t('dueDiligence.parecerIA.evidenciasEmFalta')}
              itens={parecer.evidenciasEmFalta}
              Icone={IconFile}
              tomDoIcone="text-muted-foreground"
            />
            <Bloco
              titulo={t('dueDiligence.parecerIA.recomendacoes')}
              itens={parecer.recomendacoes}
              Icone={IconInfo}
              tomDoIcone="text-primary"
            />

            {/*
              Quem escreveu e quando. Sem isto, daqui a seis meses ninguém sabe
              se o parecer é desta versão do questionário ou de outra.
            */}
            <p className="border-t border-border/50 pt-3 text-xs text-muted-foreground">
              {t('dueDiligence.parecerIA.rodape', {
                data: avaliadoEm ? formatDateOnly(avaliadoEm) : '—',
                respostas: String(parecer.respostasAnalisadas ?? 0),
              })}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
