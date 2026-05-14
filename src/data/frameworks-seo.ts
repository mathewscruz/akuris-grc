export interface FrameworkSEO {
  slug: string;
  nome: string;
  categoria: string;
  tagline: string;
  resumo: string;
  oQueE: string;
  porQueImporta: string[];
  requisitosPrincipais: { titulo: string; desc: string }[];
  comoAkurisAjuda: string[];
  faq: { pergunta: string; resposta: string }[];
  keywordsLongTail: string[];
}

export const frameworksSeo: FrameworkSEO[] = [
  {
    slug: 'iso-27001',
    nome: 'ISO/IEC 27001',
    categoria: 'Segurança da Informação',
    tagline: 'O padrão internacional para Sistemas de Gestão de Segurança da Informação (SGSI).',
    resumo:
      'A ISO/IEC 27001 é a norma mais reconhecida mundialmente para gestão de segurança da informação. Define um Sistema de Gestão (SGSI) baseado em risco, com 93 controles no Anexo A (versão 2022).',
    oQueE:
      'A ISO/IEC 27001:2022 é uma norma internacional publicada pela ISO/IEC que estabelece requisitos para implementar, manter e melhorar continuamente um Sistema de Gestão de Segurança da Informação (SGSI). A certificação demonstra a empresas, clientes e órgãos reguladores que sua organização gerencia riscos de segurança da informação de forma sistemática.',
    porQueImporta: [
      'Reconhecimento internacional — abre portas em licitações, contratos enterprise e exportação.',
      'Reduz custos de incidentes ao tratar riscos antes que se materializem.',
      'Atende clientes que exigem fornecedores certificados (especialmente bancos, saúde e governo).',
      'Acelera a conformidade com LGPD, GDPR, SOC 2 e PCI DSS por sobreposição de controles.',
    ],
    requisitosPrincipais: [
      { titulo: 'Contexto e Liderança (Cl. 4-5)', desc: 'Definir escopo do SGSI, partes interessadas e compromisso da alta direção com uma política de segurança.' },
      { titulo: 'Planejamento e Riscos (Cl. 6)', desc: 'Avaliação e tratamento de riscos com critérios claros, declaração de aplicabilidade (SoA) e objetivos mensuráveis.' },
      { titulo: 'Operação (Cl. 8)', desc: 'Implementar os controles selecionados do Anexo A e tratar riscos identificados.' },
      { titulo: 'Avaliação de Desempenho (Cl. 9)', desc: 'Monitoramento, auditoria interna e análise crítica pela direção.' },
      { titulo: 'Melhoria (Cl. 10)', desc: 'Tratamento de não conformidades e ciclo de melhoria contínua.' },
      { titulo: 'Anexo A (93 controles)', desc: 'Organizacionais, de pessoas, físicos e tecnológicos. Cada controle pode ser aplicável ou justificadamente excluído na SoA.' },
    ],
    comoAkurisAjuda: [
      'Gap Analysis pronto contra os 93 controles do Anexo A 2022, com scoring automático e plano de ação por requisito.',
      'Repositório de evidências por controle, vinculado aos riscos e auditorias correspondentes.',
      'Geração assistida por IA da SoA, política de SI e procedimentos obrigatórios.',
      'Cross-mapping nativo: um controle ISO 27001 atende automaticamente requisitos de SOC 2, NIST CSF e LGPD.',
      'Painéis prontos para auditoria interna e revisão pela direção.',
    ],
    faq: [
      {
        pergunta: 'Quanto tempo leva para certificar a ISO 27001?',
        resposta: 'Em geral, de 6 a 12 meses para empresas que partem do zero. O Akuris reduz esse tempo ao automatizar gap analysis, geração de documentos e gestão de evidências.',
      },
      {
        pergunta: 'Qual a diferença entre ISO 27001 e ISO 27002?',
        resposta: 'A ISO 27001 é a norma certificável que define requisitos do SGSI. A ISO 27002 é um guia de boas práticas que detalha como implementar os controles do Anexo A — não é certificável.',
      },
      {
        pergunta: 'Preciso aplicar todos os 93 controles do Anexo A?',
        resposta: 'Não. A norma exige justificar inclusões e exclusões na Declaração de Aplicabilidade (SoA), com base na avaliação de riscos da sua organização.',
      },
      {
        pergunta: 'A ISO 27001 atende à LGPD?',
        resposta: 'Parcialmente. A ISO 27001 cobre segurança da informação; a LGPD exige controles específicos de privacidade. A combinação ideal é ISO 27001 + ISO 27701 (extensão para privacidade).',
      },
    ],
    keywordsLongTail: ['ISO 27001 software', 'ISO 27001 certificação', 'ISO 27001 2022 controles', 'SGSI ISO 27001', 'Anexo A ISO 27001'],
  },
  {
    slug: 'lgpd',
    nome: 'LGPD',
    categoria: 'Privacidade',
    tagline: 'Lei Geral de Proteção de Dados — Lei nº 13.709/2018.',
    resumo:
      'A LGPD é a lei brasileira que regula o tratamento de dados pessoais, com base inspirada no GDPR europeu. Vigente desde 2020, com sanções aplicadas pela ANPD desde 2021.',
    oQueE:
      'A Lei Geral de Proteção de Dados (LGPD) regula como empresas e órgãos públicos coletam, armazenam, tratam e compartilham dados pessoais de pessoas físicas no Brasil. Define direitos dos titulares, bases legais para tratamento, papéis (controlador, operador, encarregado/DPO) e obrigações de governança.',
    porQueImporta: [
      'Sanções da ANPD chegam a R$ 50 milhões por infração ou 2% do faturamento.',
      'Toda empresa que trata dados de pessoas no Brasil está sujeita — independente de porte ou localização.',
      'Clientes corporativos exigem conformidade LGPD em contratos de fornecimento.',
      'Reduz risco reputacional após vazamentos de dados (incidentes precisam ser comunicados à ANPD).',
    ],
    requisitosPrincipais: [
      { titulo: 'Bases Legais (Art. 7 e 11)', desc: 'Todo tratamento precisa de uma das 10 bases legais (consentimento, execução de contrato, legítimo interesse, etc.).' },
      { titulo: 'Direitos dos Titulares (Art. 18)', desc: 'Confirmação, acesso, correção, anonimização, portabilidade, eliminação, revogação de consentimento.' },
      { titulo: 'ROPA — Registro das Operações (Art. 37)', desc: 'Controlador e operador devem manter registro das atividades de tratamento.' },
      { titulo: 'Encarregado/DPO (Art. 41)', desc: 'Indicação obrigatória do encarregado pelo tratamento de dados pessoais.' },
      { titulo: 'Incidentes (Art. 48)', desc: 'Comunicação à ANPD e aos titulares em prazo razoável.' },
      { titulo: 'Relatório de Impacto (RIPD/DPIA — Art. 38)', desc: 'Obrigatório quando o tratamento gera alto risco aos direitos dos titulares.' },
    ],
    comoAkurisAjuda: [
      'Mapeamento de dados pessoais (data discovery) e fluxo entre sistemas.',
      'ROPA estruturado por atividade, com base legal vinculada e ciclo de vida.',
      'Gestão de solicitações de titulares com SLA e trilha de auditoria.',
      'Gap analysis dos 65 artigos da LGPD com plano de ação por requisito.',
      'Workflow completo de incidentes com notificação à ANPD pré-formatada.',
    ],
    faq: [
      {
        pergunta: 'Quem precisa cumprir a LGPD?',
        resposta: 'Toda pessoa jurídica (pública ou privada) que trate dados pessoais de indivíduos no Brasil, independentemente do país de origem da empresa ou onde os dados estão hospedados.',
      },
      {
        pergunta: 'O que é ROPA na LGPD?',
        resposta: 'ROPA (Record of Processing Activities) é o Registro das Operações de Tratamento exigido pelo Art. 37. Lista cada atividade que envolve dados pessoais — finalidade, base legal, dados tratados, prazo de retenção, compartilhamentos.',
      },
      {
        pergunta: 'Qual a diferença entre LGPD e GDPR?',
        resposta: 'A LGPD é inspirada no GDPR mas tem diferenças importantes: 10 bases legais (vs. 6 do GDPR), prazos diferentes para resposta a titulares, sanções menores em valor absoluto e a ANPD como autoridade nacional.',
      },
      {
        pergunta: 'Toda empresa precisa ter um DPO?',
        resposta: 'A LGPD exige a indicação de um encarregado, mas a ANPD permite que micro e pequenas empresas adotem regras simplificadas. Mesmo assim, é recomendado nomear formalmente um responsável.',
      },
    ],
    keywordsLongTail: ['LGPD software', 'plataforma LGPD', 'ROPA LGPD', 'gestão LGPD empresas', 'DPO LGPD ferramenta'],
  },
  {
    slug: 'soc-2',
    nome: 'SOC 2 Type II',
    categoria: 'Atestado de Confiança',
    tagline: 'Atestado AICPA para empresas SaaS e provedores de serviço.',
    resumo:
      'SOC 2 é um relatório de atestado emitido por auditor independente sobre os controles de uma organização de serviços, baseado nos cinco Trust Services Criteria: Segurança, Disponibilidade, Integridade de Processamento, Confidencialidade e Privacidade.',
    oQueE:
      'O SOC 2 (Service Organization Control 2) é um framework do AICPA usado para avaliar como organizações de serviço gerenciam dados de clientes. O Type II avalia o desenho E a operação dos controles ao longo de um período (usualmente 6 a 12 meses), enquanto o Type I avalia apenas o desenho em uma data.',
    porQueImporta: [
      'Pré-requisito para vender SaaS para empresas dos EUA e multinacionais.',
      'Demonstra maturidade operacional além da conformidade pontual.',
      'Reduz drasticamente o tempo de questionários de segurança em vendas enterprise.',
      'Convergente com ISO 27001 — implementar um facilita o outro.',
    ],
    requisitosPrincipais: [
      { titulo: 'Common Criteria (CC1-CC9)', desc: 'Base obrigatória: ambiente de controle, comunicação, avaliação de risco, monitoramento, controles lógicos e físicos.' },
      { titulo: 'Disponibilidade (A)', desc: 'SLAs, capacidade, monitoramento e recuperação de desastres.' },
      { titulo: 'Integridade de Processamento (PI)', desc: 'Garantia de que o sistema processa dados de forma completa, válida e oportuna.' },
      { titulo: 'Confidencialidade (C)', desc: 'Classificação, criptografia e descarte seguro de informação confidencial.' },
      { titulo: 'Privacidade (P)', desc: 'Coleta, uso, retenção, divulgação e descarte de informação pessoal.' },
    ],
    comoAkurisAjuda: [
      'Mapeamento dos Common Criteria e Trust Services Categories selecionados.',
      'Coleta contínua de evidências (logs, screenshots, políticas) durante o período de observação.',
      'Cross-mapping com ISO 27001 — controles compartilhados são preenchidos uma vez.',
      'Trilha de auditoria carimbada para o auditor independente.',
    ],
    faq: [
      {
        pergunta: 'Qual a diferença entre SOC 2 Type I e Type II?',
        resposta: 'Type I avalia se os controles estão DESENHADOS adequadamente em uma data específica. Type II avalia se OPERAM efetivamente ao longo de um período (normalmente 6-12 meses). Type II é o que clientes enterprise pedem.',
      },
      {
        pergunta: 'SOC 2 é uma certificação?',
        resposta: 'Não. É um atestado emitido por um auditor independente (CPA licenciado nos EUA). Não há um selo padrão; o resultado é o relatório SOC 2 que sua empresa entrega aos clientes.',
      },
      {
        pergunta: 'Posso fazer SOC 2 e ISO 27001 juntos?',
        resposta: 'Sim, e é uma estratégia comum. Há grande sobreposição entre Common Criteria e o Anexo A da ISO 27001. O Akuris faz cross-mapping automático para evitar retrabalho.',
      },
    ],
    keywordsLongTail: ['SOC 2 Type II', 'SOC 2 software', 'SOC 2 vs ISO 27001', 'Trust Services Criteria', 'auditoria SOC 2'],
  },
  {
    slug: 'nist-csf',
    nome: 'NIST CSF 2.0',
    categoria: 'Cibersegurança',
    tagline: 'Cybersecurity Framework do NIST — versão 2.0 (2024).',
    resumo:
      'O NIST CSF 2.0 é o framework de cibersegurança mais adotado globalmente. Organiza práticas em 6 funções (Govern, Identify, Protect, Detect, Respond, Recover) e serve para empresas de qualquer porte ou setor.',
    oQueE:
      'O NIST Cybersecurity Framework 2.0, publicado em 2024 pelo National Institute of Standards and Technology, é um framework voluntário que ajuda organizações a entender, comunicar e gerenciar risco cibernético. A versão 2.0 adicionou a função GOVERN no centro do modelo.',
    porQueImporta: [
      'Framework de referência para programas de cibersegurança em qualquer setor.',
      'Linguagem comum entre executivos, técnicos e auditores.',
      'Mapeia para ISO 27001, CIS Controls, COBIT — facilita conformidade múltipla.',
      'Adotado por reguladores e exigido em contratos do setor público.',
    ],
    requisitosPrincipais: [
      { titulo: 'GOVERN (GV)', desc: 'Estabelece a estratégia, expectativas e política de gestão de risco cibernético.' },
      { titulo: 'IDENTIFY (ID)', desc: 'Compreensão dos ativos, riscos e contexto de negócio.' },
      { titulo: 'PROTECT (PR)', desc: 'Salvaguardas para garantir a entrega de serviços críticos.' },
      { titulo: 'DETECT (DE)', desc: 'Identificação tempestiva de eventos de cibersegurança.' },
      { titulo: 'RESPOND (RS)', desc: 'Ações para conter o impacto de incidentes detectados.' },
      { titulo: 'RECOVER (RC)', desc: 'Restauração de capacidades e serviços afetados.' },
    ],
    comoAkurisAjuda: [
      'Avaliação de maturidade nas 6 funções e 22 categorias do CSF 2.0.',
      'Plano de ação priorizado por gap e impacto.',
      'Mapeamento cruzado com ISO 27001, CIS v8 e LGPD.',
      'Indicadores executivos do nível de implementação por função.',
    ],
    faq: [
      {
        pergunta: 'O que mudou no NIST CSF 2.0?',
        resposta: 'A versão 2.0 (2024) adicionou a função GOVERN no centro do modelo, expandiu o escopo para todas as organizações (não só infraestrutura crítica) e melhorou orientação sobre gestão de cadeia de suprimentos.',
      },
      {
        pergunta: 'NIST CSF é obrigatório?',
        resposta: 'É voluntário, mas é referência para muitos requisitos regulatórios e contratuais. Nos EUA, o setor público frequentemente exige conformidade.',
      },
    ],
    keywordsLongTail: ['NIST CSF 2.0', 'NIST Cybersecurity Framework', 'NIST CSF GOVERN', 'avaliação maturidade NIST'],
  },
  {
    slug: 'pci-dss',
    nome: 'PCI DSS 4.0',
    categoria: 'Pagamentos',
    tagline: 'Payment Card Industry Data Security Standard — versão 4.0.',
    resumo:
      'O PCI DSS é o padrão obrigatório para qualquer organização que armazena, processa ou transmite dados de cartão de pagamento. A versão 4.0 traz requisitos mais flexíveis e novos controles de autenticação.',
    oQueE:
      'O PCI DSS (Payment Card Industry Data Security Standard) é mantido pelo PCI Security Standards Council (Visa, Mastercard, Amex, Discover, JCB). Define 12 requisitos organizados em 6 objetivos para proteger dados do titular do cartão (CHD) e dados sensíveis de autenticação (SAD).',
    porQueImporta: [
      'Obrigatório por contrato com bandeiras e adquirentes de cartão.',
      'Multa por não conformidade pode chegar a US$ 100 mil/mês para grandes comerciantes.',
      'Reduz drasticamente o risco e o impacto de vazamentos envolvendo dados de cartão.',
      'A versão 4.0 é mandatória desde 31/03/2025 — substitui a 3.2.1.',
    ],
    requisitosPrincipais: [
      { titulo: 'Construir e manter rede segura', desc: 'Firewall e parâmetros padrão alterados.' },
      { titulo: 'Proteger dados do titular', desc: 'CHD armazenado e em trânsito sempre criptografado.' },
      { titulo: 'Programa de gestão de vulnerabilidades', desc: 'Antivírus e desenvolvimento seguro.' },
      { titulo: 'Controle de acesso forte', desc: 'MFA expandido na 4.0, princípio de menor privilégio.' },
      { titulo: 'Monitoramento e testes', desc: 'Logs, scans e testes de intrusão regulares.' },
      { titulo: 'Política de segurança', desc: 'Documentação e capacitação contínua.' },
    ],
    comoAkurisAjuda: [
      'Gap analysis dos 12 requisitos PCI DSS 4.0 e seus 60+ sub-requisitos.',
      'Coleta de evidências por requisito para o QSA (auditor PCI).',
      'Trilha completa para SAQ ou Report on Compliance (RoC).',
    ],
    faq: [
      {
        pergunta: 'PCI DSS é obrigatório no Brasil?',
        resposta: 'Sim, por contrato. Toda empresa que aceita pagamento com cartão (próprio ou via gateway) está sujeita aos requisitos das bandeiras, mesmo no Brasil.',
      },
      {
        pergunta: 'O que mudou no PCI DSS 4.0?',
        resposta: 'Maior ênfase em MFA (incluindo acesso administrativo a sistemas que tratam CHD), abordagem customizada para atender controles, ciclo de validação contínua e novos requisitos de autenticação.',
      },
    ],
    keywordsLongTail: ['PCI DSS 4.0', 'PCI DSS software', 'PCI compliance Brasil', 'auditoria PCI DSS'],
  },
  {
    slug: 'gdpr',
    nome: 'GDPR',
    categoria: 'Privacidade',
    tagline: 'General Data Protection Regulation — Regulamento (UE) 2016/679.',
    resumo:
      'O GDPR é o regulamento europeu de proteção de dados pessoais, em vigor desde maio de 2018. Aplica-se a qualquer empresa que trate dados de residentes da UE, independentemente de onde a empresa está sediada.',
    oQueE:
      'O General Data Protection Regulation harmonizou as regras de proteção de dados em toda a União Europeia. Estabelece princípios, direitos dos titulares, obrigações de controladores e processadores, e sanções administrativas que chegam a € 20 milhões ou 4% do faturamento global.',
    porQueImporta: [
      'Aplica-se a empresas brasileiras que ofereçam bens/serviços a residentes da UE ou monitorem seu comportamento.',
      'Sanções altíssimas — incluem casos públicos de dezenas de milhões de euros.',
      'Pré-requisito para parcerias comerciais e operação de subsidiárias na Europa.',
      'Sobreposição forte com LGPD — atender um facilita o outro.',
    ],
    requisitosPrincipais: [
      { titulo: 'Princípios (Art. 5)', desc: 'Licitude, lealdade, transparência, limitação de finalidades, minimização.' },
      { titulo: 'Bases Legais (Art. 6)', desc: '6 bases: consentimento, contrato, obrigação legal, vital, interesse público, legítimo interesse.' },
      { titulo: 'Direitos dos Titulares (Art. 12-22)', desc: 'Acesso, retificação, apagamento, portabilidade, oposição, decisões automatizadas.' },
      { titulo: 'DPIA (Art. 35)', desc: 'Avaliação de impacto obrigatória para tratamentos de alto risco.' },
      { titulo: 'Notificação de Incidentes (Art. 33)', desc: '72 horas para notificar a autoridade supervisora.' },
      { titulo: 'Transferências Internacionais (Cap. V)', desc: 'SCCs, BCRs ou decisões de adequação para sair do EEE.' },
    ],
    comoAkurisAjuda: [
      'ROPA conforme Art. 30, gestão de DPIAs e bases legais por atividade.',
      'Workflow de incidentes com cronômetro para a regra das 72 horas.',
      'Cross-mapping LGPD ↔ GDPR — controles compartilhados implementados uma vez.',
    ],
    faq: [
      {
        pergunta: 'Empresa brasileira precisa cumprir o GDPR?',
        resposta: 'Sim, se oferecer bens/serviços a residentes da União Europeia ou monitorar comportamento (Art. 3). A localização da empresa não importa — o que importa é onde está o titular dos dados.',
      },
      {
        pergunta: 'Qual a diferença prática entre LGPD e GDPR?',
        resposta: 'LGPD tem 10 bases legais (vs. 6 do GDPR), prazos diferentes para resposta a titulares, sanções menores em valor absoluto e a ANPD como autoridade brasileira. A estrutura geral é muito semelhante.',
      },
    ],
    keywordsLongTail: ['GDPR Brasil', 'GDPR vs LGPD', 'DPIA GDPR', 'Art. 30 GDPR ROPA'],
  },
  {
    slug: 'iso-27701',
    nome: 'ISO/IEC 27701',
    categoria: 'Privacidade',
    tagline: 'Extensão da ISO 27001 para Sistema de Gestão de Privacidade (PIMS).',
    resumo:
      'A ISO/IEC 27701 estende a ISO 27001 e a ISO 27002 para incluir requisitos específicos de privacidade. Permite estabelecer um Sistema de Gestão de Privacidade da Informação (PIMS) certificável.',
    oQueE:
      'A ISO/IEC 27701:2019 é uma extensão da ISO 27001 voltada para privacidade. Adiciona requisitos e diretrizes para controladores e operadores de dados pessoais, alinhada à ISO 29100 (privacy framework) e mapeada para GDPR.',
    porQueImporta: [
      'É o caminho natural para empresas certificadas em ISO 27001 demonstrarem maturidade em privacidade.',
      'Mapeamento direto com requisitos do GDPR e LGPD — facilita conformidade global.',
      'Diferencial competitivo em vendas enterprise que envolvem dados pessoais.',
    ],
    requisitosPrincipais: [
      { titulo: 'Requisitos do PIMS (Cl. 5-6)', desc: 'Estende o SGSI da ISO 27001 com elementos específicos de privacidade.' },
      { titulo: 'Anexo A (Controladores)', desc: 'Controles adicionais quando a organização é controladora de dados pessoais.' },
      { titulo: 'Anexo B (Operadores)', desc: 'Controles adicionais quando a organização atua como operadora.' },
      { titulo: 'Mapeamento ISO 29100, GDPR e ISO 29151', desc: 'Anexos D, E e F facilitam conformidade combinada.' },
    ],
    comoAkurisAjuda: [
      'Implementação combinada ISO 27001 + 27701 com cross-mapping nativo.',
      'Geração de evidências para certificação PIMS.',
      'Alinhamento com módulos de Privacidade & LGPD do Akuris.',
    ],
    faq: [
      {
        pergunta: 'Posso certificar ISO 27701 sem ISO 27001?',
        resposta: 'Não. A ISO 27701 é uma extensão e exige um SGSI ISO 27001 implementado como base.',
      },
      {
        pergunta: 'A ISO 27701 substitui a LGPD?',
        resposta: 'Não. É uma norma técnica que ajuda a estruturar controles, mas a conformidade legal com a LGPD continua sendo obrigação independente.',
      },
    ],
    keywordsLongTail: ['ISO 27701', 'PIMS ISO 27701', 'ISO 27701 LGPD', 'ISO 27001 27701 conjunta'],
  },
];

export const frameworksSeoMap = Object.fromEntries(
  frameworksSeo.map((f) => [f.slug, f]),
);
