/**
 * A permissão revogada tem de valer.
 *
 * O `ProtectedRoute` decidia com `hasPermission() || hasRoleAccess()`. Como
 * `hasPermission()` devolve `permission?.can_access || false`, uma permissão
 * posta a `false` de propósito caía no ramo do papel — e o papel reconcedia.
 * O administrador desligava o interruptor no ecrã de permissões e o utilizador
 * continuava a entrar.
 *
 * A regra agora: havendo registo para o módulo, é o registo que decide, nos
 * dois sentidos. Sem registo, o papel — que era a retrocompatibilidade que o
 * `||` pretendia dar, e essa continua inteira.
 */
import { describe, expect, it } from 'vitest';
import { decidirAcesso, papelPermite } from '@/lib/autorizacao';

describe('decisão de acesso a módulo', () => {
  it('permissão revogada bloqueia, mesmo quando o papel permitiria', () => {
    // `user` tem acesso a "riscos" pelo papel...
    expect(papelPermite('user', 'riscos', 'access')).toBe(true);

    // ...mas o registo explícito manda.
    expect(
      decidirAcesso({
        papel: 'user',
        modulo: 'riscos',
        acao: 'access',
        permissao: { can_access: false },
      }),
    ).toBe(false);
  });

  it('permissão concedida abre, mesmo quando o papel não permitiria', () => {
    expect(papelPermite('readonly', 'riscos', 'update')).toBe(false);
    expect(
      decidirAcesso({
        papel: 'readonly',
        modulo: 'riscos',
        acao: 'update',
        permissao: { can_update: true },
      }),
    ).toBe(true);
  });

  it('sem registo nenhum, decide o papel — a retrocompatibilidade fica', () => {
    expect(
      decidirAcesso({ papel: 'user', modulo: 'riscos', acao: 'access', permissao: undefined }),
    ).toBe(true);
    expect(
      decidirAcesso({ papel: 'user', modulo: 'configuracoes', acao: 'access', permissao: undefined }),
    ).toBe(false);
    expect(
      decidirAcesso({ papel: 'readonly', modulo: 'riscos', acao: 'delete', permissao: undefined }),
    ).toBe(false);
  });

  it('super admin entra sempre, com registo ou sem ele', () => {
    expect(
      decidirAcesso({
        papel: 'super_admin',
        modulo: 'configuracoes',
        acao: 'delete',
        permissao: { can_delete: false },
      }),
    ).toBe(true);
  });

  it('sem papel e sem registo, nega', () => {
    expect(
      decidirAcesso({ papel: undefined, modulo: 'riscos', acao: 'access', permissao: undefined }),
    ).toBe(false);
  });

  it('o campo nulo conta como negado, não como ausente', () => {
    // `can_create: null` vem de base em linhas antigas; não pode virar "sim".
    expect(
      decidirAcesso({
        papel: 'user',
        modulo: 'riscos',
        acao: 'create',
        permissao: { can_access: true, can_create: null },
      }),
    ).toBe(false);
  });

  it('desligar a reserva por papel nega quem não tem registo', () => {
    expect(
      decidirAcesso({
        papel: 'user',
        modulo: 'riscos',
        acao: 'access',
        permissao: undefined,
        usarPapelComoReserva: false,
      }),
    ).toBe(false);
  });

  it('o comportamento antigo do papel ficou preservado', () => {
    expect(papelPermite('admin', 'configuracoes', 'delete')).toBe(false);
    expect(papelPermite('admin', 'configuracoes', 'update')).toBe(true);
    expect(papelPermite('user', 'auditorias', 'read')).toBe(true);
    expect(papelPermite('user', 'auditorias', 'create')).toBe(false);
    expect(papelPermite('readonly', 'riscos', 'read')).toBe(true);
    expect(papelPermite('super_admin', 'configuracoes', 'delete')).toBe(true);
  });
});
