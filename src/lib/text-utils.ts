// Funções utilitárias para formatação de texto

// Mapa de traduções para português correto com acentos
const STATUS_LABELS: Record<string, string> = {
  // Tipos de Ativos/Sistemas
  'aplicacao': 'Aplicação',
  'banco_dados': 'Banco de Dados',
  'sistema_operacional': 'Sistema Operacional',
  'hardware': 'Hardware',
  'software': 'Software',
  'rede': 'Rede',
  'nuvem': 'Nuvem',
  'servidor': 'Servidor',
  'dispositivo': 'Dispositivo',
  'seguranca': 'Segurança',
  'comunicacao': 'Comunicação',
  
  // Tipos de Documentos
  'politica': 'Política',
  'procedimento': 'Procedimento',
  'instrucao': 'Instrução',
  'formulario': 'Formulário',
  'relatorio': 'Relatório',
  'certificado': 'Certificado',
  'contrato': 'Contrato',
  'documento': 'Documento',
  'manual': 'Manual',
  'norma': 'Norma',
  'registro': 'Registro',
  
  // Classificações
  'publica': 'Pública',
  'interna': 'Interna',
  'restrita': 'Restrita',
  'confidencial': 'Confidencial',
  
  // Criticidade/Prioridade
  'critico': 'Crítico',
  'critica': 'Crítica',
  'alto': 'Alto',
  'alta': 'Alta',
  'medio': 'Médio',
  'media': 'Média',
  'baixo': 'Baixo',
  'baixa': 'Baixa',
  'muito_alto': 'Muito Alto',
  'muito_baixo': 'Muito Baixo',
  
  // Status de Workflow
  'pendente': 'Pendente',
  'pendente_aprovacao': 'Pendente Aprovação',
  'em_andamento': 'Em Andamento',
  'em_execucao': 'Em Execução',
  'em_analise': 'Em Análise',
  'em_revisao': 'Em Revisão',
  'em_investigacao': 'Em Investigação',
  'concluido': 'Concluído',
  'concluida': 'Concluída',
  'cancelado': 'Cancelado',
  'cancelada': 'Cancelada',
  'aprovado': 'Aprovado',
  'aprovada': 'Aprovada',
  'rejeitado': 'Rejeitado',
  'rejeitada': 'Rejeitada',
  'nao_aplicavel': 'Não Aplicável',
  'arquivado': 'Arquivado',
  'arquivada': 'Arquivada',
  'rascunho': 'Rascunho',
  'planejamento': 'Planejamento',
  'contido': 'Contido',
  'resolvido': 'Resolvido',
  'resolvida': 'Resolvida',
  'atendida': 'Atendida',
  'fechado': 'Fechado',
  'aberto': 'Aberto',
  'nova': 'Nova',
  'novo': 'Novo',
  
  // Tipos de Auditoria
  'ti': 'TI',
  'compliance': 'Compliance',
  'operacional': 'Operacional',
  'externa': 'Externa',
  'financeira': 'Financeira',
  
  // Tipos de Controle
  'preventivo': 'Preventivo',
  'detectivo': 'Detectivo',
  'corretivo': 'Corretivo',
  'compensatorio': 'Compensatório',
  
  // Sistemas e Tecnologia
  'erp': 'ERP',
  'crm': 'CRM',
  'bi': 'BI',
  'siem': 'SIEM',
  'iam': 'IAM',
  'vpn': 'VPN',
  'api': 'API',
  'saas': 'SaaS',
  'paas': 'PaaS',
  'iaas': 'IaaS',
  
  // Status de Itens
  'ativo': 'Ativo',
  'ativa': 'Ativa',
  'inativo': 'Inativo',
  'inativa': 'Inativa',
  'vencido': 'Vencido',
  'vencida': 'Vencida',
  'expirado': 'Expirado',
  'expirada': 'Expirada',
  'revogado': 'Revogado',
  'revogada': 'Revogada',
  'suspenso': 'Suspenso',
  'suspensa': 'Suspensa',
  'a_vencer': 'A Vencer',
  'em_renovacao': 'Em Renovação',
  'em_rotacao': 'Em Rotação',
  'descontinuado': 'Descontinuado',
  
  // Riscos
  'identificado': 'Identificado',
  'analisado': 'Analisado',
  'tratado': 'Tratado',
  'monitorado': 'Monitorado',
  'aceito': 'Aceito',
  'mitigado': 'Mitigado',
  
  // Tratamentos de Risco
  'mitigar': 'Mitigar',
  'transferir': 'Transferir',
  'aceitar': 'Aceitar',
  'evitar': 'Evitar',
  
  // Frequências
  'diaria': 'Diária',
  'diario': 'Diário',
  'semanal': 'Semanal',
  'quinzenal': 'Quinzenal',
  'mensal': 'Mensal',
  'bimestral': 'Bimestral',
  'trimestral': 'Trimestral',
  'semestral': 'Semestral',
  'anual': 'Anual',
  'sob_demanda': 'Sob Demanda',
  
  // Níveis de privilégio
  'administrativo': 'Administrativo',
  'leitura': 'Leitura',
  'escrita': 'Escrita',
  'total': 'Total',
  'elevado': 'Elevado',
  'padrao': 'Padrão',
  
  // Dados e Privacidade
  'sensivel': 'Sensível',
  'muito_sensivel': 'Muito Sensível',
  'comum': 'Comum',
  'moderado': 'Moderado',
  
  // Contratos
  'negociacao': 'Negociação',
  'aprovacao': 'Aprovação',
  'encerrado': 'Encerrado',
  'renovacao': 'Renovação',
  
  // Status de Revisão de Acessos
  'aguardando_inicio': 'Aguardando Início',
  'aguardando': 'Aguardando',
  'iniciada': 'Iniciada',
  'iniciado': 'Iniciado',
  'finalizada': 'Finalizada',
  'finalizado': 'Finalizado',
  
  // Due Diligence
  'enviado': 'Enviado',
  'respondido': 'Respondido',
  'avaliado': 'Avaliado',
  
  // Gap Analysis / Conformidade
  'conforme': 'Conforme',
  'nao_conforme': 'Não Conforme',
  'parcial': 'Parcial',
  'parcialmente_conforme': 'Parcialmente Conforme',
  
  // Incidentes
  'investigacao': 'Investigação',
  'contencao': 'Contenção',
  'erradicacao': 'Erradicação',
  'recuperacao': 'Recuperação',
  'licoes_aprendidas': 'Lições Aprendidas',
  
  // Chaves e Certificados
  'api_key': 'API Key',
  'certificado_ssl': 'Certificado SSL',
  'ssh_key': 'SSH Key',
  'token_acesso': 'Token de Acesso',
  'secret_key': 'Secret Key',
  'certificado_digital': 'Certificado Digital',
  'chave_simetrica': 'Chave Simétrica',
  'chave_assimetrica': 'Chave Assimétrica',
  
  // Bases Legais LGPD
  'legitimo_interesse': 'Legítimo Interesse',
  'execucao_contrato': 'Execução de Contrato',
  'cumprimento_obrigacao': 'Cumprimento de Obrigação Legal',
  'protecao_vida': 'Proteção da Vida',
  'exercicio_direitos': 'Exercício de Direitos',
  'politicas_publicas': 'Políticas Públicas',
  'consentimento': 'Consentimento',
  'tutela_saude': 'Tutela da Saúde',
  'protecao_credito': 'Proteção ao Crédito',
  'estudo_pesquisa': 'Estudo e Pesquisa',
  
  // Coleta e Compartilhamento
  'diretamente_titular': 'Diretamente do Titular',
  'nao_compartilha': 'Não Compartilha',
  'autorizacao_anpd': 'Autorização ANPD',
  'revogacao_consentimento': 'Revogação de Consentimento',
  'formulario_web': 'Formulário Web',
  
  // Tipos de Sistema
  'autenticacao': 'Autenticação',

  // Infraestrutura
  'servidor_local': 'Servidor Local',
  'cloud_publica': 'Cloud Pública',
  'cloud_privada': 'Cloud Privada',
  'cloud_hibrida': 'Cloud Híbrida',
  'data_center': 'Data Center',
  
  // Dimensões e Volumes
  'muito_grande': 'Muito Grande',
  'tempo_real': 'Tempo Real',
  
  // Pessoas e Entidades
  'pessoa_juridica': 'Pessoa Jurídica',
  'pessoa_fisica': 'Pessoa Física',
  
  // Contratos
  'contrato_principal': 'Contrato Principal',
  'aditivo_contrato': 'Aditivo de Contrato',
  'termo_aditivo': 'Termo Aditivo',
  
  // Segurança da Informação
  'seguranca_informacao': 'Segurança da Informação',
  'gestao_riscos': 'Gestão de Riscos',
  'gestao_incidentes': 'Gestão de Incidentes',
  'gestao_mudancas': 'Gestão de Mudanças',
  'gestao_vulnerabilidades': 'Gestão de Vulnerabilidades',
  'controle_acesso': 'Controle de Acesso',
  'backup_restauracao': 'Backup e Restauração',
  
  // Categorias gerais
  'disponibilidade': 'Disponibilidade',
  'privacidade': 'Privacidade',
  'integridade': 'Integridade',
  'confidencialidade': 'Confidencialidade',
  'conformidade': 'Conformidade',
  'governanca': 'Governança',
  
  // Tipos de Incidentes
  'vazamento_dados': 'Vazamento de Dados',
  'acesso_nao_autorizado': 'Acesso Não Autorizado',
  'indisponibilidade': 'Indisponibilidade',
  'violacao_politica': 'Violação de Política',
  'phishing': 'Phishing',
  'malware': 'Malware',
  'ransomware': 'Ransomware',
  
  // Denúncias
  'assedio_moral': 'Assédio Moral',
  'assedio_sexual': 'Assédio Sexual',
  'discriminacao': 'Discriminação',
  'fraude': 'Fraude',
  'corrupcao': 'Corrupção',
  'conflito_interesses': 'Conflito de Interesses',
  'desvio_conduta': 'Desvio de Conduta',
  'violacao_normas': 'Violação de Normas',
};

// English translations for STATUS_LABELS keys
const STATUS_LABELS_EN: Record<string, string> = {
  aplicacao: 'Application', banco_dados: 'Database', sistema_operacional: 'Operating System',
  hardware: 'Hardware', software: 'Software', rede: 'Network', nuvem: 'Cloud',
  servidor: 'Server', dispositivo: 'Device', seguranca: 'Security', comunicacao: 'Communication',
  politica: 'Policy', procedimento: 'Procedure', instrucao: 'Instruction', formulario: 'Form',
  relatorio: 'Report', certificado: 'Certificate', contrato: 'Contract', documento: 'Document',
  manual: 'Manual', norma: 'Standard', registro: 'Record',
  publica: 'Public', interna: 'Internal', restrita: 'Restricted', confidencial: 'Confidential',
  critico: 'Critical', critica: 'Critical', alto: 'High', alta: 'High',
  medio: 'Medium', media: 'Medium', baixo: 'Low', baixa: 'Low',
  muito_alto: 'Very High', muito_baixo: 'Very Low',
  pendente: 'Pending', pendente_aprovacao: 'Pending Approval', em_andamento: 'In Progress',
  em_analise: 'Under Review', em_revisao: 'Under Revision', em_investigacao: 'Under Investigation',
  concluido: 'Completed', concluida: 'Completed', cancelado: 'Cancelled', cancelada: 'Cancelled',
  aprovado: 'Approved', aprovada: 'Approved', rejeitado: 'Rejected', rejeitada: 'Rejected',
  nao_aplicavel: 'Not Applicable', arquivado: 'Archived', arquivada: 'Archived',
  rascunho: 'Draft', planejamento: 'Planning', contido: 'Contained',
  resolvido: 'Resolved', resolvida: 'Resolved', atendida: 'Fulfilled',
  fechado: 'Closed', aberto: 'Open', nova: 'New', novo: 'New',
  ti: 'IT', compliance: 'Compliance', operacional: 'Operational', externa: 'External', financeira: 'Financial',
  preventivo: 'Preventive', detectivo: 'Detective', corretivo: 'Corrective', compensatorio: 'Compensatory',
  erp: 'ERP', crm: 'CRM', bi: 'BI', siem: 'SIEM', iam: 'IAM', vpn: 'VPN', api: 'API',
  saas: 'SaaS', paas: 'PaaS', iaas: 'IaaS',
  ativo: 'Active', ativa: 'Active', inativo: 'Inactive', inativa: 'Inactive',
  vencido: 'Expired', vencida: 'Expired', expirado: 'Expired', expirada: 'Expired',
  revogado: 'Revoked', revogada: 'Revoked', suspenso: 'Suspended', suspensa: 'Suspended',
  a_vencer: 'Due Soon', em_renovacao: 'Renewing', em_rotacao: 'Rotating', descontinuado: 'Discontinued',
  identificado: 'Identified', analisado: 'Analyzed', tratado: 'Treated', monitorado: 'Monitored',
  aceito: 'Accepted', mitigado: 'Mitigated',
  mitigar: 'Mitigate', transferir: 'Transfer', aceitar: 'Accept', evitar: 'Avoid',
  diaria: 'Daily', diario: 'Daily', semanal: 'Weekly', quinzenal: 'Biweekly',
  mensal: 'Monthly', bimestral: 'Bimonthly', trimestral: 'Quarterly',
  semestral: 'Semiannual', anual: 'Annual', sob_demanda: 'On Demand',
  administrativo: 'Administrative', leitura: 'Read', escrita: 'Write', total: 'Total',
  elevado: 'Elevated', padrao: 'Standard',
  sensivel: 'Sensitive', muito_sensivel: 'Highly Sensitive', comum: 'Common', moderado: 'Moderate',
  negociacao: 'Negotiation', aprovacao: 'Approval', encerrado: 'Ended', renovacao: 'Renewal',
  aguardando_inicio: 'Awaiting Start', aguardando: 'Awaiting',
  iniciada: 'Started', iniciado: 'Started', finalizada: 'Finalized', finalizado: 'Finalized',
  enviado: 'Sent', respondido: 'Answered', avaliado: 'Evaluated',
  conforme: 'Compliant', nao_conforme: 'Non-Compliant',
  parcial: 'Partial', parcialmente_conforme: 'Partially Compliant',
  investigacao: 'Investigation', contencao: 'Containment',
  erradicacao: 'Eradication', recuperacao: 'Recovery', licoes_aprendidas: 'Lessons Learned',
  api_key: 'API Key', certificado_ssl: 'SSL Certificate', ssh_key: 'SSH Key',
  token_acesso: 'Access Token', secret_key: 'Secret Key', certificado_digital: 'Digital Certificate',
  chave_simetrica: 'Symmetric Key', chave_assimetrica: 'Asymmetric Key',
  legitimo_interesse: 'Legitimate Interest', execucao_contrato: 'Contract Execution',
  cumprimento_obrigacao: 'Legal Obligation', protecao_vida: 'Life Protection',
  exercicio_direitos: 'Exercise of Rights', politicas_publicas: 'Public Policies',
  consentimento: 'Consent', tutela_saude: 'Health Care', protecao_credito: 'Credit Protection',
  estudo_pesquisa: 'Study and Research',
  diretamente_titular: 'Directly from Subject', nao_compartilha: 'Not Shared',
  autorizacao_anpd: 'ANPD Authorization', revogacao_consentimento: 'Consent Revocation',
  formulario_web: 'Web Form',
  servidor_local: 'Local Server', cloud_publica: 'Public Cloud',
  cloud_privada: 'Private Cloud', cloud_hibrida: 'Hybrid Cloud', data_center: 'Data Center',
  muito_grande: 'Very Large', tempo_real: 'Real Time',
  pessoa_juridica: 'Legal Entity', pessoa_fisica: 'Individual',
  contrato_principal: 'Main Contract', aditivo_contrato: 'Contract Addendum', termo_aditivo: 'Addendum',
  seguranca_informacao: 'Information Security', gestao_riscos: 'Risk Management',
  gestao_incidentes: 'Incident Management', gestao_mudancas: 'Change Management',
  gestao_vulnerabilidades: 'Vulnerability Management', controle_acesso: 'Access Control',
  backup_restauracao: 'Backup and Restore',
  disponibilidade: 'Availability', privacidade: 'Privacy', integridade: 'Integrity',
  confidencialidade: 'Confidentiality', conformidade: 'Compliance', governanca: 'Governance',
  vazamento_dados: 'Data Leak', acesso_nao_autorizado: 'Unauthorized Access',
  indisponibilidade: 'Unavailability', violacao_politica: 'Policy Violation',
  phishing: 'Phishing', malware: 'Malware', ransomware: 'Ransomware',
  assedio_moral: 'Workplace Harassment', assedio_sexual: 'Sexual Harassment',
  discriminacao: 'Discrimination', fraude: 'Fraud', corrupcao: 'Corruption',
  conflito_interesses: 'Conflict of Interest', desvio_conduta: 'Misconduct',
  violacao_normas: 'Standards Violation',
};

// Locale-aware status label getter (use this in new code)
export const getStatusLabel = (status: string, locale: 'pt' | 'en' = 'pt'): string => {
  if (!status) return '';
  const lower = status.toLowerCase();
  const map = locale === 'en' ? STATUS_LABELS_EN : STATUS_LABELS;
  if (map[lower]) return map[lower];
  return formatStatus(status);
};

// Palavras que devem permanecer em maiúsculas
const UPPERCASE_WORDS = new Set(['ti', 'erp', 'crm', 'bi', 'siem', 'iam', 'vpn', 'api', 'saas', 'paas', 'iaas', 'rls', 'jwt', 'sql', 'css', 'html', 'url', 'uri', 'xml', 'json', 'http', 'https', 'ftp', 'ssh', 'ssl', 'tls', 'dns', 'ip', 'tcp', 'udp', 'smtp', 'imap', 'pop', 'ldap', 'oauth', 'sso', 'mfa', 'otp', 'pdf', 'csv', 'xlsx', 'docx', 'pptx', 'png', 'jpg', 'jpeg', 'gif', 'svg', 'mp3', 'mp4', 'avi', 'mov', 'iso', 'nist', 'lgpd', 'gdpr', 'ccpa', 'hipaa', 'sox', 'soc', 'pci', 'dss', 'cobit', 'coso', 'itil', 'cis']);

export const capitalizeText = (text: string): string => {
  if (!text) return '';
  const lower = text.toLowerCase();
  
  // Verificar se é uma sigla conhecida
  if (UPPERCASE_WORDS.has(lower)) {
    return text.toUpperCase();
  }
  
  // Verificar se há tradução no mapa
  if (STATUS_LABELS[lower]) {
    return STATUS_LABELS[lower];
  }
  
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
};

// Formata status dinâmicos: substitui underscores, capitaliza cada palavra
export const formatStatus = (status: string): string => {
  if (!status) return '';
  
  const lowerStatus = status.toLowerCase();
  
  // Primeiro, verificar se há uma tradução direta no mapa
  if (STATUS_LABELS[lowerStatus]) {
    return STATUS_LABELS[lowerStatus];
  }
  
  // Se não encontrar no mapa, aplicar formatação padrão
  return status
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => {
      const lowerWord = word.toLowerCase();
      
      // Verificar se é uma sigla conhecida
      if (UPPERCASE_WORDS.has(lowerWord)) {
        return word.toUpperCase();
      }
      
      // Verificar cada palavra individualmente no mapa
      if (STATUS_LABELS[lowerWord]) {
        return STATUS_LABELS[lowerWord];
      }
      
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
};

// ============= FUNÇÕES PADRONIZADAS DE CORES DE STATUS =============

/**
 * Cores para criticidade/prioridade (Crítico, Alto, Médio, Baixo)
 * Usado em: Controles, Incidentes, Sistemas, Chaves, Licenças, Denúncias, etc.
 */
export const getCriticidadeColor = (criticidade: string): string => {
  const value = criticidade?.toLowerCase() || '';
  switch (value) {
    case 'critico':
    case 'critica':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'alto':
    case 'alta':
      return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'medio':
    case 'media':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'baixo':
    case 'baixa':
      return 'bg-green-100 text-green-800 border-green-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

/**
 * Cores para status de workflow (Concluído, Em Andamento, Pendente, Cancelado)
 * Usado em: Auditorias, Revisão de Acessos, Incidentes, Due Diligence, etc.
 */
export const getWorkflowStatusColor = (status: string): string => {
  const value = status?.toLowerCase() || '';
  switch (value) {
    case 'concluido':
    case 'concluida':
    case 'resolvido':
    case 'fechado':
    case 'atendida':
    case 'aprovado':
    case 'aprovada':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'em_andamento':
    case 'investigacao':
    case 'em_analise':
    case 'contido':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'pendente':
    case 'planejamento':
    case 'rascunho':
    case 'nova':
    case 'pendente_aprovacao':
    case 'aberto':
      return 'bg-gray-100 text-gray-800 border-gray-200';
    case 'cancelado':
    case 'cancelada':
    case 'rejeitado':
    case 'rejeitada':
      return 'bg-red-100 text-red-800 border-red-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

/**
 * Cores para status de item (Ativo, Inativo, Vencido, Expirado)
 * Usado em: Ativos, Licenças, Chaves, Contas Privilegiadas, etc.
 */
export const getItemStatusColor = (status: string): string => {
  const value = status?.toLowerCase() || '';
  switch (value) {
    case 'ativo':
    case 'ativa':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'inativo':
    case 'inativa':
    case 'arquivado':
    case 'descontinuado':
    case 'revogado':
    case 'revogada':
      return 'bg-gray-100 text-gray-800 border-gray-200';
    case 'vencido':
    case 'vencida':
    case 'expirado':
    case 'expirada':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'a_vencer':
    case 'em_renovacao':
    case 'em_rotacao':
      return 'bg-amber-100 text-amber-800 border-amber-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

/**
 * Cores para status de contratos (Ativo, Negociação, Aprovação, Suspenso, Encerrado)
 * Usado em: Contratos
 */
export const getContratoStatusColor = (status: string): string => {
  const value = status?.toLowerCase() || '';
  switch (value) {
    case 'ativo':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'negociacao':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'aprovacao':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'suspenso':
      return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'encerrado':
    case 'cancelado':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'rascunho':
    case 'inativo':
      return 'bg-gray-100 text-gray-800 border-gray-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

/**
 * Cores para tipos de controle (Preventivo, Detectivo, Corretivo)
 * Usado em: Controles
 */
export const getControleTipoColor = (tipo: string): string => {
  const value = tipo?.toLowerCase() || '';
  switch (value) {
    case 'preventivo':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'detectivo':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'corretivo':
      return 'bg-green-100 text-green-800 border-green-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

/**
 * Cores para tipos de documentos
 * Usado em: Documentos
 */
export const getTipoColor = (tipo: string): string => {
  const value = tipo?.toLowerCase() || '';
  switch (value) {
    case 'documento':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'politica':
      return 'bg-purple-100 text-purple-800 border-purple-200';
    case 'procedimento':
      return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'instrucao':
      return 'bg-teal-100 text-teal-800 border-teal-200';
    case 'formulario':
      return 'bg-pink-100 text-pink-800 border-pink-200';
    case 'certificado':
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'contrato':
      return 'bg-indigo-100 text-indigo-800 border-indigo-200';
    case 'relatorio':
      return 'bg-cyan-100 text-cyan-800 border-cyan-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

/**
 * Cores para classificação de documentos (Confidencial, Restrita, Interna, Pública)
 * Usado em: Documentos
 */
export const getClassificacaoColor = (classificacao: string): string => {
  const value = classificacao?.toLowerCase() || '';
  switch (value) {
    case 'confidencial':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'restrita':
      return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'interna':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'publica':
      return 'bg-green-100 text-green-800 border-green-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

/**
 * Cores para status de auditoria
 * Usado em: Auditorias
 */
export const getAuditoriaStatusColor = (status: string): string => {
  const value = status?.toLowerCase() || '';
  switch (value) {
    case 'planejamento':
      return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'em_andamento':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'concluida':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'cancelada':
      return 'bg-red-100 text-red-800 border-red-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

/**
 * Cores para tipos de auditoria
 * Usado em: Auditorias
 */
export const getAuditoriaTipoColor = (tipo: string): string => {
  const value = tipo?.toLowerCase() || '';
  switch (value) {
    case 'interna':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'externa':
      return 'bg-purple-100 text-purple-800 border-purple-200';
    case 'compliance':
      return 'bg-indigo-100 text-indigo-800 border-indigo-200';
    case 'operacional':
      return 'bg-teal-100 text-teal-800 border-teal-200';
    case 'ti':
      return 'bg-cyan-100 text-cyan-800 border-cyan-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

/**
 * Cores para prioridade de auditoria
 * Usado em: Auditorias
 */
export const getAuditoriaPrioridadeColor = (prioridade: string): string => {
  const value = prioridade?.toLowerCase() || '';
  switch (value) {
    case 'baixa':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'media':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'alta':
      return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'critica':
      return 'bg-red-100 text-red-800 border-red-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

/**
 * Cores para status de denúncias (Nova, Em Análise, Em Investigação, Resolvida, Arquivada)
 * Usado em: Denúncias
 */
export const getDenunciaStatusColor = (status: string): string => {
  const value = status?.toLowerCase() || '';
  switch (value) {
    case 'nova':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'em_analise':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'em_investigacao':
      return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'resolvida':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'arquivada':
      return 'bg-gray-100 text-gray-800 border-gray-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

/**
 * Cores para sensibilidade de dados (Sensível, Moderado, Comum)
 * Usado em: Dados Pessoais, ROPA
 */
export const getSensibilidadeColor = (tipo: string, sensibilidade: string): string => {
  if (tipo === 'sensivel' || sensibilidade === 'muito_sensivel') {
    return 'bg-red-100 text-red-800 border-red-200';
  }
  if (sensibilidade === 'sensivel') {
    return 'bg-yellow-100 text-yellow-800 border-yellow-200';
  }
  return 'bg-gray-100 text-gray-800 border-gray-200';
};

/**
 * @deprecated Use `resolveRiscoStatusTone` de `@/lib/status-tone` + `<StatusBadge>`.
 * Será removida em breve. Cores Tailwind cruas quebram o tema dark e o padrão visual.
 */
export const getRiscoStatusColor = (status: string): string => {
  const value = status?.toLowerCase() || '';
  switch (value) {
    case 'identificado':
      return 'bg-gray-100 text-gray-800 border-gray-200';
    case 'analisado':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'tratado':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'monitorado':
      return 'bg-teal-100 text-teal-800 border-teal-200';
    case 'aceito':
      return 'bg-amber-100 text-amber-800 border-amber-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

/**
 * @deprecated Use `resolveNivelRiscoTone` de `@/lib/status-tone` + `<StatusBadge>`.
 */
export const getNivelRiscoColor = (nivel: string): string => {
  const value = nivel?.toLowerCase() || '';
  switch (value) {
    case 'critico':
    case 'crítico':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'muito alto':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'alto':
      return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'medio':
    case 'médio':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'baixo':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'muito baixo':
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

/**
 * @deprecated Use `resolveDueDiligenceStatusTone` de `@/lib/status-tone` + `<StatusBadge>`.
 */
export const getDueDiligenceStatusColor = (status: string): string => {
  const value = status?.toLowerCase() || '';
  switch (value) {
    case 'pendente':
      return 'bg-gray-100 text-gray-800 border-gray-200';
    case 'ativo':
    case 'em_andamento':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'concluido':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'expirado':
      return 'bg-red-100 text-red-800 border-red-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

/**
 * @deprecated Use `resolveTratamentoTipoTone` de `@/lib/status-tone` + `<StatusBadge>`.
 */
export const getTratamentoTipoColor = (tipo: string): string => {
  const value = tipo?.toLowerCase() || '';
  switch (value) {
    case 'mitigar':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'transferir':
      return 'bg-purple-100 text-purple-800 border-purple-200';
    case 'aceitar':
      return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'evitar':
      return 'bg-green-100 text-green-800 border-green-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

/**
 * @deprecated Use `resolveTratamentoStatusTone` de `@/lib/status-tone` + `<StatusBadge>`.
 */
export const getTratamentoStatusColor = (status: string): string => {
  const value = status?.toLowerCase() || '';
  switch (value) {
    case 'pendente':
      return 'bg-gray-100 text-gray-800 border-gray-200';
    case 'em andamento':
    case 'em_andamento':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'concluído':
    case 'concluido':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'cancelado':
      return 'bg-red-100 text-red-800 border-red-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

/**
 * Cores para sensibilidade de dados (versão simplificada com 1 argumento)
 * Usado em: Dados Pessoais, ROPA
 */
export const getSensibilidadeColorSimple = (sensibilidade: string): string => {
  const value = sensibilidade?.toLowerCase() || '';
  switch (value) {
    case 'sensivel':
    case 'muito_sensivel':
    case 'crítico':
    case 'critico':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'moderado':
    case 'medio':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'comum':
    case 'baixo':
      return 'bg-green-100 text-green-800 border-green-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};