/**
 * Registo único de entidades pesquisáveis/ligáveis da plataforma.
 *
 * Serve três consumidores:
 *  - Busca global (Cmd+K) — pesquisa registos reais agrupados por tipo;
 *  - Seletor genérico de registo (`EntidadeSelect`) — vínculos GRC e origem
 *    de planos de ação;
 *  - Navegação profunda — cada resultado leva ao registo (`?focus=<id>`).
 *
 * Todas as consultas passam pelo cliente Supabase autenticado (RLS ativa) e,
 * quando a tabela tem `empresa_id`, o filtro de empresa é sempre aplicado.
 */
import { supabase } from '@/integrations/supabase/client';

export type EntityKey =
  | 'risco'
  | 'controle'
  | 'gap_requirement'
  | 'ativo'
  | 'licenca'
  | 'chave'
  | 'documento'
  | 'contrato'
  | 'fornecedor'
  | 'incidente'
  | 'auditoria'
  | 'auditoria_item'
  | 'projeto'
  | 'tarefa'
  | 'plano_acao'
  | 'denuncia'
  | 'dados_pessoais'
  | 'ropa'
  | 'conta_privilegiada'
  | 'continuidade'
  | 'due_diligence';

export interface EntityRow {
  id: string;
  titulo: string;
  /** Identificador amigável (código, protocolo, número) ou derivado do UUID. */
  codigo: string;
  /** Subtítulo útil: estado, severidade ou similar (valor cru, snake_case). */
  subtitulo: string | null;
  /** Linha original, para casos que precisem de campos extra (ex.: projeto_id). */
  raw: Record<string, any>;
}

interface EntityDef {
  key: EntityKey;
  table: string;
  /** Chave i18n do rótulo do tipo. */
  labelKey: string;
  /** Colunas lidas do Postgres. */
  select: string;
  /** Campo(s) usados como título, na ordem de preferência. */
  tituloFields: string[];
  /** Campo com identificador amigável persistido, se existir. */
  codigoField?: string;
  /** Prefixo usado quando não há identificador amigável persistido. */
  prefixo: string;
  /** Campo usado como subtítulo (estado/severidade). */
  subtituloField?: string;
  /** A tabela tem coluna `empresa_id`? (senão, confia apenas na RLS). */
  empresaScoped: boolean;
  /** Coluna de ordenação decrescente para o recorte de candidatos. */
  orderBy?: string;
  /** Rota de destino do registo. */
  route: (row: Record<string, any>) => string;
}

const focus = (base: string, id: string) =>
  `${base}${base.includes('?') ? '&' : '?'}focus=${id}`;

export const ENTITY_DEFS: EntityDef[] = [
  {
    key: 'risco', table: 'riscos', labelKey: 'entidades.risco',
    select: 'id, nome, status, nivel_risco_inicial, biblioteca_codigo, created_at',
    tituloFields: ['nome'], prefixo: 'R', subtituloField: 'nivel_risco_inicial',
    empresaScoped: true, orderBy: 'created_at',
    route: (r) => focus('/riscos', r.id),
  },
  {
    key: 'controle', table: 'controles', labelKey: 'entidades.controle',
    select: 'id, nome, codigo, status, criticidade, created_at',
    tituloFields: ['nome'], codigoField: 'codigo', prefixo: 'C', subtituloField: 'status',
    empresaScoped: true, orderBy: 'created_at',
    route: (r) => focus('/governanca?tab=controles', r.id),
  },
  {
    key: 'gap_requirement', table: 'gap_analysis_requirements', labelKey: 'entidades.gap_requirement',
    select: 'id, codigo, titulo, categoria, framework_id',
    tituloFields: ['titulo'], codigoField: 'codigo', prefixo: 'REQ', subtituloField: 'categoria',
    empresaScoped: false,
    route: (r) => focus(`/gap-analysis/framework/${r.framework_id}`, r.id),
  },
  {
    key: 'ativo', table: 'ativos', labelKey: 'entidades.ativo',
    select: 'id, nome, tipo, status, criticidade, created_at',
    tituloFields: ['nome'], prefixo: 'AT', subtituloField: 'criticidade',
    empresaScoped: true, orderBy: 'created_at',
    route: (r) => focus('/ativos', r.id),
  },
  {
    key: 'licenca', table: 'ativos_licencas', labelKey: 'entidades.licenca',
    select: 'id, nome, numero_licenca, status, fornecedor, created_at',
    tituloFields: ['nome'], codigoField: 'numero_licenca', prefixo: 'LIC', subtituloField: 'status',
    empresaScoped: true, orderBy: 'created_at',
    route: (r) => focus('/ativos/licencas', r.id),
  },
  {
    key: 'chave', table: 'ativos_chaves_criptograficas', labelKey: 'entidades.chave',
    select: 'id, nome, tipo_chave, status, created_at',
    tituloFields: ['nome'], prefixo: 'KEY', subtituloField: 'status',
    empresaScoped: true, orderBy: 'created_at',
    route: (r) => focus('/ativos/chaves', r.id),
  },
  {
    key: 'documento', table: 'documentos', labelKey: 'entidades.documento',
    select: 'id, nome, tipo, status, created_at',
    tituloFields: ['nome'], prefixo: 'DOC', subtituloField: 'status',
    empresaScoped: true, orderBy: 'created_at',
    route: (r) => focus('/documentos', r.id),
  },
  {
    key: 'contrato', table: 'contratos', labelKey: 'entidades.contrato',
    select: 'id, nome, numero_contrato, status, created_at',
    tituloFields: ['nome'], codigoField: 'numero_contrato', prefixo: 'CT', subtituloField: 'status',
    empresaScoped: true, orderBy: 'created_at',
    route: (r) => focus('/contratos', r.id),
  },
  {
    key: 'fornecedor', table: 'fornecedores', labelKey: 'entidades.fornecedor',
    select: 'id, nome, cnpj, status, tipo, created_at',
    tituloFields: ['nome'], prefixo: 'FO', subtituloField: 'status',
    empresaScoped: true, orderBy: 'created_at',
    route: (r) => focus('/contratos?tab=fornecedores', r.id),
  },
  {
    key: 'incidente', table: 'incidentes', labelKey: 'entidades.incidente',
    select: 'id, titulo, status, criticidade, created_at',
    tituloFields: ['titulo'], prefixo: 'IN', subtituloField: 'criticidade',
    empresaScoped: true, orderBy: 'created_at',
    route: (r) => focus('/incidentes', r.id),
  },
  {
    key: 'auditoria', table: 'auditorias', labelKey: 'entidades.auditoria',
    select: 'id, nome, status, tipo, created_at',
    tituloFields: ['nome'], prefixo: 'AU', subtituloField: 'status',
    empresaScoped: true, orderBy: 'created_at',
    route: (r) => focus('/governanca/auditorias', r.id),
  },
  {
    key: 'auditoria_item', table: 'auditoria_itens', labelKey: 'entidades.auditoria_item',
    select: 'id, codigo, titulo, status, auditoria_id, created_at',
    tituloFields: ['titulo'], codigoField: 'codigo', prefixo: 'AI', subtituloField: 'status',
    empresaScoped: false, orderBy: 'created_at',
    route: (r) => focus('/governanca/auditorias', r.id),
  },
  {
    key: 'projeto', table: 'projetos', labelKey: 'entidades.projeto',
    select: 'id, nome, status, created_at',
    tituloFields: ['nome'], prefixo: 'PJ', subtituloField: 'status',
    empresaScoped: true, orderBy: 'created_at',
    route: (r) => `/projetos/${r.id}`,
  },
  {
    key: 'tarefa', table: 'projeto_tarefas', labelKey: 'entidades.tarefa',
    select: 'id, titulo, prioridade, projeto_id, created_at',
    tituloFields: ['titulo'], prefixo: 'TK', subtituloField: 'prioridade',
    empresaScoped: false, orderBy: 'created_at',
    route: (r) => focus(`/projetos/${r.projeto_id}`, r.id),
  },
  {
    key: 'plano_acao', table: 'planos_acao', labelKey: 'entidades.plano_acao',
    select: 'id, titulo, status, prioridade, created_at',
    tituloFields: ['titulo'], prefixo: 'PA', subtituloField: 'status',
    empresaScoped: true, orderBy: 'created_at',
    route: (r) => focus('/planos-acao', r.id),
  },
  {
    key: 'denuncia', table: 'denuncias', labelKey: 'entidades.denuncia',
    select: 'id, titulo, protocolo, status, gravidade, created_at',
    tituloFields: ['titulo'], codigoField: 'protocolo', prefixo: 'DN', subtituloField: 'status',
    empresaScoped: true, orderBy: 'created_at',
    route: (r) => focus('/denuncia', r.id),
  },
  {
    key: 'dados_pessoais', table: 'dados_pessoais', labelKey: 'entidades.dados_pessoais',
    select: 'id, nome, sensibilidade, categoria_dados, created_at',
    tituloFields: ['nome'], prefixo: 'DP', subtituloField: 'sensibilidade',
    empresaScoped: true, orderBy: 'created_at',
    route: (r) => focus('/privacidade', r.id),
  },
  {
    key: 'ropa', table: 'ropa_registros', labelKey: 'entidades.ropa',
    select: 'id, nome_tratamento, status, base_legal, created_at',
    tituloFields: ['nome_tratamento'], prefixo: 'RP', subtituloField: 'status',
    empresaScoped: true, orderBy: 'created_at',
    route: (r) => focus('/privacidade', r.id),
  },
  {
    key: 'conta_privilegiada', table: 'contas_privilegiadas', labelKey: 'entidades.conta_privilegiada',
    select: 'id, usuario_beneficiario, email_beneficiario, status, nivel_privilegio, created_at',
    tituloFields: ['usuario_beneficiario', 'email_beneficiario'], prefixo: 'CP', subtituloField: 'status',
    empresaScoped: true, orderBy: 'created_at',
    route: (r) => focus('/contas-privilegiadas', r.id),
  },
  {
    key: 'continuidade', table: 'continuidade_planos', labelKey: 'entidades.continuidade',
    select: 'id, nome, status, tipo, created_at',
    tituloFields: ['nome'], prefixo: 'BC', subtituloField: 'status',
    empresaScoped: true, orderBy: 'created_at',
    route: (r) => focus('/continuidade', r.id),
  },
  {
    key: 'due_diligence', table: 'due_diligence_assessments', labelKey: 'entidades.due_diligence',
    select: 'id, fornecedor_nome, fornecedor_email, status, created_at',
    tituloFields: ['fornecedor_nome', 'fornecedor_email'], prefixo: 'DD', subtituloField: 'status',
    empresaScoped: true, orderBy: 'created_at',
    route: (r) => focus('/due-diligence', r.id),
  },
];

export const ENTITY_BY_KEY: Record<EntityKey, EntityDef> = ENTITY_DEFS.reduce((acc, def) => {
  acc[def.key] = def;
  return acc;
}, {} as Record<EntityKey, EntityDef>);

/** Identificador curto derivado do UUID: "R-D77". */
export function shortEntityId(prefixo: string, uuid: string): string {
  return `${prefixo}-${uuid.replace(/-/g, '').slice(-3).toUpperCase()}`;
}

/** Remove acentos e baixa a caixa — base da comparação insensível. */
export function normalizeText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/** Todas as palavras da consulta têm de aparecer, em qualquer ordem (AND). */
export function matchesTokens(haystack: string, tokens: string[]): boolean {
  const alvo = normalizeText(haystack);
  return tokens.every((token) => alvo.includes(token));
}

export function queryTokens(query: string): string[] {
  return normalizeText(query).split(/\s+/).filter(Boolean);
}

function toRow(def: EntityDef, raw: Record<string, any>): EntityRow {
  const titulo = def.tituloFields.map((f) => raw[f]).find((v) => v) || '—';
  const codigoPersistido = def.codigoField ? raw[def.codigoField] : null;
  return {
    id: raw.id,
    titulo: String(titulo),
    codigo: codigoPersistido ? String(codigoPersistido) : shortEntityId(def.prefixo, raw.id),
    subtitulo: def.subtituloField ? (raw[def.subtituloField] ?? null) : null,
    raw,
  };
}

/**
 * Recorte de candidatos de uma entidade. A filtragem por texto acontece no
 * cliente para permitir comparação sem acentos e várias palavras em AND —
 * o Postgres sem `unaccent` no PostgREST não faz isso de forma fiável.
 */
export async function fetchEntityRows(
  key: EntityKey,
  empresaId: string | null | undefined,
  limit = 400,
): Promise<EntityRow[]> {
  const def = ENTITY_BY_KEY[key];
  if (!def) return [];
  if (def.empresaScoped && !empresaId) return [];

  let query = supabase.from(def.table as any).select(def.select).limit(limit);
  if (def.empresaScoped && empresaId) query = query.eq('empresa_id', empresaId);
  if (def.orderBy) query = query.order(def.orderBy, { ascending: false });

  const { data, error } = await query;
  if (error || !data) return [];
  return (data as any[]).map((raw) => toRow(def, raw));
}

export function routeForEntity(key: EntityKey, row: EntityRow): string {
  return ENTITY_BY_KEY[key].route(row.raw);
}

export function entityLabelKey(key: EntityKey): string {
  return ENTITY_BY_KEY[key].labelKey;
}
