/**
 * Guardrail de internacionalização.
 *
 * Garante que os dicionários agregados PT e EN tenham exatamente as mesmas
 * chaves. Se alguém adicionar uma chave só em português (ou só em inglês),
 * o teste quebra e aponta exatamente qual chave está faltando.
 */
import { describe, it, expect } from 'vitest';
import { pt as corePt } from '../pt';
import { en as coreEn } from '../en';
import { modulesPt, modulesEn, mergeDictionaries } from '../modules';

type Dict = Record<string, unknown>;

function flatten(obj: Dict, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return value && typeof value === 'object' && !Array.isArray(value)
      ? flatten(value as Dict, path)
      : [path];
  });
}

function emptyValues(obj: Dict, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return emptyValues(value as Dict, path);
    }
    return typeof value === 'string' && value.trim() === '' ? [path] : [];
  });
}

describe('i18n — paridade PT/EN', () => {
  const pt = flatten(modulesPt as Dict).sort();
  const en = flatten(modulesEn as Dict).sort();

  it('carrega os dicionários agregados', () => {
    expect(pt.length).toBeGreaterThan(0);
    expect(en.length).toBeGreaterThan(0);
  });

  it('não tem chaves faltando em nenhum idioma', () => {
    const faltandoEmEn = pt.filter((k) => !en.includes(k));
    const faltandoEmPt = en.filter((k) => !pt.includes(k));
    expect({ faltandoEmEn, faltandoEmPt }).toEqual({ faltandoEmEn: [], faltandoEmPt: [] });
  });

  // Chaves cujo valor vazio é intencional (usadas como fallback silencioso).
  const VAZIAS_PERMITIDAS = ['dashWidgets.drill.fallback.description'];

  it('não tem valores vazios', () => {
    const filtrar = (chaves: string[]) => chaves.filter((k) => !VAZIAS_PERMITIDAS.includes(k));
    expect({
      pt: filtrar(emptyValues(modulesPt as Dict)),
      en: filtrar(emptyValues(modulesEn as Dict)),
    }).toEqual({ pt: [], en: [] });
  });

  it('preserva chaves comuns ao agregar módulos', () => {
    const aggregatedPt = mergeDictionaries(corePt, modulesPt) as Dict;
    const aggregatedEn = mergeDictionaries(coreEn, modulesEn) as Dict;

    expect((aggregatedPt.common as Dict).viewDetails).toBe('Ver detalhes');
    expect((aggregatedEn.common as Dict).viewDetails).toBe('View details');
  });
});
