/**
 * O produto tem TRÊS idiomas: `pt` (Portugal), `pt-BR` (Brasil) e `en`.
 *
 * Muito código foi escrito quando eram dois, e ficou a testar `locale === 'pt'`
 * com o inglês no ramo `else`. Quando o `pt-BR` entrou, esse teste passou a
 * mandar o utilizador BRASILEIRO — que é o público principal — para o ramo
 * inglês, em silêncio:
 *
 *   · o painel mostrava "about 24 hours ago" numa interface em português;
 *   · o diálogo de aprovação datava em `MM/dd/yyyy 'at' h:mm a`;
 *   · e cada página declarava `<html lang="en">`, com o Open Graph a condizer,
 *     enquanto a de Portugal se declarava `pt-BR`.
 *
 * A forma correta trata os três, e está em `dateFnsLocale()` / `intlLocale()`.
 */
import { describe, expect, it } from 'vitest';
import { fontesTsx, linhas } from './_fontes';

/** `locale === 'pt' ? algo : outro` — o binário que esquece o pt-BR. */
const binarioDoLocale = /locale\s*===\s*'pt'\s*\?/;

/**
 * A forma correta TESTA os três, e testar três exige dois `?`.
 *
 * A primeira versão desta guarda contentava-se com a linha citar `'pt-BR'` em
 * qualquer sítio — e deixou passar exatamente o defeito que existe para
 * apanhar, na exportação de PDF de Relatórios:
 *
 *   toLocaleDateString(locale === 'pt' ? 'pt-BR' : 'en-US')
 *
 * Cita `'pt-BR'`, sim: para dar ao utilizador de PORTUGAL o formato do Brasil,
 * e mandar o brasileiro — que é o público principal — para o inglês. Contar os
 * ramos é o que distingue tratar três casos de mencionar três nomes.
 */
const trataOsTres = (linha: string) => {
  const ramos = (linha.match(/\?/g) ?? []).length;
  if (ramos >= 2) return true;
  // Um ramo só é aceitável quando a decisão foi delegada ao ajudante.
  return /dateFnsLocale\(\)|intlLocale\(\)|datePattern\(\)/.test(linha);
};

describe('três variantes de idioma', () => {
  it('ninguém decide idioma com um teste de duas variantes', () => {
    const infratores: string[] = [];

    for (const arquivo of fontesTsx()) {
      linhas(arquivo).forEach((linha, i) => {
        const t = linha.trimStart();
        if (t.startsWith('*') || t.startsWith('//')) return;
        if (binarioDoLocale.test(linha) && !trataOsTres(linha)) {
          infratores.push(`${arquivo}:${i + 1} → ${linha.trim()}`);
        }
      });
    }

    expect(
      infratores,
      "São três idiomas: use dateFnsLocale()/intlLocale(), ou trate 'en' e 'pt-BR' explicitamente.",
    ).toEqual([]);
  });

  it('a guarda enxerga o padrão que proíbe', () => {
    // Sem isto, um erro na expressão faria o teste passar sempre.
    const mau = "const l = locale === 'pt' ? ptBR : enUS;";
    expect(binarioDoLocale.test(mau)).toBe(true);
    expect(trataOsTres(mau)).toBe(false);

    // O caso que a primeira versão da guarda deixou passar: cita 'pt-BR', mas
    // para dar ao português de Portugal o formato do Brasil e mandar o
    // brasileiro para inglês.
    const enganador = "toLocaleDateString(locale === 'pt' ? 'pt-BR' : 'en-US')";
    expect(binarioDoLocale.test(enganador)).toBe(true);
    expect(trataOsTres(enganador)).toBe(false);

    // As duas formas corretas não são acusadas.
    const ternarioTriplo = "const l = locale === 'en' ? enUS : locale === 'pt' ? ptPT : ptBR;";
    expect(binarioDoLocale.test(ternarioTriplo) && !trataOsTres(ternarioTriplo)).toBe(false);
    const delegada = 'toLocaleDateString(intlLocale())';
    expect(binarioDoLocale.test(delegada) && !trataOsTres(delegada)).toBe(false);
  });
});
