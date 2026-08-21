/**
 * Esquema canónico do ROPA (Registo de Operações de Tratamento de Dados Pessoais).
 * Espelha a estrutura das planilhas de ROPA usadas pelos clientes (Categoria / Campo /
 * Descrição / Valor) para permitir importar, editar, visualizar e exportar tudo dentro
 * do Akuris, sem depender de Excel.
 */

export type RopaFieldType = 'text' | 'textarea' | 'user' | 'boolean' | 'select' | 'escala' | 'derivado';

export interface RopaFieldDef {
  key: string;
  section: RopaSectionKey;
  type: RopaFieldType;
  label: { pt: string; en: string };
  hint: { pt: string; en: string };
  /** Rótulos aceites na importação de planilhas (normalizados). */
  aliases: string[];
  options?: string[];
  required?: boolean;
}

/**
 * `escala` — nível da matriz de risco da empresa (1..N), com os rótulos que
 * ela configurou. `derivado` — campo calculado, mostrado mas nunca editável.
 */

export type RopaSectionKey =
  | 'identificacao'
  | 'finalidade'
  | 'dados'
  | 'tratamento'
  | 'baseLegal'
  | 'compartilhamento'
  | 'seguranca'
  | 'cicloVida'
  | 'risco'
  | 'evidencias';

export const ROPA_SECTIONS: { key: RopaSectionKey; label: { pt: string; en: string } }[] = [
  { key: 'identificacao', label: { pt: 'Identificação', en: 'Identification' } },
  { key: 'finalidade', label: { pt: 'Finalidade', en: 'Purpose' } },
  { key: 'dados', label: { pt: 'Dados', en: 'Data' } },
  { key: 'tratamento', label: { pt: 'Tratamento', en: 'Processing' } },
  { key: 'baseLegal', label: { pt: 'Base legal', en: 'Legal basis' } },
  { key: 'compartilhamento', label: { pt: 'Partilha', en: 'Sharing' } },
  { key: 'seguranca', label: { pt: 'Segurança', en: 'Security' } },
  { key: 'cicloVida', label: { pt: 'Ciclo de vida', en: 'Lifecycle' } },
  { key: 'risco', label: { pt: 'Risco', en: 'Risk' } },
  { key: 'evidencias', label: { pt: 'Evidências e documentação', en: 'Evidence and documentation' } },
];

/**
 * Vocabulário canónico de severidade — o mesmo de riscos, incidentes, ativos
 * e controlos desde a migration `20260821110000_escala_de_severidade_unica`.
 */
export const RISCO_NIVEIS = ['baixo', 'medio', 'alto', 'critico'] as const;

export const ROPA_FIELDS: RopaFieldDef[] = [
  {
    key: 'nome_tratamento',
    section: 'identificacao',
    type: 'text',
    required: true,
    label: { pt: 'Nome do processo', en: 'Process name' },
    hint: { pt: 'Nome do processo de tratamento.', en: 'Name of the processing activity.' },
    aliases: ['nome do processo', 'nome do tratamento', 'processo', 'process name'],
  },
  {
    key: 'codigo',
    section: 'identificacao',
    type: 'text',
    label: { pt: 'Código do processo', en: 'Process code' },
    hint: { pt: 'Identificador interno do processo (ex.: Processo 1).', en: 'Internal process identifier (e.g. Process 1).' },
    aliases: ['codigo', 'codigo do processo', 'id do processo', 'process code'],
  },
  {
    key: 'area_responsavel',
    section: 'identificacao',
    type: 'text',
    label: { pt: 'Área responsável', en: 'Responsible area' },
    hint: { pt: 'Área ou departamento responsável pelo processo.', en: 'Area or department responsible for the process.' },
    aliases: ['area responsavel', 'area', 'departamento', 'responsible area'],
  },
  {
    key: 'responsavel_tratamento',
    section: 'identificacao',
    type: 'user',
    label: { pt: 'Responsável pelo processo', en: 'Process owner' },
    hint: { pt: 'Pessoa responsável pela operação do processo.', en: 'Person accountable for running the process.' },
    aliases: ['responsavel pelo processo', 'responsavel pelo tratamento', 'responsavel', 'process owner'],
  },
  {
    key: 'encarregado_dados',
    section: 'identificacao',
    type: 'user',
    label: { pt: 'Encarregado (DPO)', en: 'Data protection officer (DPO)' },
    hint: { pt: 'Encarregado de proteção de dados.', en: 'Data protection officer.' },
    aliases: ['encarregado', 'encarregado (dpo)', 'dpo', 'data protection officer'],
  },
  {
    key: 'finalidade',
    section: 'finalidade',
    type: 'textarea',
    required: true,
    label: { pt: 'Finalidade do tratamento', en: 'Purpose of processing' },
    hint: { pt: 'Motivo pelo qual os dados pessoais são tratados.', en: 'Reason why personal data is processed.' },
    aliases: ['finalidade do tratamento', 'finalidade', 'purpose'],
  },
  {
    key: 'dados_tratados',
    section: 'dados',
    type: 'textarea',
    label: { pt: 'Dados pessoais tratados', en: 'Personal data processed' },
    hint: { pt: 'Descrição dos dados pessoais utilizados.', en: 'Description of the personal data used.' },
    aliases: ['dados pessoais tratados', 'dados tratados', 'personal data processed'],
  },
  {
    key: 'categoria_dados',
    section: 'dados',
    type: 'text',
    label: { pt: 'Categoria dos dados', en: 'Data categories' },
    hint: { pt: 'Classificação dos dados (comuns, sensíveis, financeiros...).', en: 'Data classification (common, sensitive, financial...).' },
    aliases: ['categoria dos dados', 'categoria de dados', 'data category', 'data categories'],
  },
  {
    key: 'categoria_titulares',
    section: 'dados',
    type: 'text',
    required: true,
    label: { pt: 'Categoria do titular', en: 'Data subject category' },
    hint: { pt: 'Categoria dos titulares dos dados.', en: 'Category of the data subjects.' },
    aliases: ['categoria do titular', 'categoria dos titulares', 'titulares', 'data subject category'],
  },
  {
    key: 'fonte_dados',
    section: 'dados',
    type: 'textarea',
    label: { pt: 'Fonte dos dados', en: 'Data source' },
    hint: { pt: 'Origem dos dados pessoais (sistemas, formulários, terceiros).', en: 'Origin of the personal data (systems, forms, third parties).' },
    aliases: ['fonte dos dados', 'fonte de dados', 'origem dos dados', 'data source'],
  },
  {
    key: 'descricao_atividade',
    section: 'tratamento',
    type: 'textarea',
    label: { pt: 'Descrição da atividade', en: 'Activity description' },
    hint: { pt: 'Descrição resumida da atividade de tratamento.', en: 'Summary of the processing activity.' },
    aliases: ['descricao da atividade', 'descricao do tratamento', 'activity description'],
  },
  {
    key: 'operacoes_realizadas',
    section: 'tratamento',
    type: 'textarea',
    label: { pt: 'Operações realizadas', en: 'Operations performed' },
    hint: { pt: 'Coleta, consulta, uso, partilha, eliminação...', en: 'Collection, access, use, sharing, deletion...' },
    aliases: ['operacoes realizadas', 'operacoes', 'operations performed'],
  },
  {
    key: 'decisao_automatizada_detalhes',
    section: 'tratamento',
    type: 'textarea',
    label: { pt: 'Decisão automatizada', en: 'Automated decision-making' },
    hint: { pt: 'O tratamento envolve decisão automatizada? Descreva.', en: 'Does the processing involve automated decisions? Describe.' },
    aliases: ['decisao automatizada', 'decisoes automatizadas', 'automated decision'],
  },
  {
    key: 'base_legal',
    section: 'baseLegal',
    type: 'text',
    required: true,
    label: { pt: 'Base legal', en: 'Legal basis' },
    hint: { pt: 'Base legal que legitima o tratamento.', en: 'Legal basis legitimising the processing.' },
    aliases: ['base legal', 'hipotese legal', 'legal basis'],
  },
  {
    key: 'justificativa_base_legal',
    section: 'baseLegal',
    type: 'textarea',
    label: { pt: 'Justificação da base legal', en: 'Legal basis justification' },
    hint: { pt: 'Justificação para o uso da base legal escolhida.', en: 'Justification for the chosen legal basis.' },
    aliases: ['justificativa da base legal', 'justificacao da base legal', 'legal basis justification'],
  },
  {
    key: 'compartilhamento_interno',
    section: 'compartilhamento',
    type: 'textarea',
    label: { pt: 'Partilha interna', en: 'Internal sharing' },
    hint: { pt: 'Áreas internas que recebem acesso aos dados.', en: 'Internal areas granted access to the data.' },
    aliases: ['compartilhamento interno', 'partilha interna', 'internal sharing'],
  },
  {
    key: 'compartilhamento_externo',
    section: 'compartilhamento',
    type: 'textarea',
    label: { pt: 'Partilha externa', en: 'External sharing' },
    hint: { pt: 'Terceiros, operadores e fornecedores que recebem os dados.', en: 'Third parties, processors and vendors receiving the data.' },
    aliases: ['compartilhamento externo', 'partilha externa', 'terceiros', 'external sharing'],
  },
  {
    key: 'transferencia_detalhes',
    section: 'compartilhamento',
    type: 'textarea',
    label: { pt: 'Transferência internacional', en: 'International transfer' },
    hint: { pt: 'Há transferência internacional? Indique países e salvaguardas.', en: 'Is there an international transfer? State countries and safeguards.' },
    aliases: ['transferencia internacional', 'transferencia internacional de dados', 'international transfer'],
  },
  {
    key: 'medidas_seguranca',
    section: 'seguranca',
    type: 'textarea',
    label: { pt: 'Medidas de segurança', en: 'Security measures' },
    hint: { pt: 'Medidas técnicas e organizacionais adotadas.', en: 'Technical and organisational measures in place.' },
    aliases: ['medidas de seguranca', 'medidas tecnicas', 'security measures'],
  },
  {
    key: 'prazo_retencao',
    section: 'cicloVida',
    type: 'text',
    required: true,
    label: { pt: 'Prazo de retenção', en: 'Retention period' },
    hint: { pt: 'Período em que os dados são armazenados.', en: 'Period during which data is stored.' },
    aliases: ['prazo de retencao', 'retencao', 'retention period'],
  },
  {
    key: 'criterio_descarte',
    section: 'cicloVida',
    type: 'textarea',
    label: { pt: 'Critério de descarte', en: 'Disposal criteria' },
    hint: { pt: 'Como e quando os dados são eliminados ou anonimizados.', en: 'How and when data is deleted or anonymised.' },
    aliases: ['criterio de descarte', 'descarte', 'eliminacao', 'disposal criteria'],
  },
  /*
    Probabilidade e impacto passam a usar a escala da matriz da empresa — a
    mesma do módulo de Riscos — e o nível deixa de ser escolhido à mão.

    Eram três selects independentes de texto. Nos dados reais, os sete
    registos existentes tinham todos `nivel = impacto`: a probabilidade estava
    no formulário e não entrava em conta nenhuma. Era a nona regra de cálculo
    de risco do produto.
  */
  {
    key: 'risco_probabilidade',
    section: 'risco',
    type: 'escala',
    label: { pt: 'Probabilidade', en: 'Likelihood' },
    hint: { pt: 'Probabilidade de ocorrência do incidente, na escala da matriz da empresa.', en: 'Likelihood of an incident occurring, on the company matrix scale.' },
    aliases: ['probabilidade', 'likelihood'],
  },
  {
    key: 'risco_impacto',
    section: 'risco',
    type: 'escala',
    label: { pt: 'Impacto', en: 'Impact' },
    hint: { pt: 'Impacto caso o incidente ocorra, na escala da matriz da empresa.', en: 'Impact should the incident occur, on the company matrix scale.' },
    aliases: ['impacto', 'impact'],
  },
  {
    key: 'risco_nivel',
    section: 'risco',
    type: 'derivado',
    label: { pt: 'Nível de risco', en: 'Risk level' },
    hint: { pt: 'Calculado a partir da probabilidade e do impacto, pela matriz vigente.', en: 'Derived from likelihood and impact using the active matrix.' },
    aliases: ['nivel de risco', 'risco', 'risk level'],
  },
  {
    key: 'evidencias_documentos',
    section: 'evidencias',
    type: 'textarea',
    label: { pt: 'Documentos de suporte', en: 'Supporting documents' },
    hint: { pt: 'Documentos e evidências que sustentam este registo.', en: 'Documents and evidence backing this record.' },
    aliases: ['documentos de suporte', 'evidencias', 'evidencias e documentacao', 'supporting documents'],
  },
  {
    key: 'observacoes',
    section: 'evidencias',
    type: 'textarea',
    label: { pt: 'Observações', en: 'Notes' },
    hint: { pt: 'Notas adicionais e observações de auditoria.', en: 'Additional notes and audit remarks.' },
    aliases: ['observacoes', 'observacoes/evidencias', 'notas', 'notes'],
  },
];

export const normalizeRopaLabel = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[*:]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

export const findRopaFieldByLabel = (label: string): RopaFieldDef | undefined => {
  const norm = normalizeRopaLabel(label);
  if (!norm) return undefined;
  return ROPA_FIELDS.find(
    (field) =>
      field.aliases.includes(norm) ||
      normalizeRopaLabel(field.label.pt) === norm ||
      normalizeRopaLabel(field.label.en) === norm,
  );
};

const NIVEL_MAP: Record<string, string> = {
  baixo: 'baixo',
  baixa: 'baixo',
  low: 'baixo',
  medio: 'medio',
  media: 'medio',
  moderado: 'medio',
  medium: 'medio',
  alto: 'alto',
  alta: 'alto',
  high: 'alto',
  critico: 'critico',
  critica: 'critico',
  critical: 'critico',
  muito_alto: 'critico',
  'muito alto': 'critico',
};

export const normalizeNivel = (value?: string | null): string | null => {
  if (!value) return null;
  return NIVEL_MAP[normalizeRopaLabel(value)] ?? null;
};

export const ropaFieldsBySection = (section: RopaSectionKey) =>
  ROPA_FIELDS.filter((field) => field.section === section);
