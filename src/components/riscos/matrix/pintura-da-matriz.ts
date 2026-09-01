/**
 * Como se pinta a matriz de risco. Um sítio, para todos os sítios onde ela
 * aparece.
 *
 * ## O que estava
 *
 * A mesma matriz tinha desenhos diferentes conforme o ecrã:
 *
 *  · O **mapa de calor** (aba Matriz) pintava a célula com tokens de
 *    severidade — `bg-destructive/15`, `bg-orange/15`, `bg-warning/8`,
 *    `bg-success/12` — e ignorava a cor configurada.
 *  · A **pré-visualização** (diálogo da matriz) pintava a célula com o hex
 *    guardado em `niveis_risco[].cor`, sólido, com o número a branco.
 *
 * As cores são escolhidas pela empresa: há uma configuração na base com os
 * níveis renomeados para «Baixo / Moderado / Elevado / Extremo» e o Extremo em
 * **roxo**. No diálogo da matriz essa empresa via roxo; na aba onde trabalha
 * todos os dias via vermelho. A pré-visualização é literalmente uma
 * pré-visualização — e mostrava outra coisa.
 *
 * ## O que fica
 *
 * A cor vem de quem a escolheu: `niveis_risco[].cor`. Sem cor configurada,
 * cai no token de severidade, que é o que o resto do produto usa.
 *
 * O tratamento é o mesmo nos dois: fundo tenue, borda da mesma cor mais
 * marcada, e uma marca sólida com a letra da severidade. Tenue porque em cima
 * da célula do mapa de calor vivem as bolhas dos riscos e o número do score —
 * um fundo sólido come-os.
 *
 * ## A letra
 *
 * A cor da letra sai da luminância do fundo, não de uma escolha fixa. Uma
 * empresa que ponha amarelo no nível mais grave recebe letra escura; a que
 * ponha roxo recebe letra clara. Sem isto, a legenda do mapa de calor tinha
 * contraste **1,04:1** — a letra herdava o cinzento do texto à volta e ficava
 * invisível dentro do quadrado colorido, medido no navegador.
 */
import type { CSSProperties } from 'react';
import type { Severity } from '@/components/riscos/risk-utils';

/** A faixa como vem da configuração da empresa. */
export interface NivelPintavel {
  nivel?: string;
  min: number;
  max: number;
  cor?: string;
}

/** Token de cor por severidade, para quem não configurou nenhuma. */
const TOKEN_DA_SEVERIDADE: Record<Severity, string> = {
  critico: 'hsl(var(--destructive))',
  alto: 'hsl(var(--orange))',
  medio: 'hsl(var(--warning))',
  baixo: 'hsl(var(--success))',
};

/**
 * A letra que o sistema de design já garante para cada token.
 *
 * Um token não se pode medir a partir daqui — o seu valor vive no CSS e muda
 * com o tema. Mas o par já existe e é o que o resto do produto usa.
 */
const LETRA_DO_TOKEN: Record<Severity, string> = {
  critico: 'hsl(var(--destructive-foreground))',
  alto: 'hsl(var(--orange-foreground))',
  medio: 'hsl(var(--warning-foreground))',
  baixo: 'hsl(var(--success-foreground))',
};

/*
   Absolutas, não `--foreground`.

   A marca é pintada com um hex fixo, que não muda com o tema; a letra por cima
   dela também não pode mudar. `hsl(var(--foreground))` ficaria quase-preta em
   claro e quase-branca em escuro — e sobre um amarelo fixo a segunda some.
*/
const BRANCO = 'hsl(0 0% 100%)';
const QUASE_PRETO = 'hsl(0 0% 9%)';

/** Opacidades do tratamento, iguais em todos os sítios. */
const FUNDO = '14%';
const BORDA = '38%';

/** `#abc` e `#aabbcc` → [r,g,b]. `null` para o que não for hex. */
function rgbDoHex(cor: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(cor.trim());
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/**
 * Luminância relativa (WCAG). Serve para decidir se a letra vai clara ou
 * escura sobre a marca.
 */
export function luminancia(cor: string): number | null {
  const rgb = rgbDoHex(cor);
  if (!rgb) return null;
  const canal = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const [r, g, b] = rgb;
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

/**
 * A cor base de um nível: a que a empresa escolheu, ou o token da severidade.
 */
export function corDoNivel(nivel: NivelPintavel | null | undefined, sev: Severity): string {
  const escolhida = nivel?.cor?.trim();
  if (escolhida && rgbDoHex(escolhida)) return escolhida;
  return TOKEN_DA_SEVERIDADE[sev];
}

export interface PinturaDoNivel {
  /** Fundo tenue + borda, para a célula da grelha. */
  celula: CSSProperties;
  /** Quadrado sólido com letra legível, para a legenda e para o canto da célula. */
  marca: CSSProperties;
}

/**
 * O tratamento visual de um nível, pronto a aplicar.
 *
 * `color-mix` faz o esbatimento sem precisar de saber se a cor veio em hex ou
 * em `hsl(var(--token))` — é o que permite a mesma função servir os dois casos.
 */
export function pinturaDoNivel(nivel: NivelPintavel | null | undefined, sev: Severity): PinturaDoNivel {
  const base = corDoNivel(nivel, sev);

  return {
    celula: {
      backgroundColor: `color-mix(in srgb, ${base} ${FUNDO}, transparent)`,
      borderColor: `color-mix(in srgb, ${base} ${BORDA}, transparent)`,
    },
    marca: {
      backgroundColor: base,
      color: letraSobre(base) ?? LETRA_DO_TOKEN[sev],
    },
  };
}

/**
 * Branco ou quase-preto, o que se ler melhor sobre esta cor. `null` quando a
 * cor não é um hex (é um token, e aí quem manda é o par do sistema de design).
 *
 * Um limiar fixo de luminância não serve: medido no navegador, o laranja da
 * configuração dava 2,80:1 com letra branca e o amarelo 1,92:1 — a letra
 * existia e não se via. Comparar os dois contrastes e ficar com o maior dá
 * 7,4 e 10,6 nos mesmos fundos, sem escolher nada à mão.
 */
export function letraSobre(cor: string): string | null {
  const lum = luminancia(cor);
  if (lum === null) return null;
  const contraste = (a: number, b: number) =>
    (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  return contraste(lum, 1) >= contraste(lum, luminancia('#171717') ?? 0)
    ? BRANCO
    : QUASE_PRETO;
}
