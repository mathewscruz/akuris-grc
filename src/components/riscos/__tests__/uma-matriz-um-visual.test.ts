/**
 * A matriz de risco tem um visual só.
 *
 * Aparecia em dois sítios e desenhava-se de duas maneiras:
 *
 *  · **Mapa de calor** (aba Matriz): célula com fundo tenue vindo de tokens de
 *    severidade — `bg-destructive/15`, `bg-orange/15` — e a cor configurada
 *    pela empresa ignorada.
 *  · **Pré-visualização** (diálogo da matriz): célula SÓLIDA pintada com o hex
 *    de `niveis_risco[].cor`, número a branco, e outra legenda.
 *
 * As cores são escolhidas pela empresa: há uma configuração na base com os
 * níveis renomeados para «Baixo / Moderado / Elevado / Extremo» e o Extremo em
 * roxo. Essa empresa via roxo no diálogo e vermelho na aba onde trabalha — e o
 * diálogo chama-se «pré-visualização».
 *
 * A legenda tinha o seu próprio defeito, medido no navegador: rótulo a 10,2px
 * com contraste 4,65:1, e a letra dentro do quadrado a **1,04:1** — as classes
 * de severidade davam só o fundo e a letra herdava o cinzento do texto à volta.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { luminancia, letraSobre, pinturaDoNivel, corDoNivel } from '../matrix/pintura-da-matriz';

const MAPA = 'src/components/riscos/matrix/RiskHeatmap.tsx';
const PREVIA = 'src/components/riscos/MatrizPreviewGrid.tsx';

const contraste = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

describe('a letra lê-se sobre qualquer cor', () => {
  it('escolhe branco ou quase-preto pelo maior contraste', () => {
    /* As quatro cores da configuração por omissão. Com um limiar fixo de
       luminância, o laranja dava 2,80:1 e o amarelo 1,92:1 — a letra existia e
       não se via. */
    const cores = ['#dc2626', '#f97316', '#eab308', '#22c55e', '#8e099f', '#d10a0a'];
    for (const cor of cores) {
      const letra = letraSobre(cor);
      expect(letra, cor).not.toBeNull();
      const lumFundo = luminancia(cor)!;
      const lumLetra = letra === 'hsl(0 0% 100%)' ? 1 : luminancia('#171717')!;
      expect(contraste(lumFundo, lumLetra), `${cor} → ${letra}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('sem hex, entrega o par do sistema de design', () => {
    // Um token não se mede daqui: o valor vive no CSS e muda com o tema.
    expect(letraSobre('hsl(var(--destructive))')).toBeNull();
    expect(pinturaDoNivel(null, 'critico').marca.color).toBe('hsl(var(--destructive-foreground))');
  });

  it('a cor vem de quem a escolheu', () => {
    expect(corDoNivel({ min: 17, max: 25, cor: '#8e099f' }, 'critico')).toBe('#8e099f');
    // Sem cor configurada, o token — que é o que o resto do produto usa.
    expect(corDoNivel({ min: 17, max: 25 }, 'critico')).toBe('hsl(var(--destructive))');
    expect(corDoNivel({ min: 17, max: 25, cor: 'nao-e-cor' }, 'alto')).toBe('hsl(var(--orange))');
  });

  it('a célula é tenue e a marca é sólida', () => {
    const p = pinturaDoNivel({ min: 1, max: 4, cor: '#22c55e' }, 'baixo');
    // Tenue porque em cima da célula do mapa vivem as bolhas dos riscos.
    expect(String(p.celula.backgroundColor)).toContain('color-mix');
    expect(p.marca.backgroundColor).toBe('#22c55e');
  });
});

describe('um visual, dois sítios', () => {
  it('os dois desenham a célula pela mesma função', () => {
    for (const f of [MAPA, PREVIA]) {
      const fonte = readFileSync(f, 'utf8');
      expect(fonte.includes('pinturaDoNivel('), f).toBe(true);
    }
  });

  it('os dois usam a mesma legenda', () => {
    for (const f of [MAPA, PREVIA]) {
      expect(readFileSync(f, 'utf8').includes('<LegendaDaMatriz'), f).toBe(true);
    }
  });

  it('nenhum dos dois volta a pintar a célula por conta própria', () => {
    const mapa = readFileSync(MAPA, 'utf8');
    /* Declaração e uso, não a palavra: o comentário que explica a remoção
       nomeia-as de propósito, e uma leitura por nome cru transformava a
       explicação do defeito no próprio defeito. */
    for (const nome of ['SEV_BG', 'SEV_BORDER']) {
      expect(new RegExp(`const ${nome}\\s*:`).test(mapa), `${nome} redeclarado`).toBe(false);
      expect(new RegExp(`${nome}\\[`).test(mapa), `${nome} em uso`).toBe(false);
    }

    const previa = readFileSync(PREVIA, 'utf8');
    // O bloco sólido com `backgroundColor: faixa.cor` era a outra metade.
    expect(/backgroundColor:\s*faixa\.cor/.test(previa)).toBe(false);
    expect(previa.includes('text-white/95')).toBe(false);
  });

  it('a legenda não volta ao tamanho e ao tom que a apagavam', () => {
    const legenda = readFileSync('src/components/riscos/matrix/LegendaDaMatriz.tsx', 'utf8');
    // Rótulo: `text-xs text-foreground` (14,2:1), não `text-micro muted` (4,65:1).
    expect(/text-xs text-foreground/.test(legenda)).toBe(true);
    // A marca tem cor de letra própria; sem ela herdava o cinzento à volta.
    expect(/style=\{i\.pintura\.marca\}/.test(legenda)).toBe(true);
  });
});
