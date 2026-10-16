import { describe, it, expect } from 'vitest';
import { seloDoFramework } from '@/components/frameworks/framework-seal-icon';
import { resolveFrameworkBrand } from '@/lib/framework-brand';

const s = (n: string) => seloDoFramework(n, resolveFrameworkBrand(n));
describe('selo: tema e cor por framework', () => {
  it('ISO 27001', () => { expect(s('ISO/IEC 27001').tema.en).toBe('Information security'); expect(s('ISO/IEC 27001').cor).toBe('--fw-blue'); });
  it('SOC 2', () => { expect(s('SOC 2 Type II').tema.en).toBe('Trust Services'); });
  it('LGPD', () => { expect(s('LGPD').tema.pt).toBe('Privacidade de dados'); expect(s('LGPD').cor).toBe('--fw-teal'); });
  it('NIST CSF', () => { expect(s('NIST CSF').cor).toBe('--fw-violet'); });
  it('PCI DSS', () => { expect(s('PCI DSS').tema.en).toBe('Payment security'); expect(s('PCI DSS').cor).toBe('--fw-gold'); });
});
