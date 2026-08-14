/**
 * Resolve a que registo concreto uma notificação se refere.
 *
 * As notificações guardam o identificador do registo em `metadata`
 * (ex.: `{ documento_id: "..." }`) ou no próprio `link_to`
 * (ex.: `/incidentes?detalhe=<id>`). Com esse par (tipo, id) conseguimos
 * abrir o registo específico — e dizer honestamente ao utilizador quando o
 * registo já não existe, em vez de o mandar para uma lista vazia.
 */
import type { EntityKey } from '@/lib/entity-search';

const METADATA_KEYS: Record<string, EntityKey> = {
  documento_id: 'documento',
  risco_id: 'risco',
  controle_id: 'controle',
  incidente_id: 'incidente',
  contrato_id: 'contrato',
  fornecedor_id: 'fornecedor',
  ativo_id: 'ativo',
  licenca_id: 'licenca',
  chave_id: 'chave',
  plano_acao_id: 'plano_acao',
  plano_id: 'plano_acao',
  denuncia_id: 'denuncia',
  auditoria_id: 'auditoria',
  auditoria_item_id: 'auditoria_item',
  projeto_id: 'projeto',
  tarefa_id: 'tarefa',
  assessment_id: 'due_diligence',
  due_diligence_id: 'due_diligence',
  requirement_id: 'gap_requirement',
  dados_pessoais_id: 'dados_pessoais',
  ropa_id: 'ropa',
  conta_privilegiada_id: 'conta_privilegiada',
  continuidade_id: 'continuidade',
};

/** Rotas conhecidas → tipo de entidade, para o fallback via `link_to`. */
const ROUTE_KEYS: Array<{ prefix: string; key: EntityKey }> = [
  { prefix: '/documentos', key: 'documento' },
  { prefix: '/contratos', key: 'contrato' },
  { prefix: '/controles', key: 'controle' },
  { prefix: '/governanca', key: 'controle' },
  { prefix: '/incidentes', key: 'incidente' },
  { prefix: '/riscos', key: 'risco' },
  { prefix: '/ativos/licencas', key: 'licenca' },
  { prefix: '/ativos/chaves', key: 'chave' },
  { prefix: '/ativos', key: 'ativo' },
  { prefix: '/planos-acao', key: 'plano_acao' },
  { prefix: '/denuncia', key: 'denuncia' },
  { prefix: '/due-diligence', key: 'due_diligence' },
];

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

export interface NotificationTarget {
  entityKey: EntityKey;
  id: string;
}

interface NotificationLike {
  metadata?: Record<string, unknown> | null;
  link_to?: string | null;
}

export function resolveNotificationTarget(
  notification: NotificationLike | null | undefined,
): NotificationTarget | null {
  if (!notification) return null;

  const metadata = notification.metadata;
  if (metadata && typeof metadata === 'object') {
    for (const [field, entityKey] of Object.entries(METADATA_KEYS)) {
      const value = (metadata as Record<string, unknown>)[field];
      if (typeof value === 'string' && UUID_RE.test(value)) {
        return { entityKey, id: value };
      }
    }
  }

  const link = notification.link_to;
  if (link) {
    const match = link.match(UUID_RE);
    if (match) {
      const route = ROUTE_KEYS.find(r => link.startsWith(r.prefix));
      if (route) return { entityKey: route.key, id: match[0] };
    }
  }

  return null;
}
