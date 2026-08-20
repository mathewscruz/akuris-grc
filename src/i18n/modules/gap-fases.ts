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
 * O bloco inglês repete o português de propósito: o conteúdo destas fases foi
 * escrito para o mercado brasileiro e ainda não foi traduzido. Repetir é
 * honesto e mantém a paridade de chaves; inventar uma tradução automática de
 * texto de conformidade não é.
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
};
