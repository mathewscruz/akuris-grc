import { describe, it, expect } from 'vitest';
import { ordenarPorSensibilidade, normalizarUrlScan, nomeAmigavelFormulario } from '@/lib/url-scanner-utils';

describe('url-scanner-utils', () => {
  it('ordena críticos, depois sensíveis, depois comuns', () => {
    const r = ordenarPorSensibilidade([
      { sensitivity: 'comum', n: 'a' },
      { sensitivity: 'sensivel', n: 'b' },
      { sensitivity: 'critico', n: 'c' },
      { sensitivity: 'comum', n: 'd' },
    ]);
    expect(r.map((x) => x.campo.n)).toEqual(['c', 'b', 'a', 'd']);
    expect(r[0].indice).toBe(2);
  });

  it('adiciona https:// a domínios sem protocolo', () => {
    expect(normalizarUrlScan('vitru.com.br')).toBe('https://vitru.com.br');
    expect(normalizarUrlScan('http://site.pt/contato')).toBe('http://site.pt/contato');
  });

  it('rejeita entradas inválidas', () => {
    expect(normalizarUrlScan('')).toBeNull();
    expect(normalizarUrlScan('localhost')).toBeNull();
    expect(normalizarUrlScan('não é url')).toBeNull();
  });

  it('troca nomes técnicos genéricos por "Formulário N"', () => {
    expect(nomeAmigavelFormulario('name', 0, 'Formulário')).toBe('Formulário 1');
    expect(nomeAmigavelFormulario('', 2, 'Form')).toBe('Form 3');
    expect(nomeAmigavelFormulario('Contato', 0, 'Formulário')).toBe('Contato');
  });
});
