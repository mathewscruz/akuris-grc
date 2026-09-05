import type { EntityKey } from './entity-search';

/** Shared by the origin picker and the action that opens that exact record. */
export const ACTION_PLAN_ENTITIES: Record<string, EntityKey> = {
  riscos: 'risco', controles: 'controle', frameworks: 'gap_requirement',
  incidentes: 'incidente', auditorias: 'auditoria', contratos: 'contrato',
  documentos: 'documento', dados: 'dados_pessoais', 'due-diligence': 'due_diligence',
  denuncia: 'denuncia', ativos: 'ativo', 'contas-privilegiadas': 'conta_privilegiada',
};

export function actionPlanOrigin(plan: { id?: string; modulo_origem?: string; registro_origem_id?: string | null; _isExternal?: boolean }) {
  const module = plan.modulo_origem ?? '';
  const key = plan._isExternal && module === 'auditorias' ? 'auditoria_item' : ACTION_PLAN_ENTITIES[module];
  const id = plan._isExternal ? plan.id : plan.registro_origem_id;
  return key && id ? { key, id } : null;
}
