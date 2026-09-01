import React from 'react';
import { useNavigate } from 'react-router-dom';
import { IconWarning } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAiCredits } from '@/hooks/useAiCredits';
import { useLanguage } from '@/contexts/LanguageContext';

/**
 * Faixa do saldo de créditos de IA.
 *
 * ## Quando aparece
 *
 * **Esgotado** é permanente: enquanto não houver franquia, os assistentes não
 * funcionam, e a faixa é a resposta à pergunta «porque é que isto não faz
 * nada». Fechá-la seria esconder a causa.
 *
 * **A acabar** e **últimos** aparecem só DEPOIS de alguém usar a IA. Uma
 * faixa permanente em todas as páginas, para quem talvez nem use IA hoje, é
 * ruído — e ruído constante deixa de se ler. O aviso chega no momento em que
 * significa alguma coisa: acabou de gastar um crédito, e restam poucos. Fica
 * até ser dispensado, e volta na utilização seguinte.
 *
 * ## Cor
 *
 * A cor fica na BORDA e no ÍCONE; o texto é de leitura. É o que as barras de
 * aviso das ferramentas boas fazem, e por uma razão medida:
 *
 *  · `text-warning-foreground` sobre `bg-warning/10` é branco puro sobre
 *    quase-branco — contraste ~1:1, literalmente ilegível. Aquela ficha
 *    existe para assentar sobre `bg-warning` SÓLIDO.
 *  · `text-warning` sobre o mesmo véu dá 3,1:1 — melhor, e ainda abaixo dos
 *    4,5:1 que o texto normal exige. Num aviso de dois tamanhos de letra,
 *    com a descrição em `text-micro`, isso não serve.
 *
 * Com `text-foreground` o contraste passa de 3,1 para mais de 12:1, e o
 * aviso continua a ler-se como aviso pela borda, pelo fundo e pelo ícone.
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
  const { isSuperAdmin, loading, franquia, restantes } = useAiCredits();
  const [dispensado, setDispensado] = React.useState(false);
  const [usouIA, setUsouIA] = React.useState(false);

  /* O mesmo evento que faz aparecer o aviso de «gastou 1 crédito». */
  React.useEffect(() => {
    const aoUsar = () => {
      setUsouIA(true);
      setDispensado(false);
    };
    window.addEventListener('ai-credit-consumed', aoUsar);
    window.addEventListener('ai-credits-exhausted', aoUsar);
    return () => {
      window.removeEventListener('ai-credit-consumed', aoUsar);
      window.removeEventListener('ai-credits-exhausted', aoUsar);
    };
  }, []);

  const estado = loading ? 'nenhum' : estadoDosCreditos(franquia, restantes);
  const esgotado = estado === 'esgotado';

  if (estado === 'nenhum') return null;
  // Só o esgotado se mostra sozinho; os outros esperam por uma utilização.
  if (!esgotado && (!usouIA || dispensado)) return null;

  const titulo = esgotado
    ? t('creditosIA.esgotadosTitulo')
    : t('creditosIA.aCabarTitulo', { n: String(restantes) });

  const descricao = esgotado
    ? isSuperAdmin
      ? t('creditosIA.esgotadosAdmin')
      : t('creditosIA.esgotadosUtilizador')
    : t('creditosIA.aCabarDescricao', { n: String(restantes), total: String(franquia) });

  return (
    <div
      role="alert"
      aria-live="polite"
      className={cn(
        'relative border-b px-4 py-2.5 flex items-center gap-3 flex-wrap text-foreground',
        esgotado
          ? 'border-destructive/40 bg-destructive/10'
          : 'border-warning/50 bg-warning/10',
      )}
    >
      {/* A cor vive aqui e na borda: o ícone aguenta-a sem custo de leitura. */}
      <span
        className={cn(
          'flex h-7 w-7 items-center justify-center rounded-md shrink-0',
          esgotado ? 'bg-destructive/15 text-destructive' : 'bg-warning/25 text-warning',
        )}
      >
        <IconWarning className="h-4 w-4" strokeWidth={1.5} />
      </span>
      <div className="flex-1 min-w-[240px]">
        <p className="text-xs font-semibold leading-tight">{titulo}</p>
        {/* `foreground/75` e não `muted-foreground`: o cinzento de apoio sobre o
            véu de aviso dava 4,0:1, e esta linha é a mais pequena das duas. A
            hierarquia fica no peso e no tamanho, não em desbotar até deixar de
            se ler. */}
        <p className="text-micro text-foreground/75 leading-tight mt-0.5">{descricao}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'h-7 px-2.5 text-micro',
            esgotado
              ? 'border-destructive/50 text-destructive hover:bg-destructive/15'
              : 'border-warning/60 hover:bg-warning/15',
          )}
          onClick={() =>
            navigate(isSuperAdmin ? '/configuracoes?tab=creditos-ia' : '/configuracoes?tab=assinatura')
          }
        >
          {isSuperAdmin ? t('creditosIA.gerirCreditos') : t('creditosIA.verPlano')}
        </Button>
        {!esgotado && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2.5 text-micro text-foreground/75 hover:bg-warning/15"
            onClick={() => setDispensado(true)}
          >
            {t('creditosIA.dispensar')}
          </Button>
        )}
      </div>
    </div>
  );
}
