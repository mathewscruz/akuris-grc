export type ProjetoStatus = 'ativo' | 'pausado' | 'concluido' | 'arquivado';
export type ProjetoMembroPapel = 'owner' | 'admin' | 'membro' | 'viewer';
export type ProjetoTarefaPrioridade = 'baixa' | 'media' | 'alta' | 'critica';
export type ProjetoDependenciaTipo = 'FS' | 'SS' | 'FF' | 'SF';

export type ProjetoVinculoEntidade =
  | 'risco'
  | 'controle'
  | 'incidente'
  | 'auditoria'
  | 'auditoria_item'
  | 'gap_requirement'
  | 'gap_assessment'
  | 'contrato'
  | 'fornecedor'
  | 'due_diligence'
  | 'documento'
  | 'ativo'
  | 'denuncia'
  | 'plano_acao'
  | 'dados_pessoais'
  | 'conta_privilegiada'
  | 'continuidade';

export interface Projeto {
  id: string;
  empresa_id: string;
  nome: string;
  descricao: string | null;
  status: ProjetoStatus;
  owner_id: string;
  data_inicio: string | null;
  data_fim_prevista: string | null;
  cor: string | null;
  icone: string | null;
  configuracoes: Record<string, any> | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjetoColuna {
  id: string;
  projeto_id: string;
  nome: string;
  ordem: number;
  cor: string | null;
  wip_limit: number | null;
  is_concluido: boolean;
  created_at: string;
}

export interface ProjetoMembro {
  id: string;
  projeto_id: string;
  user_id: string;
  papel: ProjetoMembroPapel;
  added_by: string | null;
  created_at: string;
}

export interface ProjetoTarefa {
  id: string;
  projeto_id: string;
  coluna_id: string | null;
  parent_task_id: string | null;
  titulo: string;
  descricao: string | null;
  prioridade: ProjetoTarefaPrioridade;
  responsavel_id: string | null;
  criador_id: string | null;
  data_inicio: string | null;
  data_fim: string | null;
  prazo: string | null;
  estimativa_horas: number | null;
  tempo_gasto_horas: number | null;
  progresso_pct: number;
  tags: string[];
  ordem: number;
  bloqueada: boolean;
  concluida_em: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjetoTarefaChecklist {
  id: string;
  tarefa_id: string;
  texto: string;
  concluido: boolean;
  ordem: number;
  created_at: string;
}

export interface ProjetoTarefaComentario {
  id: string;
  tarefa_id: string;
  user_id: string;
  conteudo: string;
  mencionados: string[];
  created_at: string;
  updated_at: string;
}

export interface ProjetoTarefaAnexo {
  id: string;
  tarefa_id: string;
  nome: string;
  storage_path: string;
  tipo: string | null;
  tamanho_bytes: number | null;
  uploaded_by: string | null;
  created_at: string;
}

export interface ProjetoTarefaVinculo {
  id: string;
  tarefa_id: string;
  entidade_tipo: ProjetoVinculoEntidade;
  entidade_id: string;
  criado_por: string | null;
  created_at: string;
}

export const PRIORIDADE_LABEL: Record<ProjetoTarefaPrioridade, string> = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
  critica: 'Crítica',
};

export const STATUS_LABEL: Record<ProjetoStatus, string> = {
  ativo: 'Ativo',
  pausado: 'Pausado',
  concluido: 'Concluído',
  arquivado: 'Arquivado',
};

export const ENTIDADE_LABEL: Record<ProjetoVinculoEntidade, string> = {
  risco: 'Risco',
  controle: 'Controle',
  incidente: 'Incidente',
  auditoria: 'Auditoria',
  auditoria_item: 'Item de Auditoria',
  gap_requirement: 'Requisito (Gap Analysis)',
  gap_assessment: 'Avaliação (Gap Analysis)',
  contrato: 'Contrato',
  fornecedor: 'Fornecedor',
  due_diligence: 'Due Diligence',
  documento: 'Documento',
  ativo: 'Ativo',
  denuncia: 'Denúncia',
  plano_acao: 'Plano de Ação',
  dados_pessoais: 'Dados Pessoais (LGPD)',
  conta_privilegiada: 'Conta Privilegiada',
  continuidade: 'Continuidade',
};
