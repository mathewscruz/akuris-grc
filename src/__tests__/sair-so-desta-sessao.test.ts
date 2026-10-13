import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { decidirAcesso } from '@/lib/autorizacao';

describe('sessão e acesso', () => {
  it('o "Sair" comum encerra só a sessão deste aparelho', () => {
    const src = readFileSync('src/components/AuthProvider.tsx', 'utf8');
    expect(src).toContain("signOut({ scope: 'local' })");
  });

  it('super admin entra em Continuidade quando o plano a inclui', () => {
    expect(decidirAcesso({ papel: 'super_admin', modulo: 'continuidade', acao: 'access', permissao: undefined, modulosDoPlano: ['dashboard', 'continuidade'] })).toBe(true);
  });

  it('super admin é barrado só quando o plano não inclui Continuidade', () => {
    expect(decidirAcesso({ papel: 'super_admin', modulo: 'continuidade', acao: 'access', permissao: undefined, modulosDoPlano: ['dashboard'] })).toBe(false);
  });
});
