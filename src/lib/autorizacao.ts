/**
 * Decisão de acesso a um módulo, num sítio só e testável.
 *
 * O `ProtectedRoute` decidia assim:
 *
 *   const allowed = hasPermission() || hasRoleAccess();
 *
 * e `hasPermission()` devolve `permission?.can_access || false`. Junto, isto
 * quer dizer que uma permissão **explicitamente revogada** (`can_access =
 * false`) cai no `false`, o `||` passa ao sistema antigo de papéis, e o papel
 * reconcede o acesso. Ou seja: tirar a permissão a um utilizador `user` não
 * tinha efeito nenhum no ecrã — o administrador desligava o interruptor e nada
 * acontecia.
 *
 * A intenção do `||` era retrocompatibilidade, e essa continua a valer: quem
 * nunca recebeu permissões nenhumas continua a entrar pelo papel. O que muda é
 * que, **havendo registo para o módulo, é ele que decide**. Sem registo, o
 * papel; com registo, a permissão.
 *
 * Isto é o portão da INTERFACE. Quem manda de verdade é a RLS do banco — ver
 * `scripts/auditoria-rls.sql`. Aqui trata-se de o ecrã não contradizer o que o
 * administrador configurou.
 */
export type AcaoModulo = 'access' | 'create' | 'read' | 'update' | 'delete';

export type PapelUtilizador = 'super_admin' | 'admin' | 'user' | 'readonly';

/** O registo de `user_module_permissions` para um módulo, se existir. */
export interface PermissaoDeModulo {
  can_access?: boolean | null;
  can_create?: boolean | null;
  can_read?: boolean | null;
  can_update?: boolean | null;
  can_delete?: boolean | null;
}

const CAMPO: Record<AcaoModulo, keyof PermissaoDeModulo> = {
  access: 'can_access',
  create: 'can_create',
  read: 'can_read',
  update: 'can_update',
  delete: 'can_delete',
};

/** O que o papel, por si só, permite. É o comportamento antigo, preservado. */
export function papelPermite(
  papel: PapelUtilizador | undefined,
  modulo: string,
  acao: AcaoModulo,
): boolean {
  switch (papel) {
    case 'super_admin':
      return true;
    case 'admin':
      return modulo !== 'configuracoes' || acao !== 'delete';
    case 'user':
      return (
        modulo !== 'configuracoes' &&
        !(modulo === 'auditorias' && ['create', 'update', 'delete'].includes(acao))
      );
    case 'readonly':
      return acao === 'read' && modulo !== 'configuracoes';
    default:
      return false;
  }
}

export interface EntradaDeDecisao {
  papel: PapelUtilizador | undefined;
  modulo: string;
  acao: AcaoModulo;
  /** `undefined` quando não há registo nenhum para este módulo. */
  permissao: PermissaoDeModulo | undefined;
  /** `false` desliga a retrocompatibilidade por papel. */
  usarPapelComoReserva?: boolean;
}

export function decidirAcesso({
  papel,
  modulo,
  acao,
  permissao,
  usarPapelComoReserva = true,
}: EntradaDeDecisao): boolean {
  // Super admin entra sempre — é como o resto do produto já se comporta.
  if (papel === 'super_admin') return true;

  // Havendo registo para o módulo, é ele que decide, nos dois sentidos.
  // Era aqui que o `||` deixava o papel reconceder o que fora revogado.
  if (permissao) return permissao[CAMPO[acao]] === true;

  // Sem registo nenhum, o papel decide — a retrocompatibilidade pretendida.
  return usarPapelComoReserva ? papelPermite(papel, modulo, acao) : false;
}
