import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  eDominioPublicoAkuris,
  protegerContraEnquadramento,
} from '@/lib/seguranca/clickjacking';

describe('proteção complementar contra clickjacking', () => {
  afterEach(() => {
    document.documentElement.style.display = '';
    vi.restoreAllMocks();
  });

  it('não altera a página quando executada fora do domínio de produção', () => {
    protegerContraEnquadramento();

    expect(document.documentElement.style.display).toBe('');
  });

  it('reconhece apenas o domínio público e os seus subdomínios', () => {
    expect(eDominioPublicoAkuris('akuris.pt')).toBe(true);
    expect(eDominioPublicoAkuris('WWW.AKURIS.PT')).toBe(true);
    expect(eDominioPublicoAkuris('preview.akuris.pt')).toBe(true);
    expect(eDominioPublicoAkuris('akuris.pt.atacante.test')).toBe(false);
    expect(eDominioPublicoAkuris('localhost')).toBe(false);
  });
});
