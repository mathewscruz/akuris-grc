/**
 * Os nomes das fases de trabalho de cada framework.
 *
 * Nome de RESULTADO, nunca de atividade: "Escopo fechado" e não "Definir
 * escopo". O leigo precisa de saber o que TEM no fim de cada etapa, e a última
 * termina sempre na auditoria — um programa de conformidade sem fim visível
 * parece infinito, e é aí que as pessoas desistem.
 *
 * A estrutura (que categoria pertence a que fase) vive em `lib/gap-fases.ts`;
 * aqui só o texto. Uma guarda impede que uma categoria fique sem fase.
 *
 * O bloco inglês repetia o português: os rótulos estavam traduzidos e as 48
 * frases das fases não, por isso a aplicação em inglês mostrava «Plano de
 * trabalho» como «Work plan» e a seguir «Escopo fechado». Repetir mantinha a
 * paridade de CHAVES e nenhuma paridade de língua — e quem lê o plano de
 * trabalho é precisamente quem ainda não conhece a norma.
 */
export const gapFases = {
  pt: {
    gapFases: {
      titulo: 'Plano de trabalho',
      subtitulo: 'Quatro etapas até a auditoria. Clique numa delas para ver só os requisitos daquela fase.',
      agora: 'você está aqui',
      progresso: '{feitos} de {total} em conformidade',
      semanas: '{semanas} semanas',
      verRequisitos: 'ver requisitos',
      pilula: 'Fase:',
      iso27001: {
        escopo: { nome: 'Escopo fechado', resultado: 'Está escrito quais áreas e sistemas entram na certificação, quem responde por eles e que gente, tempo e dinheiro a empresa vai colocar nisso.' },
        programa: { nome: 'Programa no papel', resultado: 'Você tem a lista dos riscos da empresa, a decisão do que fazer com cada um e as políticas aprovadas e publicadas para as pessoas seguirem.' },
        controles: { nome: 'Controles no ar', resultado: 'As regras saíram do papel: o time foi treinado e checado na contratação, o escritório está protegido e os sistemas estão configurados do jeito que a política manda.' },
        auditoria: { nome: 'Pronto para o certificado', resultado: 'O sistema já rodou meses gerando registros, a auditoria interna encontrou e corrigiu as falhas e a diretoria assinou a análise; o auditor de fora pode marcar a visita.' },
      },
      lgpd: {
        mapa: { nome: 'Mapa dos dados pronto', resultado: 'Você sabe quais dados de pessoas a empresa guarda, de onde eles vieram e qual é a justificativa da lei que permite usar cada um.' },
        responsaveis: { nome: 'Responsáveis no lugar', resultado: 'A empresa nomeou o encarregado, que é a pessoa que fala com a autoridade e com os clientes, definiu o papel de cada fornecedor que toca nos dados e sabe quais dados saem do Brasil.' },
        titular: { nome: 'Titular atendido', resultado: 'Qualquer pessoa consegue pedir cópia ou exclusão dos seus dados e receber resposta no prazo, e existem medidas de segurança e um plano pronto para o caso de vazamento.' },
        anpd: { nome: 'Pronto para a ANPD', resultado: 'Se a autoridade bater na porta, você tem documento para mostrar que a empresa cumpre a lei, e a diretoria sabe exatamente o que está em jogo se não cumprir.' },
      },
      soc2: {
        governanca: { nome: 'Governança montada', resultado: 'A empresa tem dono para a segurança, uma lista de riscos revisada e a estrutura de decisão que o auditor pede logo na primeira conversa.' },
        seguranca: { nome: 'Segurança no ar', resultado: 'Os controles básicos que todo relatório SOC 2 exige estão funcionando: acesso aos sistemas, controle de mudanças, tratamento da informação e comunicação interna.' },
        promessas: { nome: 'Promessas ao cliente cobertas', resultado: 'Além da segurança, estão implantados os compromissos que você vende no contrato: sistema no ar, processamento correto, sigilo e privacidade dos dados do cliente.' },
        auditor: { nome: 'Pronto para o auditor', resultado: 'Os controles rodaram por vários meses seguidos deixando rastro, o monitoramento pegou o que falhou e você já corrigiu; é justamente esse período que o auditor vai examinar.' },
      },
      nistCsf: {
        direcao: { nome: 'Direção definida', resultado: 'A diretoria decidiu quem responde por segurança, quanto risco a empresa aceita correr e colocou isso numa política escrita e aprovada.' },
        inventario: { nome: 'Inventário na mão', resultado: 'Existe a lista dos sistemas, dos dados e dos fornecedores que a empresa usa, com a avaliação de quais deles trazem mais risco.' },
        defesas: { nome: 'Defesas e alarmes ligados', resultado: 'Os acessos estão controlados, os dados e as máquinas protegidos, o time treinado, e há monitoramento avisando quando alguma coisa foge do normal.' },
        avaliacao: { nome: 'Pronto para a avaliação', resultado: 'Existe plano de resposta e de volta ao ar já testado num exercício de mentira, e o que o teste mostrou virou melhoria; a empresa aguenta uma avaliação feita por gente de fora.' },
      },
      pciDss: {
        ambiente: { nome: 'Ambiente do cartão cercado', resultado: 'Você sabe exatamente quais máquinas e redes tocam no número do cartão, elas estão separadas do resto da empresa e configuradas com segurança.' },
        dadoProtegido: { nome: 'Número do cartão protegido', resultado: 'O dado do cartão fica guardado de forma ilegível, viaja criptografado pela internet e só permanece na empresa pelo tempo necessário.' },
        acesso: { nome: 'Acesso sob controle', resultado: 'Só quem precisa entra nos sistemas de cartão, cada pessoa tem login próprio com segundo fator, e a entrada física às máquinas é restrita e registrada.' },
        auditor: { nome: 'Pronto para o auditor do cartão', resultado: 'Os sistemas passam por varredura e teste de invasão nos prazos exigidos, os registros de acesso são guardados, e você tem em mãos os relatórios que o auditor credenciado pede.' },
      },
      gdpr: {
        baseLegal: { nome: 'Base legal definida', resultado: 'Está claro se a lei europeia se aplica ao seu caso, quais dados de pessoas você trata e qual é a justificativa legal de cada um desses usos.' },
        programa: { nome: 'Programa montado', resultado: 'A empresa definiu se é controladora ou operadora, nomeou o encarregado quando exigido, ajustou os contratos com fornecedores e tem processo escrito para avisar vazamento em 72 horas.' },
        direitos: { nome: 'Direitos atendidos', resultado: 'Qualquer cidadão europeu consegue pedir, corrigir ou apagar seus dados e ter resposta no prazo, e os dados que saem da Europa estão cobertos por uma garantia válida.' },
        autoridade: { nome: 'Pronto para a autoridade', resultado: 'Você sabe qual autoridade europeia fiscaliza a sua empresa, como ela age junto com as dos outros países, e o que a empresa arrisca em multa e processo se falhar.' },
      },
    },
  },
  en: {
    gapFases: {
      titulo: 'Work plan',
      subtitulo: 'Four stages to the audit. Click one to see only that stage\u2019s requirements.',
      agora: 'you are here',
      progresso: '{feitos} of {total} compliant',
      semanas: '{semanas} weeks',
      verRequisitos: 'view requirements',
      pilula: 'Stage:',
      iso27001: {
        escopo: { nome: 'Scope closed', resultado: 'It is written down which areas and systems fall inside the certification, who answers for them, and what people, time and money the company will put into it.' },
        programa: { nome: 'Program on paper', resultado: 'You have the list of the company risks, the decision on what to do with each one, and the policies approved and published for people to follow.' },
        controles: { nome: 'Controls live', resultado: 'The rules have come off the paper: the team has been trained and screened at hiring, the office is protected and the systems are configured the way the policy requires.' },
        auditoria: { nome: 'Ready for the certificate', resultado: 'The system has run for months producing records, the internal audit found and fixed the failures and the board signed off the review; the outside auditor can schedule the visit.' },
      },
      lgpd: {
        mapa: { nome: 'Data map ready', resultado: 'You know which personal data the company holds, where it came from, and which basis in the law allows each one to be used.' },
        responsaveis: { nome: 'Owners in place', resultado: 'The company has appointed the data protection officer, who is the person who speaks to the authority and to customers, has defined the role of every supplier that touches the data, and knows which data leaves Brazil.' },
        titular: { nome: 'Data subject served', resultado: 'Anyone can ask for a copy or the deletion of their data and get an answer within the deadline, and there are security measures and a plan ready for a breach.' },
        anpd: { nome: 'Ready for the ANPD', resultado: 'If the authority comes knocking, you have documents to show that the company complies with the law, and the board knows exactly what is at stake if it does not.' },
      },
      soc2: {
        governanca: { nome: 'Governance in place', resultado: 'The company has an owner for security, a reviewed risk list and the decision-making structure the auditor asks about in the very first conversation.' },
        seguranca: { nome: 'Security live', resultado: 'The basic controls every SOC 2 report requires are working: system access, change control, information handling and internal communication.' },
        promessas: { nome: 'Customer promises covered', resultado: 'Beyond security, the commitments you sell in the contract are in place: the system stays up, processing is correct, and customer data is kept confidential and private.' },
        auditor: { nome: 'Ready for the auditor', resultado: 'The controls have run for several months in a row leaving a trail, monitoring caught what failed and you have already fixed it; that period is exactly what the auditor will examine.' },
      },
      nistCsf: {
        direcao: { nome: 'Direction set', resultado: 'The board has decided who answers for security and how much risk the company accepts, and has put that into a written and approved policy.' },
        inventario: { nome: 'Inventory in hand', resultado: 'There is a list of the systems, the data and the suppliers the company uses, with an assessment of which of them carry the most risk.' },
        defesas: { nome: 'Defenses and alarms on', resultado: 'Access is controlled, data and machines are protected, the team is trained, and monitoring raises an alert when something departs from the normal.' },
        avaliacao: { nome: 'Ready for the assessment', resultado: 'There is a response and recovery plan already tried out in a drill, and what the drill revealed became an improvement; the company can withstand an assessment run by outsiders.' },
      },
      pciDss: {
        ambiente: { nome: 'Card environment fenced off', resultado: 'You know exactly which machines and networks touch the card number, they are separated from the rest of the company and configured securely.' },
        dadoProtegido: { nome: 'Card number protected', resultado: 'Card data is stored unreadable, travels encrypted over the internet and stays in the company only for as long as it is needed.' },
        acesso: { nome: 'Access under control', resultado: 'Only those who need it get into the card systems, each person has a login of their own with a second factor, and physical entry to the machines is restricted and recorded.' },
        auditor: { nome: 'Ready for the card auditor', resultado: 'The systems go through scanning and penetration testing within the required deadlines, access logs are retained, and you have in hand the reports the accredited auditor asks for.' },
      },
      gdpr: {
        baseLegal: { nome: 'Legal basis defined', resultado: 'It is clear whether European law applies to your case, which personal data you process and what the legal basis is for each of those uses.' },
        programa: { nome: 'Program in place', resultado: 'The company has settled whether it is a controller or a processor, appointed the data protection officer where required, adjusted supplier contracts, and has a written process to report a breach within 72 hours.' },
        direitos: { nome: 'Rights served', resultado: 'Any European citizen can ask for, correct or erase their data and get an answer within the deadline, and data leaving Europe is covered by a valid safeguard.' },
        autoridade: { nome: 'Ready for the authority', resultado: 'You know which European authority supervises your company, how it acts alongside those of other countries, and what the company risks in fines and litigation if it fails.' },
      },
    },
  },
};
