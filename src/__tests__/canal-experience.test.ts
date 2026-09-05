import { describe, it, expect } from 'vitest';
import { buildDenunciaSchema, canalFileMime } from '@/lib/canal-report-form';
import { canalBrandColor } from '@/lib/canal-brand';

const t = (key: string) => key;
const report = { categoria_id: 'categoria', titulo: 'Um relato de teste', descricao: 'Descrição fictícia suficiente para validação.', nivel_identificacao: 'anonima', politica_aceita: true };
describe('public report validation', () => {
  it('aligns summary and description limits with the server', () => {
    const schema = buildDenunciaSchema(t, true, true);
    expect(schema.safeParse(report).success).toBe(true);
    for (const titulo of ['1234567', ' '.repeat(8), 'a'.repeat(161)]) expect(schema.safeParse({ ...report, titulo }).success).toBe(false);
    for (const descricao of ['a'.repeat(19), 'a'.repeat(10001)]) expect(schema.safeParse({ ...report, descricao }).success).toBe(false);
    expect(schema.safeParse({ ...report, titulo: 'a'.repeat(160), descricao: 'a'.repeat(10000) }).success).toBe(true);
  });
  it('does not let the pending policy hide conditional identification errors', () => {
    const result = buildDenunciaSchema(t, true, true).safeParse({ ...report, nivel_identificacao: 'confidencial', politica_aceita: false });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.map((issue) => issue.path[0])).toEqual(expect.arrayContaining(['denunciante_nome', 'politica_aceita']));
  });
  it('supports optional policy, confidential contact and tenant email requirements', () => {
    expect(buildDenunciaSchema(t, true, false).safeParse({ ...report, politica_aceita: false }).success).toBe(true);
    const identified = { ...report, nivel_identificacao: 'confidencial', denunciante_nome: 'Pessoa Teste' };
    expect(buildDenunciaSchema(t, false, true).safeParse(identified).success).toBe(true);
    const required = buildDenunciaSchema(t, true, true, true);
    expect(required.safeParse(report).success).toBe(false);
    expect(required.safeParse(identified).success).toBe(false);
    expect(required.safeParse({ ...identified, denunciante_email: 'person@example.test' }).success).toBe(true);
    expect(required.safeParse({ ...identified, denunciante_email: 'invalid' }).success).toBe(false);
    expect(buildDenunciaSchema(t, false, true).safeParse(report).success).toBe(false);
  });
  it('accepts only supported evidence extensions and matching MIME types', () => {
    expect(canalFileMime({ name: 'evidence.PDF', type: '' })).toBe('application/pdf');
    expect(canalFileMime({ name: 'evidence.docx', type: 'application/octet-stream' })).toContain('wordprocessingml');
    expect(canalFileMime({ name: 'evidence.txt', type: 'text/plain' })).toBeNull();
    expect(canalFileMime({ name: 'evidence.jpg', type: 'image/png' })).toBeNull();
    expect(canalFileMime({ name: 'evidence.pdf.exe', type: 'application/pdf' })).toBeNull();
  });
});
describe('tenant brand contrast', () => {
  const contrast = (hex: string) => {
    const values = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
    return 1.05 / (.05 + values.reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0));
  };
  it.each(['#ffffff', '#ffff00', '#00ff00', '#7452ff', '#aaaaaa', '#ff0000', '#6246bc'])('keeps %s readable with white text', (color) => {
    expect(contrast(canalBrandColor(color))).toBeGreaterThanOrEqual(4.7);
  });
  it('keeps a readable brand and uses safe fallbacks', () => {
    expect(canalBrandColor('#6246bc')).toBe('#6246bc');
    expect(canalBrandColor('url(https://example.test)')).toBe('#6246bc');
    expect(canalBrandColor(null)).toBe('#6246bc');
  });
});
