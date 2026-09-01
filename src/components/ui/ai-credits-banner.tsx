import React from 'react';
import { useNavigate } from 'react-router-dom';
import { IconWarning } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAiCredits } from '@/hooks/useAiCredits';
import { useLanguage } from '@/contexts/LanguageContext';

/**
 * Faixa global do saldo de créditos de IA.
 *
 * Tinha um estado só — esgotado — e por isso a primeira notícia que alguém
 * recebia era a de que já não podia trabalhar. Passa a avisar ANTES, que é
 * quando ainda dá para pedir mais ou poupar: é o que fazem as ferramentas que
 * cobram por uso.
 *
 * Três estados, e nunca mais do que um:
 *
 *  · **A acabar** (≤20% e ≤10 restantes) — tom de aviso, dispensável. Quem
 *    dispensa não volta a ver esta soleira nesta sessão; a soleira seguinte,
 *    mais grave, volta a aparecer.
 *  · **Últimos** (≤3 restantes) — tom de aviso forte, não se dispensa.
 *  · **Esgotado** — tom destrutivo, não se dispensa.
 *
 * O «≤10» evita gritar por nada em planos grandes: 20% de 200 são 40 créditos,
 * e ainda dá para muito trabalho.
 */

/** Abaixo disto começa a haver o que dizer. */
const FRACAO_DE_AVISO = 0.2;
const TETO_DE_AVISO = 10;
const ULTIMOS = 3;

type Estado = 'nenhum' | 'aCabar' | 'ultimos' | 'esgotado';

export function estadoDosCreditos(franquia: number, restantes: number): Estado {
  if (franquia <= 0) return 'nenhum';
  if (restantes <= 0) return 'esgotado';
  if (restantes <= ULTIMOS) return 'ultimos';
  if (restantes <= Math.min(TETO_DE_AVISO, Math.ceil(franquia * FRACAO_DE_AVISO))) return 'aCabar';
  return 'nenhum';
}

export function AiCreditsExhaustedBanner() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { esgotado, isSuperAdmin, loading, franquia, restantes } = useAiCredits();
  const [dispensado, setDispensado] = React.useState(false);

  const estado = loading ? 'nenhum' : estadoDosCreditos(franquia, restantes);
  const grave = estado === 'esgotado' || estado === 'ultimos';

  // Voltar a subir de soleira faz o aviso reaparecer, mesmo dispensado antes.
  React.useEffect(() => {
    if (grave) setDispensado(false);
  }, [grave]);

  if (estado === 'nenhum' || (estado === 'aCabar' && dispensado)) return null;

  const titulo =
    estado === 'esgotado'
      ? t('creditosIA.esgotadosTitulo')
      : t('creditosIA.aCabarTitulo', { n: String(restantes) });

  const descricao =
    estado === 'esgotado'
      ? isSuperAdmin
        ? t('creditosIA.esgotadosAdmin')
        : t('creditosIA.esgotadosUtilizador')
      : t('creditosIA.aCabarDescricao', { n: String(restantes), total: String(franquia) });

  return (
    <div
      role="alert"
      aria-live="polite"
      className={cn(
        'relative border-b px-4 py-2.5 flex items-center gap-3 flex-wrap',
        esgotado
          ? 'border-destructive/30 bg-destructive/10 text-destructive'
          : 'border-warning/30 bg-warning/10 text-warning-foreground',
      )}
    >
      <span
        className={cn(
          'flex h-7 w-7 items-center justify-center rounded-md shrink-0',
          esgotado ? 'bg-destructive/15' : 'bg-warning/20',
        )}
      >
        <IconWarning className="h-4 w-4" strokeWidth={1.5} />
      </span>
      <div className="flex-1 min-w-[240px]">
        <p className="text-xs font-semibold leading-tight">{titulo}</p>
        <p className="text-micro opacity-90 leading-tight mt-0.5">{descricao}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'h-7 px-2.5 text-micro',
            esgotado
              ? 'border-destructive/40 text-destructive hover:bg-destructive/15'
              : 'border-warning/40 hover:bg-warning/15',
          )}
          onClick={() =>
            navigate(isSuperAdmin ? '/configuracoes?tab=creditos-ia' : '/configuracoes?tab=assinatura')
          }
        >
          {isSuperAdmin ? t('creditosIA.gerirCreditos') : t('creditosIA.verPlano')}
        </Button>
        {estado === 'aCabar' && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2.5 text-micro"
            onClick={() => setDispensado(true)}
          >
            {t('creditosIA.dispensar')}
          </Button>
        )}
      </div>
    </div>
  );
}
