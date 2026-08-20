-- A orientação dos requisitos deixa de ser resíduo e passa a ser dado versionado.
--
-- O produto gera a orientação sob demanda: quem abre um requisito sem texto
-- dispara `populate-requirement-guidance`, o modelo escreve, e o resultado fica
-- gravado GLOBALMENTE, para todas as empresas. É um bom desenho — o segundo
-- cliente não paga o que o primeiro já pagou.
--
-- O que não estava bem é que nenhuma migration jamais escreveu uma linha nessas
-- colunas. Das 1.573 orientações, 36 existiam, e não por curadoria: eram os
-- requisitos que alguém, algures, abriu primeiro. O conteúdo do cliente A
-- chegava ao cliente B por acaso, e um ambiente novo nascia com zero.
--
-- Esta migration fixa as 36 no repositório. É pouco, e é de propósito: o resto
-- semeia-se com `scripts/aquecer-orientacao.mjs`, framework a framework, com
-- alguém a olhar para o que sai. Orientação de conformidade escrita por modelo
-- e publicada sem revisão é exactamente o que este produto existe para evitar.
--
-- Grava por (nome do framework, código do requisito) e não por id: os
-- frameworks são globais e os ids diferem entre ambientes.
--
-- Idempotente: só escreve onde ainda não há texto, portanto nunca sobrepõe uma
-- revisão feita por gente.


UPDATE public.gap_analysis_requirements r
   SET orientacao_implementacao = COALESCE(NULLIF(r.orientacao_implementacao, ''), 'O controle 1.1 pede que você crie e mantenha uma lista detalhada de todos os ativos da sua empresa que podem armazenar ou processar dados. Isso inclui computadores, servidores, dispositivos móveis, impressoras e até mesmo software que você usa. Ter essa lista ajuda a entender o que você possui e onde os dados estão, o que é essencial para proteger as informações da sua empresa.

Para começar, faça um inventário de todos os ativos. Você pode usar uma planilha simples para listar cada item, incluindo informações como tipo de ativo, localização, quem é o responsável por ele e quais dados ele processa. É importante que essa lista seja atualizada regularmente, sempre que novos ativos forem adquiridos ou quando ativos antigos forem descartados.

Além disso, envolva sua equipe nesse processo. Peça a cada departamento que contribua com informações sobre os ativos que eles usam. Isso não só ajuda a manter a lista completa, mas também aumenta a conscientização sobre a importância da segurança dos dados. Por fim, revise essa lista periodicamente para garantir que ela esteja sempre atualizada e precisa.'),
       exemplos_evidencias      = COALESCE(NULLIF(r.exemplos_evidencias, ''), '- Lista de ativos em formato de planilha
- Relatório de auditoria de ativos
- Documentação de aquisição de novos equipamentos
- Registro de descarte de ativos antigos
- Comunicações internas sobre ativos e responsabilidades
- Atualizações de software e hardware registradas
- Inventário de dispositivos móveis utilizados na empresa'),
       perguntas_diagnostico    = COALESCE(NULLIF(r.perguntas_diagnostico, ''), NULL)
  FROM public.gap_analysis_frameworks f
 WHERE f.id = r.framework_id
   AND f.nome = 'CIS Controls'
   AND r.codigo = '1.1'
   AND COALESCE(r.orientacao_implementacao, '') = '';

UPDATE public.gap_analysis_requirements r
   SET orientacao_implementacao = COALESCE(NULLIF(r.orientacao_implementacao, ''), 'Para assegurar a governança na sua organização, você precisa criar um conjunto de regras e práticas que ajudem a gerenciar e proteger as informações. Isso significa que você deve definir quem toma as decisões, quais são as responsabilidades de cada um e como as informações devem ser tratadas. Comece reunindo sua equipe e discutindo quais são os objetivos da sua organização em relação à segurança da informação. Isso ajudará a criar um plano claro e direcionado.

Depois de definir os objetivos, é importante documentar tudo. Crie um documento que descreva as políticas de governança, incluindo como as informações serão protegidas, quem tem acesso a elas e quais são os procedimentos a serem seguidos em caso de incidentes. Essa documentação deve ser fácil de entender e acessível a todos os colaboradores.

Por fim, não esqueça de revisar e atualizar regularmente esse framework. A governança não é algo que se faz uma vez e esquece. À medida que sua organização cresce e as ameaças mudam, você precisará ajustar suas políticas e práticas. Realize reuniões periódicas para discutir a eficácia do seu framework e faça as alterações necessárias para garantir que ele continue relevante e eficaz.'),
       exemplos_evidencias      = COALESCE(NULLIF(r.exemplos_evidencias, ''), '- Documento de políticas de governança assinado pela alta direção
- Registro de reuniões da equipe sobre governança e segurança da informação
- Relatório de auditoria interna sobre a conformidade com as políticas
- Treinamento realizado com funcionários sobre as práticas de governança
- Atualizações de políticas documentadas e comunicadas a todos os colaboradores
- Feedback de colaboradores sobre a clareza das políticas de governança
- Planos de ação para melhorias identificadas nas reuniões de governança'),
       perguntas_diagnostico    = COALESCE(NULLIF(r.perguntas_diagnostico, ''), NULL)
  FROM public.gap_analysis_frameworks f
 WHERE f.id = r.framework_id
   AND f.nome = 'COBIT'
   AND r.codigo = 'EDM01'
   AND COALESCE(r.orientacao_implementacao, '') = '';

UPDATE public.gap_analysis_requirements r
   SET orientacao_implementacao = COALESCE(NULLIF(r.orientacao_implementacao, ''), 'Para demonstrar compromisso com os valores da sua organização, é fundamental que o conselho de administração esteja ativamente envolvido na supervisão e promoção desses valores. Isso significa que os membros do conselho devem não apenas conhecer os valores da empresa, mas também agir de acordo com eles em suas decisões e comportamentos. Uma maneira prática de fazer isso é realizar reuniões regulares onde os valores sejam discutidos e avaliados em relação às ações da empresa. 

Além disso, é importante que esses valores sejam comunicados claramente a todos os colaboradores. Você pode criar materiais de comunicação, como cartazes ou newsletters, que expliquem os valores e como eles se aplicam no dia a dia da empresa. Isso ajuda a criar uma cultura organizacional forte, onde todos se sentem parte do compromisso com esses princípios. 

Outra ação prática é incentivar feedback dos colaboradores sobre como os valores estão sendo vividos na prática. Isso pode ser feito através de pesquisas anônimas ou reuniões abertas, onde todos podem compartilhar suas opiniões. O conselho deve estar disposto a ouvir e fazer ajustes quando necessário, mostrando que está realmente comprometido com esses valores.'),
       exemplos_evidencias      = COALESCE(NULLIF(r.exemplos_evidencias, ''), '- Ata de reunião do conselho onde os valores foram discutidos.
- Materiais de comunicação interna que destacam os valores da empresa.
- Resultados de pesquisas de clima organizacional que mencionam os valores.
- Relatórios de ações tomadas em resposta ao feedback dos colaboradores sobre os valores.
- Registro de treinamentos realizados sobre os valores da empresa.
- Exemplos de decisões do conselho que refletem os valores organizacionais.
- Mensagens de líderes da empresa reforçando a importância dos valores.'),
       perguntas_diagnostico    = COALESCE(NULLIF(r.perguntas_diagnostico, ''), NULL)
  FROM public.gap_analysis_frameworks f
 WHERE f.id = r.framework_id
   AND f.nome = 'COSO ERM'
   AND r.codigo = 'P1'
   AND COALESCE(r.orientacao_implementacao, '') = '';

UPDATE public.gap_analysis_requirements r
   SET orientacao_implementacao = COALESCE(NULLIF(r.orientacao_implementacao, ''), 'Este regulamento fala sobre a proteção das informações pessoais das pessoas. Isso significa que, quando você coleta ou usa dados de clientes, funcionários ou qualquer outra pessoa, você precisa garantir que esses dados estejam seguros e que as pessoas saibam como você os está usando. Para implementar isso, comece fazendo um levantamento de todos os dados pessoais que sua empresa coleta. Isso inclui nomes, endereços, e-mails e qualquer outra informação que possa identificar uma pessoa. 

Depois de identificar quais dados você possui, é importante ter uma política clara sobre como esses dados serão usados. Comunique essa política a todos os funcionários e, se possível, aos seus clientes. As pessoas devem saber por que você está coletando seus dados e como eles serão protegidos. 

Além disso, implemente medidas de segurança, como senhas fortes e acesso limitado aos dados. Isso ajuda a evitar que pessoas não autorizadas acessem informações sensíveis. Por fim, esteja preparado para responder a perguntas ou preocupações sobre a privacidade dos dados, pois isso demonstra que você leva a sério a proteção das informações pessoais.'),
       exemplos_evidencias      = COALESCE(NULLIF(r.exemplos_evidencias, ''), '- Lista de todos os tipos de dados pessoais coletados
- Política de privacidade documentada e acessível
- Treinamentos realizados sobre proteção de dados para funcionários
- Registros de consentimento de clientes para uso de dados
- Medidas de segurança implementadas (ex: senhas, criptografia)
- Relatórios de auditoria sobre o uso e proteção de dados
- Comunicação clara sobre como os dados são usados e protegidos'),
       perguntas_diagnostico    = COALESCE(NULLIF(r.perguntas_diagnostico, ''), NULL)
  FROM public.gap_analysis_frameworks f
 WHERE f.id = r.framework_id
   AND f.nome = 'GDPR'
   AND r.codigo = 'Art. 1'
   AND COALESCE(r.orientacao_implementacao, '') = '';

UPDATE public.gap_analysis_requirements r
   SET orientacao_implementacao = COALESCE(NULLIF(r.orientacao_implementacao, ''), 'O controle PR.1 exige que sua organização informe as pessoas sobre como suas informações de saúde serão usadas e protegidas. Isso significa que você precisa criar um aviso claro e fácil de entender que explique quais dados você coleta, como eles serão utilizados e com quem poderão ser compartilhados. Esse aviso deve ser acessível a todos os pacientes ou usuários que fornecem suas informações de saúde. 

Para implementar isso, comece escrevendo um documento que descreva suas práticas de privacidade. Use uma linguagem simples e evite termos complicados. Certifique-se de incluir informações sobre os direitos dos indivíduos em relação aos seus dados, como o direito de acessar e corrigir suas informações. 

Depois de criar o aviso, é importante divulgá-lo. Você pode disponibilizá-lo em seu site, em locais visíveis na sua organização ou até mesmo entregá-lo pessoalmente quando alguém fornecer suas informações de saúde. Lembre-se de que a transparência é fundamental para construir a confiança com seus pacientes e usuários.'),
       exemplos_evidencias      = COALESCE(NULLIF(r.exemplos_evidencias, ''), '- Cópia do aviso de práticas de privacidade impresso ou digital
- Registro de entrega do aviso aos pacientes
- Exibição do aviso em local visível na recepção
- Publicação do aviso no site da organização
- Feedback de pacientes sobre a clareza do aviso
- Treinamento da equipe sobre como explicar o aviso aos pacientes
- Atualizações do aviso com data de revisão'),
       perguntas_diagnostico    = COALESCE(NULLIF(r.perguntas_diagnostico, ''), NULL)
  FROM public.gap_analysis_frameworks f
 WHERE f.id = r.framework_id
   AND f.nome = 'HIPAA'
   AND r.codigo = 'PR.1'
   AND COALESCE(r.orientacao_implementacao, '') = '';

UPDATE public.gap_analysis_requirements r
   SET orientacao_implementacao = COALESCE(NULLIF(r.orientacao_implementacao, ''), '## 📋 O que este requisito significa
Este requisito exige que a empresa olhe para "dentro e para fora" antes de definir qualquer estratégia de governança ou segurança. Significa identificar quais fatores internos (cultura, estrutura, objetivos) e externos (leis, mercado, tecnologia) podem influenciar a capacidade da organização de atingir seus resultados.

É o alicerce de qualquer sistema de gestão. Não se pode proteger o que não se conhece ou aplicar regras que não fazem sentido para o setor em que a empresa atua. É o momento de mapear quem são as partes interessadas e quais são as pressões que o negócio sofre.

## 🎯 Por que isso importa para sua empresa
Sem entender o contexto, a empresa corre o risco de investir recursos em controles de compliance que são irrelevantes para o seu modelo de negócio, enquanto deixa vulnerabilidades críticas expostas. Isso gera ineficiência operacional e desperdício financeiro.

Além disso, a falta de visão contextual impede a antecipação de mudanças regulatórias ou movimentos de mercado. Uma empresa que ignora seu contexto pode ser surpreendida por novas leis (como a LGPD) ou por exigências contratuais de grandes clientes que ela não está preparada para atender, resultando em perda de contratos e multas pesadas.

## ⚠️ O que acontece se você não faz isso
*   Implementação de políticas genéricas que não refletem a realidade da operação.
*   Falha em identificar riscos emergentes no setor de atuação.
*   Dificuldade em priorizar investimentos em segurança e conformidade.
*   Incapacidade de responder rapidamente a mudanças no cenário macroeconômico ou legal.
*   Desalinhamento entre os objetivos de negócio e as práticas de GRC.

## 🔍 Fatores que você deve analisar
1. Quais são as principais leis e regulamentações que regem o nosso setor atualmente?
2. Nossa infraestrutura tecnológica atual suporta o crescimento planejado para os próximos dois anos?
3. Quem são nossos principais concorrentes e quais padrões de conformidade eles adotam?
4. A cultura organizacional atual favorece ou dificulta a adoção de novos controles?
5. Quais eventos externos (crises econômicas, instabilidade política) mais impactam nossa operação?
6. Quais são as expectativas reais dos nossos acionistas e clientes em relação à ética e segurança?

## 💡 Dicas práticas de implementação
1.  **Realize uma Análise SWOT (FOFA):** Identifique Forças, Oportunidades, Fraquezas e Ameaças sob a ótica de GRC.
2.  **Mapeie Stakeholders:** Liste todas as partes interessadas (clientes, órgãos reguladores, funcionários) e o que elas esperam da empresa.
3.  **Formalize o Escopo:** Escreva um documento curto descrevendo o que a empresa faz, onde atua e quais são seus limites de atuação.
4.  **Reunião de Alinhamento:** Realize workshops com a alta liderança para validar se a visão de riscos está alinhada com a estratégia do negócio.'),
       exemplos_evidencias      = COALESCE(NULLIF(r.exemplos_evidencias, ''), '- Relatório de Análise SWOT (FOFA) focado em riscos e conformidade.
- Matriz de Partes Interessadas com necessidades e expectativas mapeadas.
- Documento de Escopo do Sistema de Gestão aprovado pela diretoria.
- Relatório de análise de mercado e cenário macroeconômico (PESTEL).
- Atas de reuniões de planejamento estratégico onde o contexto foi discutido.
- Organograma atualizado detalhando a estrutura de governança.
- Mapeamento de requisitos legais e regulatórios aplicáveis ao negócio.
- Manual de Governança que descreve a missão, visão e valores da organização.'),
       perguntas_diagnostico    = COALESCE(NULLIF(r.perguntas_diagnostico, ''), '[
  {"pergunta": "A organização possui uma análise formalizada das influências externas (leis, mercado, tecnologia) e internas que afetam seu negócio?", "peso": 3},
  {"pergunta": "As necessidades e expectativas das partes interessadas (clientes, reguladores, sócios) foram identificadas e documentadas?", "peso": 2},
  {"pergunta": "O escopo do sistema de gestão de compliance/riscos está claramente definido e documentado?", "peso": 2},
  {"pergunta": "A alta direção participa ativamente da definição e revisão do contexto estratégico da organização?", "peso": 3},
  {"pergunta": "Existe um processo de revisão periódica (pelo menos anual) do contexto organizacional para capturar mudanças no mercado?", "peso": 1}
]')
  FROM public.gap_analysis_frameworks f
 WHERE f.id = r.framework_id
   AND f.nome = 'ISO 9001'
   AND r.codigo = '4.1'
   AND COALESCE(r.orientacao_implementacao, '') = '';

UPDATE public.gap_analysis_requirements r
   SET orientacao_implementacao = COALESCE(NULLIF(r.orientacao_implementacao, ''), '## 📋 O que este requisito significa
O requisito "Foco no Cliente" estabelece que a alta liderança deve demonstrar comprometimento direto em garantir que as necessidades e expectativas dos clientes sejam identificadas, compreendidas e atendidas com consistência. Não se trata apenas de "vender bem", mas de colocar o cliente no centro das decisões estratégicas da organização.

Isso significa que a diretoria deve assegurar que os requisitos legais e regulamentares aplicáveis ao produto ou serviço sejam cumpridos, e que os riscos que podem afetar a satisfação do cliente sejam monitorados e mitigados proativamente.

## 🎯 Por que isso importa para sua empresa
No cenário atual de GRC, o cliente é o principal stakeholder. Negligenciar este foco pode levar a uma erosão acelerada da base de receitas e ao aumento do custo de aquisição de novos clientes (CAC), tornando o negócio financeiramente insustentável a médio prazo.

Além disso, a falta de foco no cliente frequentemente resulta em falhas de conformidade com órgãos de defesa do consumidor, gerando passivos jurídicos e administrativos que drenam o caixa da empresa e paralisam a operação com fiscalizações constantes.

## ⚠️ O que acontece se você não faz isso
*   Aumento no volume de reclamações em canais públicos (Reclame Aqui, redes sociais), deteriorando o valor da marca.
*   Perda de contratos importantes por descumprimento de SLAs (Acordos de Nível de Serviço).
*   Multas pesadas de órgãos reguladores ou Procons por falhas na prestação de serviço ou entrega de produtos.
*   Desalinhamento estratégico: a empresa investe em melhorias que o cliente não valoriza, desperdiçando recursos.

## 🔍 Fatores que você deve analisar
1. A alta direção revisa periodicamente os indicadores de satisfação (NPS, CSAT)?
2. Existem processos claros para identificar requisitos legais que impactam o cliente?
3. Como a empresa identifica riscos que podem impedir a entrega do que foi prometido?
4. Os feedbacks dos clientes são transformados em planos de ação reais ou apenas arquivados?
5. A cultura da empresa incentiva os colaboradores a priorizarem a experiência do usuário?
6. Existe um canal de comunicação eficiente e acessível para o cliente registrar insatisfações?

## 💡 Dicas práticas de implementação
1. **Defina KPIs de Sucesso:** Implemente métricas como Net Promoter Score (NPS) e monitore-as em reuniões de diretoria.
2. **Mapeie a Jornada:** Desenhe o caminho que o cliente percorre e identifique os "pontos de dor" onde a liderança deve intervir.
3. **Comitê de Ética e Cliente:** Crie um fórum mensal para discutir reclamações críticas e falhas de processo que geraram insatisfação.
4. **Treinamento de Liderança:** Capacite gestores para que tomem decisões baseadas no impacto final para o cliente, não apenas no custo.
5. **Ciclo de Feedback Fechado:** Garanta que toda reclamação relevante receba uma resposta sobre o que foi alterado internamente para evitar reincidência.'),
       exemplos_evidencias      = COALESCE(NULLIF(r.exemplos_evidencias, ''), '- Relatórios mensais de indicadores de satisfação (NPS/CSAT) assinados pela diretoria.
- Atas de reuniões de análise crítica da direção onde o tema "satisfação do cliente" foi pautado.
- Pesquisas de mercado ou de percepção de marca realizadas no último ano.
- Planos de ação documentados para correção de falhas apontadas em reclamações de clientes.
- Matriz de riscos operacionais que inclua o risco de perda de clientes ou queda na qualidade.
- Política de Atendimento ao Cliente aprovada e comunicada pela alta gestão.
- Registros de treinamentos da equipe de linha de frente sobre requisitos do cliente.
- Relatórios de conformidade com órgãos de defesa do consumidor (ex: histórico de processos no Procon).'),
       perguntas_diagnostico    = COALESCE(NULLIF(r.perguntas_diagnostico, ''), '[
  {"pergunta": "A alta direção analisa formalmente os resultados de satisfação dos clientes em reuniões de gestão?", "peso": 3},
  {"pergunta": "Existem metas de satisfação do cliente desdobradas para as principais lideranças da empresa?", "peso": 2},
  {"pergunta": "A empresa possui um processo estruturado para identificar e cumprir requisitos legais e regulatórios do cliente?", "peso": 3},
  {"pergunta": "Os riscos que podem afetar a satisfação do cliente são identificados e tratados na matriz de riscos?", "peso": 1},
  {"pergunta": "Existe evidência de melhoria em processos internos baseada diretamente em feedbacks negativos de clientes?", "peso": 2}
]')
  FROM public.gap_analysis_frameworks f
 WHERE f.id = r.framework_id
   AND f.nome = 'ISO 9001'
   AND r.codigo = '5.2'
   AND COALESCE(r.orientacao_implementacao, '') = '';

UPDATE public.gap_analysis_requirements r
   SET orientacao_implementacao = COALESCE(NULLIF(r.orientacao_implementacao, ''), 'Com certeza! Aqui está a orientação detalhada para o requisito 4.1, elaborada para gestores não técnicos:

---

## 📋 O que este requisito significa

Imagine sua empresa como um barco navegando em um oceano. Para chegar ao seu destino com segurança (que é o sucesso do seu Sistema de Gestão de Segurança da Informação - SGSI), você precisa entender não só o seu barco, mas também o oceano ao redor. Este requisito pede exatamente isso: que você olhe para fora e para dentro da sua empresa para identificar tudo que pode influenciar a segurança da sua informação.

Isso inclui desde as ondas grandes (como novas leis ou tecnologias) até as condições do seu próprio barco (como a cultura da sua equipe ou os recursos que você tem). O objetivo é ter uma visão clara do cenário para que suas decisões sobre segurança da informação sejam bem fundamentadas e eficazes.

Em resumo, é como fazer um "check-up" completo do ambiente e da sua própria organização para garantir que você está preparado para proteger suas informações mais valiosas.

## 🎯 Por que isso importa para sua empresa

Não entender o contexto da sua empresa e do ambiente em que ela opera é como tentar construir uma casa sem saber se o terreno é firme ou se vai chover muito. Se você não sabe o que pode afetar a segurança da sua informação, você não consegue se preparar adequadamente. Isso pode levar a falhas de segurança que expõem dados sensíveis, resultando em grandes prejuízos.

Pense em empresas que sofreram ataques cibernéticos e tiveram seus dados roubados. Muitas vezes, a falha não foi apenas técnica, mas também porque a empresa não avaliou corretamente os riscos externos (como a crescente sofisticação dos hackers) ou internos (como a falta de treinamento dos funcionários). O resultado? Perda de confiança dos clientes, multas pesadas de órgãos reguladores (como a LGPD no Brasil) e um impacto significativo na reputação da marca, que pode levar anos para ser recuperada.

Ao entender seu contexto, você consegue antecipar problemas, alocar recursos de forma inteligente e construir um sistema de segurança robusto que realmente protege o que importa, garantindo a continuidade dos seus negócios e a confiança dos seus clientes.

## ⚠️ O que acontece se você não faz isso

*   **Vulnerabilidades Desconhecidas:** Sua empresa pode ter pontos fracos na segurança que você nem imagina, tornando-a um alvo fácil para ataques.
*   **Decisões Inadequadas:** Investimentos em segurança podem ser feitos em áreas erradas, desperdiçando recursos e deixando lacunas críticas.
*   **Não Conformidade Legal:** Você pode falhar em cumprir leis e regulamentações (como LGPD, PCI-DSS), resultando em multas e sanções.
*   **Perda de Reputação:** Incidentes de segurança podem manchar a imagem da sua empresa, afastando clientes e parceiros.
*   **Interrupção de Negócios:** Ataques bem-sucedidos podem paralisar suas operações, causando perdas financeiras e operacionais significativas.
*   **Dificuldade em Alcançar Metas:** Sem um SGSI eficaz, seus objetivos de negócio podem ser comprometidos pela falta de segurança da informação.

## 🔍 Fatores que você deve analisar

1.  **Quais são as novas leis ou regulamentações (como LGPD, leis setoriais) que podem impactar a forma como protegemos nossas informações?**
2.  **Quais são as principais ameaças cibernéticas que nossa indústria ou tipo de negócio enfrenta atualmente (ex: ransomware, phishing)?**
3.  **Quais são as expectativas dos nossos clientes e parceiros em relação à segurança das informações que compartilhamos com eles?**
4.  **Nossa cultura interna valoriza a segurança da informação? Nossos colaboradores estão cientes de suas responsabilidades?**
5.  **Quais são os nossos recursos (financeiros, humanos, tecnológicos) disponíveis para investir em segurança da informação?**
6.  **Quais são as tecnologias que estamos usando ou planejamos usar e que podem trazer novos desafios de segurança (ex: nuvem, inteligência artificial)?**
7.  **Quais são os nossos objetivos estratégicos de negócio e como a segurança da informação pode apoiá-los ou, se falhar, prejudicá-los?**
8.  **Quais são os nossos principais concorrentes e como eles estão lidando com a segurança da informação? Há algo que podemos aprender ou nos diferenciar?**

## 💡 Dicas práticas de implementação

1.  **Reúna a Liderança:** Agende uma reunião com os principais líderes da empresa para discutir abertamente o cenário atual e futuro, tanto interno quanto externo, sob a perspectiva da segurança da informação.
2.  **Faça um Brainstorming Guiado:** Use as perguntas da seção "Fatores que você deve analisar" como um guia para identificar e listar as questões mais relevantes para sua empresa. Não precisa ser perfeito, apenas comece a registrar.
3.  **Consulte Especialistas (Internos e Externos):** Converse com sua equipe de TI, jurídico, RH e, se necessário, com consultores externos para obter diferentes perspectivas sobre os desafios e oportunidades de segurança.
4.  **Documente de Forma Simples:** Crie um documento curto e objetivo (pode ser um slide ou uma tabela) que resuma as principais questões identificadas. Isso será seu "mapa" para o SGSI.
5.  **Revise Periodicamente:** O mundo muda, sua empresa muda. Revise este "mapa" pelo menos uma vez por ano, ou sempre que houver uma mudança significativa no seu negócio ou no ambiente externo.
6.  **Comunique os Pontos Chave:** Compartilhe as conclusões mais importantes com as equipes relevantes para que todos entendam o porquê das ações de segurança da informação.'),
       exemplos_evidencias      = COALESCE(NULLIF(r.exemplos_evidencias, ''), '- Ata da reunião da alta direção que discute os resultados da análise SWOT, com data e lista de participantes.
- Registro da análise PESTEL (ou PESTLE) atualizada nos últimos 12 meses, identificando fatores externos relevantes e seus impactos.
- Matriz de riscos e oportunidades, com identificação de riscos e oportunidades relacionados ao contexto, suas análises e planos de tratamento.
- Relatório de análise de partes interessadas, incluindo suas necessidades e expectativas, e como a organização as aborda.
- Plano estratégico da organização, aprovado pela alta direção, que demonstre como os fatores internos e externos foram considerados na definição dos objetivos.
- Evidência de comunicação interna sobre os objetivos estratégicos e a política da qualidade, como e-mails ou comunicados no intranet.
- Análise comparativa de desempenho da organização em relação a benchmarks do setor, demonstrando a compreensão do ambiente competitivo.
- Registro de reuniões de análise crítica pela alta direção, onde o contexto da organização e as questões internas/externas são revisados e discutidos.
- Documento de escopo do Sistema de Gestão, aprovado pela alta direção, que define os limites e a aplicabilidade do sistema com base no contexto.
- Evidência de monitoramento de informações externas relevantes, como notícias do setor, regulamentações ou tendências de mercado, e como essas informações são utilizadas.'),
       perguntas_diagnostico    = COALESCE(NULLIF(r.perguntas_diagnostico, ''), NULL)
  FROM public.gap_analysis_frameworks f
 WHERE f.id = r.framework_id
   AND f.nome = 'ISO/IEC 27001'
   AND r.codigo = '4.1'
   AND COALESCE(r.orientacao_implementacao, '') = '';

UPDATE public.gap_analysis_requirements r
   SET orientacao_implementacao = COALESCE(NULLIF(r.orientacao_implementacao, ''), '## 📋 O que este requisito significa
Este requisito estabelece que a segurança da informação não deve ser pensada de forma isolada, mas sim considerando todos que possuem algum interesse ou influência sobre o negócio. A organização precisa identificar quem são essas pessoas ou entidades (partes interessadas) e o que elas esperam ou exigem em termos de segurança.

Basicamente, trata-se de mapear o "ecossistema" da empresa. Isso inclui desde obrigações legais e contratuais até expectativas informais de clientes e funcionários que, se não atendidas, podem comprometer a eficácia do Sistema de Gestão de Segurança da Informação (SGSI).

## 🎯 Por que isso importa para sua empresa
Ignorar as expectativas das partes interessadas pode levar a falhas graves de conformidade. Se você não mapeia que um cliente específico exige criptografia de ponta a ponta em contrato, você corre o risco de perder esse contrato ou enfrentar litígios judiciais por descumprimento de cláusulas de segurança.

Além disso, a reputação da marca está diretamente ligada à confiança. Quando a empresa demonstra que entende e respeita as necessidades de privacidade e segurança de seus parceiros e reguladores, ela se posiciona como um player maduro no mercado, facilitando novos negócios e evitando sanções de órgãos fiscalizadores.

## ⚠️ O que acontece se você não faz isso
*   **Quebra de Contratos:** Perda de clientes importantes por não atender requisitos de segurança específicos exigidos em cláusulas contratuais.
*   **Multas Regulatórias:** Sanções pesadas de órgãos como a ANPD (LGPD) ou BACEN por descumprimento de normas setoriais.
*   **Incapacidade de Renovação de Seguros:** Dificuldade ou encarecimento na contratação de seguros Cyber por falta de controles exigidos pelas seguradoras.
*   **Atrito Operacional:** Conflitos internos entre departamentos por falta de clareza sobre as responsabilidades de segurança de cada área.

## 🔍 Fatores que você deve analisar
1. Quais são as leis e regulamentações (ex: LGPD, leis trabalhistas) que impactam diretamente nosso negócio?
2. Quais compromissos de segurança assumimos em contratos com nossos principais clientes?
3. O que nossos acionistas ou investidores esperam em termos de resiliência e continuidade de negócio?
4. Quais são as exigências de segurança que nossos fornecedores e parceiros críticos devem cumprir?
5. Quais são as expectativas de privacidade e proteção de dados dos nossos colaboradores?
6. Existem requisitos de associações de classe ou normas técnicas que decidimos seguir voluntariamente?

## 💡 Dicas práticas de implementação
1.  **Crie uma Matriz de Partes Interessadas:** Liste em uma planilha quem são (Internos: sócios, RH, TI; Externos: Clientes, Governo, Auditoria).
2.  **Identifique as Necessidades:** Para cada parte, anote qual é a exigência (ex: "Relatório de auditoria anual", "Conformidade com a LGPD").
3.  **Classifique a Obrigatoriedade:** Diferencie o que é "obrigatório" (lei/contrato) do que é "expectativa" (melhores práticas).
4.  **Vincule aos Controles:** Garanta que cada requisito identificado tenha um controle correspondente dentro do seu SGSI.
5.  **Revise Periodicamente:** Estabeleça uma rotina semestral para atualizar essa lista, pois novas leis surgem e contratos mudam.'),
       exemplos_evidencias      = COALESCE(NULLIF(r.exemplos_evidencias, ''), '- Planilha de Matriz de Partes Interessadas com requisitos mapeados.
- Contratos com clientes contendo cláusulas de segurança da informação (Anexos de Segurança/DPA).
- Relatórios de conformidade legal ou pareceres do departamento jurídico sobre regulamentações vigentes.
- Atas de reunião de diretoria onde foram discutidas expectativas de investidores sobre riscos cibernéticos.
- Acordos de Nível de Serviço (SLAs) assinados com fornecedores críticos de TI/Cloud.
- Políticas internas que endereçam requisitos específicos de sindicatos ou conselhos de classe.
- Questionários de due diligence de segurança respondidos para clientes ou parceiros.
- Registro de análise crítica pela direção onde as necessidades das partes interessadas foram validadas.'),
       perguntas_diagnostico    = COALESCE(NULLIF(r.perguntas_diagnostico, ''), '[
  {"pergunta": "A organização possui uma lista documentada de todas as partes interessadas (internas e externas) relevantes para o SGSI?", "peso": 2},
  {"pergunta": "Existem requisitos legais, regulatórios ou contratuais claramente identificados para cada parte interessada?", "peso": 3},
  {"pergunta": "Os requisitos identificados são revisados e atualizados em intervalos planejados ou quando ocorrem mudanças significativas?", "peso": 1},
  {"pergunta": "A alta gestão participa da validação das necessidades e expectativas mapeadas?", "peso": 1},
  {"pergunta": "Os controles de segurança implementados estão diretamente vinculados aos requisitos identificados das partes interessadas?", "peso": 2}
]')
  FROM public.gap_analysis_frameworks f
 WHERE f.id = r.framework_id
   AND f.nome = 'ISO/IEC 27001'
   AND r.codigo = '4.2'
   AND COALESCE(r.orientacao_implementacao, '') = '';

UPDATE public.gap_analysis_requirements r
   SET orientacao_implementacao = COALESCE(NULLIF(r.orientacao_implementacao, ''), '## 📋 O que este requisito significa

Imagine que sua empresa é uma casa e o SGSI (Sistema de Gestão de Segurança da Informação) é o sistema de segurança que você vai instalar. Este requisito significa que, antes de comprar câmeras, alarmes e sensores, você precisa decidir quais partes da casa serão protegidas. Você vai proteger apenas a sala e a cozinha? Ou a casa inteira, incluindo o quintal e a garagem?

Determinar o escopo é exatamente isso: definir quais informações, sistemas, processos, pessoas e até mesmo locais físicos da sua empresa estarão "dentro" do guarda-chuva de segurança do SGSI. É o primeiro passo para saber onde concentrar seus esforços e recursos para proteger o que realmente importa.

## 🎯 Por que isso importa para sua empresa

Não definir o escopo corretamente é como tentar proteger sua casa sem saber onde estão as portas e janelas. Isso pode levar a um gasto excessivo de recursos em áreas que não precisam de tanta proteção, ou, pior, deixar vulneráveis as informações mais críticas da sua empresa.

Empresas que falham nisso podem sofrer vazamentos de dados de clientes, como já vimos em grandes varejistas, resultando em multas pesadas por órgãos reguladores (como a LGPD no Brasil). Além das multas, a reputação da empresa é seriamente abalada, afastando clientes e parceiros de negócios que perdem a confiança na sua capacidade de proteger informações sensíveis. Isso impacta diretamente a receita e a sustentabilidade do negócio a longo prazo.

## ⚠️ O que acontece se você não faz isso

*   **Gastos desnecessários:** Investimento em segurança para áreas de baixo risco, desviando recursos de onde são realmente necessários.
*   **Vulnerabilidades críticas expostas:** Partes importantes da empresa (dados de clientes, segredos comerciais) podem ficar sem proteção, pois não foram incluídas no escopo.
*   **Não conformidade regulatória:** Multas e sanções por não atender a leis como LGPD, que exigem proteção de dados específicos.
*   **Danos à reputação e perda de clientes:** Vazamentos de dados ou incidentes de segurança podem destruir a confiança do mercado.
*   **Ineficiência operacional:** Esforços de segurança desorganizados e sem foco claro, dificultando a resposta a incidentes.

## 🔍 Fatores que você deve analisar

1.  Quais são os principais produtos ou serviços que sua empresa oferece e quais informações são essenciais para entregá-los?
2.  Onde estão armazenadas as informações mais sensíveis da sua empresa (dados de clientes, financeiros, propriedade intelectual)?
3.  Quais são os requisitos legais e regulatórios (ex: LGPD, BACEN, ANPD) que sua empresa precisa cumprir em relação à segurança da informação?
4.  Quais são os principais processos de negócio que, se pararem, causariam um grande impacto na sua empresa?
5.  Quais são as expectativas dos seus clientes e parceiros em relação à segurança das informações que eles compartilham com você?
6.  Quais são os sistemas de TI (servidores, redes, aplicativos) que suportam esses processos e informações críticas?
7.  Existem áreas geográficas específicas (escritórios, data centers) que precisam ser incluídas no SGSI?

## 💡 Dicas práticas de implementação

*   **Identifique os "ativos" críticos:** Faça uma lista das informações, sistemas e processos mais valiosos da sua empresa. Pense no que causaria o maior estrago se fosse perdido ou comprometido.
*   **Converse com as áreas de negócio:** Reúna-se com líderes de vendas, financeiro, RH e operações para entender suas necessidades e preocupações com a segurança. Eles são os "donos" das informações.
*   **Considere as exigências externas:** Verifique quais leis (LGPD), regulamentações do setor ou contratos com clientes exigem que você proteja certas informações.
*   **Documente sua decisão:** Escreva claramente quais partes da empresa (departamentos, sistemas, dados) estão incluídas e quais estão fora do SGSI, e por quê. Isso evita dúvidas futuras.
*   **Obtenha aprovação da liderança:** Apresente o escopo proposto para a diretoria ou conselho para garantir que todos estejam alinhados e apoiem os esforços de segurança.
*   **Revise periodicamente:** O negócio muda, e o escopo do SGSI também deve mudar. Planeje revisões anuais ou sempre que houver grandes mudanças na empresa.'),
       exemplos_evidencias      = COALESCE(NULLIF(r.exemplos_evidencias, ''), '- Ata da reunião da alta direção que aprova o escopo do SGSI, com lista de participantes e data.
- Documento formal de escopo do SGSI, assinado pelo responsável pela segurança da informação e com data de emissão.
- Lista de ativos de informação e sistemas incluídos e excluídos do escopo, com justificativa para as exclusões.
- Diagrama de rede ou arquitetura de sistemas que ilustra os limites físicos e lógicos do escopo do SGSI.
- Entrevistas com funcionários-chave (ex: gerente de TI, gerente de segurança) para confirmar a compreensão e aplicação do escopo.
- Registros de treinamento sobre o escopo do SGSI para os colaboradores impactados, incluindo datas e listas de presença.
- Comunicações internas (e-mails, memorandos) divulgando o escopo do SGSI para as partes interessadas relevantes.
- Análise de riscos e declaração de aplicabilidade (SoA) que demonstram a consideração do escopo definido.
- Contratos com fornecedores e parceiros que referenciam o escopo do SGSI, quando aplicável.
- Evidências de que o escopo foi revisado e atualizado em resposta a mudanças significativas na organização ou nos sistemas.'),
       perguntas_diagnostico    = COALESCE(NULLIF(r.perguntas_diagnostico, ''), '[
  {
    "pergunta": "O escopo do SGSI está documentado e aprovado pela alta direção, incluindo os limites físicos e organizacionais, e as interfaces com partes externas?",
    "peso": 3
  },
  {
    "pergunta": "A empresa considerou as questões internas e externas relevantes (4.1) e os requisitos das partes interessadas (4.2) ao definir o escopo do SGSI?",
    "peso": 3
  },
  {
    "pergunta": "O escopo do SGSI exclui alguma parte da organização ou de seus processos? Se sim, essa exclusão é justificada e documentada?",
    "peso": 2
  },
  {
    "pergunta": "O escopo do SGSI é comunicado e está disponível para as partes interessadas relevantes?",
    "peso": 1
  },
  {
    "pergunta": "Existem evidências de que o escopo do SGSI é revisado periodicamente ou quando há mudanças significativas na organização ou em seus processos?",
    "peso": 2
  }
]')
  FROM public.gap_analysis_frameworks f
 WHERE f.id = r.framework_id
   AND f.nome = 'ISO/IEC 27001'
   AND r.codigo = '4.3'
   AND COALESCE(r.orientacao_implementacao, '') = '';

UPDATE public.gap_analysis_requirements r
   SET orientacao_implementacao = COALESCE(NULLIF(r.orientacao_implementacao, ''), '## 📋 O que este requisito significa
Este requisito é o "guarda-chuva" de toda a norma ISO 27001. Ele estabelece que a segurança da informação não deve ser um projeto com data para acabar, mas sim um processo cíclico e vivo dentro da empresa. Significa que você precisa criar uma estrutura organizada (o SGSI) que planeja, executa, mede e corrige as ações de proteção de dados.

Em termos práticos, a organização deve demonstrar que possui um método sistemático para gerenciar seus ativos de informação. Não basta ter firewalls ou antivírus; é necessário ter um sistema de gestão que garanta que esses controles funcionem conforme o esperado e evoluam conforme novas ameaças surgem.

## 🎯 Por que isso importa para sua empresa
A ausência de um sistema de gestão estruturado torna a segurança da informação reativa e caótica. Sem o SGSI, a empresa gasta recursos em ferramentas desnecessárias enquanto deixa brechas críticas abertas, aumentando a probabilidade de incidentes que podem paralisar a operação.

Além disso, grandes clientes e parceiros internacionais hoje exigem provas de que seus dados estão seguros. Ter um SGSI implementado e em melhoria contínua é um diferencial competitivo que abre portas para contratos de alto valor e evita multas pesadas de órgãos reguladores, como a ANPD (LGPD).

## ⚠️ O que acontece se você não faz isso
*   **Decisões baseadas em "achismos":** Investimentos em segurança sem priorização técnica, gerando desperdício de orçamento.
*   **Fragilidade em auditorias:** Dificuldade extrema em passar em due diligences de clientes ou certificações.
*   **Obsolescência de controles:** Processos de segurança que funcionavam ontem, mas que não se adaptam às novas ameaças de hoje.
*   **Interrupção de negócios:** Maior tempo de recuperação em caso de ataques (como Ransomware) por falta de processos de melhoria e resposta.

## 🔍 Fatores que você deve analisar
1. Existe um comitê ou responsável formalmente designado para gerir a segurança da informação?
2. A alta direção fornece os recursos (financeiros e humanos) necessários para manter o sistema funcionando?
3. Como a empresa garante que as lições aprendidas em incidentes passados se tornem melhorias reais no sistema?
4. Existem indicadores de desempenho (KPIs) que mostram se a segurança está melhorando ou piorando?
5. Os processos de segurança estão documentados e são seguidos por todos os departamentos?
6. Existe um cronograma de revisões periódicas para as políticas e normas de segurança?

## 💡 Dicas práticas de implementação
1. **Defina o Ciclo PDCA:** Estabeleça rituais trimestrais para Planejar, Executar, Verificar e Agir sobre os processos de segurança.
2. **Documente o Escopo:** Deixe claro quais áreas e processos da empresa fazem parte do sistema de gestão.
3. **Engaje a Liderança:** Garanta que a diretoria assine a Política de Segurança, demonstrando apoio formal ao sistema.
4. **Crie um Plano de Melhoria:** Mantenha um registro simples (pode ser uma planilha ou software) de oportunidades de melhoria e falhas identificadas para correção.'),
       exemplos_evidencias      = COALESCE(NULLIF(r.exemplos_evidencias, ''), '- Manual do SGSI ou documento de diretrizes do sistema de gestão.
- Atas de reuniões de análise crítica pela direção sobre o desempenho da segurança.
- Plano de tratamento de riscos atualizado e aprovado.
- Relatórios de indicadores de desempenho (KPIs) de segurança da informação.
- Registro de não conformidades e respectivas ações corretivas implementadas.
- Cronograma anual de auditorias internas e revisões de conformidade.
- Evidências de alocação de orçamento específico para iniciativas de segurança.
- Matriz de responsabilidades (RACI) para os processos do SGSI.'),
       perguntas_diagnostico    = COALESCE(NULLIF(r.perguntas_diagnostico, ''), '[
  {"pergunta": "A alta direção revisa formalmente o desempenho do SGSI em intervalos planejados?", "peso": 3},
  {"pergunta": "Existe uma metodologia definida para a melhoria contínua dos processos de segurança?", "peso": 2},
  {"pergunta": "A organização possui recursos humanos e financeiros dedicados à manutenção do SGSI?", "peso": 2},
  {"pergunta": "As falhas e incidentes de segurança são utilizados para gerar ações corretivas documentadas?", "peso": 1},
  {"pergunta": "O SGSI está integrado aos processos de negócio e não apenas à área de TI?", "peso": 3}
]')
  FROM public.gap_analysis_frameworks f
 WHERE f.id = r.framework_id
   AND f.nome = 'ISO/IEC 27001'
   AND r.codigo = '4.4'
   AND COALESCE(r.orientacao_implementacao, '') = '';

UPDATE public.gap_analysis_requirements r
   SET orientacao_implementacao = COALESCE(NULLIF(r.orientacao_implementacao, ''), '## 📋 O que este requisito significa

Este requisito, "Liderança e comprometimento", significa que a Alta Direção (vocês, gestores de topo) não pode apenas delegar a segurança da informação para a equipe de TI e esquecer. É como ser o capitão de um time de futebol: não basta contratar os melhores jogadores; o capitão precisa estar em campo, motivar, dar o exemplo e tomar decisões estratégicas para o time vencer.

No nosso contexto, o "time" é o Sistema de Gestão da Segurança da Informação (SGSI), que é o conjunto de políticas, processos e tecnologias que usamos para proteger nossos dados. A Alta Direção precisa mostrar ativamente que se importa com a segurança da informação, que entende sua importância e que está disposta a investir tempo e recursos para que ela funcione.

Em outras palavras, não é só "falar que é importante", mas "mostrar que é importante" através de ações concretas. É sobre ser o principal patrocinador e defensor da segurança da informação dentro da empresa.

## 🎯 Por que isso importa para sua empresa

A falta de liderança e comprometimento da Alta Direção com a segurança da informação pode ter consequências devastadoras para a empresa. Imagine que uma empresa de e-commerce sofre um vazamento massivo de dados de clientes, incluindo informações de cartão de crédito. Se a investigação mostrar que a liderança ignorava repetidamente os alertas de segurança ou não investia em proteção adequada, a reputação da empresa pode ir por água abaixo. Clientes perdem a confiança e migram para a concorrência, resultando em perdas financeiras significativas.

Além disso, regulamentações como a Lei Geral de Proteção de Dados (LGPD) no Brasil ou o GDPR na Europa exigem claramente que a liderança seja responsável pela proteção de dados. Empresas que não demonstram esse comprometimento podem enfrentar multas milionárias. Por exemplo, uma empresa que sofre um ataque cibernético e não consegue provar que sua liderança estava ativamente envolvida na gestão de riscos de segurança pode ser penalizada severamente, não apenas pela falha em si, mas pela falta de governança (a forma como a empresa é dirigida e controlada).

Em última análise, o comprometimento da liderança é o alicerce para uma cultura de segurança robusta. Sem ele, as iniciativas de segurança são vistas como "mais um trabalho" e não como um valor essencial, tornando a empresa um alvo fácil para ataques e fraudes, que podem levar à interrupção de operações críticas e até mesmo à falência.

## ⚠️ O que acontece se você não faz isso

*   **Multas e Sanções Regulatórias:** Órgãos reguladores (como a ANPD no Brasil) podem aplicar multas pesadas por não conformidade com leis de proteção de dados, especialmente se a falta de comprometimento da liderança for evidenciada em um incidente.
*   **Perda de Reputação e Confiança:** Clientes, parceiros e investidores perdem a confiança na empresa, resultando em perda de negócios e dificuldade em atrair novos talentos.
*   **Vulnerabilidades e Ataques Cibernéticos:** A falta de priorização e investimento em segurança, decorrente da ausência de liderança, deixa a empresa mais exposta a ataques, vazamentos de dados e fraudes.
*   **Impacto Operacional e Financeiro:** Incidentes de segurança podem paralisar operações, gerar custos altíssimos de recuperação (forense, comunicação de crise, indenizações) e perda de receita.
*   **Desmotivação da Equipe de Segurança:** A equipe responsável pela segurança da informação sente-se desvalorizada e desmotivada, o que pode levar à rotatividade de talentos e à diminuição da eficácia das defesas.
*   **Dificuldade em Obter Certificações:** Certificações importantes como a ISO 27001 (padrão internacional para gestão da segurança da informação) exigem comprovação do comprometimento da Alta Direção. Sem isso, a certificação é inviável, prejudicando a competitividade.

## 🔍 Fatores que você deve analisar

1.  A Alta Direção participa regularmente de reuniões sobre segurança da informação, não apenas para receber relatórios, mas para tomar decisões e fornecer direcionamento?
2.  Existe um orçamento claro e adequado para as iniciativas de segurança da informação, aprovado e defendido pela liderança?
3.  As políticas de segurança da informação da empresa são comunicadas e endossadas ativamente pela Alta Direção, e não apenas publicadas em um portal?
4.  A liderança estabelece objetivos claros de segurança da informação que se alinham aos objetivos de negócio da empresa?
5.  A Alta Direção demonstra, através de suas próprias ações, a importância de seguir as políticas de segurança (ex: uso de senhas fortes, cuidado com e-mails suspeitos)?
6.  Existe um processo para que a Alta Direção revise e aprove os resultados da gestão de riscos de segurança, garantindo que os riscos mais críticos sejam endereçados?
7.  A liderança garante que os recursos (pessoas, tecnologia, tempo) necessários para a segurança da informação estão disponíveis e são priorizados?

## 💡 Dicas práticas de implementação

1.  **Patrocine um Comitê de Segurança:** Crie ou participe ativamente de um comitê de segurança da informação, garantindo que as decisões estratégicas sejam tomadas e comunicadas de cima para baixo.
2.  **Defina e Comunique Objetivos Claros:** Trabalhe com a equipe de segurança para estabelecer metas de segurança alinhadas aos objetivos de negócio e comunique-as amplamente para toda a empresa.
3.  **Alinhe Orçamento e Prioridades:** Garanta que o orçamento de segurança seja suficiente e que os investimentos em segurança sejam priorizados de forma estratégica, não apenas reativa.
4.  **Lidere pelo Exemplo:** Siga rigorosamente as políticas de segurança da informação da empresa e demonstre a importância da segurança em suas próprias ações e comunicações.
5.  **Revise Desempenho Regularmente:** Estabeleça métricas de segurança (Key Performance Indicators - KPIs) e revise o desempenho do SGSI em reuniões periódicas, cobrando resultados e fornecendo apoio.
6.  **Promova a Conscientização:** Apoie e participe de campanhas de conscientização sobre segurança da informação para todos os colaboradores, mostrando que o tema é uma prioridade da liderança.'),
       exemplos_evidencias      = COALESCE(NULLIF(r.exemplos_evidencias, ''), '- Atas de reuniões da alta direção (Conselho, Diretoria Executiva) que demonstram a revisão e aprovação da Política de Segurança da Informação nos últimos 12 meses.
- Plano Estratégico de Segurança da Informação aprovado pela alta direção, com metas e objetivos claros e mensuráveis, e evidências de acompanhamento do progresso.
- Relatórios de análise de riscos e avaliação de ameaças, com a assinatura de aprovação da alta direção, demonstrando a compreensão e aceitação dos riscos.
- Orçamentos aprovados e comprovantes de investimento em segurança da informação (ex: compra de ferramentas, contratação de pessoal, treinamento), com a assinatura da alta direção.
- Comunicações internas (e-mails, memorandos, comunicados na intranet) da alta direção reforçando a importância da segurança da informação e as responsabilidades de todos os colaboradores.
- Documentos de definição de papéis e responsabilidades em segurança da informação para a alta direção e gerentes, com evidências de comunicação e entendimento.
- Registros de treinamentos de conscientização em segurança da informação para a alta direção, com lista de presença e conteúdo programático.
- Evidências de que a alta direção estabeleceu e comunicou os requisitos de segurança da informação para fornecedores e parceiros externos (ex: cláusulas contratuais, acordos de nível de serviço).
- Relatórios de auditorias internas ou externas de segurança da informação apresentados à alta direção, com evidências de análise e planos de ação para não conformidades.
- Declaração de aplicabilidade (SoA) aprovada pela alta direção, com justificativa para as exclusões e inclusões de controles.'),
       perguntas_diagnostico    = COALESCE(NULLIF(r.perguntas_diagnostico, ''), '[
  {
    "pergunta": "A alta direção demonstra ativamente seu comprometimento com o sistema de gestão, comunicando a importância de uma gestão eficaz e da conformidade com os requisitos?",
    "peso": 3
  },
  {
    "pergunta": "A alta direção garante que as responsabilidades e autoridades para funções pertinentes ao sistema de gestão sejam atribuídas, comunicadas e compreendidas em todos os níveis da organização?",
    "peso": 2
  },
  {
    "pergunta": "A alta direção estabelece e revisa periodicamente a política e os objetivos do sistema de gestão, garantindo que sejam compatíveis com o contexto e a direção estratégica da organização?",
    "peso": 2
  },
  {
    "pergunta": "A alta direção promove a melhoria contínua do sistema de gestão, garantindo a disponibilidade de recursos necessários e o engajamento das pessoas?",
    "peso": 3
  },
  {
    "pergunta": "A alta direção assegura que os requisitos do cliente e os requisitos legais e regulamentares aplicáveis sejam determinados, compreendidos e consistentemente atendidos?",
    "peso": 3
  }
]')
  FROM public.gap_analysis_frameworks f
 WHERE f.id = r.framework_id
   AND f.nome = 'ISO/IEC 27001'
   AND r.codigo = '5.1'
   AND COALESCE(r.orientacao_implementacao, '') = '';

UPDATE public.gap_analysis_requirements r
   SET orientacao_implementacao = COALESCE(NULLIF(r.orientacao_implementacao, ''), '## 📋 O que este requisito significa
Este requisito estabelece que a liderança da empresa não pode apenas "esperar" que as coisas aconteçam; ela deve definir formalmente quem é responsável por cada tarefa e quem tem o poder de tomar decisões. É sobre eliminar o "cachorro de dois donos" ou tarefas que ninguém assume.

A Alta Direção deve garantir que todas as funções vitais para a operação e conformidade estejam mapeadas e que as pessoas ocupando esses cargos saibam exatamente o que se espera delas e quais são os limites de sua autonomia.

## 🎯 Por que isso importa para sua empresa
Sem clareza sobre papéis e autoridades, a empresa sofre com a paralisia decisória ou, pior, com decisões conflitantes que geram desperdício de recursos. Em um cenário de crise, a falta de definição de responsabilidades pode levar a erros operacionais graves que expõem a organização a processos judiciais.

Além disso, investidores e grandes clientes buscam maturidade na governança. Uma empresa onde as responsabilidades são nebulosas é percebida como um investimento de alto risco, o que pode dificultar a obtenção de crédito ou o fechamento de contratos de alto valor.

## ⚠️ O que acontece se você não faz isso
*   **Conflitos Internos:** Disputas de ego ou sobreposição de tarefas entre departamentos.
*   **Gargalos Operacionais:** Processos travados porque ninguém sabe quem tem a autoridade final para aprovar.
*   **Falhas de Compliance:** Atividades regulatórias críticas deixam de ser feitas porque "achavam que o outro setor estava fazendo".
*   **Dificuldade em Auditorias:** Impossibilidade de responsabilizar indivíduos por falhas ou desvios de conduta.

## 🔍 Fatores que você deve analisar
1. Existe um organograma atualizado e divulgado para toda a empresa?
2. As descrições de cargo detalham as responsabilidades específicas de cada colaborador?
3. Há uma matriz de autoridade (ex: alçadas financeiras) formalmente aprovada?
4. Os colaboradores sabem a quem reportar incidentes de conformidade ou riscos?
5. A Alta Direção revisa periodicamente se as atribuições ainda fazem sentido para o negócio?
6. Existe um processo formal de delegação de autoridade para ausências e férias?

## 💡 Dicas práticas de implementação
1.  **Desenhe o Organograma:** Mapeie a estrutura hierárquica atual, garantindo que não existam funções "isoladas".
2.  **Crie Matrizes de Responsabilidade (RACI):** Para processos críticos, defina quem é o Responsável, o Autoridade (quem aprova), o Consultado e o Informado.
3.  **Formalize Descrições de Cargo:** Documente as expectativas e os limites de autoridade para cada posição estratégica.
4.  **Comunique Claramente:** Não guarde as definições em uma gaveta; use a integração de novos funcionários e a intranet para disseminar quem faz o quê.
5.  **Estabeleça Limites de Alçada:** Defina claramente quem pode assinar contratos ou autorizar pagamentos, baseando-se em valores ou criticidade.'),
       exemplos_evidencias      = COALESCE(NULLIF(r.exemplos_evidencias, ''), '- Organograma institucional atualizado e aprovado pela diretoria.
- Descrições de cargos assinadas pelos colaboradores e gestores.
- Matriz de Responsabilidades (RACI) de processos críticos de negócio.
- Política de Alçadas e Delegação de Autoridade formalizada.
- Atas de reunião de diretoria onde foram nomeados responsáveis por comitês ou projetos.
- Termos de nomeação para papéis específicos (ex: DPO, Gestor de Riscos, Compliance Officer).
- Registros de treinamentos de integração onde as responsabilidades foram comunicadas.
- Fluxogramas de processos que indicam os donos (owners) de cada etapa.'),
       perguntas_diagnostico    = COALESCE(NULLIF(r.perguntas_diagnostico, ''), '[
  {"pergunta": "A empresa possui um organograma formalizado e acessível a todos os colaboradores?", "peso": 1},
  {"pergunta": "As descrições de cargo incluem as responsabilidades específicas relacionadas à conformidade e riscos?", "peso": 2},
  {"pergunta": "Existe uma matriz de alçadas definindo claramente quem pode autorizar gastos e decisões críticas?", "peso": 3},
  {"pergunta": "A Alta Direção comunicou formalmente as responsabilidades dos papéis-chave nos últimos 12 meses?", "peso": 2},
  {"pergunta": "Os colaboradores demonstram compreender seus limites de autoridade e a quem devem reportar falhas?", "peso": 2}
]')
  FROM public.gap_analysis_frameworks f
 WHERE f.id = r.framework_id
   AND f.nome = 'ISO/IEC 27001'
   AND r.codigo = '5.3'
   AND COALESCE(r.orientacao_implementacao, '') = '';

UPDATE public.gap_analysis_requirements r
   SET orientacao_implementacao = COALESCE(NULLIF(r.orientacao_implementacao, ''), '## 📋 O que este requisito significa
Este requisito é o alicerce do seu Sistema de Gestão de Segurança da Informação (SGSI). Ele exige que, antes de sair instalando softwares ou criando políticas, a empresa olhe para o cenário completo: quais são os problemas internos e externos (contexto) e o que as partes interessadas (clientes, reguladores, sócios) esperam de você.

A partir dessa visão, você deve identificar o que pode dar errado (riscos) e onde existem chances de melhoria (oportunidades). Não se trata apenas de evitar desastres, mas de garantir que o SGSI consiga entregar os resultados esperados e evoluir com o tempo.

## 🎯 Por que isso importa para sua empresa
Sem este planejamento, a segurança da informação se torna reativa e cara. Você acabará gastando dinheiro em ferramentas que não protegem o que realmente importa ou, pior, descobrirá tarde demais que um requisito legal (como a LGPD) foi ignorado, resultando em multas pesadas que poderiam ter sido evitadas com uma análise prévia.

Além disso, grandes clientes e parceiros de negócios exigem que a segurança seja estratégica. Demonstrar que você mapeou riscos e oportunidades transmite confiança, facilitando o fechamento de contratos e evitando o dano reputacional de ser visto como uma empresa desorganizada ou vulnerável.

## ⚠️ O que acontece se você não faz isso
*   Investimento ineficiente de capital em controles de segurança irrelevantes.
*   Falha em detectar ameaças emergentes que podem paralisar a operação.
*   Perda de certificações (como a ISO 27001) por falta de base no planejamento.
*   Dificuldade em responder a auditorias de clientes e órgãos reguladores.
*   Incapacidade de aproveitar oportunidades de mercado que exigem maturidade em segurança.

## 🔍 Fatores que você deve analisar
1. Quais são os principais objetivos de negócio da empresa para este ano?
2. Quais leis e regulamentações (ex: LGPD, BACEN) impactam diretamente nossa operação?
3. Quais são as maiores preocupações dos nossos clientes em relação aos seus dados?
4. Quais mudanças no mercado ou na tecnologia podem ameaçar nossa segurança?
5. Onde falhamos no passado e o que podemos aprender com esses incidentes?
6. Temos recursos (pessoas e orçamento) suficientes para tratar os riscos identificados?

## 💡 Dicas práticas de implementação
1. **Reúna a liderança:** Realize uma reunião de "brainstorming" com os gestores das áreas principais para listar as questões internas e externas.
2. **Use a Matriz SWOT:** Aplique a análise de Forças, Fraquezas, Oportunidades e Ameaças focada em segurança da informação.
3. **Documente o Contexto:** Formalize em um documento simples quais são as partes interessadas e o que elas exigem da sua segurança.
4. **Defina Critérios de Risco:** Estabeleça o que é um risco "aceitável" para a empresa antes de começar a avaliação técnica.
5. **Crie um Plano de Ação:** Para cada risco ou oportunidade identificada, defina um responsável e um prazo para a ação.'),
       exemplos_evidencias      = COALESCE(NULLIF(r.exemplos_evidencias, ''), '- Ata de reunião de planejamento estratégico do SGSI com a alta direção.
- Matriz de Riscos e Oportunidades atualizada.
- Documento de Análise de Contexto (Interno e Externo).
- Relatório de identificação de necessidades e expectativas de Partes Interessadas.
- Plano de Tratamento de Riscos (PTR) aprovado.
- Registro de análise SWOT ou PESTEL aplicada à segurança da informação.
- Cronograma de ações para abordagem de riscos com status de execução.
- E-mails ou comunicados internos formalizando as prioridades de segurança para o período.'),
       perguntas_diagnostico    = COALESCE(NULLIF(r.perguntas_diagnostico, ''), NULL)
  FROM public.gap_analysis_frameworks f
 WHERE f.id = r.framework_id
   AND f.nome = 'ISO/IEC 27001'
   AND r.codigo = '6.1.1'
   AND COALESCE(r.orientacao_implementacao, '') = '';

UPDATE public.gap_analysis_requirements r
   SET orientacao_implementacao = COALESCE(NULLIF(r.orientacao_implementacao, ''), '## 📋 O que este requisito significa
Este requisito estabelece que a empresa não deve agir por "instinto" ao proteger seus dados. Ele exige a criação de um método padronizado para identificar o que pode dar errado com as informações (ameaças), quais são os pontos fracos atuais (vulnerabilidades) e qual seria o impacto real para o negócio se um incidente ocorresse.

Na prática, significa que a organização precisa ter uma "régua" clara para medir riscos. Não basta dizer que algo é perigoso; é necessário aplicar um processo repetível que classifique os riscos de forma objetiva, permitindo que a diretoria decida onde investir recursos com base em dados, e não em suposições.

## 🎯 Por que isso importa para sua empresa
Sem uma avaliação de riscos, a empresa gasta dinheiro protegendo ativos sem valor e deixa portas abertas para ataques críticos. Em um cenário de auditoria ou due diligence de grandes clientes, a ausência deste processo é um sinal vermelho imediato, sugerindo que a gestão é reativa e imatura.

Além disso, a conformidade com leis como a LGPD exige que a organização demonstre que conhece seus riscos. A falha aqui pode resultar em multas pesadas e, pior, na perda de contratos com parceiros que exigem garantias de segurança robustas para compartilhar seus dados.

## ⚠️ O que acontece se você não faz isso
*   Investimento ineficiente de orçamento em ferramentas de segurança desnecessárias.
*   Exposição a ataques cibernéticos que poderiam ter sido previstos e mitigados.
*   Dificuldade em obter ou renovar seguros cibernéticos.
*   Reprovação em auditorias de certificação (como ISO 27001) e compliance regulatório.
*   Perda de confiança de investidores e parceiros de negócios.

## 🔍 Fatores que você deve analisar
1.  Quais são os ativos de informação mais críticos para a operação do negócio?
2.  Quais ameaças externas (hackers, desastres naturais) e internas (erros de funcionários) são mais prováveis?
3.  Qual é o impacto financeiro e jurídico se os dados de clientes forem vazados?
4.  As vulnerabilidades técnicas de sistemas e processos são revisadas periodicamente?
5.  A metodologia de cálculo de risco leva em conta a probabilidade e o impacto de forma clara?
6.  Quem são os "donos dos riscos" responsáveis por aceitar ou tratar as ameaças identificadas?

## 💡 Dicas práticas de implementação
1.  **Defina a Metodologia:** Escolha um critério simples (ex: Baixo, Médio, Alto) para medir impacto e probabilidade.
2.  **Inventarie os Ativos:** Liste o que precisa ser protegido (servidores, bancos de dados, processos manuais).
3.  **Realize Workshops:** Reúna gestores de diferentes áreas para identificar riscos que a TI sozinha não enxerga.
4.  **Documente os Resultados:** Mantenha um Registro de Riscos (planilha ou sistema) atualizado com as descobertas.
5.  **Priorize o Tratamento:** Foque primeiro nos riscos "Críticos" e "Altos" antes de tentar resolver problemas menores.'),
       exemplos_evidencias      = COALESCE(NULLIF(r.exemplos_evidencias, ''), '- Política de Gestão de Riscos de Segurança da Informação aprovada pela diretoria.
- Metodologia de Avaliação de Riscos detalhando critérios de probabilidade e impacto.
- Relatório de Inventário de Ativos de Informação com classificação de criticidade.
- Planilha ou Sistema de Registro de Riscos (Risk Register) preenchido.
- Atas de reuniões do Comitê de Segurança onde os riscos foram discutidos.
- Relatórios de análise de vulnerabilidades integrados ao processo de risco.
- Plano de Tratamento de Riscos (PTR) com ações, prazos e responsáveis definidos.
- Evidência de aprovação formal dos riscos residuais pelos donos das áreas de negócio.'),
       perguntas_diagnostico    = COALESCE(NULLIF(r.perguntas_diagnostico, ''), '[
  {"pergunta": "Existe uma metodologia formal e documentada para avaliar riscos de segurança?", "peso": 3},
  {"pergunta": "A organização realiza avaliações de risco em intervalos planejados ou quando ocorrem mudanças significativas?", "peso": 2},
  {"pergunta": "Os impactos financeiros, operacionais e legais são considerados na análise de riscos?", "peso": 2},
  {"pergunta": "Os resultados das avaliações de risco são apresentados e aprovados pela alta gestão?", "peso": 1},
  {"pergunta": "Existe um registro atualizado contendo as ameaças, vulnerabilidades e os respectivos donos de cada risco?", "peso": 3}
]')
  FROM public.gap_analysis_frameworks f
 WHERE f.id = r.framework_id
   AND f.nome = 'ISO/IEC 27001'
   AND r.codigo = '6.1.2'
   AND COALESCE(r.orientacao_implementacao, '') = '';

UPDATE public.gap_analysis_requirements r
   SET orientacao_implementacao = COALESCE(NULLIF(r.orientacao_implementacao, ''), '## 📋 O que este requisito significa
Este requisito estabelece que a segurança da informação não deve ser baseada em ações isoladas ou na "boa vontade" dos funcionários, mas sim em um conjunto de regras formais. É o alicerce de todo o programa de segurança, onde a alta gestão define as diretrizes e expectativas da organização.

Na prática, significa que a empresa precisa ter um documento principal (Política de Segurança da Informação - PSI) e normas específicas que cubram temas como senhas, uso de ativos e privacidade. Esses documentos precisam ser validados pela diretoria, estarem acessíveis a todos e serem comunicados de forma clara.

## 🎯 Por que isso importa para sua empresa
Sem políticas aprovadas, a empresa fica juridicamente vulnerável. Em caso de um incidente causado por um funcionário, a falta de uma política clara dificulta a aplicação de medidas disciplinares ou a defesa em processos trabalhistas e cíveis.

Além disso, grandes clientes e parceiros de negócios exigem a comprovação dessas políticas em processos de *due diligence*. Não ter essas diretrizes formalizadas pode significar a perda de contratos importantes e a exclusão de mercados regulados que exigem conformidade com padrões como a ISO 27001.

## ⚠️ O que acontece se você não faz isso
*   **Inconsistência operacional:** Cada colaborador decide o que considera "seguro", gerando brechas críticas.
*   **Dificuldade em auditorias:** Falha automática em certificações e auditorias de conformidade (LGPD, ISO, PCI-DSS).
*   **Imunidade a sanções:** Impossibilidade de responsabilizar legalmente usuários por mau uso de recursos tecnológicos.
*   **Desorientação em crises:** Em caso de incidentes, a equipe não sabe quais protocolos seguir, aumentando o tempo de recuperação e o prejuízo financeiro.

## 🔍 Fatores que você deve analisar
1. Existe uma Política de Segurança da Informação (PSI) formalmente escrita?
2. A alta direção assinou e aprovou formalmente esses documentos nos últimos 12 meses?
3. Todos os colaboradores (incluindo terceiros) têm fácil acesso a essas políticas?
4. Há evidências de que os funcionários leram e compreenderam as regras (ex: termo de aceite)?
5. As políticas são revisadas periodicamente ou quando ocorrem mudanças significativas na empresa?
6. As políticas cobrem as necessidades específicas do negócio e requisitos legais (como a LGPD)?

## 💡 Dicas práticas de implementação
1. **Não reinvente a roda:** Utilize frameworks como a ISO 27002 como base, mas adapte o texto à realidade e cultura da sua empresa.
2. **Aprovação no topo:** Garanta que o CEO ou o Comitê de Riscos assine o documento; isso dá autoridade às regras.
3. **Linguagem acessível:** Evite termos técnicos complexos. A política deve ser compreendida pelo RH, Marketing e Vendas, não apenas pelo TI.
4. **Comunicação multicanal:** Não apenas envie por e-mail. Use treinamentos, avisos na intranet e integre a política no processo de integração (onboarding) de novos funcionários.
5. **Gestão de Versões:** Mantenha um histórico de revisões para provar a evolução do documento ao longo do tempo.'),
       exemplos_evidencias      = COALESCE(NULLIF(r.exemplos_evidencias, ''), '- Política de Segurança da Informação (PSI) assinada pela diretoria.
- Atas de reunião do Comitê de Segurança ou Diretoria aprovando as políticas.
- Logs de leitura ou termos de aceite assinados pelos colaboradores no sistema de RH.
- Capturas de tela da Intranet ou portal corporativo demonstrando a publicação das políticas.
- Registros de treinamentos de conscientização que mencionam as políticas específicas.
- Cronograma de revisão anual das políticas com o histórico de alterações realizadas.
- Lista de distribuição ou e-mails corporativos comunicando a publicação de novas normas.
- Evidência de integração da política nos contratos com fornecedores e terceiros.'),
       perguntas_diagnostico    = COALESCE(NULLIF(r.perguntas_diagnostico, ''), '[
  {"pergunta": "A organização possui uma Política de Segurança da Informação formalmente documentada?", "peso": 3},
  {"pergunta": "Existe evidência de aprovação das políticas pela alta gestão (ex: assinatura ou ata)?", "peso": 2},
  {"pergunta": "As políticas estão publicadas em local de fácil acesso para todos os colaboradores?", "peso": 2},
  {"pergunta": "Houve comunicação formal ou treinamento sobre as políticas nos últimos 12 meses?", "peso": 1},
  {"pergunta": "As políticas são revisadas anualmente ou quando ocorrem mudanças organizacionais?", "peso": 1}
]')
  FROM public.gap_analysis_frameworks f
 WHERE f.id = r.framework_id
   AND f.nome = 'ISO/IEC 27001'
   AND r.codigo = 'A.5.1'
   AND COALESCE(r.orientacao_implementacao, '') = '';

UPDATE public.gap_analysis_requirements r
   SET orientacao_implementacao = COALESCE(NULLIF(r.orientacao_implementacao, ''), '## 📋 O que este requisito significa
Este requisito estabelece que a empresa deve definir claramente o que os colaboradores e terceiros podem ou não fazer com as informações e equipamentos (laptops, celulares, sistemas) fornecidos pela organização. Não basta ter a tecnologia; é preciso ter regras de conduta documentadas.

Na prática, trata-se de criar um "manual de etiqueta e segurança" que oriente o uso profissional dos recursos, evitando que o patrimônio da empresa seja utilizado para fins ilícitos, perigosos ou que fujam do propósito do negócio.

## 🎯 Por que isso importa para sua empresa
Sem regras claras, a empresa fica juridicamente vulnerável. Se um funcionário comete um crime digital usando o notebook corporativo e não há uma política de uso aceitável assinada, a organização pode ser responsabilizada solidariamente por omissão ou falta de vigilância.

Além disso, o uso indevido de ativos é a porta de entrada para a maioria dos incidentes de segurança. O download de softwares piratas ou o acesso a sites maliciosos por falta de orientação pode paralisar a operação e causar prejuízos financeiros diretos e danos irreversíveis à imagem perante o mercado.

## ⚠️ O que acontece se você não faz isso
*   Dificuldade em aplicar sanções disciplinares ou demissões por justa causa por mau uso de tecnologia.
*   Aumento drástico do risco de infecção por malwares e sequestro de dados (Ransomware).
*   Vazamento involuntário de dados confidenciais por uso de ferramentas de armazenamento pessoal não autorizadas.
*   Responsabilização civil e criminal da empresa por atos ilícitos praticados por colaboradores.
*   Não conformidade em auditorias de ISO 27001, SOC2 ou exigências contratuais de grandes clientes.

## 🔍 Fatores que você deve analisar
1. Existe uma Política de Uso Aceitável (PUA) formalmente escrita e aprovada pela diretoria?
2. Todos os funcionários e prestadores de serviço assinaram um termo de ciência sobre essas regras?
3. As regras cobrem o uso de redes sociais, e-mail corporativo e dispositivos móveis?
4. Está claro para o usuário que ele não deve ter expectativa de privacidade ao usar recursos da empresa?
5. Existem proibições explícitas sobre a instalação de softwares não autorizados?
6. A empresa revisa essas regras anualmente para adaptá-las a novas tecnologias (como IA generativa)?

## 💡 Dicas práticas de implementação
1. **Redija a Política:** Crie um documento curto e objetivo, evitando termos jurídicos complexos para que todos entendam.
2. **Classifique os Ativos:** Diferencie as regras para o que é físico (hardware) e o que é digital (informação/dados).
3. **Formalize a Ciência:** Utilize assinaturas digitais ou ferramentas de RH para garantir que 100% dos colaboradores leram e aceitaram os termos.
4. **Treine a Equipe:** Realize pílulas de conhecimento ou treinamentos rápidos explicando exemplos práticos do que é "uso aceitável".
5. **Monitore e Reforce:** Utilize filtros de conteúdo web e bloqueios de instalação para apoiar tecnicamente o que diz a política.'),
       exemplos_evidencias      = COALESCE(NULLIF(r.exemplos_evidencias, ''), '- Política de Uso Aceitável de Ativos e Informação aprovada e datada.
- Termos de Responsabilidade assinados individualmente por colaboradores e terceiros.
- Logs de sistemas de MDM (Mobile Device Management) demonstrando a aplicação de perfis de uso.
- Registros de treinamentos de conscientização em segurança com lista de presença ou logs de plataforma de e-learning.
- Evidência de bloqueio de sites de alto risco via Firewall ou Proxy alinhado à política.
- Relatórios de inventário de ativos vinculando equipamentos aos seus respectivos usuários responsáveis.'),
       perguntas_diagnostico    = COALESCE(NULLIF(r.perguntas_diagnostico, ''), '[
  {"pergunta": "A organização possui uma Política de Uso Aceitável documentada e aprovada?", "peso": 3},
  {"pergunta": "Existem termos de responsabilidade assinados por todos os colaboradores que utilizam ativos da empresa?", "peso": 3},
  {"pergunta": "A política proíbe explicitamente a instalação de softwares não autorizados e o compartilhamento de senhas?", "peso": 2},
  {"pergunta": "Os colaboradores passam por treinamentos periódicos sobre como manusear informações e ativos com segurança?", "peso": 1},
  {"pergunta": "A empresa revisou as regras de uso aceitável nos últimos 12 meses para incluir novas tecnologias (ex: ChatGPT/IA)?", "peso": 1}
]')
  FROM public.gap_analysis_frameworks f
 WHERE f.id = r.framework_id
   AND f.nome = 'ISO/IEC 27001'
   AND r.codigo = 'A.5.10'
   AND COALESCE(r.orientacao_implementacao, '') = '';

UPDATE public.gap_analysis_requirements r
   SET orientacao_implementacao = COALESCE(NULLIF(r.orientacao_implementacao, ''), '## 📋 O que este requisito significa
Este requisito estabelece que a segurança da informação não deve ser "terra de ninguém". Ele exige que a organização defina claramente quem é responsável pelo quê, desde a alta gestão até os níveis operacionais, garantindo que as tarefas de proteção de dados estejam formalmente atribuídas.

Na prática, significa que cada colaborador deve saber exatamente quais são suas obrigações de segurança e quem deve ser acionado em caso de incidentes. Não basta ter as funções; elas precisam estar documentadas e alinhadas com as políticas internas da empresa.

## 🎯 Por que isso importa para sua empresa
A ausência de papéis definidos gera o "vácuo de responsabilidade". Quando algo dá errado, como um vazamento de dados, a falta de um responsável claro atrasa a resposta, o que pode transformar um incidente pequeno em uma crise catastrófica com multas pesadas da LGPD.

Além disso, clientes corporativos e parceiros de negócios exigem cada vez mais provas de que a empresa possui uma estrutura de governança sólida. Demonstrar que a segurança tem "donos" aumenta a confiança do mercado e facilita o fechamento de novos contratos.

## ⚠️ O que acontece se você não faz isso
*   **Conflito de competências:** Duas pessoas tentando fazer a mesma coisa ou, pior, ninguém fazendo tarefas críticas.
*   **Lentidão em incidentes:** Perda de tempo precioso tentando descobrir quem tem autoridade para tomar decisões em crises.
*   **Falhas de auditoria:** Apontamentos graves em certificações como ISO 27001 ou auditorias de conformidade.
*   **Sobrecarga do TI:** O departamento de tecnologia acaba assumindo responsabilidades de negócio que não deveriam ser dele.

## 🔍 Fatores que você deve analisar
1. Existe um comitê de segurança da informação formalizado com participação da diretoria?
2. As descrições de cargo (JDs) incluem as responsabilidades de segurança específicas da função?
3. Há um Gestor de Segurança da Informação (CISO) ou equivalente nomeado?
4. Os proprietários de ativos (donos de sistemas e dados) foram identificados e notificados?
5. As responsabilidades por atividades de terceiros e prestadores de serviço estão claras?
6. A segregação de funções é respeitada para evitar que uma única pessoa controle um processo do início ao fim?

## 💡 Dicas práticas de implementação
1. **Crie uma Matriz RACI:** Mapeie as principais atividades de segurança e defina quem é Responsável, Prestador de Contas, Consultado e Informado.
2. **Atualize Contratos:** Inclua cláusulas de responsabilidade de segurança nos contratos de trabalho e com fornecedores.
3. **Formalize um Comitê:** Reúna líderes de diferentes áreas (RH, Jurídico, TI, Operações) mensalmente para decidir sobre riscos.
4. **Comunique as Nomeações:** Envie um comunicado formal ou publique na intranet quem são os pontos de contato para cada tema de segurança.'),
       exemplos_evidencias      = COALESCE(NULLIF(r.exemplos_evidencias, ''), '- Matriz RACI de Segurança da Informação atualizada e aprovada pela diretoria.
- Descrições de cargos (Job Descriptions) contendo cláusulas de responsabilidade sobre proteção de dados.
- Atas de reunião do Comitê de Segurança da Informação ou Comitê de Riscos.
- Termos de Nomeação formal para o CISO (Chief Information Security Officer) ou Encarregado de Dados (DPO).
- Organograma da empresa destacando a estrutura de reporte da área de segurança.
- Política de Segurança da Informação com capítulo específico sobre estrutura organizacional.
- Evidência de treinamentos de integração onde as responsabilidades individuais foram apresentadas.
- Contratos com terceiros contendo o anexo de responsabilidades de segurança (DPA/Security Exhibit).'),
       perguntas_diagnostico    = COALESCE(NULLIF(r.perguntas_diagnostico, ''), '[
  {"pergunta": "A alta direção nomeou formalmente um responsável pela segurança da informação (CISO ou similar)?", "peso": 3},
  {"pergunta": "Existe uma matriz de responsabilidades (ex: RACI) que defina os papéis de segurança para cada processo crítico?", "peso": 2},
  {"pergunta": "As responsabilidades de segurança estão documentadas nas descrições de cargo dos colaboradores?", "peso": 1},
  {"pergunta": "Os ''donos'' dos ativos de informação (sistemas e bases de dados) foram formalmente identificados?", "peso": 2},
  {"pergunta": "Existe um comitê multidisciplinar que se reúne periodicamente para tratar de temas de governança e riscos?", "peso": 2}
]')
  FROM public.gap_analysis_frameworks f
 WHERE f.id = r.framework_id
   AND f.nome = 'ISO/IEC 27001'
   AND r.codigo = 'A.5.2'
   AND COALESCE(r.orientacao_implementacao, '') = '';

UPDATE public.gap_analysis_requirements r
   SET orientacao_implementacao = COALESCE(NULLIF(r.orientacao_implementacao, ''), '## 📋 O que este requisito significa
A segregação de funções (SoD - *Segregation of Duties*) é o princípio de que nenhuma pessoa deve ter o controle total sobre todas as etapas de um processo crítico. Na prática, significa dividir as tarefas de modo que o erro ou a fraude de um indivíduo sejam detectados por outro.

Imagine que a mesma pessoa que cadastra um fornecedor no sistema também aprova o pagamento e faz a conciliação bancária. Sem a segregação, essa pessoa poderia criar um fornecedor fantasma e desviar recursos sem ser notada. Este requisito exige que funções conflitantes sejam identificadas e atribuídas a pessoas diferentes.

## 🎯 Por que isso importa para sua empresa
A ausência de segregação é a porta de entrada para fraudes internas e erros operacionais catastróficos. Para empresas que buscam certificações como a ISO 27001 ou conformidade com a LGPD e SOX, este controle é inegociável.

Além de evitar perdas financeiras diretas, a segregação protege a reputação da organização perante investidores e clientes. Uma falha de segurança causada por um "superusuário" com acessos excessivos pode resultar em multas pesadas e na quebra da confiança do mercado, algo que leva anos para ser reconstruído.

## ⚠️ O que acontece se você não faz isso
*   **Fraudes Internas:** Facilitação para desvio de ativos, manipulação de dados financeiros ou roubo de propriedade intelectual.
*   **Erros Não Detectados:** Falhas humanas em processos críticos passam despercebidas por falta de uma "segunda camada" de revisão.
*   **Acessos Excessivos:** Acúmulo de privilégios (o funcionário muda de área, mas mantém os acessos da função anterior).
*   **Sanções Regulatórias:** Reprovação em auditorias externas e impossibilidade de obter selos de conformidade.

## 🔍 Fatores que você deve analisar
1. Existe uma matriz formal que identifica quais funções são consideradas conflitantes na empresa?
2. O processo de concessão de acessos aos sistemas verifica se o novo perfil conflita com o atual?
3. Há revisões periódicas (pelo menos semestrais) dos acessos concedidos aos colaboradores?
4. Em processos críticos (como pagamentos ou alteração de código-fonte), o sistema impede tecnicamente que o mesmo usuário execute todas as etapas?
5. Quando a segregação não é possível (em times muito pequenos), existem controles compensatórios, como logs de auditoria revisados pela gerência?

## 💡 Dicas práticas de implementação
1. **Mapeie os Processos Críticos:** Identifique onde estão os maiores riscos (Financeiro, TI/Desenvolvimento, RH).
2. **Crie uma Matriz SoD:** Liste as atividades e marque quais não podem ser executadas pela mesma pessoa (ex: Desenvolvedor vs. Aprovador de Produção).
3. **Automatize via Perfis de Acesso:** Configure o ERP ou sistemas internos com perfis baseados em funções (*Role-Based Access Control*), limitando o acesso ao mínimo necessário.
4. **Estabeleça Fluxos de Aprovação:** Garanta que toda ação sensível exija a aprovação de uma segunda pessoa no sistema.'),
       exemplos_evidencias      = COALESCE(NULLIF(r.exemplos_evidencias, ''), '- Matriz de Segregação de Funções (Matriz SoD) documentada e aprovada.
- Relatórios de revisão de acessos (User Access Review) assinados pelos gestores de área.
- Configuração de perfis de acesso no ERP demonstrando a separação de privilégios.
- Logs de sistema mostrando que o usuário que solicita uma alteração não é o mesmo que a aprova.
- Política de Controle de Acesso atualizada prevendo o princípio do privilégio mínimo.
- Evidência de testes de auditoria interna realizados sobre processos de pagamento ou mudança de código.
- Descrições de cargos (Job Descriptions) que delimitam claramente as responsabilidades de cada função.
- Workflow de aprovação de tickets de acesso com a validação do proprietário da informação.'),
       perguntas_diagnostico    = COALESCE(NULLIF(r.perguntas_diagnostico, ''), '[
  {"pergunta": "A empresa possui uma matriz formal que identifica quais funções ou acessos são conflitantes?", "peso": 3},
  {"pergunta": "O processo de criação de novos usuários no sistema inclui uma validação de conflito de funções?", "peso": 2},
  {"pergunta": "Existe uma separação clara entre quem desenvolve código e quem aprova a subida para o ambiente de produção?", "peso": 2},
  {"pergunta": "Os acessos dos colaboradores são revisados formalmente pelo menos uma vez ao ano?", "peso": 1},
  {"pergunta": "Em casos onde a segregação é impossível, existem logs de auditoria que são revisados por um superior?", "peso": 2}
]')
  FROM public.gap_analysis_frameworks f
 WHERE f.id = r.framework_id
   AND f.nome = 'ISO/IEC 27001'
   AND r.codigo = 'A.5.3'
   AND COALESCE(r.orientacao_implementacao, '') = '';

UPDATE public.gap_analysis_requirements r
   SET orientacao_implementacao = COALESCE(NULLIF(r.orientacao_implementacao, ''), '## 📋 O que este requisito significa
Este requisito estabelece que a segurança da informação não é apenas uma responsabilidade do departamento de TI, mas sim um dever de liderança. A direção da empresa deve exigir formalmente que todos os colaboradores e terceiros sigam as regras estabelecidas nas políticas de segurança.

Na prática, significa que os executivos e gestores devem "dar o tom" (Tone at the Top), garantindo que as normas de segurança sejam comunicadas, compreendidas e, acima de tudo, praticadas no dia a dia de todas as áreas de negócio.

## 🎯 Por que isso importa para sua empresa
Sem o apoio explícito da direção, as políticas de segurança tornam-se apenas "papel guardado na gaveta". Quando a liderança não exige o cumprimento, cria-se uma cultura de permissividade onde os funcionários ignoram controles, aumentando drasticamente a probabilidade de incidentes graves.

Além disso, em auditorias de certificação (como ISO 27001) ou due diligence de grandes clientes, a falta de evidências do comprometimento da direção é considerada uma falha crítica, podendo impedir o fechamento de contratos importantes e gerar multas por descumprimento contratual ou regulatório.

## ⚠️ O que acontece se você não faz isso
*   Criação de uma cultura organizacional onde a segurança é vista como um obstáculo, não como um valor.
*   Aumento do risco de "Shadow IT", onde áreas de negócio contratam softwares sem validação de segurança.
*   Dificuldade em aplicar sanções disciplinares em caso de violações, por falta de respaldo da alta gestão.
*   Responsabilização legal direta dos diretores em caso de vazamento de dados por negligência de supervisão.

## 🔍 Fatores que você deve analisar
1. A direção revisa e aprova formalmente as políticas de segurança da informação anualmente?
2. Existe uma comunicação clara vinda da diretoria sobre a importância da segurança para o negócio?
3. Os gestores de cada área cobram seus liderados sobre o uso correto de senhas, bloqueio de telas e proteção de dados?
4. A empresa possui um processo de integração onde as responsabilidades de segurança são apresentadas aos novos colaboradores?
5. A direção aloca orçamento e recursos suficientes para que as políticas possam ser seguidas?
6. Existe um canal de denúncias ou reporte para quando as diretrizes de segurança são ignoradas?

## 💡 Dicas práticas de implementação
1. **Mensagem da Liderança:** Peça ao CEO ou Diretor Geral para enviar um e-mail semestral a toda a empresa reforçando o compromisso com a segurança da informação.
2. **Termo de Responsabilidade:** Garanta que todos os colaboradores assinem um termo de ciência e responsabilidade sobre as políticas de segurança no ato da contratação.
3. **Indicadores para a Diretoria:** Apresente mensalmente indicadores de conformidade (ex: % de colaboradores treinados) em reuniões de diretoria.
4. **Cláusulas Contratuais:** Inclua obrigatoriedades de segurança nos contratos com fornecedores e parceiros, aprovadas pelo jurídico e direção.
5. **Treinamento de Liderança:** Realize workshops específicos para gestores sobre como eles devem cobrar segurança de suas equipes.'),
       exemplos_evidencias      = COALESCE(NULLIF(r.exemplos_evidencias, ''), '- Ata de reunião da diretoria aprovando a Política de Segurança da Informação (PSI).
- E-mail institucional enviado pelo CEO reforçando a importância da conformidade com as políticas.
- Termos de Confidencialidade e Responsabilidade assinados por todos os funcionários.
- Relatórios de indicadores de segurança apresentados em reuniões de comitê executivo.
- Registro de treinamentos de conscientização com lista de presença e notas de avaliação.
- Evidência de aplicação de medidas disciplinares em casos de violação intencional das políticas.
- Descrições de cargos que incluam responsabilidades específicas sobre segurança da informação.
- Plano de comunicação interna contendo o cronograma de divulgação das diretrizes de segurança.'),
       perguntas_diagnostico    = COALESCE(NULLIF(r.perguntas_diagnostico, ''), '[
  {"pergunta": "A alta direção aprovou e assinou formalmente as políticas de segurança da informação nos últimos 12 meses?", "peso": 3},
  {"pergunta": "Existe uma comunicação periódica da diretoria para toda a empresa sobre a obrigatoriedade de seguir as normas de segurança?", "peso": 2},
  {"pergunta": "Os gestores de áreas não-técnicas (RH, Financeiro, Vendas) monitoram se suas equipes estão cumprindo as regras de segurança?", "peso": 2},
  {"pergunta": "Todos os colaboradores assinaram um termo de responsabilidade comprometendo-se a seguir as políticas da organização?", "peso": 1},
  {"pergunta": "A direção disponibiliza os recursos necessários (tempo, verba e pessoal) para a execução do programa de segurança?", "peso": 2}
]')
  FROM public.gap_analysis_frameworks f
 WHERE f.id = r.framework_id
   AND f.nome = 'ISO/IEC 27001'
   AND r.codigo = 'A.5.4'
   AND COALESCE(r.orientacao_implementacao, '') = '';

UPDATE public.gap_analysis_requirements r
   SET orientacao_implementacao = COALESCE(NULLIF(r.orientacao_implementacao, ''), '## 📋 O que este requisito significa
Este controle trata da necessidade de a empresa saber exatamente com quem falar em órgãos governamentais, agências reguladoras e forças policiais antes que um problema aconteça. Não se trata apenas de ter um telefone na agenda, mas de estabelecer canais formais de comunicação para reportar incidentes de segurança, violações de dados ou atividades suspeitas.

Manter esse contato significa que a organização é proativa. Em vez de tentar descobrir quem é o responsável pela delegacia de crimes cibernéticos ou pela ANPD no meio de uma crise, a empresa já possui um fluxo definido e sabe quais informações deve fornecer e em qual formato.

## 🎯 Por que isso importa para sua empresa
Em um cenário de crise, como um ataque de ransomware ou vazamento de dados, o tempo é o seu maior inimigo. Ter canais estabelecidos acelera a resposta e pode reduzir drasticamente o valor de multas regulatórias, já que a colaboração imediata é vista como um fator atenuante por órgãos como a ANPD.

Além disso, a confiança do mercado aumenta. Clientes e parceiros de negócios sentem-se mais seguros ao saber que a empresa opera dentro da legalidade e possui maturidade para interagir com autoridades de forma profissional, protegendo a continuidade do negócio e a reputação da marca.

## ⚠️ O que acontece se você não faz isso
*   Atraso crítico na resposta a incidentes que exigem notificação legal obrigatória.
*   Risco de multas pesadas por descumprimento de prazos regulatórios (como os da LGPD).
*   Dificuldade em obter apoio policial ou judicial em casos de fraudes ou ataques externos.
*   Danos à reputação por parecer que a empresa está tentando "esconder" informações das autoridades.
*   Perda de licenças de operação em setores altamente regulados (financeiro, saúde, energia).

## 🔍 Fatores que você deve analisar
1. A empresa possui uma lista atualizada com os contatos de autoridades relevantes (Polícia Federal, ANPD, BACEN, etc.)?
2. Existe um procedimento claro definindo QUEM está autorizado a falar em nome da empresa com essas autoridades?
3. A equipe de resposta a incidentes sabe em quais situações é obrigatório notificar um órgão externo?
4. Os contatos são revisados periodicamente para garantir que os nomes e telefones ainda são válidos?
5. Existe um registro (log) de todas as interações e informações compartilhadas com autoridades?

## 💡 Dicas práticas de implementação
*   **Mapeie as autoridades:** Identifique quais órgãos regulam seu setor e quais delegacias atendem sua região.
*   **Crie uma Matriz de Contatos:** Documente nomes, cargos, e-mails e telefones de emergência, mantendo isso em local seguro e offline.
*   **Defina Porta-vozes:** Determine que apenas o Jurídico, o DPO ou o CISO podem realizar esses contatos para evitar informações desencontradas.
*   **Estabeleça Gatilhos:** Crie uma regra simples: "Se o incidente X afetar Y pessoas, a autoridade Z deve ser avisada em até 24 horas".
*   **Simule o contato:** Uma vez por ano, verifique se os canais de denúncia ou portais das autoridades estão funcionando e se as credenciais de acesso da empresa estão ativas.'),
       exemplos_evidencias      = COALESCE(NULLIF(r.exemplos_evidencias, ''), '- Lista de contatos de autoridades e órgãos reguladores atualizada nos últimos 12 meses.
- Procedimento documentado de resposta a incidentes contendo a etapa de notificação externa.
- Matriz de responsabilidades (RACI) indicando quem contata cada autoridade.
- Registros de e-mails ou protocolos de notificações enviadas a órgãos reguladores em incidentes passados.
- Comprovante de participação em fóruns, grupos de trabalho ou associações de classe que interagem com o governo.
- Ata de reunião de revisão crítica onde a lista de contatos foi validada pela diretoria.
- Logs de acesso ao portal da ANPD ou outros órgãos reguladores setoriais.
- Contrato ou termo de nomeação do DPO (Encarregado de Dados) protocolado na autoridade competente.'),
       perguntas_diagnostico    = COALESCE(NULLIF(r.perguntas_diagnostico, ''), '[
  {"pergunta": "A organização possui uma lista de contatos de autoridades relevantes (ex: ANPD, Polícia, Órgãos Reguladores) documentada e atualizada?", "peso": 3},
  {"pergunta": "Existem critérios definidos sobre quando e quais tipos de incidentes devem ser reportados às autoridades?", "peso": 2},
  {"pergunta": "Foi designado formalmente quem são as pessoas autorizadas a realizar a comunicação com as autoridades?", "peso": 2},
  {"pergunta": "A lista de contatos de emergência das autoridades está disponível em local acessível mesmo em caso de queda total dos sistemas (ex: cópia física ou offline)?", "peso": 1},
  {"pergunta": "A empresa mantém registros ou protocolos de todas as comunicações oficiais realizadas com órgãos governamentais?", "peso": 1}
]')
  FROM public.gap_analysis_frameworks f
 WHERE f.id = r.framework_id
   AND f.nome = 'ISO/IEC 27001'
   AND r.codigo = 'A.5.5'
   AND COALESCE(r.orientacao_implementacao, '') = '';

UPDATE public.gap_analysis_requirements r
   SET orientacao_implementacao = COALESCE(NULLIF(r.orientacao_implementacao, ''), '## 📋 O que este requisito significa
Este controle trata da necessidade de a empresa manter um relacionamento ativo e estruturado com entidades externas especializadas, como associações de classe, fóruns de segurança da informação, grupos de resposta a incidentes e órgãos reguladores. Não basta apenas saber que eles existem; é preciso ter canais estabelecidos de comunicação.

A ideia é que a organização não opere em uma bolha. Ao participar desses grupos, a empresa recebe alertas antecipados sobre novas vulnerabilidades, tendências de ataques cibernéticos e atualizações em legislações, permitindo uma postura proativa em vez de apenas reagir a problemas já consolidados.

## 🎯 Por que isso importa para sua empresa
No cenário atual de ameaças, a colaboração é uma estratégia de defesa. Sem esses contatos, sua empresa pode demorar dias ou semanas para descobrir uma falha crítica que outros setores já mitigaram, tornando-a um "alvo fácil" por pura falta de informação atualizada.

Além disso, para empresas que buscam certificações (como a ISO 27001) ou que operam em setores regulados (financeiro, saúde, infraestrutura), a ausência dessa rede de contatos é vista como uma falha de maturidade. Isso pode resultar na perda de contratos com grandes clientes que exigem que seus fornecedores estejam inseridos no ecossistema de segurança.

## ⚠️ O que acontece se você não faz isso
*   **Atraso na Resposta:** Sua equipe gastará mais tempo "descobrindo a roda" durante um incidente que já possui solução conhecida em fóruns especializados.
*   **Obsolescência Normativa:** Risco de multas por descumprimento de novas regulamentações que foram discutidas e antecipadas em grupos de interesse.
*   **Isolamento Técnico:** Perda de acesso a melhores práticas de mercado, resultando em investimentos ineficientes em ferramentas de segurança.
*   **Dano à Reputação:** Em caso de vazamento, a falta de contato com órgãos competentes dificulta a gestão da crise e a comunicação oficial.

## 🔍 Fatores que você deve analisar
1. A empresa possui uma lista atualizada de associações e fóruns relevantes para o seu setor?
2. Existem profissionais específicos nomeados como pontos de contato para esses grupos?
3. Como a informação recebida desses grupos é compartilhada internamente com as áreas de TI e Riscos?
4. Participamos de eventos, webinars ou reuniões periódicas desses grupos de interesse?
5. Existe um orçamento ou tempo alocado para que os colaboradores participem dessas comunidades?
6. Temos canais de comunicação estabelecidos com autoridades policiais ou órgãos de proteção de dados (como a ANPD)?

## 💡 Dicas práticas de implementação
1. **Mapeamento:** Identifique ao menos três grupos relevantes (ex: CERT.br, ISACA, fóruns setoriais ou grupos de usuários de tecnologias que você utiliza).
2. **Formalização:** Crie uma planilha ou registro simples com o nome da entidade, o objetivo do contato, o link/e-mail e quem é o responsável interno por acompanhar.
3. **Assinatura de Alertas:** Inscreva os e-mails da equipe de segurança em newsletters de alertas de vulnerabilidades e boletins de segurança cibernética.
4. **Rotina de Compartilhamento:** Estabeleça uma reunião mensal rápida ou um canal no Teams/Slack para disseminar o que foi aprendido ou alertado nesses grupos.'),
       exemplos_evidencias      = COALESCE(NULLIF(r.exemplos_evidencias, ''), '- Lista de associações, fóruns e grupos de interesse com nomes de contatos e responsabilidades.
- Comprovantes de pagamento de anuidade ou filiação a entidades de classe (ex: Assespro, Brasscom, ISACA).
- E-mails ou logs de comunicação trocados com grupos de resposta a incidentes (como o CERT.br).
- Certificados de participação de colaboradores em eventos, workshops ou fóruns promovidos por esses grupos.
- Prints de telas de dashboards ou newsletters de segurança assinadas pela equipe técnica.
- Atas de reuniões internas de comitê onde foram discutidas informações obtidas em fóruns externos.'),
       perguntas_diagnostico    = COALESCE(NULLIF(r.perguntas_diagnostico, ''), '[
  {"pergunta": "A organização mantém uma lista formalizada de contatos com grupos especiais de interesse e autoridades?", "peso": 2},
  {"pergunta": "Existem responsabilidades definidas sobre quem deve interagir com cada grupo ou fórum externo?", "peso": 1},
  {"pergunta": "A empresa recebe e analisa regularmente alertas de segurança ou atualizações vindas desses grupos?", "peso": 3},
  {"pergunta": "As informações obtidas externamente são integradas ao processo de gestão de riscos ou resposta a incidentes?", "peso": 2},
  {"pergunta": "A organização participa ativamente de fóruns ou associações específicas do seu setor de atuação?", "peso": 1}
]')
  FROM public.gap_analysis_frameworks f
 WHERE f.id = r.framework_id
   AND f.nome = 'ISO/IEC 27001'
   AND r.codigo = 'A.5.6'
   AND COALESCE(r.orientacao_implementacao, '') = '';

UPDATE public.gap_analysis_requirements r
   SET orientacao_implementacao = COALESCE(NULLIF(r.orientacao_implementacao, ''), '## 📋 O que este requisito significa
A Inteligência de Ameaças (Threat Intelligence) consiste em coletar e analisar dados sobre ataques que estão acontecendo no mundo ou no seu setor para se antecipar a eles. Não basta apenas reagir a um vírus; é preciso entender quem são os atacantes, quais métodos eles usam e se a sua empresa está na mira.

Em termos práticos, é o processo de transformar dados brutos de segurança em conhecimento acionável. Isso permite que a equipe de TI saiba exatamente onde reforçar as defesas antes mesmo de uma tentativa de invasão ocorrer.

## 🎯 Por que isso importa para sua empresa
No cenário atual, os ataques são automatizados e escaláveis. Sem inteligência de ameaças, sua empresa está sempre um passo atrás dos criminosos, agindo apenas quando o estrago já foi feito. Estar atualizado permite priorizar investimentos onde o risco é real, evitando gastos desnecessários em ferramentas inúteis.

Além disso, a conformidade com a ISO 27001:2022 exige essa postura proativa. Demonstrar que a empresa monitora o cenário externo transmite confiança para grandes clientes e parceiros, sendo muitas vezes um diferencial competitivo em processos de due diligence e licitações.

## ⚠️ O que acontece se você não faz isso
*   **Vulnerabilidade a ataques conhecidos:** Sua empresa pode ser vítima de um golpe que já possui "vacina" disponível no mercado.
*   **Aumento do tempo de resposta:** Sem saber o que procurar, a detecção de uma invasão pode levar meses, aumentando o prejuízo financeiro.
*   **Danos à reputação:** Ser pego de surpresa por uma ameaça pública demonstra falta de maturidade e negligência com os dados de terceiros.
*   **Não conformidade:** Falha direta em auditorias de certificação ISO 27001, gerando não conformidades maiores.

## 🔍 Fatores que você deve analisar
1. Nós recebemos alertas de segurança de fontes confiáveis (governo, fabricantes, grupos de CSIRT)?
2. As informações recebidas são analisadas por alguém ou apenas arquivadas?
3. Utilizamos esses dados para atualizar nossas regras de firewall e antivírus?
4. Compartilhamos informações sobre ameaças internamente com as partes interessadas?
5. Existe um processo para identificar ameaças específicas para o nosso setor de atuação?
6. A alta gestão recebe relatórios estratégicos sobre o cenário de riscos cibernéticos?

## 💡 Dicas práticas de implementação
1. **Assine feeds gratuitos:** Comece acompanhando boletins de órgãos como o CERT.br e fabricantes de segurança que sua empresa já utiliza.
2. **Defina níveis de análise:** Separe a inteligência em Estratégica (tendências para a diretoria), Tática (técnicas de ataque para a TI) e Operacional (indicadores técnicos como IPs maliciosos).
3. **Automatize o bloqueio:** Configure suas ferramentas de segurança para importar automaticamente listas de reputação de IPs e URLs maliciosas conhecidas.
4. **Participe de comunidades:** Envolva sua equipe em grupos de troca de informações de segurança (ISACs) do seu setor econômico.'),
       exemplos_evidencias      = COALESCE(NULLIF(r.exemplos_evidencias, ''), '- Relatórios mensais de análise de tendências de ameaças cibernéticas.
- Prints de telas de feeds de inteligência configurados no SIEM ou Firewall.
- Atas de reuniões do comitê de segurança discutindo ameaças emergentes.
- E-mails de alertas de segurança enviados para a equipe técnica ou usuários.
- Lista de indicadores de comprometimento (IoCs) bloqueados preventivamente.
- Contrato ou termo de adesão a serviços pagos ou gratuitos de Threat Intelligence.
- Procedimento documentado de coleta e análise de inteligência de ameaças.
- Registro de atualizações de regras de detecção baseadas em novas ameaças identificadas.'),
       perguntas_diagnostico    = COALESCE(NULLIF(r.perguntas_diagnostico, ''), '[
  {"pergunta": "A organização possui um processo formal para coletar e analisar informações sobre ameaças de segurança?", "peso": 3},
  {"pergunta": "As informações de inteligência são utilizadas para atualizar as defesas técnicas (firewalls, antivírus, etc.) de forma sistemática?", "peso": 2},
  {"pergunta": "Existem fontes de informação externas (feeds, fóruns, alertas governamentais) sendo monitoradas regularmente?", "peso": 2},
  {"pergunta": "A inteligência de ameaças produzida é comunicada às partes interessadas e tomadores de decisão?", "peso": 1},
  {"pergunta": "A empresa avalia se as ameaças identificadas são relevantes para o seu contexto específico e setor de atuação?", "peso": 2}
]')
  FROM public.gap_analysis_frameworks f
 WHERE f.id = r.framework_id
   AND f.nome = 'ISO/IEC 27001'
   AND r.codigo = 'A.5.7'
   AND COALESCE(r.orientacao_implementacao, '') = '';

UPDATE public.gap_analysis_requirements r
   SET orientacao_implementacao = COALESCE(NULLIF(r.orientacao_implementacao, ''), '## 📋 O que este requisito significa
Este requisito estabelece que a segurança da informação não deve ser um "puxadinho" ou algo pensado apenas no final de um projeto. Ela deve ser parte integrante do DNA de qualquer iniciativa, desde a concepção (o famoso *Security by Design*) até a entrega final, seja no desenvolvimento de um novo produto, na mudança de um processo interno ou na implementação de um software.

Na prática, significa que o gerente de projeto e a equipe de segurança devem trabalhar juntos para identificar riscos de segurança logo no início, definindo requisitos de proteção e garantindo que eles sejam testados e validados ao longo de todo o cronograma.

## 🎯 Por que isso importa para sua empresa
Ignorar a segurança em projetos gera o retrabalho mais caro que existe: o de correção pós-lançamento. Se uma vulnerabilidade é descoberta apenas quando o produto já está no mercado, o custo de correção pode ser até 100 vezes maior do que se tivesse sido resolvida na fase de planejamento.

Além disso, empresas que não demonstram governança em seus projetos perdem contratos com grandes clientes (B2B) que exigem conformidade rigorosa. A segurança integrada garante que o projeto entregue valor real sem criar "portas abertas" para incidentes que podem paralisar a operação.

## ⚠️ O que acontece se você não faz isso
*   **Vazamento de dados por omissão:** Projetos lançados sem revisão de segurança frequentemente expõem dados sensíveis.
*   **Estouro de orçamento:** Necessidade de investimentos emergenciais para corrigir falhas críticas de segurança de última hora.
*   **Atrasos no cronograma:** O projeto pode ser barrado por auditorias ou pelo compliance na véspera do lançamento.
*   **Sanções Legais:** Descumprimento de leis como a LGPD, caso o projeto envolva dados pessoais sem os devidos controles.

## 🔍 Fatores que você deve analisar
1. A segurança da informação é discutida formalmente na reunião de abertura (*kick-off*) de todos os projetos?
2. Existe uma análise de riscos de segurança documentada para cada novo projeto relevante?
3. Os requisitos de segurança (ex: criptografia, controle de acesso) são listados junto com os requisitos funcionais?
4. A equipe de Segurança da Informação tem poder de veto ou voz ativa nas fases de aprovação do projeto?
5. Os testes de aceitação do projeto incluem testes específicos de segurança e vulnerabilidade?
6. Se o projeto envolve fornecedores externos, os requisitos de segurança estão previstos em contrato?

## 💡 Dicas práticas de implementação
1. **Inclua a Segurança no Workflow:** Adicione uma etapa obrigatória de "Avaliação de Impacto de Segurança" no seu software de gestão de projetos (Jira, Trello, MS Project).
2. **Defina Responsáveis:** Nomeie um "Security Champion" dentro da equipe do projeto para ser o ponto de contato com a área de segurança.
3. **Crie Checklists:** Desenvolva uma lista simples de verificação de segurança que todo gerente de projeto deve preencher no início de cada fase.
4. **Realize Portões de Decisão (Gate Reviews):** Não permita que o projeto avance para a fase de produção/execução sem uma assinatura ou validação formal da área de segurança.'),
       exemplos_evidencias      = COALESCE(NULLIF(r.exemplos_evidencias, ''), '- Metodologia de gestão de projetos atualizada incluindo tópicos de segurança da informação.
- Atas de reuniões de projeto onde riscos de segurança foram discutidos e mitigados.
- Relatórios de Análise de Impacto à Proteção de Dados (RIPD/DPIA) vinculados a projetos específicos.
- Documento de especificação de requisitos contendo cláusulas de segurança e privacidade.
- Evidências de testes de vulnerabilidade ou Pentests realizados antes do encerramento do projeto.
- Termo de aceite final do projeto assinado pelo Gestor de Segurança da Informação.
- Matriz de riscos do projeto contemplando ameaças cibernéticas e planos de resposta.
- Contratos com fornecedores de projetos contendo cláusulas de conformidade com políticas de segurança.'),
       perguntas_diagnostico    = COALESCE(NULLIF(r.perguntas_diagnostico, ''), '[
  {"pergunta": "A segurança da informação é integrada desde a fase de concepção/planejamento dos projetos?", "peso": 3},
  {"pergunta": "Existem requisitos de segurança documentados e aprovados para cada novo projeto?", "peso": 2},
  {"pergunta": "A área de Segurança da Informação revisa e aprova os projetos antes da entrada em produção?", "peso": 2},
  {"pergunta": "Os riscos de segurança identificados nos projetos são registrados em uma matriz de riscos oficial?", "peso": 1},
  {"pergunta": "Os critérios de aceitação dos projetos incluem a validação da eficácia dos controles de segurança?", "peso": 2}
]')
  FROM public.gap_analysis_frameworks f
 WHERE f.id = r.framework_id
   AND f.nome = 'ISO/IEC 27001'
   AND r.codigo = 'A.5.8'
   AND COALESCE(r.orientacao_implementacao, '') = '';

UPDATE public.gap_analysis_requirements r
   SET orientacao_implementacao = COALESCE(NULLIF(r.orientacao_implementacao, ''), '## 📋 O que este requisito significa
Este requisito estabelece que a organização deve saber exatamente quais dados e ferramentas possui. Não se trata apenas de listar computadores, mas de mapear onde a informação reside (nuvem, servidores, papel) e quem são os responsáveis por ela. É o alicerce de qualquer estratégia de segurança: você não consegue proteger o que não sabe que existe.

Manter esse inventário atualizado significa ter uma visão clara do ciclo de vida da informação, desde a sua criação até o descarte. Isso envolve identificar o valor da informação para o negócio e os ativos físicos ou lógicos (softwares, hardware, serviços de rede) que a sustentam.

## 🎯 Por que isso importa para sua empresa
Sem um inventário, a empresa fica cega diante de incidentes. Em caso de um vazamento de dados, a falta de controle sobre onde as informações estavam armazenadas pode levar a multas pesadíssimas da LGPD, pois a empresa não conseguirá explicar a extensão do dano às autoridades ou aos clientes.

Além disso, a ineficiência operacional gera custos desnecessários. Muitas empresas pagam por licenças de software que ninguém usa ou mantêm servidores antigos ligados que servem apenas como porta de entrada para hackers. Ter controle absoluto dos ativos transmite confiança para grandes clientes e parceiros de negócios durante auditorias de due diligence.

## ⚠️ O que acontece se você não faz isso
*   **Shadow IT:** Funcionários utilizam ferramentas e armazenam dados sensíveis em locais não autorizados pela TI.
*   **Recuperação Lenta:** Em um ataque de Ransomware, a empresa perde tempo tentando descobrir quais sistemas foram afetados em vez de agir na recuperação.
*   **Gastos Excessivos:** Compra duplicada de ativos ou manutenção de equipamentos obsoletos.
*   **Falha em Auditorias:** Impossibilidade de obter certificações como ISO 27001 ou passar em auditorias de conformidade regulatória.
*   **Risco de Segurança:** Ativos esquecidos (como servidores de teste) tornam-se vulnerabilidades abertas e não monitoradas.

## 🔍 Fatores que você deve analisar
1. Existe uma lista centralizada que inclui não apenas hardware, mas também ativos de informação e software?
2. Cada item do inventário possui um "dono" (custodiante) claramente definido e responsável por sua proteção?
3. O inventário é revisado periodicamente ou sempre que ocorre uma mudança significativa na infraestrutura?
4. A localização física ou lógica (ex: região da nuvem) de cada ativo está registrada?
5. O inventário diferencia o nível de criticidade de cada informação armazenada?
6. Existe um processo para incluir novos ativos e remover ativos descartados do inventário em tempo real?

## 💡 Dicas práticas de implementação
1.  **Defina o Escopo:** Comece pelos ativos que sustentam os processos mais críticos do seu negócio.
2.  **Nomeie Responsáveis:** Atribua cada grupo de ativos a um gestor de área; ele deve validar a existência dos itens anualmente.
3.  **Use Ferramentas de Descoberta:** Utilize softwares que escaneiam a rede automaticamente para encontrar dispositivos e softwares conectados.
4.  **Classifique a Informação:** Adicione uma coluna no seu inventário para o nível de sensibilidade (ex: Público, Interno, Confidencial).
5.  **Padronize o Registro:** Mantenha campos essenciais como: ID do ativo, Descrição, Proprietário, Localização e Versão (para software).'),
       exemplos_evidencias      = COALESCE(NULLIF(r.exemplos_evidencias, ''), '- Planilha ou sistema de Gerenciamento de Configuração (CMDB) atualizado.
- Política de Gestão de Ativos formalmente aprovada pela diretoria.
- Relatórios de varredura de rede (network scans) confrontados com o inventário manual.
- Termos de responsabilidade assinados por gestores de ativos.
- Registros de logs de alteração no inventário (histórico de entradas e saídas).
- Evidência de reuniões de revisão periódica do inventário de ativos.
- Lista de licenças de software e serviços de nuvem ativos.
- Procedimento documentado para a manutenção e atualização do inventário.'),
       perguntas_diagnostico    = COALESCE(NULLIF(r.perguntas_diagnostico, ''), '[
  {"pergunta": "A organização possui um inventário formal que inclui ativos de informação, software e hardware?", "peso": 3},
  {"pergunta": "Todos os ativos listados possuem um proprietário (owner) designado e identificado no registro?", "peso": 2},
  {"pergunta": "O inventário é revisado e atualizado em intervalos planejados (ex: semestral ou anualmente)?", "peso": 2},
  {"pergunta": "Existe um processo para identificar e registrar a localização (física ou lógica) de ativos críticos?", "peso": 1},
  {"pergunta": "A organização consegue identificar rapidamente quais ativos processam dados pessoais ou sensíveis através do inventário?", "peso": 3}
]')
  FROM public.gap_analysis_frameworks f
 WHERE f.id = r.framework_id
   AND f.nome = 'ISO/IEC 27001'
   AND r.codigo = 'A.5.9'
   AND COALESCE(r.orientacao_implementacao, '') = '';

UPDATE public.gap_analysis_requirements r
   SET orientacao_implementacao = COALESCE(NULLIF(r.orientacao_implementacao, ''), '## 📋 O que este requisito significa
Este requisito exige que a empresa crie um documento oficial que dite as regras sobre como os dados pessoais (de clientes, funcionários e fornecedores) são tratados. Não é apenas um texto no site, mas uma diretriz interna e externa que define o compromisso da organização com a privacidade.

A política deve detalhar o ciclo de vida dos dados: desde o momento em que são coletados, para que finalidade são usados, com quem são compartilhados e quando serão excluídos. É a "constituição" da privacidade dentro da sua operação.

## 🎯 Por que isso importa para sua empresa
Ter uma política de privacidade clara é o primeiro passo para a conformidade com a LGPD. Sem ela, a empresa opera no "escuro", aumentando drasticamente a chance de incidentes de segurança e uso indevido de informações, o que pode gerar multas pesadas da ANPD.

Além disso, o mercado hoje exige transparência. Grandes parceiros comerciais e clientes finais preferem fazer negócios com empresas que demonstram respeito à privacidade. Uma política bem estruturada serve como um diferencial competitivo e um selo de maturidade institucional.

## ⚠️ O que acontece se você não faz isso
*   Exposição a sanções administrativas e multas que podem chegar a 2% do faturamento.
*   Dificuldade em responder a requisições de titulares (clientes perguntando o que você sabe sobre eles).
*   Bloqueio em processos de compras (Procurement) de grandes empresas que exigem conformidade.
*   Incapacidade de provar "boa-fé" em caso de vazamento de dados perante a justiça.

## 🔍 Fatores que você deve analisar
1. Nós sabemos exatamente quais dados pessoais coletamos hoje?
2. Existe uma finalidade específica e legal para cada dado armazenado?
3. A política está escrita em linguagem simples que qualquer cliente entenda?
4. O documento prevê como o usuário pode solicitar a exclusão de seus dados?
5. A política foi aprovada pela diretoria e é comunicada a todos os novos funcionários?
6. Sabemos com quais terceiros (nuvem, contabilidade, marketing) compartilhamos esses dados?

## 💡 Dicas práticas de implementação
1.  **Mapeamento Inicial:** Identifique quais dados você coleta (nome, CPF, e-mail, cookies) e por onde eles entram.
2.  **Redação Transparente:** Escreva o documento evitando o "juridiquês". Foque em ser claro sobre o "porquê" de coletar cada dado.
3.  **Canais de Contato:** Inclua claramente o contato do Encarregado de Dados (DPO) para dúvidas.
4.  **Aprovação e Publicação:** Formalize o documento com a liderança e publique-o em local visível (site e intranet).
5.  **Revisão Periódica:** Estabeleça uma data anual para revisar a política, garantindo que ela ainda reflete a realidade da empresa.'),
       exemplos_evidencias      = COALESCE(NULLIF(r.exemplos_evidencias, ''), '- Cópia da Política de Privacidade atualizada e aprovada pela diretoria.
- Print do rodapé do site institucional contendo o link direto para a política.
- Registro de log ou aceite dos usuários aos termos da política em sistemas ou aplicativos.
- Termo de ciência assinado por funcionários sobre as diretrizes de privacidade.
- Ata de reunião ou e-mail de comunicação interna disparado para toda a empresa sobre a publicação da política.
- Evidência de treinamento realizado com a equipe sobre o conteúdo da política de privacidade.
- Relatório de mapeamento de dados (Data Mapping) que serviu de base para a política.
- Cláusulas padrão de privacidade incluídas em contratos com fornecedores críticos.'),
       perguntas_diagnostico    = COALESCE(NULLIF(r.perguntas_diagnostico, ''), '[
  {"pergunta": "A empresa possui uma Política de Privacidade formalizada e aprovada pela alta gestão?", "peso": 3},
  {"pergunta": "A política descreve claramente a finalidade da coleta de cada dado pessoal?", "peso": 2},
  {"pergunta": "Existe um canal de contato fácil e visível para o titular de dados exercer seus direitos?", "peso": 2},
  {"pergunta": "A política informa explicitamente com quais terceiros os dados são compartilhados?", "peso": 1},
  {"pergunta": "A política é revisada e atualizada pelo menos uma vez ao ano ou em mudanças de processos?", "peso": 1}
]')
  FROM public.gap_analysis_frameworks f
 WHERE f.id = r.framework_id
   AND f.nome = 'ISO/IEC 27701'
   AND r.codigo = '5.1'
   AND COALESCE(r.orientacao_implementacao, '') = '';

UPDATE public.gap_analysis_requirements r
   SET orientacao_implementacao = COALESCE(NULLIF(r.orientacao_implementacao, ''), '## 📋 O que este requisito significa
Este requisito exige que a empresa avalie como uma falha nos sistemas de automação e controle industrial (IACS) pode impactar diretamente os objetivos de negócio. Não se trata apenas de uma análise técnica de TI, mas de entender como um ataque cibernético pode parar uma linha de produção, comprometer a qualidade de um produto ou afetar a entrega para clientes.

A análise deve conectar vulnerabilidades tecnológicas a consequências financeiras, operacionais e estratégicas. É o momento de traduzir "bits e bytes" para a linguagem da diretoria, identificando quais processos industriais são vitais para a sobrevivência da organização.

## 🎯 Por que isso importa para sua empresa
A falta de uma visão de negócio sobre o risco industrial cria um "ponto cego" perigoso. Sem isso, a empresa pode investir fortunas protegendo sistemas irrelevantes enquanto deixa processos críticos vulneráveis. Uma interrupção não planejada em sistemas IACS pode causar perdas de receita imediatas e multas contratuais pesadas por atrasos na cadeia de suprimentos.

Além disso, em setores regulados ou de infraestrutura crítica, a demonstração dessa análise é fundamental para manter licenças de operação. O dano à reputação de uma marca que não consegue garantir a continuidade de sua produção por falhas cibernéticas básicas pode levar anos para ser recuperado.

## ⚠️ O que acontece se você não faz isso
*   Interrupção prolongada da produção por falta de priorização na recuperação de sistemas críticos.
*   Alocação ineficiente de orçamento de segurança em ativos de baixo impacto.
*   Responsabilização legal e civil dos diretores por negligência na gestão de riscos operacionais.
*   Perda de certificações de qualidade e segurança (como ISO ou normas setoriais específicas).
*   Dificuldade em contratar ou renovar seguros cibernéticos devido à falta de maturidade na gestão de riscos.

## 🔍 Fatores que você deve analisar
1. Quais são os processos produtivos que geram a maior parte do faturamento da empresa?
2. Se o sistema de controle industrial parar hoje, quanto tempo a operação sobrevive antes de um prejuízo financeiro crítico?
3. Existe dependência de sistemas legados que, se atacados, não possuem peças de reposição ou suporte imediato?
4. Um incidente cibernético no IACS pode causar danos físicos aos colaboradores ou ao meio ambiente?
5. Quais requisitos contratuais com clientes dependem diretamente da disponibilidade dos sistemas industriais?
6. Como a perda de integridade dos dados de produção (ex: fórmulas ou receitas) afetaria a qualidade do produto final?

## 💡 Dicas práticas de implementação
1. **Mapeamento de Ativos:** Liste todos os sistemas IACS e identifique quais estão vinculados aos produtos ou serviços "carro-chefe" da empresa.
2. **Workshop Interdepartamental:** Reúna os gestores de operação (OT), TI e financeiro para definir o que é uma "perda intolerável".
3. **Definição de Impacto:** Crie uma escala de impacto (Financeiro, Segurança, Ambiental e Reputacional) de 1 a 5 para classificar os riscos.
4. **Cenários de Ameaça:** Desenvolva cenários realistas (ex: Ransomware na rede de controle) e estime o custo total de um dia de parada.
5. **Plano de Tratamento:** Priorize as correções técnicas baseando-se no maior impacto financeiro evitado, não apenas na facilidade da correção.'),
       exemplos_evidencias      = COALESCE(NULLIF(r.exemplos_evidencias, ''), '- Relatório formal de Análise de Impacto de Negócio (BIA) focado em sistemas industriais.
- Matriz de Riscos IACS aprovada formalmente pela diretoria ou comitê de riscos.
- Atas de reuniões de avaliação de riscos com a participação de gestores de planta e operações.
- Inventário de ativos críticos classificados por criticidade de negócio.
- Documento de metodologia de análise de risco que inclua critérios de impacto financeiro e operacional.
- Plano de mitigação de riscos com cronograma e responsáveis definidos para os riscos identificados.'),
       perguntas_diagnostico    = COALESCE(NULLIF(r.perguntas_diagnostico, ''), '[
  {"pergunta": "A empresa possui um inventário de sistemas IACS classificado por impacto nos processos de negócio?", "peso": 3},
  {"pergunta": "Foi realizada uma avaliação formal de riscos cibernéticos industriais nos últimos 12 meses?", "peso": 2},
  {"pergunta": "A diretoria ou os gestores de negócio participaram da definição dos critérios de impacto para os riscos IACS?", "peso": 2},
  {"pergunta": "Existem cenários de perda financeira estimados para casos de interrupção total dos sistemas de controle?", "peso": 1},
  {"pergunta": "Os riscos identificados na análise de negócio possuem planos de ação documentados e monitorados?", "peso": 3}
]')
  FROM public.gap_analysis_frameworks f
 WHERE f.id = r.framework_id
   AND f.nome = 'ISO/IEC 62443'
   AND r.codigo = 'CSMS-01'
   AND COALESCE(r.orientacao_implementacao, '') = '';

UPDATE public.gap_analysis_requirements r
   SET orientacao_implementacao = COALESCE(NULLIF(r.orientacao_implementacao, ''), '## 📋 O que este requisito significa
O requisito GP-05 trata da capacidade da empresa de monitorar se seus processos e controles estão funcionando como deveriam. Não basta ter regras escritas; é necessário medir o desempenho dessas atividades através de indicadores e comunicar os resultados para as pessoas certas.

Em termos práticos, significa transformar dados operacionais em relatórios de gestão. É o mecanismo que permite à liderança saber se a estratégia está sendo executada e se os riscos estão sob controle, em vez de "gerir no escuro".

## 🎯 Por que isso importa para sua empresa
Sem medição, a empresa perde a capacidade de tomar decisões baseadas em fatos. Isso impacta diretamente a eficiência operacional, pois falhas repetitivas não são detectadas e corrigidas, gerando desperdício de recursos e retrabalho constante.

Para o mercado e investidores, a falta de relatórios de performance sinaliza baixa maturidade de gestão. Isso pode dificultar a obtenção de crédito, reduzir o valuation da empresa em auditorias de Due Diligence e afastar parceiros comerciais que exigem transparência e previsibilidade.

## ⚠️ O que acontece se você não faz isso
*   **Decisões baseadas em suposições:** A diretoria toma rumos estratégicos sem dados reais, aumentando o risco de prejuízos financeiros.
*   **Degradação silenciosa de controles:** Processos críticos podem parar de funcionar sem que ninguém perceba, até que um incidente grave ocorra.
*   **Perda de certificações:** Dificuldade em manter selos como ISO ou conformidade com frameworks (COBIT, NIST), que exigem monitoramento contínuo.
*   **Incapacidade de demonstrar conformidade:** Em caso de fiscalização, a empresa não consegue provar que monitora suas obrigações.

## 🔍 Fatores que você deve analisar
1. Existem indicadores de desempenho (KPIs) definidos para os processos mais críticos da empresa?
2. A frequência de coleta de dados é adequada para permitir uma ação corretiva rápida?
3. Os relatórios chegam às mãos de quem tem poder de decisão (Diretoria/Conselho)?
4. Os dados utilizados nos relatórios são confiáveis e extraídos de fontes verificáveis?
5. Existe uma análise crítica dos resultados ou apenas o envio passivo de planilhas?
6. As metas estabelecidas são realistas e estão alinhadas aos objetivos do negócio?

## 💡 Dicas práticas de implementação
1. **Defina o "Norte":** Escolha de 3 a 5 indicadores principais (KPIs) que realmente mostrem a saúde do processo, evitando o excesso de informação.
2. **Estabeleça Donos:** Designe um responsável por coletar os dados e outro por revisar a acurácia das informações antes do reporte.
3. **Automatize a Coleta:** Sempre que possível, extraia os dados diretamente do sistema (ERP/CRM) para evitar erros humanos e manipulação de dados em planilhas manuais.
4. **Crie um Ritual de Reporte:** Estabeleça uma agenda fixa (mensal ou trimestral) para apresentação desses resultados aos gestores, focando em planos de ação para os indicadores que estiverem "no vermelho".'),
       exemplos_evidencias      = COALESCE(NULLIF(r.exemplos_evidencias, ''), '- Dashboards de indicadores de desempenho (KPIs) atualizados mensalmente.
- Atas de reuniões de diretoria onde os relatórios de performance foram discutidos.
- Print de telas do sistema de gestão (ERP) mostrando os módulos de reporting.
- Planilhas de controle com histórico de medições e fórmulas de cálculo documentadas.
- Relatórios de exceção que destacam desvios de performance fora do limite tolerado.
- E-mails de formalização do envio dos relatórios periódicos para os stakeholders.
- Definição formal (dicionário de indicadores) detalhando a métrica e a fonte do dado.
- Planos de ação documentados para corrigir indicadores que não atingiram as metas.'),
       perguntas_diagnostico    = COALESCE(NULLIF(r.perguntas_diagnostico, ''), '[
  {"pergunta": "A organização possui indicadores de desempenho (KPIs) formalmente definidos para seus processos principais?", "peso": 3},
  {"pergunta": "Os relatórios de performance são emitidos e distribuídos com uma periodicidade definida?", "peso": 2},
  {"pergunta": "Existe evidência de que a alta gestão revisa e toma decisões baseada nos relatórios apresentados?", "peso": 3},
  {"pergunta": "As fontes de dados utilizadas para os relatórios são protegidas contra alterações manuais não autorizadas?", "peso": 1},
  {"pergunta": "Existem metas claras estabelecidas para cada indicador monitorado?", "peso": 1}
]')
  FROM public.gap_analysis_frameworks f
 WHERE f.id = r.framework_id
   AND f.nome = 'ITIL'
   AND r.codigo = 'GP-05'
   AND COALESCE(r.orientacao_implementacao, '') = '';

UPDATE public.gap_analysis_requirements r
   SET orientacao_implementacao = COALESCE(NULLIF(r.orientacao_implementacao, ''), 'O Artigo 1º da lei fala sobre a importância de cuidar dos dados pessoais das pessoas, seja por empresas ou órgãos públicos. Isso significa que, ao coletar, armazenar ou usar informações pessoais, você deve garantir que os direitos das pessoas sejam respeitados. Para implementar isso, comece fazendo um levantamento dos dados que sua empresa coleta. Pergunte-se: quais informações pessoais eu tenho? Como elas são usadas? Isso ajudará a entender o que precisa ser protegido.

Depois, é fundamental criar uma política de privacidade clara. Essa política deve explicar como os dados são coletados, usados e armazenados, além de informar as pessoas sobre seus direitos em relação a esses dados. Certifique-se de que todos na sua equipe conheçam essa política e a apliquem no dia a dia.

Por fim, implemente medidas de segurança para proteger esses dados. Isso pode incluir senhas fortes, acesso restrito a informações sensíveis e treinamento para a equipe sobre como lidar com dados pessoais. Lembre-se: a proteção dos dados não é apenas uma obrigação legal, mas também uma forma de ganhar a confiança dos seus clientes e parceiros.'),
       exemplos_evidencias      = COALESCE(NULLIF(r.exemplos_evidencias, ''), '- Política de privacidade documentada e acessível
- Registro dos tipos de dados pessoais coletados
- Relatórios de treinamento da equipe sobre proteção de dados
- Procedimentos de segurança implementados (como senhas e controles de acesso)
- Comunicações enviadas aos titulares de dados informando sobre o tratamento de suas informações
- Registros de consentimento dos titulares para uso de seus dados
- Auditorias internas sobre o tratamento de dados pessoais realizadas'),
       perguntas_diagnostico    = COALESCE(NULLIF(r.perguntas_diagnostico, ''), NULL)
  FROM public.gap_analysis_frameworks f
 WHERE f.id = r.framework_id
   AND f.nome = 'LGPD'
   AND r.codigo = 'Art. 1º'
   AND COALESCE(r.orientacao_implementacao, '') = '';

UPDATE public.gap_analysis_requirements r
   SET orientacao_implementacao = COALESCE(NULLIF(r.orientacao_implementacao, ''), 'O Artigo 1 fala sobre a importância de ter um padrão elevado de segurança cibernética em toda a União Europeia. Para implementar isso na sua empresa, comece avaliando quais são os principais riscos que você enfrenta em relação à segurança da informação. Isso pode incluir a proteção de dados de clientes, informações financeiras e outros dados sensíveis. É essencial ter uma visão clara do que precisa ser protegido e por quê.

Depois, desenvolva um plano de ação que inclua medidas de segurança, como a instalação de firewalls, a realização de backups regulares e a capacitação dos funcionários sobre boas práticas de segurança. É importante que todos na sua equipe entendam a importância da segurança cibernética e como podem contribuir para isso no dia a dia.

Por fim, monitore e revise regularmente suas práticas de segurança. Isso significa que você deve verificar se as medidas que você implementou estão funcionando e se há novas ameaças que precisam ser consideradas. Manter um diálogo aberto com sua equipe sobre segurança cibernética também é fundamental para garantir que todos estejam alinhados e cientes das melhores práticas.'),
       exemplos_evidencias      = COALESCE(NULLIF(r.exemplos_evidencias, ''), '- Relatório de avaliação de riscos de segurança cibernética.
- Registro de treinamentos realizados sobre segurança da informação para os funcionários.
- Documentação das medidas de segurança implementadas, como firewalls e sistemas de backup.
- Relatórios de auditoria interna sobre práticas de segurança.
- Comunicações internas sobre políticas de segurança e melhores práticas.
- Registros de incidentes de segurança e como foram tratados.
- Planos de resposta a incidentes de segurança cibernética.
- Certificações de segurança obtidas pela empresa.'),
       perguntas_diagnostico    = COALESCE(NULLIF(r.perguntas_diagnostico, ''), NULL)
  FROM public.gap_analysis_frameworks f
 WHERE f.id = r.framework_id
   AND f.nome = 'NIS2'
   AND r.codigo = 'Art. 1'
   AND COALESCE(r.orientacao_implementacao, '') = '';

UPDATE public.gap_analysis_requirements r
   SET orientacao_implementacao = COALESCE(NULLIF(r.orientacao_implementacao, ''), 'A missão da sua organização é a razão pela qual ela existe. Para que a gestão de riscos de cibersegurança seja eficaz, todos na empresa precisam entender essa missão. Isso significa que a missão deve ser clara e facilmente acessível a todos os colaboradores. Uma boa prática é criar um documento ou uma apresentação que explique a missão e como ela se relaciona com a segurança das informações. Você pode compartilhar isso em reuniões ou treinamentos.'),
       exemplos_evidencias      = COALESCE(NULLIF(r.exemplos_evidencias, ''), '- Documento que descreve a missão da organização
- Apresentação da missão em reuniões de equipe
- Treinamento sobre a missão e sua relação com a cibersegurança
- Comunicação interna (como e-mails ou murais) que reforce a missão
- Feedback de colaboradores sobre a compreensão da missão
- Relatórios que mostrem como a missão influencia decisões de segurança
- Registro de discussões sobre a missão em reuniões de gestão'),
       perguntas_diagnostico    = COALESCE(NULLIF(r.perguntas_diagnostico, ''), NULL)
  FROM public.gap_analysis_frameworks f
 WHERE f.id = r.framework_id
   AND f.nome = 'NIST CSF'
   AND r.codigo = 'GV.OC-01'
   AND COALESCE(r.orientacao_implementacao, '') = '';

UPDATE public.gap_analysis_requirements r
   SET orientacao_implementacao = COALESCE(NULLIF(r.orientacao_implementacao, ''), 'O controle de segurança de rede exige que você instale e mantenha ferramentas que protejam os dados que circulam pela sua rede. Isso significa que você deve ter sistemas que ajudem a bloquear acessos não autorizados e a monitorar o que acontece na sua rede. Para começar, você pode considerar a instalação de um firewall, que é como uma barreira que impede que pessoas indesejadas entrem na sua rede. Além disso, é importante manter esse firewall atualizado para garantir que ele esteja sempre protegido contra novas ameaças.'),
       exemplos_evidencias      = COALESCE(NULLIF(r.exemplos_evidencias, ''), '- Registro da instalação do firewall
- Relatórios de atualizações de segurança do firewall
- Configurações de segurança documentadas
- Logs de monitoramento de tráfego da rede
- Relatórios de testes de vulnerabilidade realizados
- Treinamentos realizados com a equipe sobre segurança de rede
- Políticas de acesso à rede implementadas e documentadas'),
       perguntas_diagnostico    = COALESCE(NULLIF(r.perguntas_diagnostico, ''), NULL)
  FROM public.gap_analysis_frameworks f
 WHERE f.id = r.framework_id
   AND f.nome = 'PCI DSS'
   AND r.codigo = '1.1'
   AND COALESCE(r.orientacao_implementacao, '') = '';

UPDATE public.gap_analysis_requirements r
   SET orientacao_implementacao = COALESCE(NULLIF(r.orientacao_implementacao, ''), '## 📋 O que este requisito significa
O CC1.1 é o alicerce de qualquer estrutura de controle interno. Ele estabelece que a alta administração não deve apenas escrever regras de conduta, mas "viver" essas regras, demonstrando através de ações concretas que a integridade e a ética estão acima dos resultados financeiros de curto prazo.

Significa que a empresa possui um padrão moral claro e que esse padrão é comunicado e cobrado de todos, desde o CEO até o estagiário, incluindo fornecedores e parceiros de negócio. É o famoso "Tone at the Top" (o tom que vem do topo).

## 🎯 Por que isso importa para sua empresa
A ausência de uma cultura ética sólida é o caminho mais rápido para fraudes internas e escândalos reputacionais que podem destruir o valor de mercado da empresa em poucos dias. Investidores e clientes hoje buscam empresas que provam ser confiáveis.

Além disso, em processos de certificação (como SOC2) ou auditorias externas, a falha neste requisito é considerada uma deficiência de "entidade", o que pode invalidar todos os outros controles de segurança, pois se a liderança não é ética, os controles técnicos podem ser facilmente burlados ou ignorados.

## ⚠️ O que acontece se você não faz isso
*   Aumento da rotatividade de talentos (pessoas éticas não permanecem em ambientes tóxicos).
*   Exposição a processos trabalhistas e multas regulatórias pesadas.
*   Dificuldade em fechar contratos com grandes empresas que exigem conformidade rigorosa.
*   Criação de um ambiente propício para desvios de ativos e corrupção passiva.

## 🔍 Fatores que você deve analisar
1. O Código de Conduta é revisado anualmente e aprovado pela diretoria?
2. Existe um canal de denúncias anônimo e realmente independente?
3. Os novos funcionários assinam o termo de adesão ética no primeiro dia de trabalho?
4. A liderança comunica mensagens sobre ética em reuniões gerais da empresa?
5. Existem punições claras e aplicadas para quem viola as regras, independentemente do cargo?
6. Os fornecedores críticos também estão sujeitos às nossas normas éticas?

## 💡 Dicas práticas de implementação
1. **Formalize o Código:** Crie um Código de Ética e Conduta simples, visual e de fácil leitura, evitando "juridiquês".
2. **Treinamento Recorrente:** Realize workshops anuais com exemplos práticos de dilemas éticos reais que acontecem no dia a dia da operação.
3. **Canal de Denúncias:** Implemente uma linha ética gerida por uma empresa terceira para garantir o anonimato e evitar retaliações.
4. **Comitê de Ética:** Institua um grupo multidisciplinar para julgar desvios de conduta de forma imparcial.'),
       exemplos_evidencias      = COALESCE(NULLIF(r.exemplos_evidencias, ''), '- Código de Ética e Conduta assinado pela Diretoria Executiva.
- Relatórios de logs do Canal de Denúncias com o status de apuração de cada caso.
- Certificados de conclusão de treinamento de compliance de 100% da força de trabalho.
- Termos de adesão ao código de conduta assinados por todos os colaboradores (onboarding).
- Atas de reuniões do Comitê de Ética demonstrando a análise de incidentes.
- Cláusulas de conformidade ética e anticorrupção em contratos com fornecedores.
- Evidência de ações disciplinares aplicadas em casos de violação comprovada.
- Print da intranet ou e-mails corporativos com mensagens da liderança sobre valores éticos.'),
       perguntas_diagnostico    = COALESCE(NULLIF(r.perguntas_diagnostico, ''), '[
  {"pergunta": "A alta administração comunica formalmente os valores éticos da empresa pelo menos uma vez ao ano?", "peso": 2},
  {"pergunta": "Existe um Código de Conduta documentado e acessível a todos os colaboradores e parceiros?", "peso": 3},
  {"pergunta": "A empresa possui um canal de denúncias anônimo operado por uma entidade independente?", "peso": 3},
  {"pergunta": "Todos os novos funcionários recebem treinamento sobre ética e integridade durante a integração?", "peso": 1},
  {"pergunta": "Existem processos formais para investigar e remediar desvios de conduta ética detectados?", "peso": 2}
]')
  FROM public.gap_analysis_frameworks f
 WHERE f.id = r.framework_id
   AND f.nome = 'SOC 2 Type II'
   AND r.codigo = 'CC1.1'
   AND COALESCE(r.orientacao_implementacao, '') = '';

UPDATE public.gap_analysis_requirements r
   SET orientacao_implementacao = COALESCE(NULLIF(r.orientacao_implementacao, ''), '## 📋 O que este requisito significa
Este requisito estabelece que a responsabilidade final pela segurança e resiliência do negócio não é apenas do departamento de TI, mas sim do Conselho de Administração ou da Alta Gestão. Ele exige que os líderes máximos da empresa participem ativamente das decisões estratégicas sobre como os riscos são aceitos e gerenciados.

Na prática, significa que deve haver um fluxo formal de informações onde a estratégia de segurança é apresentada, discutida e aprovada por quem detém o poder de investimento e decisão na organização. O conselho deve atuar como um supervisor que garante que a gestão está protegendo os ativos mais valiosos da companhia.

## 🎯 Por que isso importa para sua empresa
Sem a supervisão do conselho, a segurança da informação costuma ser tratada como um "custo técnico" e não como uma prioridade de negócio. Isso cria um abismo entre o que a TI protege e o que a empresa realmente precisa para sobreviver, deixando brechas que podem ser fatais em caso de incidentes.

Além disso, investidores e grandes clientes B2B exigem cada vez mais provas de que a governança é sólida. A falta dessa supervisão pode impedir a empresa de fechar contratos de alto valor ou resultar em multas severas por negligência administrativa, caso ocorra um vazamento de dados que poderia ter sido evitado com o apoio da liderança.

## ⚠️ O que acontece se você não faz isso
*   **Desalinhamento de Investimento:** Recursos são gastos em ferramentas inúteis enquanto riscos críticos de negócio ficam expostos.
*   **Responsabilização Pessoal:** Diretores podem ser responsabilizados judicialmente por omissão na gestão de riscos cibernéticos.
*   **Lentidão na Resposta:** Em crises, a falta de uma estrutura de governança impede decisões rápidas, agravando o prejuízo financeiro.
*   **Perda de Credibilidade:** O mercado percebe a falta de maturidade, o que desvaloriza a marca e afasta parceiros estratégicos.

## 🔍 Fatores que você deve analisar
1. O Conselho de Administração possui uma agenda regular (trimestral ou semestral) para discutir riscos de segurança?
2. Existe um comitê de riscos ou de auditoria que reporta diretamente à alta gestão?
3. A estratégia de segurança da informação foi formalmente aprovada pela diretoria este ano?
4. O apetite ao risco da organização (o quanto de risco a empresa aceita correr) está definido e documentado?
5. O CISO (Chief Information Security Officer) ou responsável pela segurança tem canal direto de comunicação com o CEO ou Conselho?
6. Os investimentos em tecnologia são baseados nos riscos identificados e priorizados pela gestão?

## 💡 Dicas práticas de implementação
1. **Institua um Comitê de Segurança:** Reúna líderes de diferentes áreas (Jurídico, RH, TI, Operações) para discutir riscos mensalmente.
2. **Crie Relatórios Executivos:** Traduza termos técnicos em indicadores de negócio (KPIs e KRIs) que o conselho consiga entender.
3. **Formalize as Atas:** Documente todas as reuniões onde riscos e estratégias foram discutidos, registrando as decisões tomadas.
4. **Defina o Apetite ao Risco:** Escreva um documento simples declarando quais riscos a empresa aceita e quais ela exige mitigação imediata.
5. **Eduque a Liderança:** Realize uma sessão anual de atualização para o conselho sobre as principais ameaças do setor.'),
       exemplos_evidencias      = COALESCE(NULLIF(r.exemplos_evidencias, ''), '- Atas de reuniões do Conselho de Administração mencionando a revisão de riscos de segurança.
- Regimento interno do Comitê de Riscos ou Comitê de Segurança da Informação.
- Matriz de Riscos Corporativos aprovada e assinada pela diretoria.
- Relatórios trimestrais de status de conformidade e segurança apresentados à gestão.
- Política de Segurança da Informação com evidência de aprovação da alta liderança.
- Orçamento anual aprovado com rubricas específicas para iniciativas de mitigação de riscos.
- Plano Estratégico de Segurança da Informação alinhado aos objetivos de negócio.
- Documento de definição do Apetite ao Risco assinado pelo CEO ou Conselho.'),
       perguntas_diagnostico    = COALESCE(NULLIF(r.perguntas_diagnostico, ''), '[
  {"pergunta": "O Conselho de Administração revisa formalmente o perfil de riscos de segurança pelo menos uma vez ao ano?", "peso": 3},
  {"pergunta": "Existe um comitê formalizado que inclui membros da alta gestão para tratar de governança e riscos?", "peso": 2},
  {"pergunta": "A estratégia de segurança da informação é aprovada e suportada financeiramente pela diretoria?", "peso": 2},
  {"pergunta": "Os riscos de segurança são comunicados ao conselho em linguagem de impacto financeiro e de negócio?", "peso": 1},
  {"pergunta": "O conselho define e documenta formalmente os níveis de tolerância a riscos para a organização?", "peso": 3}
]')
  FROM public.gap_analysis_frameworks f
 WHERE f.id = r.framework_id
   AND f.nome = 'SOC 2 Type II'
   AND r.codigo = 'CC1.2'
   AND COALESCE(r.orientacao_implementacao, '') = '';

UPDATE public.gap_analysis_requirements r
   SET orientacao_implementacao = COALESCE(NULLIF(r.orientacao_implementacao, ''), '## 📋 O que este requisito significa
Este requisito trata da "espinha dorsal" da organização. Ele exige que a empresa defina claramente quem manda em quem, quem é responsável por quais decisões de segurança e como as informações circulam dos níveis operacionais até a alta gestão.

Não basta ter pessoas trabalhando; é preciso que a estrutura organizacional suporte a segurança da informação. Isso significa que as responsabilidades devem estar documentadas e que as linhas de reporte permitam que problemas críticos cheguem rapidamente aos tomadores de decisão, sem filtros burocráticos excessivos.

## 🎯 Por que isso importa para sua empresa
Sem uma estrutura clara, a segurança se torna "terra de ninguém". Em momentos de crise ou auditoria, a falta de autoridades definidas gera paralisia decisória, o que aumenta o tempo de exposição a ataques e pode resultar em multas pesadas por negligência de governança.

Além disso, grandes clientes e parceiros de negócios exigem provas de que a empresa é bem gerida. A ausência de linhas de reporte formais demonstra imaturidade, o que pode levar à perda de contratos estratégicos e à desvalorização da marca no mercado.

## ⚠️ O que acontece se você não faz isso
*   Conflitos de interesse, onde a mesma pessoa executa e aprova tarefas críticas.
*   Ambiguidade na tomada de decisão, causando atrasos na resposta a incidentes.
*   Sobrecarga de gestores ou, inversamente, tarefas essenciais que ninguém assume.
*   Dificuldade em responsabilizar indivíduos por falhas de segurança ou vazamentos.
*   Apontamentos graves em auditorias de conformidade (como SOC 2 ou ISO 27001).

## 🔍 Fatores que você deve analisar
1. Existe um organograma atualizado que reflete a realidade das operações de segurança?
2. As descrições de cargo detalham claramente as responsabilidades de segurança de cada líder?
3. O responsável pela segurança (CISO ou equivalente) tem acesso direto à diretoria ou conselho?
4. As alçadas de aprovação (quem pode autorizar gastos ou mudanças críticas) estão documentadas?
5. Há evidências de que a alta gestão revisa periodicamente a eficácia da estrutura de governança?
6. As linhas de reporte evitam que a segurança fique subordinada a áreas que podem priorizar apenas a velocidade (como Desenvolvimento puro)?

## 💡 Dicas práticas de implementação
*   **Desenhe o Organograma:** Crie um diagrama visual que mostre as linhas de reporte diretas e pontilhadas entre as equipes de TI, Segurança e Executivos.
*   **Formalize as Alçadas:** Crie uma matriz de autoridade (Matriz de Delegação de Autoridade) especificando quem pode aprovar riscos e orçamentos.
*   **Atualize Descrições de Cargo:** Garanta que o contrato ou o descritivo de função dos gestores mencione explicitamente suas responsabilidades de supervisão.
*   **Crie Comitês:** Estabeleça um Comitê de Segurança ou Riscos com reuniões mensais e atas formalizadas.
*   **Comunique a Estrutura:** Garanta que todos os colaboradores saibam a quem recorrer ou reportar problemas de segurança através de um manual de integração.'),
       exemplos_evidencias      = COALESCE(NULLIF(r.exemplos_evidencias, ''), '- Organograma corporativo atualizado e aprovado pela diretoria.
- Descrições de cargo (Job Descriptions) assinadas, detalhando responsabilidades de supervisão.
- Atas de reuniões do Comitê de Segurança da Informação ou Riscos.
- Matriz de competências e autoridades (Matriz de Delegação de Autoridade).
- Relatórios de desempenho da gestão apresentados ao Conselho de Administração.
- Fluxogramas de processos que demonstrem os pontos de aprovação e revisão.
- Cartas de designação de responsabilidades para gestores de áreas críticas.
- Registros de treinamentos de governança realizados pela alta gestão.'),
       perguntas_diagnostico    = COALESCE(NULLIF(r.perguntas_diagnostico, ''), '[
  {"pergunta": "A empresa possui um organograma formal que define claramente as linhas de reporte para a área de segurança?", "peso": 2},
  {"pergunta": "As responsabilidades de supervisão e autoridade estão documentadas em descrições de cargo ou políticas internas?", "peso": 1},
  {"pergunta": "O responsável pela segurança da informação possui um canal de reporte direto para a alta gestão (Diretoria/Conselho)?", "peso": 3},
  {"pergunta": "Existem comitês ou fóruns regulares onde a gestão supervisiona o status dos controles de segurança?", "peso": 2},
  {"pergunta": "As autoridades para aprovação de exceções de segurança e aceitação de riscos estão claramente definidas?", "peso": 2}
]')
  FROM public.gap_analysis_frameworks f
 WHERE f.id = r.framework_id
   AND f.nome = 'SOC 2 Type II'
   AND r.codigo = 'CC1.3'
   AND COALESCE(r.orientacao_implementacao, '') = '';

UPDATE public.gap_analysis_requirements r
   SET orientacao_implementacao = COALESCE(NULLIF(r.orientacao_implementacao, ''), '## 📋 O que este requisito significa
Este requisito exige que a empresa não olhe apenas para falhas técnicas ou desastres naturais, mas que considere ativamente a má intenção humana. A avaliação de riscos deve incluir cenários onde funcionários, gestores ou terceiros possam manipular dados, burlar controles ou desviar ativos para benefício próprio ou da organização.

Em termos práticos, significa mapear onde o sistema é vulnerável a abusos, como a alteração de registros financeiros, o roubo de dados de clientes ou a manipulação de privilégios de acesso para ocultar atividades ilícitas.

## 🎯 Por que isso importa para sua empresa
A fraude raramente é um evento isolado; ela costuma indicar falhas profundas de cultura e controle. Para uma empresa tecnológica, uma fraude de dados pode significar a perda imediata da confiança do mercado, levando à rescisão de contratos e à dificuldade de atrair novos investidores.

Além disso, a detecção tardia de fraudes costuma ser muito mais cara do que a prevenção. O impacto financeiro direto é apenas a ponta do iceberg; o custo real envolve investigações forenses caríssimas, multas regulatórias pesadas e a desmotivação das equipes éticas que se sentem desprotegidas.

## ⚠️ O que acontece se você não faz isso
*   **Perda de Certificações:** Dificuldade extrema em obter ou manter selos como SOC 2 ou ISO 27001.
*   **Vulnerabilidade Interna:** Aumento da probabilidade de "insider threats" (ameaças internas) passarem despercebidas por anos.
*   **Responsabilização Civil e Criminal:** Executivos podem ser responsabilizados judicialmente por negligência na supervisão de controles.
*   **Dano Reputacional Irreversível:** A marca pode ser associada à falta de integridade, afastando parceiros estratégicos.

## 🔍 Fatores que você deve analisar
1.  Quais são os incentivos ou pressões que poderiam levar alguém a cometer uma fraude aqui?
2.  Existem oportunidades criadas por controles fracos ou falta de segregação de funções?
3.  Como a cultura da empresa lida com o "jeitinho" ou com o descumprimento de normas?
4.  Quais ativos (dados, dinheiro, propriedade intelectual) são os alvos mais prováveis?
5.  Como a gerência poderia burlar os controles existentes sem ser detectada?
6.  Quais são os riscos de fraude específicos para o nosso modelo de negócio (ex: pagamentos digitais, e-commerce)?

## 💡 Dicas práticas de implementação
*   **Workshop de Brainstorming:** Reúna líderes de diferentes áreas para listar "como eu roubaria ou burlaria o sistema se quisesse", identificando pontos cegos.
*   **Matriz de Riscos de Fraude:** Crie um documento separado ou uma seção na sua matriz de riscos focada especificamente em cenários de fraude.
*   **Segregação de Funções (SoD):** Garanta que quem aprova um pagamento ou acesso não seja a mesma pessoa que o executa.
*   **Canal de Denúncias:** Implemente um meio seguro e anônimo para que funcionários relatem comportamentos suspeitos.
*   **Monitoramento de Logs:** Configure alertas para atividades incomuns, como acessos em horários estranhos ou exportação massiva de dados.'),
       exemplos_evidencias      = COALESCE(NULLIF(r.exemplos_evidencias, ''), '- Política de Prevenção à Fraude e Corrupção formalmente aprovada pela diretoria.
- Matriz de Riscos contendo cenários específicos de fraude, probabilidade e impacto.
- Ata de reunião ou workshop anual de avaliação de riscos de fraude com a alta gestão.
- Relatório de testes de controles internos focados em segregação de funções (SoD).
- Comprovante de treinamentos de ética e compliance realizados pelos colaboradores.
- Evidência de funcionamento do Canal de Denúncias (ex: estatísticas de chamados, sem expor dados sensíveis).
- Plano de Resposta a Incidentes que inclua protocolos para investigação de fraudes.
- Relatórios de auditoria interna que revisaram processos críticos suscetíveis a manipulação.'),
       perguntas_diagnostico    = COALESCE(NULLIF(r.perguntas_diagnostico, ''), '[
  {
    "pergunta": "A empresa possui uma avaliação de riscos documentada que inclui explicitamente cenários de fraude interna e externa?",
    "peso": 3
  },
  {
    "pergunta": "Existe uma segregação de funções clara nos processos que envolvem movimentação financeira ou alteração de dados sensíveis?",
    "peso": 2
  },
  {
    "pergunta": "A alta administração revisa e aprova formalmente os resultados da avaliação de risco de fraude ao menos uma vez por ano?",
    "peso": 1
  },
  {
    "pergunta": "Existe um canal de denúncias ativo e divulgado para todos os colaboradores e parceiros?",
    "peso": 2
  },
  {
    "pergunta": "A empresa realiza verificações de antecedentes (background check) para contratação de funcionários em cargos de confiança ou acesso crítico?",
    "peso": 1
  }
]')
  FROM public.gap_analysis_frameworks f
 WHERE f.id = r.framework_id
   AND f.nome = 'SOC 2 Type II'
   AND r.codigo = 'CC2.3'
   AND COALESCE(r.orientacao_implementacao, '') = '';
