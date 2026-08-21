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
import { chaveDePlano, decidirAcesso, papelPermite } from '@/lib/autorizacao';

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

  /*
    O teto do plano — a parte que faz o canal de denúncia vender-se sozinho.

    Antes disto, `planos.modulos_habilitados` era catálogo de preço que
    ninguém lia, e o único recorte era a permissão POR UTILIZADOR: vender só o
    canal obrigava a desligar dezoito módulos pessoa a pessoa, e a repetir a
    cada contratação. Pior, `super_admin` passava por cima de tudo — o
    administrador do próprio cliente veria a suíte inteira.
  */
  describe('o plano da empresa é teto', () => {
    const soCanal = ['denuncia'];

    it('bloqueia o que a empresa não comprou, mesmo a super_admin', () => {
      expect(
        decidirAcesso({
          papel: 'super_admin',
          modulo: 'riscos',
          acao: 'access',
          permissao: { can_access: true },
          modulosDoPlano: soCanal,
        }),
      ).toBe(false);
    });

    it('deixa passar o que está no plano', () => {
      expect(
        decidirAcesso({
          papel: 'super_admin',
          modulo: 'denuncia',
          acao: 'access',
          permissao: undefined,
          modulosDoPlano: soCanal,
        }),
      ).toBe(true);
    });

    it('é teto e não concessão: a permissão negada continua a valer', () => {
      expect(
        decidirAcesso({
          papel: 'user',
          modulo: 'denuncia',
          acao: 'access',
          permissao: { can_access: false },
          modulosDoPlano: soCanal,
        }),
      ).toBe(false);
    });

    it('nunca esconde configurações — sem elas não há como ligar o que se comprou', () => {
      expect(
        decidirAcesso({
          papel: 'admin',
          modulo: 'configuracoes',
          acao: 'access',
          permissao: undefined,
          modulosDoPlano: soCanal,
        }),
      ).toBe(true);
    });

    it('sem restrição de plano, nada muda', () => {
      expect(
        decidirAcesso({
          papel: 'super_admin',
          modulo: 'riscos',
          acao: 'access',
          permissao: undefined,
          modulosDoPlano: null,
        }),
      ).toBe(true);
    });

    it('traduz o nome do módulo para a chave do plano', () => {
      // A navegação usa hífen, o plano usa sublinhado; e `dados` é `privacidade`.
      expect(chaveDePlano('planos-acao')).toBe('planos_acao');
      expect(chaveDePlano('gap-analysis')).toBe('gap_analysis');
      expect(chaveDePlano('contas-privilegiadas')).toBe('contas_privilegiadas');
      expect(chaveDePlano('dados')).toBe('privacidade');
      expect(chaveDePlano('denuncia')).toBe('denuncia');

      expect(
        decidirAcesso({
          papel: 'admin',
          modulo: 'planos-acao',
          acao: 'access',
          permissao: { can_access: true },
          modulosDoPlano: ['planos_acao'],
        }),
      ).toBe(true);
    });
  });
});
