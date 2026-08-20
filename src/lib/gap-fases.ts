/**
 * As fases de trabalho de um framework.
 *
 * O módulo tinha um "Roteiro Recomendado" de quatro passos, bom e específico
 * por framework, que aparecia UMA vez num ecrã de boas-vindas e desaparecia
 * para sempre depois da primeira avaliação. Era um tapete de entrada, não um
 * plano: quem perguntava "o que faço primeiro" já tinha passado por cima dele.
 *
 * Aqui as fases deixam de ser texto e passam a ser estrutura. Cada uma agrupa
 * categorias reais de requisito, portanto sabe dizer quanto está feito e sabe
 * filtrar a tabela ao clique.
 *
 * Duas decisões deliberadas:
 *
 *  - **Nome de resultado, não de atividade.** "Escopo fechado", não "Definir
 *    escopo". É o padrão que Vanta e Drata usam ("Program setup", "Audit
 *    ready", "Report in hand") e serve para o leigo saber o que TEM no fim,
 *    não o que vai fazer no meio.
 *
 *  - **A última fase termina sempre na auditoria.** Um programa de conformidade
 *    sem fim visível parece infinito, e é aí que as pessoas desistem.
 *
 * A ordem respeita dependência real: não se escreve política de classificação
 * antes de saber que informação a empresa tem, e não se recolhe prova de um
 * controlo que ainda não existe.
 *
 * Um framework sem entrada aqui simplesmente não mostra o painel — não há
 * fase inventada, e a tabela continua a funcionar como sempre.
 */

export interface FaseDeTrabalho {
  /** Chave i18n do nome e do resultado, sob `gapFases.<framework>.<id>`. */
  id: string;
  /** Categorias de requisito que pertencem a esta fase. Valores REAIS da coluna. */
  categorias: string[];
  /** Duração típica, em semanas, para uma empresa de porte médio. */
  semanas: string;
}

/**
 * Chave estável por framework, derivada do nome.
 *
 * Deliberadamente pela mesma via que `FrameworkOnboarding` usa, e não pelo id:
 * os frameworks são globais e vêm de migrations, mas o id difere entre
 * ambientes. Comparar por nome normalizado funciona em qualquer base.
 */
export function chaveDoFramework(nome: string): string | null {
  const n = (nome || '').toLowerCase();
  if (n.includes('27001')) return 'iso27001';
  if (n.includes('lgpd')) return 'lgpd';
  if (n.includes('soc') && n.includes('2')) return 'soc2';
  if (n.includes('nist') && n.includes('csf')) return 'nistCsf';
  if (n.includes('pci')) return 'pciDss';
  if (n.includes('gdpr')) return 'gdpr';
  return null;
}

/**
 * Como termina o percurso deste framework.
 *
 * Não é detalhe de texto: o produto dizia a toda a gente "contrate um organismo
 * certificador, o certificado vale três anos". Quem abrisse a LGPD lia isso —
 * e **não existe certificado de LGPD**. Ninguém certifica conformidade com uma
 * lei brasileira; o que existe é conseguir demonstrá-la à ANPD e aos clientes.
 * O SOC 2 também não dá certificado: dá um relatório de auditor independente.
 *
 *  - `certificado`  ISO: organismo acreditado, dois estágios, validade de 3 anos
 *  - `lei`          LGPD, GDPR, HIPAA, SOX: não há certificado, há fiscalização
 *  - `relatorio`    SOC 2, PCI DSS: um auditor externo emite relatório/atestado
 *  - `referencial`  NIST CSF, CIS, COBIT: nenhuma auditoria externa formal
 */
export type FimDoPercurso = 'certificado' | 'lei' | 'relatorio' | 'referencial';

export function fimDoPercurso(nome: string): FimDoPercurso {
  const n = (nome || '').toLowerCase();
  if (n.includes('lgpd') || n.includes('gdpr') || n.includes('ccpa') || n.includes('hipaa')
      || n.includes('sox') || n.includes('dora') || n.includes('nis2')) return 'lei';
  if (n.includes('soc') || n.includes('pci')) return 'relatorio';
  if (n.startsWith('iso') || n.includes('iso/iec') || n.includes('iso ')) return 'certificado';
  return 'referencial';
}

export const FASES_POR_FRAMEWORK: Record<string, FaseDeTrabalho[]> = {
  iso27001: [
    { id: 'escopo', categorias: ['Contexto', 'Liderança', 'Apoio'], semanas: '3 a 4' },
    { id: 'programa', categorias: ['Planejamento', 'Segurança'], semanas: '8 a 10' },
    { id: 'controles', categorias: ['Pessoas', 'Físico', 'Tecnologia'], semanas: '10 a 14' },
    /*
      12 a 16 semanas, não 6 a 8.

      O auditor do Estágio 2 espera ver o sistema a operar e a gerar registos,
      mais uma auditoria interna e uma análise crítica pela direção já
      concluídas. Seis semanas não são "meses de registo", e prometer isso põe
      a empresa a marcar a auditoria cedo demais.
    */
    { id: 'auditoria', categorias: ['Operação', 'Avaliação', 'Melhoria'], semanas: '12 a 16' },
  ],
  lgpd: [
    { id: 'mapa', categorias: ['Disposições Preliminares', 'Tratamento de Dados'], semanas: '4 a 6' },
    { id: 'responsaveis', categorias: ['Agentes de Tratamento', 'Transferência Internacional'], semanas: '3 a 4' },
    { id: 'titular', categorias: ['Direitos do Titular', 'Segurança e Boas Práticas'], semanas: '4 a 6' },
    { id: 'anpd', categorias: ['ANPD', 'Sanções', 'Disposições Finais'], semanas: '2 a 3' },
  ],
  /*
    Os grupos reais da AICPA, depois da equalização.

    Os rótulos antigos estavam deslocados em um: 'Security - Gestão de Riscos'
    cobria o CC2, que é Comunicação e Informação, e 'Atividades de Controle'
    cobria o CC3, que é Avaliação de Riscos. Com a taxonomia corrigida, as
    fases seguem a lógica do próprio relatório: montar a governança, pôr a
    segurança a funcionar, cobrir o que se prometeu ao cliente por contrato, e
    provar que se vigia — que é o que o auditor examina ao longo do período.
  */
  soc2: [
    { id: 'governanca', categorias: ['Ambiente de Controle', 'Comunicação e Informação', 'Avaliação de Riscos'], semanas: '3 a 4' },
    { id: 'seguranca', categorias: ['Atividades de Controle', 'Controles de Acesso', 'Gestão de Mudanças'], semanas: '6 a 8' },
    { id: 'promessas', categorias: ['Availability', 'Processing Integrity', 'Confidentiality', 'Privacy'], semanas: '8 a 12' },
    { id: 'auditor', categorias: ['Operação de Sistemas', 'Monitoramento', 'Mitigação de Riscos'], semanas: '12 a 16' },
  ],
  nistCsf: [
    { id: 'direcao', categorias: ['Contexto Organizacional', 'Estratégia de Gestão de Riscos', 'Papéis e Responsabilidades', 'Política', 'Supervisão'], semanas: '3 a 4' },
    { id: 'inventario', categorias: ['Gestão de Ativos', 'Avaliação de Riscos', 'Cadeia de Suprimentos'], semanas: '5 a 7' },
    { id: 'defesas', categorias: ['Controle de Acesso', 'Treinamento', 'Segurança de Dados', 'Segurança de Plataforma', 'Resiliência de Infraestrutura', 'Monitoramento Contínuo', 'Análise de Eventos'], semanas: '10 a 14' },
    { id: 'avaliacao', categorias: ['Gestão de Incidentes', 'Análise de Incidentes', 'Comunicação de Incidentes', 'Mitigação de Incidentes', 'Execução da Recuperação', 'Comunicação de Recuperação', 'Melhoria'], semanas: '6 a 8' },
  ],
  /*
    O PCI DSS segue a ordem dos seus próprios Requisitos 1 a 12, que é como o
    auditor de cartão lê a norma: cercar o ambiente (1-2 e 12), proteger o dado
    (3-6), controlar quem entra (7-9), e provar que se vigia (10-11).
  */
  pciDss: [
    { id: 'ambiente', categorias: ['Network Security', 'System Configuration', 'Secure Configurations', 'Security Program'], semanas: '4 a 6' },
    { id: 'dadoProtegido', categorias: ['Data Protection', 'Data Transmission', 'Transmission Security', 'Malware Protection', 'Secure Software'], semanas: '6 a 8' },
    { id: 'acesso', categorias: ['Access Control', 'Authentication', 'Physical Security'], semanas: '4 a 6' },
    { id: 'auditor', categorias: ['Vulnerability Management', 'Monitoring', 'Logging', 'Security Testing'], semanas: '8 a 12' },
  ],
  gdpr: [
    { id: 'baseLegal', categorias: ['General Provisions', 'Principles'], semanas: '3 a 5' },
    { id: 'programa', categorias: ['Controller and Processor'], semanas: '6 a 8' },
    { id: 'direitos', categorias: ['Rights of Data Subject', 'Transfers'], semanas: '4 a 6' },
    { id: 'autoridade', categorias: ['Supervisory Authorities', 'Cooperation', 'Remedies', 'Specific Situations', 'Delegated Acts', 'Final Provisions'], semanas: '2 a 3' },
  ],
};

/** As fases de um framework, ou `null` se ele ainda não tem plano desenhado. */
export function fasesDe(nomeDoFramework: string): FaseDeTrabalho[] | null {
  const chave = chaveDoFramework(nomeDoFramework);
  return chave ? (FASES_POR_FRAMEWORK[chave] ?? null) : null;
}

export interface ProgressoDaFase extends FaseDeTrabalho {
  ordem: number;
  total: number;
  concluidos: number;
  /** A fase onde o trabalho está: a primeira que ainda não fechou. */
  atual: boolean;
}

/**
 * Quanto está feito em cada fase.
 *
 * `conformePorCategoria` e `totalPorCategoria` vêm do mesmo cálculo que
 * alimenta o mapa de calor, para o painel não inventar uma terceira contagem —
 * este módulo já teve três fórmulas paralelas de aderência e uma guarda
 * dedicada a impedir a quarta.
 */
export function progressoDasFases(
  fases: FaseDeTrabalho[],
  totalPorCategoria: Record<string, number>,
  concluidosPorCategoria: Record<string, number>,
): ProgressoDaFase[] {
  const linhas = fases.map((f, i) => {
    const total = f.categorias.reduce((s, c) => s + (totalPorCategoria[c] ?? 0), 0);
    const concluidos = f.categorias.reduce((s, c) => s + (concluidosPorCategoria[c] ?? 0), 0);
    return { ...f, ordem: i + 1, total, concluidos, atual: false };
  });

  // A fase actual é a primeira que ainda tem trabalho. Estando tudo fechado,
  // é a última — o utilizador está na auditoria, não no vazio.
  const i = linhas.findIndex((l) => l.total > 0 && l.concluidos < l.total);
  const indiceAtual = i >= 0 ? i : linhas.length - 1;
  if (linhas[indiceAtual]) linhas[indiceAtual].atual = true;
  return linhas;
}
