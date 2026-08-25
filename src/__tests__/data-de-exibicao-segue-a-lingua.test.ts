/**
 * Data e hora mostradas na tela seguem a língua de quem lê.
 *
 * ## O padrão
 *
 * `intlLocale()` devolve `pt-BR`, `pt-PT` ou `en-US` conforme o idioma activo, e
 * é ele que se passa a `toLocaleString`/`toLocaleTimeString`. Cravar `'pt-BR'`
 * faz uma data aparecer como `25/08/2026` para um utilizador que escolheu inglês
 * e vê todo o resto em `MM/DD`. Eram 13 pontos assim, em ecrãs de auditoria,
 * denúncia, incidentes, planos de acção.
 *
 * ## A excepção, e porque é excepção
 *
 * VALORES MONETÁRIOS em reais ficam em `pt-BR` de propósito: a receita da
 * própria plataforma e os contratos brasileiros são BRL por domínio, não por
 * idioma — `R$ 1.234,56` não vira `$1,234.56` só porque a interface está em
 * inglês. Esses passam `{ currency: 'BRL' }` ou `{ minimumFractionDigits }`, e
 * é por aí que a guarda os distingue de uma data.
 */
import { describe, expect, it, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fontes } from './_fontes';
import { intlLocale } from '@/lib/date-utils';
import { setAppLocale, getAppLocale, type AppLocale } from '@/lib/i18n-locale';

describe('data de exibição segue a língua', () => {
  const original = getAppLocale();
  afterEach(() => setAppLocale(original));

  it('intlLocale() devolve o BCP-47 do idioma activo', () => {
    setAppLocale('pt-BR');
    expect(intlLocale()).toBe('pt-BR');
    setAppLocale('en');
    expect(intlLocale()).toBe('en-US');
    setAppLocale('pt');
    expect(intlLocale()).toBe('pt-PT');
  });

  it('a mesma data muda de formato com a língua', () => {
    const d = new Date('2026-03-15T14:30:00Z');
    setAppLocale('pt-BR');
    const pt = d.toLocaleDateString(intlLocale()); // 15/03/2026
    setAppLocale('en');
    const en = d.toLocaleDateString(intlLocale()); // 3/15/2026
    expect(pt).not.toBe(en);
    expect(pt.startsWith('15')).toBe(true);
    expect(en.startsWith('3')).toBe(true);
  });

  it("nenhuma data de exibição crava 'pt-BR' (só moeda pode)", () => {
    /*
      Proibido: `toLocaleString`/`toLocaleDateString`/`toLocaleTimeString` com
      `'pt-BR'` como locale, EXCEPTO quando a chamada também formata moeda
      (`currency:` ou `minimumFractionDigits:` na mesma linha) — aí é um valor
      em reais, que fica em pt-BR por domínio.
    */
    const proibido = /toLocale(?:String|DateString|TimeString)\(\s*'pt-BR'/;
    const eMoeda = /currency|minimumFractionDigits|style:\s*'currency'/;

    const infratores: string[] = [];
    for (const ficheiro of fontes()) {
      const texto = readFileSync(ficheiro, 'utf8');
      texto.split('\n').forEach((linha, i) => {
        if (proibido.test(linha) && !eMoeda.test(linha)) {
          infratores.push(`${ficheiro}:${i + 1} → ${linha.trim().slice(0, 90)}`);
        }
      });
    }

    expect(
      infratores,
      "Data de exibição com locale 'pt-BR' cravado. Use `intlLocale()` de " +
        '`@/lib/date-utils` para a data seguir a língua. (Valor em reais é ' +
        'excepção — passe `currency: \'BRL\'`.)',
    ).toEqual([]);
  });
});
