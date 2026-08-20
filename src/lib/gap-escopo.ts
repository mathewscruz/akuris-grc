/**
 * O assistente de escopo: as perguntas que encurtam a lista antes de a pessoa a ver.
 *
 * Ao activar a ISO 27001 o utilizador recebia 121 linhas em branco e a
 * instrução implícita de as classificar uma a uma. Nenhum concorrente começa
 * assim: Vanta, Drata, Sprinto e Secureframe abrem por **contexto**, não por
 * conteúdo, e a resposta a esse contexto recorta a norma antes de a mostrar.
 * Na Drata a marcação In Scope/Out of Scope com justificação escrita *é*
 * literalmente a Declaração de Aplicabilidade.
 *
 * É o que isto faz. São perguntas que uma pessoa leiga responde sem consultar
 * ninguém — "a empresa desenvolve software próprio?" — e cada NÃO retira do
 * escopo os requisitos que não têm objeto naquela realidade, gravando a
 * justificativa já redigida para um auditor ler.
 *
 * Três regras que valem mais do que a lista:
 *
 *  - **Na dúvida, não exclui.** Lista maior é chatice; exclusão indevida é
 *    reprovação na auditoria. Onde não se podia excluir com segurança, a
 *    pergunta não existe.
 *  - **Nada é obrigatório do sistema de gestão.** As cláusulas 4 a 10 da ISO
 *    nunca saem, responda o que responder.
 *  - **A pessoa confirma antes de gravar.** A justificativa afirma factos sobre
 *    a empresa ("todas as pessoas trabalham de casa") que só quem lá está pode
 *    confirmar. Fica editável, e quem confirmou fica registado.
 *
 * Os códigos foram validados um a um contra `gap_analysis_requirements`: um
 * código inventado não daria erro nenhum, apenas deixaria de excluir em
 * silêncio. Uma guarda impede que voltem a entrar.
 */

export interface PerguntaDeEscopo {
  id: string;
  /** Sim ou não, em linguagem de quem nunca leu a norma. */
  pergunta: string;
  /** Uma frase que desambigua, para a pessoa não responder errado sem perceber. */
  ajuda: string;
  /** Requisitos que saem do escopo quando a resposta é NÃO. Códigos reais. */
  codigos: string[];
  /** O texto que fica gravado na Declaração de Aplicabilidade. */
  justificativa: string;
  /** O que NÃO sai, mesmo com esta resposta. Mostrado junto da pergunta. */
  nuncaExcluir?: string;
  /** Aviso sobre o próprio dado do sistema, quando ele é conhecidamente frágil. */
  aviso?: string;
}

/**
 * Combinações impossíveis.
 *
 * Sem isto, quem respondesse NÃO a "a empresa ocupa algum endereço?" e NÃO a
 * "alguém trabalha fora do escritório?" produzia uma Declaração que exclui a
 * segurança física inteira E o trabalho remoto: uma empresa que não existe em
 * lado nenhum. O auditor recusa, e com razão.
 */
export interface TravaDeEscopo {
  /** [idDaPergunta, resposta] que dispara a trava. */
  se: [string, 'sim' | 'nao'];
  /** [idDaPergunta, resposta] que passa a ser forçada. */
  entao: [string, 'sim' | 'nao'];
  /** A razão, dita ao utilizador. */
  porque: string;
}

export interface AssistenteDeEscopo {
  intro: string;
  perguntas: PerguntaDeEscopo[];
  travas?: TravaDeEscopo[];
}

export const ESCOPO_POR_FRAMEWORK: Record<string, AssistenteDeEscopo> = {
  iso27001: {
    intro: 'Estas nove perguntas descrevem como a sua empresa funciona de verdade (onde as pessoas trabalham, que equipamentos existem e quem escreve os sistemas), e cada resposta "não" tira da sua lista os controles do Anexo A que não têm objeto na sua realidade, já com a justificativa escrita para o auditor ler; as exigências de gestão das cláusulas 4 a 10 nunca saem, porque a norma não permite excluir nenhuma delas.',
    perguntas: [
      {
        id: 'instalacoes_proprias',
        pergunta: 'A empresa ocupa algum endereço físico onde as pessoas trabalham, como escritório, loja, galpão, fábrica ou sala em coworking?',
        ajuda: 'Responda sim se existe qualquer espaço que a empresa possui, aluga ou usa de forma exclusiva, mesmo que seja uma sala pequena, e responda não apenas se todo mundo trabalha de casa e a empresa não mantém nenhum endereço.',
        codigos: ['A.7.1', 'A.7.2', 'A.7.3', 'A.7.4', 'A.7.6', 'A.7.11', 'A.7.12'],
        justificativa: 'A organização não ocupa nem controla qualquer instalação física. Todas as pessoas trabalham a partir de residências particulares e todo o processamento de informação ocorre em serviços contratados pela internet. Não existem perímetros, salas, entradas, serviços de apoio predial nem cabeamento sob responsabilidade da organização a serem protegidos. A segurança física dos ambientes onde a informação é processada é obrigação contratual dos provedores e está tratada em A.5.19, A.5.22 e A.5.23; a proteção dos equipamentos e da informação fora de instalações está tratada em A.6.7, A.7.9 e A.8.1. Esta condição será reavaliada se a organização passar a ocupar qualquer endereço.',
        nuncaExcluir: 'Mesmo sem escritório continuam no escopo A.7.5, A.7.7, A.7.8, A.7.9, A.7.10, A.7.13 e A.7.14, porque a empresa segue responsável pelos equipamentos que entrega às pessoas, pela regra de mesa e tela limpa no trabalho em casa, pelas mídias e pelo descarte seguro desses equipamentos.',
      },
      {
        id: 'area_de_acesso_restrito',
        pergunta: 'Existe algum espaço dentro da empresa em que só algumas pessoas podem entrar, como sala de servidores, sala de rede, arquivo trancado, cofre ou sala reservada?',
        ajuda: 'Conta qualquer ambiente cujo acesso é limitado por chave, crachá ou senha, inclusive uma sala pequena onde fica o rack de rede, e se qualquer colaborador pode circular por todo o espaço a resposta é não.',
        codigos: ['A.7.6'],
        justificativa: 'A organização não possui áreas seguras. As instalações consistem em um espaço único de escritório, acessível a todos os colaboradores autorizados a entrar no imóvel, sem sala de servidores, sala técnica, cofre ou arquivo de acesso restrito. Não existindo área segura definida, não há trabalho em área segura a ser regulado. O controle de quem entra e circula nas instalações permanece aplicável e está tratado em A.7.1, A.7.2, A.7.3 e A.7.4.',
        nuncaExcluir: 'Não ter sala restrita não dispensa controlar quem entra no escritório: A.7.1, A.7.2, A.7.3 e A.7.4 continuam no escopo enquanto a empresa ocupar qualquer endereço.',
      },
      {
        id: 'cabeamento_ou_equipamento_no_escritorio',
        pergunta: 'Existe cabo de rede, rack, switch, roteador, servidor, storage, nobreak ou central telefônica instalado pela empresa no escritório?',
        ajuda: 'Olhe embaixo das mesas e no armário de rede: se as pessoas conectam o computador por cabo, ou se há qualquer equipamento da empresa ligado o tempo todo, responda sim, e responda não somente se tudo funciona pela rede sem fio do prédio e existem apenas notebooks.',
        codigos: ['A.7.12'],
        justificativa: 'A organização não instalou nem opera cabeamento de dados ou de energia próprio nas instalações que ocupa. Os colaboradores usam notebooks ligados por rede sem fio fornecida e mantida pelo locador do imóvel, e não existem racks, equipamentos de rede, servidores ou linhas dedicadas sob responsabilidade da organização. A proteção do cabeamento do imóvel é obrigação do locador e é acompanhada como serviço de fornecedor em A.5.19 e A.5.22.',
        nuncaExcluir: 'A.7.11 permanece no escopo mesmo sem equipamento próprio, porque a operação continua dependendo da energia elétrica e da internet do imóvel, e a norma espera que a empresa avalie o efeito de uma queda desses serviços.',
      },
      {
        id: 'trabalho_fora_das_instalacoes',
        pergunta: 'Alguma pessoa trabalha fora do escritório em algum momento, em casa, no cliente ou em viagem, levando consigo notebook, celular ou documentos da empresa?',
        ajuda: 'Basta um caso ocasional para a resposta ser sim, como o diretor que abre o e-mail do celular no fim de semana ou o vendedor que leva o notebook até o cliente.',
        codigos: ['A.6.7', 'A.7.9'],
        justificativa: 'A organização não pratica trabalho remoto sob qualquer forma e nenhum ativo de informação sai das suas instalações. Todo o trabalho é realizado presencialmente, em equipamentos fixos que permanecem no escritório, sem acesso remoto aos sistemas e sem uso de dispositivos móveis corporativos ou pessoais para fins de trabalho. Não havendo atividade fora das instalações nem ativos fora do perímetro, não há o que regular nestes controles. A autorização de qualquer trabalho remoto, ainda que pontual, reativará ambos os controles.',
        nuncaExcluir: 'A.8.1 e A.7.7 continuam aplicáveis, porque os computadores dentro do escritório seguem sendo dispositivos de usuário final e a regra de mesa e tela limpa vale igualmente no trabalho presencial.',
      },
      {
        id: 'servicos_em_nuvem',
        pergunta: 'A empresa usa algum serviço pela internet para guardar arquivos, trocar e-mails ou rodar sistemas, como Google Workspace, Microsoft 365, Dropbox, ERP online, sistema de RH ou de contabilidade?',
        ajuda: 'Se o sistema é acessado pelo navegador e a empresa paga uma mensalidade, em vez de instalar o programa em um servidor próprio, isso é serviço em nuvem e a resposta é sim.',
        codigos: ['A.5.23'],
        justificativa: 'A organização não utiliza serviços em nuvem. Todos os sistemas, o correio eletrônico e os arquivos são executados e armazenados em infraestrutura própria, instalada e operada nas instalações da organização, sem contratação de processamento ou armazenamento de terceiros pela internet. A contratação de qualquer serviço em nuvem passará pelo processo de aquisição e tornará este controle aplicável novamente.',
        nuncaExcluir: 'A.5.19, A.5.20, A.5.21 e A.5.22 continuam no escopo, porque mesmo sem nuvem a empresa compra equipamentos, software e suporte de fornecedores, e esses contratos precisam de exigências de segurança.',
      },
      {
        id: 'desenvolvimento_interno',
        pergunta: 'Alguma pessoa que trabalha na empresa escreve ou altera código de programa, como o site, um aplicativo, uma integração entre sistemas ou uma automação?',
        ajuda: 'É sim se existe qualquer pessoa, mesmo uma só e mesmo em tempo parcial, que programa para a empresa, incluindo scripts, macros de planilha e telas criadas em ferramentas de baixo código.',
        codigos: ['A.8.25', 'A.8.27', 'A.8.28'],
        justificativa: 'A organização não desenvolve software internamente. Não existem atividades de programação, de definição de arquitetura de sistemas nem de codificação realizadas por pessoal próprio, e a organização utiliza sistemas adquiridos de terceiros. Os requisitos de segurança do software que a organização usa são estabelecidos no processo de aquisição e nos contratos com fornecedores, tratados em A.5.19 a A.5.22, e o desenvolvimento eventualmente contratado a terceiros é tratado em A.8.30. A contratação de pessoal de desenvolvimento tornará estes controles aplicáveis novamente.',
        nuncaExcluir: 'A.8.26, A.8.29, A.8.31, A.8.32 e A.8.33 não saem por esta resposta, porque valem também para sistemas comprados prontos: a empresa continua definindo o que exige do software, aceitando novas versões, separando ambientes e controlando mudanças.',
      },
      {
        id: 'codigo_fonte_proprio',
        pergunta: 'A empresa guarda em algum lugar o código-fonte de algum sistema, seja escrito por ela, seja entregue por um fornecedor?',
        ajuda: 'Código-fonte é o texto do programa, normalmente guardado em ferramentas como GitHub, GitLab, Bitbucket ou Azure DevOps, ou em uma pasta de rede, e se a empresa só recebe programas prontos para instalar ou usar a resposta é não.',
        codigos: ['A.8.4'],
        justificativa: 'A organização não detém código-fonte de qualquer sistema. Não desenvolve software e não recebe código-fonte dos seus fornecedores, que entregam software executável ou serviços acessados pela internet. Não existindo repositório, biblioteca ou cópia de código-fonte sob controle da organização, não há acesso a código-fonte a restringir. O recebimento de código-fonte de um fornecedor, inclusive por cláusula de custódia, tornará este controle aplicável novamente.',
        nuncaExcluir: 'A.8.2 e A.8.3 continuam no escopo, porque a restrição de acesso à informação e o controle de contas com privilégios elevados valem para todos os sistemas, inclusive os comprados prontos.',
      },
      {
        id: 'desenvolvimento_terceirizado',
        pergunta: 'A empresa paga alguma pessoa ou empresa de fora para construir, personalizar ou manter um sistema feito sob medida para ela?',
        ajuda: 'Inclui fábrica de software, agência que fez o site, programador autônomo e o fornecedor que faz customizações no ERP, e comprar um sistema pronto sem alterações escritas para a empresa não conta.',
        codigos: ['A.8.30'],
        justificativa: 'A organização não contrata desenvolvimento de software a terceiros. Não existem sistemas feitos sob medida para a organização nem customizações programadas por fornecedores: todos os sistemas em uso são produtos padronizados de mercado, adquiridos como licença ou como serviço, sem alteração de código. Não havendo desenvolvimento terceirizado, não há atividade de desenvolvimento a dirigir, monitorar e revisar. A relação com os fornecedores desses produtos é tratada em A.5.19 a A.5.22.',
        nuncaExcluir: 'A.5.19, A.5.20, A.5.21 e A.5.22 nunca saem por esta resposta, porque quem fornece o sistema pronto continua sendo um fornecedor com acesso a informação da empresa.',
      },
      {
        id: 'copia_dados_para_teste',
        pergunta: 'A empresa copia informações reais dos sistemas em uso para ambientes de teste, de treinamento ou de demonstração?',
        ajuda: 'Pense em cópias do banco de dados para testar uma atualização, em um ambiente de homologação com dados de clientes verdadeiros ou em uma base de treinamento montada a partir da base real, e se nada disso acontece a resposta é não.',
        codigos: ['A.8.33'],
        justificativa: 'A organização não utiliza informação de teste. Não mantém ambientes de teste, homologação, treinamento ou demonstração alimentados com dados, e não realiza cópias de informação operacional para fins de teste. Não existindo informação de teste, não há seleção, proteção nem controle desse tipo de informação a executar. A criação de qualquer ambiente com dados para teste tornará este controle aplicável novamente.',
        nuncaExcluir: 'A.8.31 e A.8.32 continuam no escopo, porque mudanças em sistemas em produção precisam ser controladas mesmo sem ambiente de teste, e o auditor vai querer ver como uma atualização é aprovada antes de entrar no ar.',
      },
    ],
    travas: [
      { se: ['instalacoes_proprias', 'nao'], entao: ['trabalho_fora_das_instalacoes', 'sim'], porque: 'Se ninguém tem escritório, então todo mundo trabalha fora dele.' },
      { se: ['instalacoes_proprias', 'nao'], entao: ['servicos_em_nuvem', 'sim'], porque: 'Sem escritório e sem nuvem a empresa não teria onde guardar nada.' },
      { se: ['desenvolvimento_interno', 'sim'], entao: ['codigo_fonte_proprio', 'sim'], porque: 'Quem escreve código tem código-fonte guardado em algum lugar.' },
    ],
  },
  lgpd: {
    intro: 'A LGPD é lei brasileira e quase tudo nela vale para a sua empresa: estas nove perguntas separam apenas os artigos que existem para quem faz um tipo específico de tratamento, e cada resposta NÃO já sai com a justificativa escrita que o auditor vai ler no seu documento de aplicabilidade.',
    perguntas: [
      {
        id: 'dados_de_menores_de_18',
        pergunta: 'A empresa guarda dados de alguma pessoa com menos de 18 anos?',
        ajuda: 'Responda SIM se o plano de saúde ou o seguro de vida dos funcionários inclui filhos, se a empresa pede dados de dependentes para o imposto de renda, se tem estagiário ou jovem aprendiz menor de idade, ou se algum cliente, aluno ou visitante do site pode ter menos de 18 anos. Se nada disso acontece, responda NÃO.',
        codigos: ['Art. 14'],
        justificativa: 'A organização não realiza qualquer tratamento de dados pessoais de crianças ou adolescentes. Nenhum produto, serviço, canal de atendimento ou processo interno se dirige a pessoas menores de 18 anos, e os benefícios concedidos aos empregados não abrangem dependentes menores de idade. Não há, portanto, tratamento a ser realizado no melhor interesse do menor nem consentimento específico e em destaque de pai, mãe ou responsável legal a ser coletado e demonstrado. Este artigo retornará ao escopo caso a organização passe a tratar dados de menores, hipótese em que a avaliação será refeita antes do início do tratamento.',
        nuncaExcluir: 'Responder NÃO aqui não tira do escopo o consentimento em geral (Art. 8º), a revogação do consentimento (Art. 9º) nem os dados sensíveis (Art. 11). Atenção: filho de funcionário no plano de saúde já é dado de criança. Na dúvida, responda SIM.',
      },
      {
        id: 'dados_guardados_fora_do_brasil',
        pergunta: 'Algum dado de pessoas fica guardado fora do Brasil ou é enviado para outro país?',
        ajuda: 'Quase toda empresa responde SIM. Conte SIM se usa Gmail, Google Workspace, Microsoft 365, Outlook, Dropbox, AWS, Azure, Salesforce, HubSpot, Slack, ChatGPT ou qualquer sistema de empresa estrangeira; se guarda backup em nuvem; ou se manda planilha com nome de funcionário ou de cliente para matriz, filial, sócio ou fornecedor em outro país. Só responda NÃO se todos os sistemas e servidores ficarem no Brasil e nenhum dado sair do país.',
        codigos: ['Art. 33', 'Art. 34', 'Art. 35', 'Art. 36'],
        justificativa: 'A organização não realiza transferência internacional de dados pessoais. Todo o tratamento ocorre em território brasileiro, em sistemas e infraestrutura contratados de fornecedores nacionais, sem envio, acesso remoto ou armazenamento de dados pessoais no exterior e sem compartilhamento com matriz, filial, sócio ou parceiro sediado em outro país. Não há, portanto, hipótese de transferência a enquadrar, país de destino cujo nível de proteção deva ser avaliado, cláusulas contratuais específicas ou cláusulas-padrão a firmar, nem mecanismo de cooperação internacional a acionar. Estes artigos retornam ao escopo, com avaliação prévia à contratação, caso a organização venha a contratar serviço com armazenamento ou acesso a dados pessoais fora do Brasil.',
        nuncaExcluir: 'Mesmo com tudo no Brasil, continuam obrigatórios os deveres de segurança (Art. 46 e Art. 49), a responsabilidade sobre o fornecedor que trata dados em nome da empresa (Art. 39 e Art. 44) e o registro dessas operações (Art. 37). Se a empresa usa e-mail do Google ou da Microsoft, a resposta é SIM.',
      },
      {
        id: 'decisao_automatica_sobre_pessoas',
        pergunta: 'Algum sistema da empresa decide sozinho alguma coisa sobre uma pessoa, sem ninguém revisar?',
        ajuda: 'Exemplos de SIM: sistema que aprova ou nega crédito, limite ou parcelamento; site que calcula preço ou desconto diferente para cada cliente; ferramenta de recrutamento que descarta currículos automaticamente; antifraude que bloqueia conta ou compra na hora; sistema que dá nota ou pontuação a clientes e trata cada faixa de um jeito. Se sempre existe uma pessoa que analisa e aprova antes de a decisão valer, responda NÃO.',
        codigos: ['Art. 21'],
        justificativa: 'A organização não adota decisões tomadas unicamente com base em tratamento automatizado de dados pessoais. Toda decisão que afete interesses de titulares, incluindo concessão de crédito, seleção de candidatos, precificação, bloqueio de acesso e recusa de atendimento, é analisada e aprovada por pessoa natural antes de produzir efeitos, e os sistemas utilizados apenas apoiam essa análise. Não existe, portanto, decisão automatizada passível de pedido de revisão pelo titular, tampouco definição de perfil pessoal, profissional, de consumo ou de crédito feita exclusivamente por sistema. Este artigo retorna ao escopo caso a organização implante qualquer automação com decisão final sem intervenção humana.',
        nuncaExcluir: 'Isto não retira do escopo os demais direitos do titular (Art. 18), a confirmação e o acesso aos dados em até 15 dias (Art. 19) nem a portabilidade (Art. 20). Sistema que só sugere e uma pessoa aprova é NÃO; sistema que já bloqueia, já recusa ou já elimina é SIM.',
      },
      {
        id: 'vinculo_com_o_setor_publico',
        pergunta: 'A empresa é do setor público ou recebe cadastros de pessoas cedidos por algum órgão público?',
        ajuda: 'Responda SIM se a empresa é órgão, autarquia, fundação pública, empresa pública ou sociedade de economia mista; ou se recebe listas e bases com dados de pessoas entregues por prefeitura, governo estadual, ministério ou autarquia, por convênio, contrato ou participação em programa social. Enviar dados ao governo por obrigação legal, como eSocial, Receita Federal, Caged ou nota fiscal, NÃO conta aqui e não muda a resposta. Prestar serviço para o governo também não conta, desde que a empresa não receba cadastros de pessoas do órgão.',
        codigos: ['Art. 26', 'Art. 27'],
        justificativa: 'A organização é pessoa jurídica de direito privado e não integra a administração pública direta ou indireta. Não recebe de órgãos ou entidades do Poder Público, por convênio, contrato administrativo ou participação em programa governamental, bases de dados pessoais, e não realiza uso compartilhado de dados pessoais na execução de políticas públicas. Por essa razão não lhe são exigíveis: o uso compartilhado de dados pelo Poder Público vinculado a finalidades específicas de políticas públicas e a atribuição legal dos órgãos públicos (Art. 26) e a informação à Agência Nacional de Proteção de Dados sobre comunicação ou uso compartilhado de dados de pessoa jurídica de direito público para pessoa de direito privado (Art. 27). Caso a organização venha a firmar convênio ou contrato que envolva a cessão de bases de dados pessoais por ente público, estes artigos retornarão ao escopo.',
        nuncaExcluir: 'O relatório de impacto que a ANPD pode exigir de qualquer controlador privado (Art. 32 e Art. 38) continua no escopo e não sai por esta pergunta. Atenção: no sistema, os títulos destes quatro artigos estão trocados em relação ao texto que descrevem, então confira a descrição antes de confirmar a exclusão.',
      },
      {
        id: 'atuacao_em_saude_ou_pesquisa',
        pergunta: 'A empresa é da área de saúde ou faz pesquisa científica com dados de pessoas?',
        ajuda: 'Responda SIM se a empresa é hospital, clínica, laboratório, operadora de plano de saúde, farmacêutica, fabricante de equipamento médico, universidade, instituto de pesquisa, ou se participa de estudos clínicos e epidemiológicos. Oferecer plano de saúde aos funcionários não faz a empresa ser da área de saúde: nesse caso, responda NÃO.',
        codigos: ['Art. 13'],
        justificativa: 'A organização não é órgão de pesquisa e não atua no setor de saúde. Não realiza nem apoia estudos em saúde pública, pesquisas clínicas ou levantamentos epidemiológicos com dados pessoais, e não mantém base de dados constituída para essa finalidade. Não se vale, portanto, da hipótese de tratamento para realização de estudos por órgão de pesquisa nem da dispensa de consentimento a ela associada, e não há procedimento de anonimização para fins de pesquisa a ser demonstrado.',
        nuncaExcluir: 'Atestado médico, exame admissional e periódico, dados do plano de saúde e afastamento pelo INSS são dados pessoais sensíveis de qualquer empresa. Eles continuam no escopo pelo Art. 11, que não sai por esta pergunta.',
      },
      {
        id: 'dados_entregues_a_outra_empresa',
        pergunta: 'A empresa entrega dados de pessoas para outra empresa usar por conta própria?',
        ajuda: 'Responda SIM se manda dados de funcionários ou de clientes para operadora de plano de saúde, seguradora, banco onde a folha é paga, empresa de vale-refeição ou vale-transporte, birô de crédito como Serasa ou Boa Vista, parceiro comercial que recebe lista de clientes, ou se vende, troca ou cede contatos. Contratar fornecedor que apenas executa uma tarefa seguindo as ordens da empresa, como contabilidade, sistema de folha, call center ou nuvem, NÃO conta aqui.',
        codigos: ['Art. 12'],
        justificativa: 'A organização não realiza comunicação nem uso compartilhado de dados pessoais com outros controladores. Os dados pessoais sob sua responsabilidade são tratados exclusivamente para as finalidades por ela definidas e, quando há participação de terceiros, estes atuam na qualidade de operadores, tratando os dados apenas conforme instruções documentadas da organização, o que é avaliado nos artigos relativos ao operador e à segurança do tratamento. Não há transferência ou disponibilização de dados pessoais a terceiro que os utilize para finalidade própria e, por consequência, não há enquadramento em hipótese legal a demonstrar para uso compartilhado entre controladores.',
        nuncaExcluir: 'Se a empresa tem plano de saúde, seguro de vida, vale-refeição ou paga a folha por um banco, a resposta é SIM. Responder NÃO também não retira as obrigações sobre fornecedores que tratam dados em nome da empresa (Art. 39 e Art. 44) nem o registro das operações (Art. 37).',
        aviso: 'No sistema, o texto deste artigo não corresponde ao artigo da lei; confira a descrição do requisito antes de confirmar a exclusão.',
      },
      {
        id: 'uso_de_dados_nao_pedido_pela_pessoa',
        pergunta: 'A empresa usa dados de pessoas para alguma finalidade que a própria pessoa não pediu e que nenhum contrato ou lei exige?',
        ajuda: 'Exemplos de SIM: prospectar clientes a partir de listas compradas ou de contatos coletados na internet, acompanhar o comportamento de quem navega no site para oferecer produtos, usar dados de clientes para prevenção a fraude, completar cadastros com informações compradas de terceiros, monitorar funcionários além do que a lei trabalhista exige. Se todo uso de dados nasce de um pedido da própria pessoa, de um contrato assinado ou de uma exigência legal, responda NÃO. Responda SIM se a empresa tem câmera de segurança, catraca, crachá ou biometria, ou se guarda registro de quem entrou em cada sistema: isso é legítimo interesse e quase toda empresa tem.',
        codigos: ['Art. 10'],
        justificativa: 'A organização não se vale da hipótese legal de legítimo interesse. Todas as suas operações de tratamento de dados pessoais estão fundamentadas em consentimento do titular, execução de contrato ou de procedimentos preliminares a contrato, cumprimento de obrigação legal ou regulatória, exercício regular de direitos ou proteção da vida, conforme registrado no inventário de atividades de tratamento. Não havendo tratamento fundado em legítimo interesse, não há situação concreta a fundamentar, finalidade legítima a demonstrar nem balanceamento com os direitos e liberdades fundamentais do titular a documentar. A eventual adoção futura dessa base legal exigirá a reavaliação deste artigo e a elaboração do teste de balanceamento correspondente.',
        nuncaExcluir: 'As dez bases legais do Art. 7º continuam no escopo: a empresa precisa registrar qual base usa para cada atividade. Se um dia passar a usar legítimo interesse, para antifraude ou marketing por exemplo, este artigo volta.',
      },
      {
        id: 'participacao_na_estrutura_da_anpd',
        pergunta: 'A empresa faz parte da estrutura da ANPD, o órgão do governo federal que fiscaliza a proteção de dados?',
        ajuda: 'A ANPD é a autoridade que fiscaliza e aplica multas. Alguns artigos da lei só descrevem como esse órgão é organizado por dentro, quantos diretores ele tem, e a partir de que data a lei passou a valer. Esses artigos não pedem nada da sua empresa: não há política a escrever, prova a guardar nem processo a montar. Responda SIM apenas se a empresa for a própria ANPD ou um órgão que compõe a estrutura dela. Qualquer empresa privada responde NÃO.',
        codigos: ['Art. 55-C', 'Art. 55-D'],
        justificativa: 'Os artigos 55-C e 55-D da Lei nº 13.709/2018 disciplinam a composição interna, a autonomia técnica e as competências do conselho diretor da Agência Nacional de Proteção de Dados. A organização é pessoa jurídica de direito privado e não integra a estrutura da Agência, pelo que estes dispositivos não lhe impõem obrigação alguma.',
        nuncaExcluir: 'Continuam no escopo os artigos que dizem o que a ANPD pode exigir e cobrar da empresa: Art. 55-A, Art. 55-J e Art. 55-K, além das sanções e da sua dosimetria (Art. 52, Art. 53 e Art. 54). O Art. 55-L também fica: no sistema ele aparece com o título Relatório de Impacto, e enquanto esse título não for corrigido nada que se pareça com relatório de impacto deve sair da lista.',
      },
    ],
  },
  soc2: {
    intro: 'As quatro primeiras perguntas decidem categorias inteiras do SOC 2 e podem tirar até 42 dos 63 requisitos de uma vez; as seis seguintes limpam pontos específicos do que sobrou. Os 21 requisitos de Segurança (CC1.1 a CC8.1) nunca saem, responda o que responder.',
    perguntas: [
      {
        id: 'compromisso_de_disponibilidade',
        pergunta: 'Algum contrato, proposta ou e-mail seu promete por escrito que o sistema fica no ar, que ele volta em um prazo depois de cair, ou prevê desconto e multa se ficar fora?',
        ajuda: 'Procure no contrato as palavras SLA, disponibilidade, uptime ou indisponibilidade. Se ninguém prometeu nada por escrito e o cliente nunca cobrou isso formalmente, responda NÃO.',
        codigos: ['A1.1', 'A1.2', 'A1.3', 'A2.1', 'A2.2', 'A3.1', 'A3.2', 'A4.1', 'A4.2', 'A5.1'],
        justificativa: 'A organização não assumiu, perante nenhum cliente, compromisso contratual de disponibilidade, de tempo de recuperação ou de nível de serviço quanto ao sistema incluído no escopo. Não havendo compromisso de disponibilidade a ser demonstrado, a categoria Disponibilidade (Availability) não integra o escopo deste relatório, que se limita à categoria Segurança. Caso a organização venha a assumir compromisso dessa natureza, a categoria será reincorporada ao escopo antes do início do próximo período de auditoria.',
        nuncaExcluir: 'Backup e recuperação não somem da sua lista. Mesmo sem a categoria Disponibilidade, o auditor vai testar se você consegue voltar a operar depois de um incidente de segurança, e isso está em CC7.1 e CC7.2, que são obrigatórios. Continue fazendo backup e testando restauração.',
      },
      {
        id: 'processamento_calcula_valores',
        pergunta: 'O seu sistema calcula ou gera números em nome do cliente, como folha de pagamento, cobrança, imposto, saldo, nota fiscal ou comissão, em que um valor errado causaria prejuízo financeiro direto a ele?',
        ajuda: 'Guardar, mostrar e deixar o cliente editar dados que ele mesmo digitou não conta. Conta quando o seu sistema é quem produz o número que o cliente usa para pagar, cobrar ou declarar.',
        codigos: ['PI1.1', 'PI1.2', 'PI1.3', 'PI1.4', 'PI1.5', 'PI2.1', 'PI2.2', 'PI3.1', 'PI3.2', 'PI4.1'],
        justificativa: 'O sistema incluído no escopo não executa processamento que produza resultados financeiros, fiscais ou de cálculo em nome dos clientes; limita-se a armazenar, apresentar e disponibilizar informações fornecidas pelos próprios usuários, que permanecem responsáveis pela sua exatidão. A organização não assumiu perante os clientes compromisso de completude, exatidão, validade ou tempestividade de processamento. Por esse motivo, a categoria Integridade de Processamento (Processing Integrity) não integra o escopo deste relatório.',
        nuncaExcluir: 'Se a sua empresa emite nota fiscal, fecha folha, faz conciliação bancária ou calcula comissão para o cliente, responda SIM mesmo que use um software de terceiros para isso. E não confunda: registrar o que o sistema fez continua obrigatório por CC7.1, que fica no escopo de qualquer jeito.',
      },
      {
        id: 'compromisso_de_sigilo',
        pergunta: 'Algum cliente exigiu que você tratasse as informações dele como sigilosas, seja um acordo de sigilo (NDA) assinado, uma cláusula de confidencialidade no contrato, ou o compromisso de apagar os dados quando o contrato acabar?',
        ajuda: 'Procure no contrato as palavras confidencialidade, sigilo ou NDA. Se você já assinou um acordo de sigilo com qualquer cliente, a resposta é SIM.',
        codigos: ['C1.1', 'C1.2', 'C2.1', 'C2.2', 'C3.1', 'C3.2', 'C4.1', 'C4.2'],
        justificativa: 'A organização não assumiu, perante clientes ou parceiros, compromissos específicos de confidencialidade sobre as informações tratadas no sistema incluído no escopo, nem mantém acordos de sigilo aplicáveis a esses dados. Por esse motivo, a categoria Confidencialidade (Confidentiality) não integra o escopo deste relatório. As proteções de acesso lógico, de segregação e de criptografia aplicadas a essas informações permanecem avaliadas sob os critérios comuns da categoria Segurança.',
        nuncaExcluir: 'Criptografia e controle de acesso NÃO saem. Continuam obrigatórios em CC6.1, CC6.2 e CC6.3. O que sai é só o compromisso adicional de sigilo sobre um conjunto de dados que o cliente marcou como confidencial. Quase toda empresa que vende para outra empresa já assinou algum NDA: na dúvida, responda SIM.',
      },
      {
        id: 'dados_pessoais_de_terceiros',
        pergunta: 'O sistema que vai ser auditado guarda dados de pessoas físicas que não são funcionários da sua empresa, como nome, CPF, e-mail, telefone, endereço, dados de saúde ou de pagamento?',
        ajuda: 'Dados dos seus próprios funcionários, guardados no sistema de RH, não entram nessa conta. O que conta é o cadastro dos clientes do seu cliente, ou dos usuários finais que usam o seu sistema.',
        codigos: ['P1.1', 'P2.1', 'P3.1', 'P3.2', 'P4.1', 'P4.2', 'P5.1', 'P5.2', 'P6.1', 'P6.2', 'P7.1', 'P8.1', 'P8.2', 'P9.1'],
        justificativa: 'O sistema incluído no escopo não coleta, armazena, utiliza, divulga nem descarta dados pessoais de titulares externos à organização. Os únicos dados pessoais tratados pela organização referem-se aos seus próprios colaboradores e são processados em sistemas administrativos que não integram o escopo deste relatório. Por esse motivo, a categoria Privacidade (Privacy) não integra o escopo. A organização reavaliará esta definição caso o sistema passe a tratar dados pessoais de titulares externos.',
        nuncaExcluir: 'O e-mail corporativo do contato do seu cliente já é dado pessoal. Se o seu sistema tem qualquer cadastro com nome e e-mail de gente, responda SIM. Privacidade é a categoria em que mais empresas reprovam por ter desenhado o escopo errado: na dúvida, deixe dentro.',
      },
      {
        id: 'terceiros_acessam_dados_pessoais',
        pergunta: 'Alguma empresa de fora recebe ou consegue acessar os dados pessoais guardados no seu sistema, como provedor de nuvem, ferramenta de e-mail, suporte terceirizado, BI ou escritório de cobrança?',
        ajuda: 'Só responda esta pergunta se a categoria Privacidade continuou no escopo. Conte também o provedor de nuvem (AWS, Azure, Google Cloud) e qualquer ferramenta contratada por onde esses dados passam. Responda NÃO apenas se tudo roda em servidor da própria empresa, operado exclusivamente por funcionários seus.',
        codigos: ['P6.1', 'P6.2'],
        justificativa: 'A organização não divulga, transfere nem concede acesso a dados pessoais a terceiros. A totalidade do tratamento ocorre em infraestrutura própria, operada exclusivamente por colaboradores da organização, sem participação de subcontratados, provedores de serviço ou parceiros. Não havendo divulgação a terceiros no período auditado, os critérios P6.1 e P6.2 não se aplicam. A organização submeterá qualquer terceiro futuro a avaliação prévia e a compromisso contratual de proteção de dados antes de conceder acesso.',
        nuncaExcluir: 'Se você usa qualquer nuvem, a resposta é SIM: hospedar na AWS já é dar acesso a um terceiro. Responder NÃO por engano aqui derruba a auditoria, porque a lista de fornecedores que tocam nos dados é uma das primeiras coisas que o auditor pede.',
      },
      {
        id: 'dados_pessoais_fora_do_brasil',
        pergunta: 'Os dados pessoais guardados pelo seu sistema ficam armazenados fora do Brasil, ou alguém de fora do Brasil consegue acessá-los, incluindo o suporte técnico de algum fornecedor?',
        ajuda: 'Só responda esta pergunta se a categoria Privacidade continuou no escopo. Veja em que região está a sua nuvem (us-east-1 é Estados Unidos, sa-east-1 é São Paulo) e se algum fornecedor de suporte ou de monitoramento tem equipe fora do país.',
        codigos: ['P9.1'],
        justificativa: 'Os dados pessoais tratados no sistema incluído no escopo são armazenados e processados exclusivamente em território brasileiro, e nenhum fornecedor, prestador de serviço ou colaborador situado fora do país possui acesso a eles. A organização não realizou transferência internacional de dados pessoais durante o período auditado, motivo pelo qual o critério P9.1 não se aplica. Qualquer transferência internacional futura será precedida de avaliação e das salvaguardas contratuais correspondentes.',
        nuncaExcluir: 'Se você usa Google Workspace, Microsoft 365, Slack, HubSpot, Zendesk ou qualquer ferramenta estrangeira que toque nesses dados, responda SIM mesmo que o servidor principal esteja no Brasil. O suporte dessas empresas normalmente acessa de fora do país.',
      },
      {
        id: 'integracao_automatica_entre_sistemas',
        pergunta: 'O seu sistema troca dados automaticamente com sistemas de outras empresas, por API, integração pronta, ou arquivo que entra e sai sozinho?',
        ajuda: 'Só responda esta pergunta se a categoria Integridade de Processamento continuou no escopo. Vale qualquer coisa que funcione sem alguém clicar: integração com ERP, banco, marketplace, meio de pagamento, ou um robô que lê planilha de uma pasta compartilhada.',
        codigos: ['PI4.1'],
        justificativa: 'O sistema incluído no escopo não mantém interfaces automatizadas de entrada ou de saída com sistemas de terceiros. Todos os dados são inseridos e extraídos por usuários autenticados através da interface da própria aplicação, não havendo transferência automática entre sistemas a ser controlada. Por esse motivo, o critério PI4.1 não se aplica ao período auditado.',
        nuncaExcluir: 'A validação do que o usuário digita continua obrigatória em PI1.2, e o registro do que foi processado continua em PI2.2. Só sai o controle sobre a tubulação automática entre sistemas.',
      },
      {
        id: 'sistema_executa_transacoes',
        pergunta: 'O seu sistema executa operações que movimentam dinheiro, estoque ou pedidos, como aprovar um pagamento, dar baixa em estoque, fechar uma venda ou emitir um boleto?',
        ajuda: 'Só responda esta pergunta se a categoria Integridade de Processamento continuou no escopo. Se o seu sistema apenas registra que algo aconteceu, e quem move o dinheiro ou o estoque é outro sistema, responda NÃO.',
        codigos: ['PI2.1'],
        justificativa: 'O sistema incluído no escopo não executa transações que movimentem recursos financeiros, estoques ou pedidos. Sua função limita-se a registrar e apresentar informações, sem autorizar nem efetivar operações de negócio, que permanecem sob responsabilidade dos sistemas dos próprios clientes. Não havendo transação a autorizar previamente, o critério PI2.1 não se aplica ao período auditado.',
        nuncaExcluir: 'Isto não dispensa autorização de acesso. Quem pode ver e alterar o quê continua sendo testado em CC6.3, que é obrigatório e nunca sai do escopo.',
      },
      {
        id: 'conciliacao_com_sistema_de_origem',
        pergunta: 'Os números que o seu sistema mostra precisam bater com os de outro sistema que é a fonte oficial do dado, como o ERP, o banco ou o sistema do próprio cliente?',
        ajuda: 'Só responda esta pergunta se a categoria Integridade de Processamento continuou no escopo. Se o seu sistema é o lugar onde o dado nasce, e não existe outro sistema com quem conferir, responda NÃO.',
        codigos: ['PI1.5'],
        justificativa: 'O sistema incluído no escopo é a origem dos dados que processa, não recebendo informações de sistema de registro externo com o qual devesse haver conferência. Não existindo base de origem independente a ser confrontada, não há reconciliação de processamento a executar, motivo pelo qual o critério PI1.5 não se aplica ao período auditado. Os controles de completude e de exatidão do processamento permanecem avaliados nos critérios PI1.2, PI1.3 e PI1.4.',
        nuncaExcluir: 'Isto não significa que ninguém confere nada. Conferir se o processamento saiu completo e correto continua obrigatório em PI1.3 e PI1.4, e a correção de erros continua em PI3.1 e PI3.2.',
      },
      {
        id: 'nivel_de_servico_numerico',
        pergunta: 'Existe um número acordado por escrito com o cliente, como um percentual de tempo no ar ou um prazo máximo em horas para o sistema voltar depois de uma queda?',
        ajuda: 'Só responda esta pergunta se a categoria Disponibilidade continuou no escopo. Um compromisso genérico de melhores esforços não é um número: precisa haver um percentual, como 99,9%, ou um prazo, como 4 horas.',
        codigos: ['A4.1', 'A4.2'],
        justificativa: 'A organização não pactuou com seus clientes metas quantitativas de disponibilidade ou de tempo de recuperação para o sistema incluído no escopo. Não existindo nível de serviço acordado, não há acordo a definir, comunicar ou monitorar perante os clientes, motivo pelo qual os critérios A4.1 e A4.2 não se aplicam ao período auditado. Os compromissos de disponibilidade assumidos pela organização são de natureza operacional interna e permanecem avaliados nos demais critérios da categoria.',
        nuncaExcluir: 'Monitorar capacidade e desempenho (A1.1) e monitorar o sistema (A1.2) continuam obrigatórios. O auditor quer ver que você percebe quando o sistema cai, mesmo sem nenhum número assinado com o cliente.',
      },
    ],
  },
};

/** O assistente deste framework, ou `null` se ainda não foi desenhado. */
export function escopoDe(chaveDoFramework: string | null): AssistenteDeEscopo | null {
  return chaveDoFramework ? (ESCOPO_POR_FRAMEWORK[chaveDoFramework] ?? null) : null;
}

/**
 * Aplica as travas às respostas, devolvendo as que ficam forçadas.
 *
 * Não corrige em silêncio: devolve também a razão, para o ecrã poder dizer
 * "marquei esta por si, e foi por isto".
 */
export function aplicarTravas(
  assistente: AssistenteDeEscopo,
  respostas: Record<string, 'sim' | 'nao' | undefined>,
): { respostas: Record<string, 'sim' | 'nao' | undefined>; forcadas: TravaDeEscopo[] } {
  const saida = { ...respostas };
  const forcadas: TravaDeEscopo[] = [];
  for (const trava of assistente.travas ?? []) {
    const [origem, valorOrigem] = trava.se;
    const [alvo, valorAlvo] = trava.entao;
    if (saida[origem] === valorOrigem && saida[alvo] !== valorAlvo) {
      saida[alvo] = valorAlvo;
      forcadas.push(trava);
    }
  }
  return { respostas: saida, forcadas };
}

/** Os códigos que saem do escopo, dadas as respostas. */
export function codigosExcluidos(
  assistente: AssistenteDeEscopo,
  respostas: Record<string, 'sim' | 'nao' | undefined>,
): Array<{ codigo: string; justificativa: string; perguntaId: string }> {
  const saida: Array<{ codigo: string; justificativa: string; perguntaId: string }> = [];
  for (const p of assistente.perguntas) {
    if (respostas[p.id] !== 'nao') continue;
    for (const codigo of p.codigos) {
      saida.push({ codigo, justificativa: p.justificativa, perguntaId: p.id });
    }
  }
  return saida;
}
