// Funções utilitárias para formatação de texto
import { getAppLocale } from '@/lib/i18n-locale';

// Mapa de traduções para português correto com acentos
const STATUS_LABELS: Record<string, string> = {
  // Tipos de contrato / fornecedor
  'servico': 'Serviço',
  'servicos': 'Serviços',
  'produto': 'Produto',
  'produtos': 'Produtos',
  'consultoria': 'Consultoria',
  'prestacao_servicos': 'Prestação de Serviços',
  'fornecimento': 'Fornecimento',
  'locacao': 'Locação',
  'manutencao': 'Manutenção',
  'licenciamento': 'Licenciamento',
  'parceria': 'Parceria',
  'nda': 'NDA',
  'outro': 'Outro',
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
  
  // Criticidade/Prioridade/Severidade — forma ÚNICA (masculino) em todo o sistema
  'critico': 'Crítico',
  'critica': 'Crítico',
  'alto': 'Alto',
  'alta': 'Alto',
  'medio': 'Médio',
  'media': 'Médio',
  'baixo': 'Baixo',
  'baixa': 'Baixo',
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
  servico: 'Service',
  servicos: 'Services',
  produto: 'Product',
  produtos: 'Products',
  consultoria: 'Consulting',
  prestacao_servicos: 'Service Provision',
  fornecimento: 'Supply',
  locacao: 'Lease',
  manutencao: 'Maintenance',
  licenciamento: 'Licensing',
  parceria: 'Partnership',
  nda: 'NDA',
  outro: 'Other',
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
  em_execucao: 'In Execution', autenticacao: 'Authentication',

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

// Mapa ativo conforme idioma selecionado (EN cai para o mapa PT quando não houver tradução)
const activeLabel = (key: string): string | undefined => {
  if (getAppLocale() === 'en') return STATUS_LABELS_EN[key] ?? undefined;
  return STATUS_LABELS[key];
};

// Locale-aware status label getter (use this in new code)
export const getStatusLabel = (status: string, locale: 'pt' | 'en' = 'pt'): string => {
  if (!status) return '';
  const lower = status.toLowerCase();
  const map = locale === 'en' ? STATUS_LABELS_EN : STATUS_LABELS;
  if (map[lower]) return map[lower];
  return formatStatus(status);
};

/** Rótulo feminino para prioridade (não confundir com severidade/nível de risco). */
export const formatPrioridade = (prioridade?: string | null): string => {
  if (!prioridade) return '';
  const key = prioridade.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (getAppLocale() === 'en') {
    return ({ baixa: 'Low', media: 'Medium', alta: 'High', critica: 'Critical' } as Record<string, string>)[key]
      ?? formatStatus(prioridade);
  }
  return ({ baixa: 'Baixa', media: 'Média', alta: 'Alta', critica: 'Crítica' } as Record<string, string>)[key]
    ?? formatStatus(prioridade);
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
  
  // Verificar se há tradução no mapa do idioma ativo
  const label = activeLabel(lower);
  if (label) {
    return label;
  }
  
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
};

// Formata status dinâmicos: substitui underscores, capitaliza cada palavra
export const formatStatus = (status: string): string => {
  if (!status) return '';
  
  const lowerStatus = status.toLowerCase();
  
  // Primeiro, verificar se há uma tradução direta no mapa do idioma ativo
  const direct = activeLabel(lowerStatus);
  if (direct) {
    return direct;
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
      
      // Verificar cada palavra individualmente no mapa do idioma ativo
      const wordLabel = activeLabel(lowerWord);
      if (wordLabel) {
        return wordLabel;
      }
      
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
};

/*
 * As dezoito funcoes de cor que viviam aqui — getCriticidadeColor,
 * getAuditoriaStatusColor, getNivelRiscoColor e companhia — foram removidas
 * em 17/08/2026. Nenhuma tinha um unico consumidor: devolviam classes cruas
 * do Tailwind (fundo, texto e borda numa mesma familia amarela) e ficaram
 * para tras quando o sistema passou a resolver estado e severidade por token.
 *
 * A cor de um estado sai hoje dos resolvers de src/lib/status-tone.tsx,
 * consumidos pelo Chip/StatusBadge. Nao recriar mapas de cor aqui.
 */
