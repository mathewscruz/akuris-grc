/**
 * O mesmo módulo, o mesmo ícone — em qualquer sítio onde apareça.
 *
 * O módulo era desenhado por três listas independentes: menu lateral, paleta
 * de busca e navegação móvel. Cada uma escolhia o seu glifo e as três tinham
 * divergido: o painel era um layout no menu e uma grelha na busca; Riscos era
 * o ícone próprio do módulo no menu e um triângulo de aviso na busca;
 * Denúncias era uma caixa de seleção na navegação móvel. Quem procura
 * "Riscos" e vê um desenho diferente do que está no menu não reconhece que é
 * o mesmo sítio — o ícone deixa de ser endereço.
 *
 * A fonte única é `lib/module-icons.ts`, com a rota como chave.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const NAVEGACAO = [
  'src/components/AppSidebar.tsx',
  'src/components/MobileBottomNav.tsx',
  'src/components/CommandPalette.tsx',
].map((p) => resolve(__dirname, '../../', p));

describe('navegação coerente', () => {
  it('as três listas leem o mesmo mapa', () => {
    for (const f of NAVEGACAO) {
      expect(existsSync(f), `${f} tem de existir`).toBe(true);
      const src = readFileSync(f, 'utf8');
      expect(src, `${f} tem de importar o mapa de ícones de módulo.`).toContain("from '@/lib/module-icons'");
    }
  });

  it('nenhuma entrada de navegação escolhe o ícone à mão', () => {
    const infratores: string[] = [];
    for (const f of NAVEGACAO) {
      const linhas = readFileSync(f, 'utf8').split('\n');
      linhas.forEach((l, i) => {
        // `icon: AlgumIcone` numa entrada com rota é escolha manual
        if (!/(url|path):\s*'/.test(l)) return;
        if (/icon:\s*MODULE_ICON\[/.test(l)) return;
        if (/icon:\s*[A-Z]\w+/.test(l)) infratores.push(`${f.split(/[\\/]/).pop()}:${i + 1}`);
      });
    }
    expect(
      infratores,
      'Use MODULE_ICON[rota] — um ícone escolhido à mão volta a divergir das outras listas.',
    ).toEqual([]);
  });

  it('o mapa não repete o mesmo glifo em módulos diferentes', () => {
    const src = readFileSync(resolve(__dirname, '../lib/module-icons.ts'), 'utf8');
    const bloco = src.slice(src.indexOf('MODULE_ICON'), src.indexOf('};', src.indexOf('MODULE_ICON')));
    const porGlifo = new Map<string, string[]>();
    for (const m of bloco.matchAll(/'([^']+)':\s*(\w+),/g)) {
      const [, rota, glifo] = m;
      if (!porGlifo.has(glifo)) porGlifo.set(glifo, []);
      porGlifo.get(glifo)!.push(rota);
    }
    const repetidos = [...porGlifo]
      .filter(([, rotas]) => rotas.length > 1)
      .map(([glifo, rotas]) => `${glifo}: ${rotas.join(', ')}`);
    expect(repetidos, 'Dois módulos com o mesmo desenho não se distinguem no menu.').toEqual([]);
  });
});
