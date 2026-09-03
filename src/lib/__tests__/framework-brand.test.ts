import { describe, expect, it } from 'vitest';
import { resolveFrameworkBadgePalette, resolveFrameworkBrand } from '@/lib/framework-brand';

describe('identidade visual dos frameworks', () => {
  it('dá assinaturas cromáticas distintas aos referenciais principais', () => {
    const iso = resolveFrameworkBrand('ISO/IEC 27001');
    const lgpd = resolveFrameworkBrand('LGPD');
    const nist = resolveFrameworkBrand('NIST CSF 2.0');

    const palettes = [
      resolveFrameworkBadgePalette('ISO/IEC 27001', iso.tone),
      resolveFrameworkBadgePalette('LGPD', lgpd.tone),
      resolveFrameworkBadgePalette('NIST CSF 2.0', nist.tone),
    ];

    expect(new Set(palettes.map((palette) => `${palette.from}:${palette.to}`)).size).toBe(3);
  });

  it('mantém uma paleta segura para frameworks personalizados', () => {
    const custom = resolveFrameworkBrand('Framework interno ACME');
    const palette = resolveFrameworkBadgePalette('Framework interno ACME', custom.tone);

    expect(palette.from).toMatch(/^#[0-9a-f]{6}$/i);
    expect(palette.to).toMatch(/^#[0-9a-f]{6}$/i);
  });
});
