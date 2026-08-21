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

/**
 * O nome do módulo na aplicação e a chave do módulo no plano divergem.
 *
 * A navegação usa hífens (`planos-acao`, `gap-analysis`) e o catálogo de
 * planos usa sublinhados (`planos_acao`, `gap_analysis`); e há um par que nem
 * se parece — o módulo `dados` é o que o plano vende como `privacidade`.
 * Comparar os dois sem normalizar daria "não está no plano" para tudo.
 */
export function chaveDePlano(modulo: string): string {
  if (modulo === 'dados') return 'privacidade';
  return modulo.replace(/-/g, '_');
}

/**
 * Módulos que o plano nunca esconde.
 *
 * Sem configurações não há como configurar o que se comprou — incluindo o
 * próprio canal. Bloqueá-la deixaria o cliente com um produto que não
 * consegue ligar.
 */
export const SEMPRE_PERMITIDOS = new Set(['configuracoes']);

export interface EntradaDeDecisao {
  papel: PapelUtilizador | undefined;
  modulo: string;
  acao: AcaoModulo;
  /** `undefined` quando não há registo nenhum para este módulo. */
  permissao: PermissaoDeModulo | undefined;
  /** `false` desliga a retrocompatibilidade por papel. */
  usarPapelComoReserva?: boolean;
  /**
   * Os módulos que o plano da EMPRESA contém, ou `null` quando o plano não
   * restringe (empresas anteriores a 21/08/2026, ou sem plano).
   *
   * É um teto, não uma concessão: estar no plano não dá acesso a quem a
   * permissão nega — só impede que se veja o que a empresa não comprou. Sem
   * isto, vender só o canal de denúncia obrigava a desligar dezoito módulos
   * pessoa a pessoa, e a repetir a cada contratação.
   */
  modulosDoPlano?: string[] | null;
}

export function decidirAcesso({
  papel,
  modulo,
  acao,
  permissao,
  usarPapelComoReserva = true,
  modulosDoPlano = null,
}: EntradaDeDecisao): boolean {
  /*
    O plano vem primeiro, e vale também para o super_admin da empresa.

    Se ficasse depois do atalho do papel, o administrador do próprio cliente
    veria a suíte inteira — que é exactamente o que a venda avulsa não pode
    permitir. O super_admin continua a mandar em tudo o resto: manda dentro do
    que a empresa comprou.
  */
  if (
    modulosDoPlano !== null &&
    !SEMPRE_PERMITIDOS.has(modulo) &&
    !modulosDoPlano.includes(chaveDePlano(modulo))
  ) {
    return false;
  }

  // Super admin entra sempre — é como o resto do produto já se comporta.
  if (papel === 'super_admin') return true;

  // Havendo registo para o módulo, é ele que decide, nos dois sentidos.
  // Era aqui que o `||` deixava o papel reconceder o que fora revogado.
  if (permissao) return permissao[CAMPO[acao]] === true;

  // Sem registo nenhum, o papel decide — a retrocompatibilidade pretendida.
  return usarPapelComoReserva ? papelPermite(papel, modulo, acao) : false;
}
