import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useAiCredits } from '@/hooks/useAiCredits';
import { useLanguage } from '@/contexts/LanguageContext';
import { aiEdgeFunctionLabel } from '@/lib/ai-usage-catalog';

/**
 * Diz, na hora, que aquilo custou um crédito.
 *
 * Quem usa uma ferramenta que cobra por uso tem de saber quando o contador
 * anda. Antes não havia sinal nenhum: o saldo descia em silêncio e a primeira
 * notícia era a faixa de esgotado.
 *
 * O aviso é discreto de propósito — não é um erro nem pede nada. Diz o que
 * gastou, em quê, e quanto resta. Quando o saldo já está a acabar, o próprio
 * aviso muda de tom: é aí que a informação passa a ser accionável.
 *
 * Ouve o evento que o `fetch` dispara (ver `lib/atualizar-apos-escrita.ts`),
 * e por isso vale para TODAS as chamadas de IA — não só as que passam pelo
 * `invokeEdgeFunction`, que quase ninguém usa.
 */

/** Abaixo disto o aviso deixa de ser informativo e passa a ser um alerta. */
const RESTAM_POUCOS = 10;

export function AvisoDeCreditoUsado() {
  const { t, locale } = useLanguage();
  const { restantes, franquia } = useAiCredits();

  /* O saldo do momento, sem re-registar o ouvinte a cada débito — senão
     perdia-se um evento entre a remoção e a nova subscrição. */
  const saldo = useRef({ restantes, franquia });
  saldo.current = { restantes, franquia };

  useEffect(() => {
    const aoConsumir = (e: Event) => {
      const nome = (e as CustomEvent)?.detail?.functionName as string | undefined;
      const { restantes: r, franquia: f } = saldo.current;
      if (f <= 0) return; // empresa sem franquia definida: não há contador para mostrar

      const rotulo = nome ? aiEdgeFunctionLabel(nome, locale) : null;
      const titulo = rotulo
        ? t('creditosIA.usadoCom', { funcionalidade: rotulo })
        : t('creditosIA.usado');

      toast(titulo, {
        description: t('creditosIA.restam', { n: String(Math.max(0, r)), total: String(f) }),
        duration: 2000,
      });
    };

    window.addEventListener('ai-credit-consumed', aoConsumir);
    return () => window.removeEventListener('ai-credit-consumed', aoConsumir);
  }, [t, locale]);

  return null;
}

export { RESTAM_POUCOS };
