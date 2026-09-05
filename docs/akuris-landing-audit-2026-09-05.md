# Akuris — avaliação da landing page, experiência comercial e recursos

Data: 05/09/2026. Avaliação somente; sem implementação ou publicação.

## Síntese

A landing page tem uma base visual reconhecível: azul profundo, violeta, DM Sans, alinhamentos regulares e chamadas comerciais visíveis. Não recomendo recomeçar a identidade nem acrescentar animações indiscriminadamente.

O maior ganho está em transformar uma apresentação predominantemente textual em uma demonstração convincente do produto: mostrar como o Akuris funciona, por que confiar nele e qual o próximo passo para cada visitante. Hoje o site explica a integração entre módulos, mas quase não mostra a interface que foi refinada no sistema.

Há também problemas concretos de navegação, acessibilidade, consistência comercial e código que devem preceder uma campanha de aquisição. Não são todos questões de gosto.

## Escopo e limites

- Inspeção da versão publicada em https://akuris.pt/, com navegação por seções, formulário de demonstração, planos e blog.
- Viewports de desktop, 1.440×900, 390×844 e 320×740. Inspeção visual, árvore de acessibilidade, dimensões e metadados do DOM.
- Leitura dos componentes da landing, formulário, planos, blog, páginas de frameworks, estilos, SEO, carregamento de traduções e função de contato comercial.
- Teste de formulário vazio, bloqueado pela validação local antes da chamada de rede. Nenhum lead, e-mail, conta ou solicitação real foi enviado.
- Preços observados na interface pública; não foram modificados nem inferidos valores comerciais corretos.
- Não foram medidos dados de conversão, Core Web Vitals de usuários reais, campanhas publicitárias ou posicionamento no Google. Não houve teste de entrega real de e-mail. Problemas de código são identificados como tais, sem afirmar que já causaram perda de clientes.
- A skill computer-use orientou a inspeção no navegador. As dimensões emuladas foram restauradas. A aba permanece na landing real, sem mockup ou alterações temporárias no conteúdo.

## 1. Corrigir primeiro: confiança e funcionamento

### F01 — Preços anuais não correspondem à economia anunciada | Alta

A opção anual mostra “Economize ~10%”, mas os valores exibidos implicam descontos diferentes:

| Plano | Mensal exibido | Total anual exibido | Economia implícita frente a 12 mensalidades |
|---|---:|---:|---:|
| Akuris Canal | R$ 290 | R$ 2.900 | 16,7% |
| Akuris Start | R$ 590 | R$ 1.069 | 84,9% |
| Akuris Manager | R$ 1.290 | R$ 2.689 | 82,6% |
| Akuris Full | R$ 2.990 | R$ 5.389 | 85,0% |

O Start, por exemplo, passa a exibir R$ 89/mês na seleção anual. Pode haver valores legados, semântica diferente do campo ou uma condição comercial intencional; a auditoria não determina qual preço deveria valer.

**Recomendação:** validar a tabela com o responsável comercial; calcular economia por plano a partir dos valores aprovados; explicar total anual, equivalente mensal, implantação e condições aplicáveis. Não manter um desconto fixo independente dos dados.

Referência: [PlanosAssinatura.tsx](C:/Users/mathe/dev/akuris/src/pages/PlanosAssinatura.tsx), cálculo em torno da linha 71 e badge em torno da linha 63.

### F02 — Confirmação comercial pode ignorar erro do provedor de e-mail | Alta

No código atual de `send-contact-email`, a resposta de `resend.emails.send()` é guardada, mas seu campo `error` não é verificado antes de marcar a submissão como processada e devolver sucesso. O SDK documenta retorno com `data` e `error`; nem toda rejeição precisa ocorrer como exceção. [Referência oficial do Resend](https://resend.com/docs/api-reference/emails/send-email).

**Risco:** a solicitação fica salva no banco, mas o aviso ao comercial pode falhar enquanto a interface indica que o time a recebeu. Não foi provocado nem comprovado um incidente real de entrega nesta análise.

**Recomendação:** separar “solicitação registrada” de “notificação enviada”; verificar erro/ID do provedor; manter fila e tentativas limitadas, com idempotência, alerta operacional e histórico. Uma confirmação automática ao interessado é um recurso útil, mas deve respeitar idioma, finalidade e a proteção contra abuso.

Referência: [send-contact-email/index.ts](C:/Users/mathe/dev/akuris/supabase/functions/send-contact-email/index.ts), linhas 174–198.

### F03 — Menu cortado em celular estreito | Alta

Em 320 px, o botão do menu ocupa aproximadamente x=306 a x=346: parte substancial fica fora da área visível. A ausência de rolagem horizontal não significa que tudo caiba; o recorte esconde o controle. Em 390 px, ele cabe.

**Recomendação:** reservar espaço fixo para o menu, permitir ajuste do logotipo/CTA e encurtar a chamada na menor largura. Testar também zoom, traduções e textos maiores. Adotar 44 px como alvo de conforto para controles importantes, distinguindo essa escolha do mínimo de 24 px com exceções da WCAG. [WCAG 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).

Referência: [index.css](C:/Users/mathe/dev/akuris/src/index.css), `.lp-nav-cta` e regras responsivas da navegação.

### F04 — Chamadas para demonstração não mantêm a intenção | Alta

O botão “Solicitar demonstração” do blog foi testado: leva à home sem abrir o formulário. As páginas de frameworks usam o mesmo destino no código. Nos planos, todos os botões abrem um `mailto:` com assunto genérico, sem identificar o plano escolhido.

**Recomendação:** um fluxo comercial compartilhado, acessível diretamente por URL, preservando página de origem, módulo/framework/plano de interesse e idioma. O usuário não deve precisar encontrar e acionar uma segunda chamada para executar o que a primeira prometeu. Manter e-mail como alternativa, não como única opção.

Referências: [Blog.tsx](C:/Users/mathe/dev/akuris/src/pages/Blog.tsx), linha 124; [FrameworkSEO.tsx](C:/Users/mathe/dev/akuris/src/pages/FrameworkSEO.tsx), linha 116; [PlanosAssinatura.tsx](C:/Users/mathe/dev/akuris/src/pages/PlanosAssinatura.tsx), linha 135.

### F05 — Formulário precisa de refinamento acessível | Alta

Após envio vazio, aparecem quatro erros, mas o foco permanece no botão. Os campos não recebem `aria-invalid` nem associação `aria-describedby`; Cargo é opcional no schema, mas isso não é comunicado no rótulo. Não há distinção consistente entre obrigatórios e opcionais.

Os rótulos têm 10 px. O placeholder usa #6b7890 sobre #0a1628, contraste calculado de aproximadamente 4,07:1, abaixo de 4,5:1 para texto normal. Os campos também se diferenciam muito pouco do fundo quando não estão focados. [Critério de contraste WCAG 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).

**Recomendação:** foco no primeiro erro, mensagens ligadas ao campo, resumo anunciado, indicação de obrigatoriedade, rótulos mais legíveis e contornos discretos identificáveis. Reduzir a introdução no mobile e avaliar Cargo/porte em uma segunda etapa de qualificação, conforme necessidade comercial. Preservar a rolagem do formulário e o fechamento acessível.

Referências: [DemoRequestDialog.tsx](C:/Users/mathe/dev/akuris/src/components/landing/DemoRequestDialog.tsx), linhas 74 e 198; [index.css](C:/Users/mathe/dev/akuris/src/index.css), regras `.lp-modal-label` e `.lp-modal-input`.

### F06 — Metadados concorrentes entre home e páginas internas | Alta técnica

No DOM publicado de `/blog` foram encontrados dois canonicals: a home e o próprio blog. O mesmo ocorre com descrição e `og:url`. Os links de idioma continuam apontando à home. O HTML inicial mantém metadados estáticos, e o componente SEO acrescenta metadados por rota.

**Recomendação:** uma fonte única de metadados por página; canonical, compartilhamento social e alternância de idioma consistentes. Isso é um conflito confirmado, mas não prova que o Google deixou de indexar o site.

Referências: [index.html](C:/Users/mathe/dev/akuris/index.html), linhas 12–14; [SEO.tsx](C:/Users/mathe/dev/akuris/src/components/SEO.tsx), linha 49.

## 2. Direção visual recomendada

### V01 — Fazer o produto ser o protagonista

O hero contém um diagrama textual de quatro etapas, não uma amostra da interface. “Conhecer a plataforma” apenas rola até os módulos. O visitante ainda precisa imaginar o que está comprando.

**Proposta:** uma captura real e cuidadosamente preparada, com dados demonstrativos identificados, mostrando requisito, controle, evidência e responsável conectados. Um seletor de três cenários pode alternar entre GRC, privacidade e terceiros. Sem dashboards inventados, gráficos de desempenho fictício, conteúdo de clientes ou dispositivos 3D ornamentais.

### V02 — Preservar DM Sans, reforçar a hierarquia

Há repetição de títulos muito grandes, peso leve e itálico violeta. O hero chega a 84 px no desktop; a chamada final e a seção de autonomia também têm grande protagonismo. No celular, “riscos” fica isolado em uma linha no título.

**Proposta:** manter a família, adotar pesos 500/600 nos títulos principais, controlar largura e quebra por idioma e usar itálico apenas como acento pontual. Uma frase dominante por seção; títulos intermediários menores. O problema não exige outra troca de fonte.

### V03 — Reduzir repetição e melhorar o ritmo de leitura

A página teve aproximadamente 7.982 px no desktop inspecionado e 12.579 px em 390 px. Existem nove seções principais, oito linhas de módulos e 24 células de frameworks. Várias partes repetem a ideia de integração e rastreabilidade com diagramas semelhantes.

**Proposta:** combinar “Como funciona” e “Autonomia” em uma demonstração única; diminuir intervalos repetidos de 120 px; alternar texto curto, interface real e prova concreta. Usar uma área clara para valorizar screenshots pode aproximar a apresentação do produto, mantendo abertura e fechamento escuros. Não converter tudo em cartões, carrosséis ou acordeões.

### V04 — Trocar pseudoindicadores por benefícios demonstráveis

“360°”, “1→N” e “LIVE” são conceitos apresentados como indicadores. Não são evidências de resultado e consomem espaço importante no mobile.

**Proposta:** três benefícios em linguagem direta, por exemplo: “Reutilize controles entre frameworks”, “Saiba quem precisa agir” e “Encontre a evidência de cada decisão”. Associar cada um a uma tela ou fluxo verificável. Métricas de resultado só quando houver metodologia e dados autorizados.

### V05 — Dar utilidade aos módulos

As oito linhas têm hover e movimento, mas nenhuma ação. Falta continuidade para quem se interessa especificamente por privacidade, riscos ou terceiros. O canal de denúncias, que já é vendido separadamente nos planos, não recebe uma apresentação proporcional na home.

**Proposta:** organizar módulos em três ou quatro grupos orientados ao comprador, cada um com problema, resultado, tela e link. Criar entrada comercial clara para o canal de denúncias e para a revisão de acessos, sem tornar a página uma lista de todos os menus internos.

### V06 — Fazer os frameworks levarem a conteúdo útil

As 24 células são estáticas, embora já existam páginas públicas de guias. A grade demonstra amplitude, mas não ajuda o visitante a escolher uma necessidade ou entender o benefício.

**Proposta:** destacar seis a oito temas prioritários, ligar aos guias existentes e oferecer “Ver todos” com busca/filtro quando fizer sentido. Indicar cobertura da plataforma sem sugerir que o Akuris possui certificações só por suportar um framework. Manter versões e nomenclaturas sob revisão editorial.

### V07 — Unificar o site comercial inteiro

A home tem estilo editorial escuro; Planos abre uma página clara com aparência de tela interna, sem o cabeçalho e rodapé comerciais. Blog e guias usam outro cabeçalho, com links e botões diferentes. A mudança parece uma troca de produto, não uma navegação dentro da mesma marca.

**Proposta:** um layout público compartilhado: logotipo, navegação, idioma, CTA, largura, tipografia e rodapé. A comparação de planos deve ter preços alinhados, diferenças objetivas e contato contextual. Substituir os pequenos ícones genéricos de estrela/escudo por distinções editoriais claras entre as ofertas.

### V08 — Refinar o tom sem perder personalidade

No formulário há a frase sobre não ligar para vender seguro de carro e o complemento “LGPD, claro”. Eles tentam dar personalidade, mas podem diminuir a percepção de rigor em uma compra de compliance. O CTA final fala apenas em matriz de risco, embora existam compradores de privacidade e canal de denúncias.

**Proposta de redação, não aplicada:**

> Veja como o Akuris organiza o seu programa de governança, riscos e privacidade.

> Em uma demonstração de 30 minutos, mostramos os fluxos relevantes para sua equipe. Nosso time retorna em até um dia útil.

O prazo deve corresponder à capacidade real da operação. “Seus dados serão usados para responder à sua solicitação” é mais claro que uma observação jocosa de conformidade, sujeito à revisão da política aplicável.

Nos planos, “Tudo do Compliance Start” e “Tudo do GRC Manager” não correspondem aos nomes atuais dos cards. Corrigir nomenclatura e separar português brasileiro/português europeu onde aplicável.

### V09 — Construir confiança com evidências

A seção de segurança tem três cartões genéricos; não há caminho para documentação técnica, implantação, suporte ou práticas operacionais. Também não vi cases, depoimentos autorizados ou demonstração concreta de migração.

**Proposta:** página de confiança com controles realmente existentes, tratamento de dados, continuidade, suporte, subprocessadores e contato responsável; cases com contexto e resultado medido; pequena seção de implantação/migração. Não inventar clientes, selos, SLA, certificações ou resultados. Alegações como suporte 24/7 precisam de validação comercial/operacional.

## 3. Recursos que acrescentariam valor

| Recurso | Benefício esperado | Condição de implementação |
|---|---|---|
| Tour curto do produto | Mostrar valor antes de exigir contato | Telas reais, dados demonstrativos, teclado e versão estática acessível |
| Solicitação de demo contextual | Preservar interesse por módulo/plano/framework | Mesmo fluxo em home, blog, guias e planos |
| Agenda após solicitação | Reduzir troca de e-mails para marcar a conversa | Disponibilidade, fusos, calendário e operação definidos; não reservar automaticamente |
| Comparação clara de ofertas | Ajudar a escolher sem interpretar lista de menus | Preços, limites, implantação e suporte aprovados |
| Página comercial do canal de denúncias | Vender a oferta independente com clareza | Separada do canal real usado para registrar relatos |
| Guia de migração | Responder a receios sobre sair de planilhas/outra ferramenta | Formatos, etapas e limites reais; sem promessa de importação universal |
| Central de confiança | Ajudar compras, jurídico e segurança a avaliar o SaaS | Conteúdo aprovado e evidências autorizadas |
| Conteúdo orientado ao problema | Transformar o blog em caminho de descoberta e conversão | Guias com links ao produto, autoria/revisão e CTA contextual |
| Instrumentação do funil | Saber onde há abandono e quais interesses convertem | Eventos próprios e política de privacidade; sem dados pessoais em URLs/eventos |

Não recomendo, nesta fase: chatbot genérico flutuante, popups automáticos de saída, excesso de badges, animações contínuas em todo elemento ou calculadora de ROI com premissas não validadas.

## 4. Base técnica que afeta a experiência

### T01 — Carregamento público pesado

Na resposta publicada foram identificados estes arquivos iniciais:

| Arquivo | Tamanho descomprimido observado |
|---|---:|
| index-PU4uxMAq.js | 540.032 bytes |
| translations-E2w09JrP.js | 1.176.732 bytes |
| index-BucyhDFR.css | 223.166 bytes |

Os dois JavaScripts somam aproximadamente 1,72 MB descomprimidos, antes de contabilizar todos os recursos adicionais. Não é medida de transferência comprimida nem uma nota de desempenho. A configuração agrupa traduções de toda a aplicação num único arquivo.

**Recomendação:** separar os dicionários e estilos públicos dos módulos internos; carregar o formulário quando necessário; avaliar geração estática das páginas públicas. Medir LCP, INP e CLS em mobile antes/depois, sem presumir ganhos percentuais.

### T02 — Conteúdo depende de JavaScript

O HTML inicial da home contém o root vazio e apenas um fallback resumido em `noscript`. Há boa base de title, sitemap, robots e Open Graph, mas falta HTML principal pronto para consumidores que não executam JavaScript.

**Recomendação:** pré-renderização ou renderização no servidor para home, planos, blog e guias. Google consegue executar JavaScript, mas isso não equivale a todos os robôs e mecanismos de compartilhamento conseguirem fazê-lo. [Orientação oficial do Google](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics).

### T03 — Internacionalização pública parcial

O seletor da landing existe, mas os guias e o layout público têm vários textos fixos em português, o fluxo não preserva claramente idioma no contato e os links alternativos de idioma apontam para a home. “CTRL → PROVA” também está fixo no componente da landing.

**Recomendação:** definir os mercados prioritários e a estratégia de URLs por idioma; traduzir navegação, mensagens comerciais e metadados em conjunto. Não publicar páginas rotuladas como inglesas com conteúdo principal não traduzido.

### T04 — Estados de falha e acompanhamento comercial

Planos transforma falha da consulta em lista vazia. Blog ignora o erro e pode mostrar ausência de conteúdo. Não identifiquei eventos próprios de abertura/envio/erro de demo nem captura de campanha no código revisado; isso não exclui métricas de infraestrutura do host.

**Recomendação:** erro persistente com nova tentativa nas páginas comerciais; monitorar solicitações registradas, avisos enviados e pendências de atendimento; instrumentar `demo_open`, `demo_submit_success`, `demo_submit_error` e interesse por oferta, sem inserir nome/e-mail/mensagem em analytics.

### T05 — Acabamento de navegação e acessibilidade

O menu móvel fecha ao escolher uma seção, mas Escape não o fechou na inspeção. O nome acessível continua “Abrir menu” mesmo aberto. A estrutura de títulos pula de h2 para h4 em partes da página; não há link de pular diretamente ao conteúdo na landing.

**Recomendação:** revisar teclado, rótulo de abrir/fechar, sequência semântica, foco nas âncoras e retorno de foco do modal. Preservar o respeito a movimento reduzido já presente. Fazer uma matriz própria de contraste, zoom e navegação, sem tratar esta amostra como certificação de acessibilidade.

## 5. Arquitetura de página sugerida

1. Proposta de valor curta + tela real + demonstração ou tour.
2. Benefícios comprováveis e prova de confiança autorizada.
3. Três ou quatro entradas por necessidade: governança/riscos, privacidade, terceiros/ética.
4. Um fluxo demonstrado: requisito → controle → evidência → decisão.
5. Frameworks prioritários com links e acesso ao catálogo completo.
6. Implantação, migração e suporte, com limites claros.
7. Segurança e confiança com acesso à documentação.
8. Opções comerciais resumidas, comparação detalhada e dúvidas de compra.
9. CTA contextual e rodapé público padronizado.

O objetivo não é aumentar a quantidade de seções. É substituir repetição por demonstração e aproximar cada seção de uma decisão do visitante.

## 6. Ordem recomendada e critérios de aceite

### Etapa 1 — Corrigir pontos que prejudicam confiança

- Validar preços anuais e desconto; nenhuma modificação de preço sem decisão comercial.
- Corrigir tratamento do retorno de e-mail e distinguir registro de notificação.
- CTA de demo abre o fluxo esperado em todas as páginas, preservando contexto.
- Menu integralmente acessível em 320 px; formulário com erros associados e foco correto.
- Um canonical e um conjunto coerente de metadados por rota.

### Etapa 2 — Refinar apresentação

- Hero com benefício específico e evidência visual real do produto.
- Menos títulos gigantes/itálicos repetidos; DM Sans preservada.
- Módulos e frameworks com continuidade útil; canal de denúncias bem posicionado comercialmente.
- Cabeçalho, rodapé, idioma e CTAs comuns a home, planos, blog e guias.
- Revisão de tom, nomenclatura e promessas operacionais.

### Etapa 3 — Evoluir recursos e medir

- Tour, comparação, migração e central de confiança conforme disponibilidade de conteúdo.
- Agenda e automações somente com processo de atendimento definido.
- Base de métricas antes de testes A/B; medir resultado, não prometer conversão maior sem evidência.
- Reduzir dependências públicas e validar carregamento em rede móvel.

## Conclusão

Minha direção é uma landing mais próxima de um produto empresarial refinado: menos abstração, mais interface real, conteúdo objetivo, confiança demonstrada e caminho comercial contínuo. A identidade principal merece ser preservada. As maiores mudanças devem ocorrer na hierarquia, na seleção do conteúdo e nos recursos que ajudam o visitante a avaliar o Akuris.

Todos os itens deste documento são achados ou propostas. Nenhum código da aplicação, preço, configuração, integração ou conteúdo publicado foi alterado nesta avaliação.
