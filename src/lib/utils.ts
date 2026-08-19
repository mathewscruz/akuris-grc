import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

/**
 * O `tailwind-merge` precisa de conhecer os degraus que nós acrescentámos.
 *
 * `text-micro` é uma escala nossa, definida no `tailwind.config.ts`. O
 * `twMerge` de fábrica não a conhece, e por isso classificava-a como classe de
 * COR de texto — o que a fazia desaparecer sempre que uma cor viesse a seguir
 * no mesmo `cn()`. Era o caso do chip de severidade:
 *
 *   cn('… text-micro …', 'bg-severity-high/10 text-severity-high …')
 *
 * O `text-micro` era engolido pelo `text-severity-high` e o chip herdava o
 * tamanho do pai — 12,2px em vez dos 10,4px desenhados. Não havia nada errado
 * no componente; o tamanho era descartado a caminho do DOM.
 *
 * Qualquer degrau novo em `fontSize` tem de ser declarado aqui também.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['micro'] }],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
