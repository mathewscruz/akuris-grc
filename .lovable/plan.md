# Akuris: diferenciais reais com menos interação

## O que a análise mostrou
- **Vanta, Drata, Secureframe, Sprinto, Hyperproof e OneTrust** automatizam evidências de SOC 2 e ISO 27001. Não falam a língua dos reguladores do Brasil e de Portugal (ANPD, BACEN, CVM, SUSEP, ANS e CNPD), não têm preço em reais e exigem conversa comercial para começar.
- **Privacy Tools e DPO Privacy** são fortes em LGPD, mas só em privacidade.
- **Complya** atende o setor financeiro (BACEN, CVM e SUSEP), mas só esse setor, e ela mesma descreve o risco dos clientes como "avaliado em planilha".
- **O Akuris** já junta num só lugar privacidade, riscos, incidentes, fornecedores, canal de denúncia, ativos, acessos, continuidade e 25 frameworks.
- Entre esses 25 frameworks não há nenhum de BACEN, CVM, SUSEP ou ANS. Esse é o maior espaço livre no mercado.

O item 2 anterior (tela "O que fazer hoje") saiu. Ficam os itens 1, 3, 4 e 5 do plano anterior, somados aos diferenciais abaixo.

## Diferenciais que só o Akuris teria

### A. Configuração automática pelo CNPJ (ou NIPC em Portugal)
O cliente digita o CNPJ. O Akuris lê o CNAE e o porte e descobre quais reguladores se aplicam, por exemplo BACEN para fintechs, SUSEP para seguradoras e ANS para operadoras de saúde. Depois ativa sozinho os frameworks certos, os riscos da biblioteca e um cronograma. Ninguém precisa escolher framework. Nenhum concorrente faz isso.

### B. Frameworks dos reguladores brasileiros
BACEN 4.893 (segurança cibernética e nuvem), CVM 35, SUSEP 638, ANS e Resolução ANPD 15/2024, já ligados aos controles de ISO 27001, LGPD e DORA. Abre o mercado financeiro, de seguros e de saúde, hoje mal atendido.

### C. Relógio regulatório automático
Um incidente com dados pessoais conta sozinho o prazo de 3 dias úteis da ANPD (72 horas para a CNPD em Portugal). Pedidos de titulares contam 15 dias. Incidentes cibernéticos relevantes seguem o prazo do BACEN.
- O Akuris avisa o responsável, depois o gestor e depois a diretoria, pelo sino e por e-mail.
- Ele já deixa pronto o rascunho da comunicação ao regulador, com os dados do incidente preenchidos.

### D. Uma evidência, todos os frameworks
Ao anexar uma evidência, o Akuris a avalia contra todos os frameworks ativos de uma vez (LGPD, BACEN, ISO e SOC 2) e marca onde ela vale. O cliente nunca envia o mesmo arquivo duas vezes. O sistema já tem o cruzamento de evidências; falta usar isso em todos os frameworks ao mesmo tempo.

### E. Monitor de novas normas
Quando ANPD, BACEN, CVM, SUSEP, ANS ou CNPD publicam uma resolução, o Akuris resume o que mudou e mostra quais empresas e controles são afetados. Também propõe os requisitos novos e os ajustes, que o cliente aprova. Assim o DPO não precisa ler o Diário Oficial.

### F. Canal de denúncia ligado ao resto
Uma denúncia que envolve dados pessoais ou fraude vira, com um clique, incidente, risco e plano de ação já ligados entre si, e com o relógio regulatório ligado. As plataformas globais nem têm canal de denúncia. As brasileiras o tratam como módulo isolado.

### G. Fornecedores críticos no padrão BACEN
Os fornecedores são classificados sozinhos como críticos ou não críticos pela regra do BACEN 4.893 (nuvem, dados e serviço essencial). Os críticos recebem o questionário certo e uma reavaliação anual automática.

### H. Documentos regulatórios em português jurídico
O DocGen passa a gerar, prontos para assinar, o RIPD (relatório de impacto da LGPD), a política de segurança cibernética no padrão BACEN, o plano de resposta a incidentes e o relatório anual de cibersegurança para a diretoria.

### I. Preço em reais e contratação sem vendedor
Teste e assinatura direto pelo site, com preço em reais. Todos os concorrentes globais exigem "fale com vendas". Fica como uma decisão comercial sua, citada aqui para avaliar.

## Ordem sugerida
1. **A + B:** configuração pelo CNPJ e frameworks BACEN, CVM, SUSEP, ANS e ANPD. É o maior diferencial e abre mercados novos.
2. **C + F:** relógio regulatório e denúncia ligada a incidente e risco.
3. **D:** uma evidência para todos os frameworks.
4. **G + H:** fornecedores críticos e documentos regulatórios.
5. **E:** monitor de normas.
6. Itens 1, 3, 4 e 5 do plano anterior.

## Detalhes técnicos
- Os novos frameworks entram como modelos globais (`empresa_id` nulo), como os 25 atuais, com mapeamento para os controles existentes. As orientações saem pela rotina automática que já está ativa.
- O CNPJ usa a função `consultar-cnpj` já existente. O mapeamento de CNAE para regulador fica numa tabela simples e editável pelo super admin.
- O relógio regulatório calcula o prazo a partir das datas guardadas, sem tarefa repetitiva. Os avisos saem pela rotina diária de lembretes que já existe.
- O monitor de normas roda uma vez por dia, a partir de fontes oficiais, e gera propostas que ficam aguardando aprovação.
- Tudo com escopo `empresa_id`, avisos pelo sino, e a IA por empresa segue a regra de créditos. Cada bloco terá um plano detalhado antes de ser construído.
