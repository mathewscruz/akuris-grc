/**
 * Guardrail de internacionalização.
 *
 * Garante que todo módulo de dicionário tenha exatamente as mesmas chaves em
 * PT e EN. Se alguém adicionar uma chave só em português (ou só em inglês),
 * o teste quebra e aponta exatamente qual chave está faltando.
 */
import { describe, it, expect } from 'vitest';
import { modules } from '../modules';

type Dict = Record<string, unknown>;

function flatten(obj: Dict, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return value && typeof value === 'object' && !Array.isArray(value)
      ? flatten(value as Dict, path)
      : [path];
  });
}

describe('i18n — paridade PT/EN', () => {
  const entries = Object.entries(modules as Record<string, { pt: Dict; en: Dict }>);

  it('encontra os módulos registrados', () => {
    expect(entries.length).toBeGreaterThan(0);
  });

  for (const [name, dict] of entries) {
    it(`módulo "${name}" tem as mesmas chaves em PT e EN`, () => {
      const pt = flatten(dict.pt).sort();
      const en = flatten(dict.en).sort();

      const faltandoEmEn = pt.filter((k) => !en.includes(k));
      const faltandoEmPt = en.filter((k) => !pt.includes(k));

      expect({ faltandoEmEn, faltandoEmPt }).toEqual({ faltandoEmEn: [], faltandoEmPt: [] });
    });

    it(`módulo "${name}" não tem valores vazios`, () => {
      const vazias: string[] = [];
      for (const locale of ['pt', 'en'] as const) {
        const walk = (obj: Dict, prefix = '') => {
          for (const [key, value] of Object.entries(obj)) {
            const path = prefix ? `${prefix}.${key}` : key;
            if (value && typeof value === 'object' && !Array.isArray(value)) {
              walk(value as Dict, path);
            } else if (typeof value === 'string' && value.trim() === '') {
              vazias.push(`${locale}:${path}`);
            }
          }
        };
        walk(dict[locale]);
      }
      expect(vazias).toEqual([]);
    });
  }
});
