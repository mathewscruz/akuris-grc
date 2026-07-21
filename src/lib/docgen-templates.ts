/**
 * Catálogo de templates do DocGen.
 * Cada template pré-preenche o briefing e gera um seed prompt para a IA.
 * NÃO contém texto do documento — apenas instruções estruturadas para o assistente.
 */

import type { LucideIcon } from 'lucide-react';
import {
  Shield,
  Lock,
  KeyRound,
  Database,
  AlertTriangle,
  ScrollText,
  Cookie,
  UserCheck,
  Archive,
  LifeBuoy,
  Activity,
  Siren,
  Scale,
  Handshake,
  Briefcase,
  UserPlus,
  Home,
  MonitorSmartphone,
} from 'lucide-react';

export type DocTone = 'formal' | 'tecnico' | 'didatico';
export type DocLanguage = 'pt-BR' | 'en';
export type DocLength = 'executivo' | 'padrao' | 'detalhado';
export type DocType =
  | 'politica'
  | 'procedimento'
  | 'norma'
  | 'plano'
  | 'termo'
  | 'em_branco';

export interface BriefingDefaults {
  docType: DocType;
  frameworks: string[];
  scope: string;
  audience: string;
  tone: DocTone;
  language: DocLanguage;
  length: DocLength;
  /** Quando true, pula o chat conversacional e gera o documento direto após o seed. */
  directGenerate?: boolean;
}

export interface DocGenTemplate {
  id: string;
  label: string;
  description: string;
  category: string;
  icon: LucideIcon;
  briefingDefaults: BriefingDefaults;
  /** Prompt inicial que será enviado automaticamente para a IA. */
  seedPromptHint: string;
}

export const TEMPLATE_CATEGORIES = [
  { id: 'seguranca', label: 'Segurança da Informação' },
  { id: 'lgpd', label: 'LGPD / Privacidade' },
  { id: 'continuidade', label: 'Continuidade de Negócios' },
  { id: 'governanca', label: 'Governança e Conduta' },
  { id: 'operacional', label: 'Operacional / RH' },
] as const;

const baseDefaults = {
  scope: '',
  audience: 'Todos os colaboradores e prestadores de serviço',
  tone: 'formal' as DocTone,
  language: 'pt-BR' as DocLanguage,
  length: 'padrao' as DocLength,
  directGenerate: true,
};

export const DOCGEN_TEMPLATES: DocGenTemplate[] = [
  // Segurança
  {
    id: 'psi-iso27001',
    label: 'Política de Segurança da Informação (PSI)',
    description: 'Documento mestre alinhado à ISO/IEC 27001 cobrindo princípios, papéis e responsabilidades.',
    category: 'seguranca',
    icon: Shield,
    briefingDefaults: {
      ...baseDefaults,
      docType: 'politica',
      frameworks: ['ISO 27001'],
      scope: 'Princípios, diretrizes, papéis e responsabilidades para proteção da informação corporativa',
    },
    seedPromptHint:
      'Quero criar uma Política de Segurança da Informação (PSI) alinhada à ISO 27001, cobrindo objetivo, escopo, princípios, papéis (CISO, gestores, usuários), classificação da informação, controle de acesso, gestão de incidentes, e penalidades.',
  },
  {
    id: 'politica-senhas',
    label: 'Política de Senhas',
    description: 'Regras de criação, rotação, complexidade e armazenamento de credenciais.',
    category: 'seguranca',
    icon: KeyRound,
    briefingDefaults: {
      ...baseDefaults,
      docType: 'politica',
      frameworks: ['ISO 27001'],
      scope: 'Regras de criação, complexidade, troca, bloqueio e armazenamento seguro de senhas',
    },
    seedPromptHint:
      'Quero uma Política de Senhas com requisitos de complexidade mínima, rotação periódica, bloqueio após tentativas inválidas, uso de MFA quando aplicável, proibição de compartilhamento e diretrizes para gerenciadores de senha.',
  },
  {
    id: 'politica-acesso',
    label: 'Política de Controle de Acesso',
    description: 'Princípio do menor privilégio, segregação de funções e revisão de acessos.',
    category: 'seguranca',
    icon: Lock,
    briefingDefaults: {
      ...baseDefaults,
      docType: 'politica',
      frameworks: ['ISO 27001'],
      scope: 'Concessão, revisão e revogação de acessos lógicos e físicos com base no menor privilégio',
    },
    seedPromptHint:
      'Quero uma Política de Controle de Acesso baseada em menor privilégio, segregação de funções, processo de provisionamento/desprovisionamento, revisão periódica de acessos privilegiados e exigências para acessos remotos.',
  },
  {
    id: 'politica-backup',
    label: 'Política de Backup',
    description: 'Estratégia, periodicidade, retenção e testes de restauração.',
    category: 'seguranca',
    icon: Database,
    briefingDefaults: {
      ...baseDefaults,
      docType: 'politica',
      frameworks: ['ISO 27001'],
      scope: 'Periodicidade, retenção, criptografia, armazenamento off-site e testes de restauração de backups',
    },
    seedPromptHint:
      'Quero uma Política de Backup cobrindo a regra 3-2-1, periodicidade por criticidade do ativo, retenção mínima, criptografia em trânsito e em repouso, armazenamento off-site, testes de restauração trimestrais e responsáveis.',
  },
  {
    id: 'plano-resposta-incidentes',
    label: 'Plano de Resposta a Incidentes',
    description: 'Detecção, contenção, erradicação, recuperação e lições aprendidas.',
    category: 'seguranca',
    icon: Siren,
    briefingDefaults: {
      ...baseDefaults,
      docType: 'plano',
      frameworks: ['ISO 27001', 'NIST'],
      scope: 'Procedimentos de resposta a incidentes de segurança da informação',
      length: 'detalhado',
    },
    seedPromptHint:
      'Quero um Plano de Resposta a Incidentes seguindo NIST SP 800-61 (preparação, detecção/análise, contenção/erradicação/recuperação, pós-incidente), com matriz de severidade, fluxo de comunicação interna/externa e contatos de acionamento.',
  },

  // LGPD
  {
    id: 'politica-privacidade',
    label: 'Política de Privacidade',
    description: 'Documento público em conformidade com a LGPD.',
    category: 'lgpd',
    icon: ScrollText,
    briefingDefaults: {
      ...baseDefaults,
      docType: 'politica',
      frameworks: ['LGPD'],
      scope: 'Tratamento de dados pessoais de titulares, finalidades, bases legais e direitos',
      audience: 'Titulares de dados (clientes, usuários, visitantes)',
    },
    seedPromptHint:
      'Quero uma Política de Privacidade pública em conformidade com a LGPD, descrevendo dados coletados, finalidades, bases legais (art. 7º), compartilhamento, retenção, direitos do titular (art. 18) e canais de atendimento ao DPO.',
  },
  {
    id: 'politica-cookies',
    label: 'Política de Cookies',
    description: 'Tipos de cookies, finalidades e gestão de consentimento.',
    category: 'lgpd',
    icon: Cookie,
    briefingDefaults: {
      ...baseDefaults,
      docType: 'politica',
      frameworks: ['LGPD'],
      scope: 'Uso de cookies e tecnologias similares no site/aplicação',
      audience: 'Visitantes do site',
      length: 'executivo',
    },
    seedPromptHint:
      'Quero uma Política de Cookies cobrindo tipos (estritamente necessários, funcionais, analíticos, marketing), finalidades, retenção, mecanismo de consentimento granular e como revogar o consentimento.',
  },
  {
    id: 'procedimento-titular',
    label: 'Procedimento de Atendimento ao Titular',
    description: 'Fluxo operacional para responder solicitações do titular (art. 18).',
    category: 'lgpd',
    icon: UserCheck,
    briefingDefaults: {
      ...baseDefaults,
      docType: 'procedimento',
      frameworks: ['LGPD'],
      scope: 'Recebimento, validação, atendimento e resposta a solicitações de titulares de dados',
    },
    seedPromptHint:
      'Quero um Procedimento de Atendimento ao Titular cobrindo canais de recebimento, validação de identidade, prazos legais, fluxo entre áreas (Jurídico, TI, Negócio), modelos de resposta e registro de evidências.',
  },
  {
    id: 'politica-retencao',
    label: 'Política de Retenção e Descarte',
    description: 'Prazos de retenção e descarte seguro de dados.',
    category: 'lgpd',
    icon: Archive,
    briefingDefaults: {
      ...baseDefaults,
      docType: 'politica',
      frameworks: ['LGPD', 'ISO 27001'],
      scope: 'Prazos de retenção e descarte seguro de dados pessoais e corporativos',
    },
    seedPromptHint:
      'Quero uma Política de Retenção e Descarte definindo prazos por categoria de dado (pessoal, financeiro, contratual), critérios de eliminação ou anonimização, métodos de descarte seguro e responsáveis.',
  },

  // Continuidade
  {
    id: 'plano-bcp',
    label: 'Plano de Continuidade de Negócios (BCP)',
    description: 'Estratégias para manter operações críticas durante interrupções.',
    category: 'continuidade',
    icon: LifeBuoy,
    briefingDefaults: {
      ...baseDefaults,
      docType: 'plano',
      frameworks: ['ISO 22301'],
      scope: 'Manutenção de processos críticos durante eventos disruptivos',
      length: 'detalhado',
    },
    seedPromptHint:
      'Quero um Plano de Continuidade de Negócios (BCP) com BIA, processos críticos, RTO/RPO, estratégias de continuidade, equipe de crise, comunicação e cronograma de testes.',
  },
  {
    id: 'plano-drp',
    label: 'Plano de Recuperação de Desastres (DRP)',
    description: 'Procedimentos técnicos de recuperação de TI.',
    category: 'continuidade',
    icon: Activity,
    briefingDefaults: {
      ...baseDefaults,
      docType: 'plano',
      frameworks: ['ISO 22301', 'ISO 27031'],
      scope: 'Recuperação técnica de sistemas, dados e infraestrutura críticos de TI',
      length: 'detalhado',
    },
    seedPromptHint:
      'Quero um Plano de Recuperação de Desastres (DRP) cobrindo inventário de sistemas críticos, RTO/RPO por sistema, procedimentos de failover, ordem de recuperação, ambiente alternativo e responsáveis técnicos.',
  },
  {
    id: 'politica-gestao-crise',
    label: 'Política de Gestão de Crise',
    description: 'Estrutura, papéis e processo de tomada de decisão em crise.',
    category: 'continuidade',
    icon: AlertTriangle,
    briefingDefaults: {
      ...baseDefaults,
      docType: 'politica',
      frameworks: ['ISO 22301'],
      scope: 'Acionamento, governança e comunicação durante crises corporativas',
    },
    seedPromptHint:
      'Quero uma Política de Gestão de Crise definindo gatilhos de acionamento, comitê de crise (papéis e suplentes), níveis de severidade, fluxo de comunicação interna e externa, e processo de pós-crise.',
  },

  // Governança
  {
    id: 'codigo-conduta',
    label: 'Código de Ética e Conduta',
    description: 'Princípios éticos e regras de conduta esperadas dos colaboradores.',
    category: 'governanca',
    icon: Scale,
    briefingDefaults: {
      ...baseDefaults,
      docType: 'norma',
      frameworks: [],
      scope: 'Princípios éticos, conduta profissional e canal de denúncias',
    },
    seedPromptHint:
      'Quero um Código de Ética e Conduta cobrindo missão/valores, conduta com colegas, clientes e fornecedores, conflito de interesses, uso de recursos da empresa, anticorrupção, canal de denúncias e medidas disciplinares.',
  },
  {
    id: 'politica-antissuborno',
    label: 'Política Antissuborno e Anticorrupção',
    description: 'Alinhada à ISO 37001 e Lei Anticorrupção (12.846/2013).',
    category: 'governanca',
    icon: Handshake,
    briefingDefaults: {
      ...baseDefaults,
      docType: 'politica',
      frameworks: ['ISO 37001'],
      scope: 'Prevenção, detecção e tratamento de atos de suborno e corrupção',
    },
    seedPromptHint:
      'Quero uma Política Antissuborno e Anticorrupção alinhada à ISO 37001 e à Lei 12.846/2013, cobrindo definições, brindes/hospitalidade, doações, terceiros, due diligence, treinamento, canal de denúncias e sanções.',
  },
  {
    id: 'politica-conflito',
    label: 'Política de Conflito de Interesses',
    description: 'Identificação, declaração e tratamento de conflitos.',
    category: 'governanca',
    icon: Briefcase,
    briefingDefaults: {
      ...baseDefaults,
      docType: 'politica',
      frameworks: [],
      scope: 'Identificação, declaração e mitigação de conflitos de interesse',
      length: 'executivo',
    },
    seedPromptHint:
      'Quero uma Política de Conflito de Interesses cobrindo definição, exemplos típicos, obrigação de declaração, fluxo de avaliação pelo comitê de ética, medidas de mitigação e consequências de omissão.',
  },

  // Operacional
  {
    id: 'procedimento-onboarding',
    label: 'Procedimento de Onboarding',
    description: 'Integração de novos colaboradores com checklist de acessos.',
    category: 'operacional',
    icon: UserPlus,
    briefingDefaults: {
      ...baseDefaults,
      docType: 'procedimento',
      frameworks: [],
      scope: 'Integração de novos colaboradores: documentação, acessos, treinamentos e termos',
    },
    seedPromptHint:
      'Quero um Procedimento de Onboarding cobrindo checklist pré-admissão, primeiro dia, primeira semana, treinamentos obrigatórios (LGPD, segurança, código de conduta), provisionamento de acessos e acompanhamento.',
  },
  {
    id: 'politica-home-office',
    label: 'Política de Home Office',
    description: 'Regras de trabalho remoto, equipamentos e segurança.',
    category: 'operacional',
    icon: Home,
    briefingDefaults: {
      ...baseDefaults,
      docType: 'politica',
      frameworks: [],
      scope: 'Trabalho remoto: elegibilidade, equipamentos, jornada e segurança da informação',
    },
    seedPromptHint:
      'Quero uma Política de Home Office cobrindo elegibilidade, jornada e disponibilidade, equipamentos fornecidos vs próprios, ambiente de trabalho, segurança da informação no remoto, despesas e revogação.',
  },
  {
    id: 'politica-uso-aceitavel',
    label: 'Política de Uso Aceitável',
    description: 'Uso aceitável de equipamentos, internet e e-mail corporativos.',
    category: 'operacional',
    icon: MonitorSmartphone,
    briefingDefaults: {
      ...baseDefaults,
      docType: 'politica',
      frameworks: ['ISO 27001'],
      scope: 'Uso aceitável de recursos de TI, internet, e-mail e dispositivos móveis',
    },
    seedPromptHint:
      'Quero uma Política de Uso Aceitável cobrindo uso de estações de trabalho, e-mail corporativo, internet, redes sociais, dispositivos móveis (BYOD), software autorizado, monitoramento e penalidades.',
  },
];

const DOC_TYPE_LABEL: Record<DocType, string> = {
  politica: 'Política',
  procedimento: 'Procedimento',
  norma: 'Norma interna',
  plano: 'Plano',
  termo: 'Termo',
  em_branco: 'Documento',
};

const TONE_LABEL: Record<DocTone, string> = {
  formal: 'Formal corporativo',
  tecnico: 'Técnico e objetivo',
  didatico: 'Didático e acessível',
};

const LENGTH_LABEL: Record<DocLength, string> = {
  executivo: 'Executivo (3–5 páginas)',
  padrao: 'Padrão (8–15 páginas)',
  detalhado: 'Detalhado (20+ páginas)',
};

const LANGUAGE_LABEL: Record<DocLanguage, string> = {
  'pt-BR': 'Português (Brasil)',
  en: 'Inglês',
};

export const DOC_TYPE_OPTIONS: Array<{ value: DocType; label: string }> = (
  Object.entries(DOC_TYPE_LABEL) as Array<[DocType, string]>
).map(([value, label]) => ({ value, label }));

export const DOC_TONE_OPTIONS: Array<{ value: DocTone; label: string }> = (
  Object.entries(TONE_LABEL) as Array<[DocTone, string]>
).map(([value, label]) => ({ value, label }));

export const DOC_LENGTH_OPTIONS: Array<{ value: DocLength; label: string }> = (
  Object.entries(LENGTH_LABEL) as Array<[DocLength, string]>
).map(([value, label]) => ({ value, label }));

export const DOC_LANGUAGE_OPTIONS: Array<{ value: DocLanguage; label: string }> = (
  Object.entries(LANGUAGE_LABEL) as Array<[DocLanguage, string]>
).map(([value, label]) => ({ value, label }));

/**
 * Monta o prompt inicial enviado automaticamente para a IA.
 * Concatena o hint do template (se houver) com os parâmetros do briefing.
 */
export function buildSeedPrompt(
  briefing: BriefingDefaults,
  templateHint?: string,
): string {
  const docLabel = DOC_TYPE_LABEL[briefing.docType] || 'Documento';
  const parts: string[] = [];

  if (templateHint) {
    parts.push(templateHint);
  } else {
    parts.push(`Quero criar um(a) ${docLabel.toLowerCase()} para a minha empresa.`);
  }

  parts.push('');
  parts.push('**Parâmetros do briefing:**');
  parts.push(`- Tipo: ${docLabel}`);
  if (briefing.frameworks.length > 0) {
    parts.push(`- Frameworks aplicáveis: ${briefing.frameworks.join(', ')}`);
  }
  if (briefing.scope.trim()) {
    parts.push(`- Escopo: ${briefing.scope.trim()}`);
  }
  if (briefing.audience.trim()) {
    parts.push(`- Público-alvo: ${briefing.audience.trim()}`);
  }
  parts.push(`- Tom: ${TONE_LABEL[briefing.tone]}`);
  parts.push(`- Idioma: ${LANGUAGE_LABEL[briefing.language]}`);
  parts.push(`- Extensão alvo: ${LENGTH_LABEL[briefing.length]}`);
  parts.push('');
  parts.push(
    'Por favor, proponha a estrutura de seções inicial e confirme se podemos prosseguir para a geração completa do documento.',
  );

  return parts.join('\n');
}
