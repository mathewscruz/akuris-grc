import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Lê ?focus=ID da URL e, quando o item correspondente estiver renderizado
 * (atributo `data-focus-id="<id>"`), faz scroll suave até ele e aplica um
 * destaque visual temporário (ring primary + bg accent) por 2,5s.
 *
 * Fica em polling leve por até 5s para esperar a tabela carregar.
 *
 * Quando o mesmo id aparece em representações responsivas diferentes (card
 * mobile + linha da tabela), o destaque vai para a que estiver visível.
 *
 * Uso:
 *   useFocusRow();
 *   <tr data-focus-id={item.id}>...</tr>
 */
export function useFocusRow(options?: { onFound?: (id: string) => void }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const focusId = searchParams.get('focus');

  useEffect(() => {
    if (!focusId) return;
    let attempts = 0;
    let cancelled = false;

    const tryFocus = () => {
      if (cancelled) return;
      // A mesma linha pode existir em mais de uma representação responsiva
      // (ex.: card mobile `md:hidden` + linha da tabela `hidden md:block`).
      // Destacar o primeiro do DOM cairia sobre o elemento oculto, sem scroll
      // nem realce perceptível — por isso escolhemos o candidato visível.
      const candidatos = Array.from(
        document.querySelectorAll<HTMLElement>(`[data-focus-id="${focusId}"]`)
      );
      const el =
        candidatos.find((candidato) => candidato.getClientRects().length > 0) ?? candidatos[0];

      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-2', 'ring-primary', 'ring-offset-2', 'bg-accent/40', 'transition-all', 'duration-300');
        window.setTimeout(() => {
          el.classList.remove('ring-2', 'ring-primary', 'ring-offset-2', 'bg-accent/40');
        }, 2500);
        options?.onFound?.(focusId);
        // limpa o param para não reaplicar em remounts
        const next = new URLSearchParams(searchParams);
        next.delete('focus');
        setSearchParams(next, { replace: true });
        return;
      }
      attempts += 1;
      if (attempts < 25) {
        window.setTimeout(tryFocus, 200);
      }
    };

    tryFocus();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId]);
}
