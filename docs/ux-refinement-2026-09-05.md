# Consistência visual — execução

Referência: relatório de análise visual de 05/09/2026. Trabalho local, sem publicação autorizada nesta rodada.

## Acompanhamento técnico atualizado

As caixas abaixo registram implementação dos temas, não cobertura universal de cada consulta e fluxo. Não equivalem a homologação integral com usuários, certificação de acessibilidade ou autorização de publicação. O fechamento anterior foi reaberto após conferência das listas e dos relacionamentos. A situação atual está na seção “Reauditoria e complementação” ao final.

- [x] UX-01 Alertas canônicos e acesso à entidade de origem.
- [x] UX-02 Semântica explícita para zero e dados indisponíveis.
- [x] UX-03 Tipografia, contraste, identificadores e autenticação.
- [x] UX-04 Abas responsivas e indicador corretamente ancorado.
- [x] UX-05 Ordenação acessível por teclado.
- [x] UX-06 Resumo móvel de indicadores e campos decisivos.
- [x] UX-07 Larguras, colunas, filtros e paginação.
- [x] UX-08 Cores semânticas e identificação de pessoas.
- [x] UX-09 Catálogo de navegação, busca completa e tarefas pessoais.
- [x] UX-10 Estados de erro, vazio, filtro e carregamento.
- [x] UX-11 Metodologia e comparações dos indicadores.
- [x] UX-12 Detalhes e preservação do contexto de navegação.
- [x] Ajustes técnicos por módulo, com decisões externas explicitadas no fechamento.
- [x] Telas públicas, primeiro uso e movimento reduzido: melhorias aplicadas ou comportamento existente conferido.
- [x] Testes automatizados, build e amostras de revisão visual responsiva.

Categorias de denúncias e casos reais de clientes não serão alterados/inventados sem a definição do responsável. As melhorias de orientação podem ser implementadas sem mudar taxonomia, dados ou políticas de acesso.

## Lote local validado em 05/09/2026

Status histórico deste primeiro lote: a revisão ainda não estava concluída. A situação atual está no fechamento ao final.

- Autenticação local concluída pela conta existente e por link de acesso enviado ao Mailpit local. Nenhuma senha foi alterada; nenhuma configuração de produção foi modificada. Não houve alteração dos mecanismos de MFA nesta rodada.
- A página demonstrativa `/__visual-preview` foi removida. O acompanhamento usa as telas reais da aplicação em `127.0.0.1:8081`, com o Supabase em `127.0.0.1:54321`.
- Dashboard: seleção canônica de incidentes críticos em curso, links de origem nos alertas, pendências antes dos gráficos, barras com largura correspondente ao score e nomenclatura de índice operacional. Ausência de ação calculada já não é anunciada como “Tudo em dia” pelo painel de rotinas.
- Fundação: DM Sans preservada, raiz tipográfica estável, cabeçalhos mais legíveis, IDs sem quebra, avatares neutros, títulos sem truncamento e abas com indicador corretamente ancorado.
- Tabelas: ordenação por botão nativo, seleção de colunas nas listas extensas, contexto em memória por usuário/empresa/rota, restauração de scroll ao voltar, estados persistentes de erro nas listas já integradas. Filtros e colunas compartilham a linha no celular quando os filtros estão recolhidos.
- Indicadores: zero neutro por padrão, erro distinto de zero e resumo móvel priorizando total e alerta/meta não atingida.
- Busca: catálogo compartilhado com navegação; consultas paginadas sem corte silencioso de 400 candidatos na busca global; retorno de mais resultados e tratamento de falhas parciais. Planos nativos abrem por `?plano=` mesmo fora do filtro atual.
- Controles: detalhe inicia em visão geral com acesso a testes e evidências; campos decisivos priorizados no celular. Projetos expõe “Minhas tarefas”. Ativos permite filtrar “Por classificar” pelo indicador. Due Diligence recolhe contatos/CNPJ por padrão e diferencia classificação cadastral de avaliação. Sistemas usa status semântico. Denúncias preserva ação explícita “Tratar”.

### Evidências desta rodada

- 131 arquivos de teste, **731 testes aprovados**, incluindo novos testes de estado por empresa, restauração de scroll, busca paginada, zero/erro em indicadores e ordenação acessível.
- TypeScript sem erros. ESLint dos arquivos modificados e novos sem erros; `git diff --check` sem erros de whitespace.
- Navegador autenticado: dashboard, busca “acessos”, Controles, detalhe de controle e acesso à aba de testes. Revisão de Controles em 390×844 sem overflow horizontal e em desktop.
- Build final concluído, sem a rota de prévia separada, com aviso de chunks acima de 500 kB. No prebuild, o gerador de sitemap encontrou `permission denied for function is_super_admin` ao consultar posts. As datas do sitemap original foram preservadas; investigar essa permissão antes de publicar. Nenhum deploy executado.

### Ainda pendente

Revisão específica e validação completa dos demais módulos do relatório; estados de erro nas consultas auxiliares/KPIs ainda não integradas; metodologia dos demais domínios; histórico e contexto de risco; revisão dos formulários e ações de pendências de Privacidade; licença/renovação/rotação; primeiro uso em campanhas, continuidade e relatórios; configurações e permissões efetivas; revisão final de landing page e canal público; cobertura responsiva e de acessibilidade dos fluxos restantes. Ver a continuação abaixo para os avanços de navegação, busca de vínculos e movimento.

## Continuação local — navegação, vínculos e movimento

Esta etapa também foi aplicada nas telas reais da aplicação, com a aba autenticada aberta para acompanhamento. Não houve deploy, envio de convites ou alteração de registros de clientes durante a validação.

- [x] Privacidade: indicadores antes da navegação principal, ícones nas cinco abas, áreas do programa em navegação vertical no desktop e seletor identificado no celular. Área escolhida preservada no contexto em memória.
- [x] Privacidade: apresentação do programa restrita à visão de próximos passos, orientação recolhível, explicação de ROPA/RIPD/LIA/TIA junto às avaliações e estados “Não iniciado” em lugar de `0/0`.
- [x] Privacidade: sem registros não apresenta índice positivo; o checklist existente é identificado como operacional, não certificação de conformidade. Falha de consulta não expõe erro bruto nem renderiza dados vazios como se fossem resultados válidos; carregamento não antecipa conclusões.
- [x] Vínculos: seletores simples e múltiplos usam a busca paginada, com debounce, cancelamento, “Ver mais resultados”, erros explícitos e consulta independente dos itens selecionados. Não dependem dos primeiros 400 candidatos, não misturam empresas e não removem silenciosamente vínculos indisponíveis. A função antiga limitada a 400 foi removida após a migração de seus dois consumidores.
- [x] Movimento: preferência “Reduzir animações” no perfil, aplicada imediatamente neste navegador e respeitando também a escolha do dispositivo. Indicadores mostram o valor final sem contagem quando a redução está ativa. Um observador compartilhado pausa medidores de criticidade fora da área visível; páginas ocultas pausam animações CSS.
- [x] Perfil: função administrativa com aparência neutra, sem vermelho de alerta; iniciais coerentes com o avatar compartilhado.
- [x] Due Diligence: corrigido o botão “Nova Avaliação”, que lançava erro ao acessar `event.detail.fornecedorNome` quando o evento do cabeçalho não tinha contexto. A criação em branco abre o formulário; origens por fornecedor/modelo preservam os dados recebidos em vez de descartá-los.

### Validação da continuação

- **136 arquivos / 746 testes aprovados**. Novos testes cobrem dados além dos 400 candidatos, busca inicial paginada, vínculos antigos, troca de empresa, cancelamento/erro, entrada de avaliação sem contexto, navegação de Privacidade, ausência de registros e preferências de movimento.
- TypeScript e ESLint sem erros; `git diff --check` sem falhas de whitespace. Build concluído com o aviso já conhecido de chunks acima de 500 kB. O problema de permissão do gerador de sitemap continua pendente; não foi feita uma publicação.
- Navegador: Privacidade desktop e 390×844, seletor móvel e avaliações, largura documental de 390 px sem overflow horizontal. Perfil: switch acionado, redução confirmada no estilo computado e escolha original restaurada.
- Navegador: o formulário “Nova Avaliação” passou a abrir; o seletor ofereceu mais resultados após os 40 iniciais e encontrou “Órigo Energia” pela busca sem acento `origo`. Nenhum fornecedor foi selecionado e nenhum convite/avaliação foi criado.

Status histórico desta continuação: ainda havia módulos pendentes. Ver o fechamento técnico abaixo.

## Fechamento técnico local — redução de ruído e experiência operacional

Data: 05/09/2026. Fechamento histórico dos temas UX-01 a UX-12. A reauditoria abaixo identificou lacunas adicionais; portanto, esta seção não deve ser interpretada como conclusão universal da implementação. Não declara homologação completa de todos os fluxos nem prontidão irrestrita para produção.

### Direção visual adotada

- DM Sans e identidade Akuris preservadas. Não foi criado outro tema ou uma prévia paralela.
- Tipos, ambientes, categorias, contagens e metadados deixaram de usar badges decorativos nas listas revisadas. Estado e criticidade conservam sinalização quando ajudam a decidir.
- Ausência de classificação, responsável, prazo, avaliação ou histórico é apresentada explicitamente, sem inventar conclusão ou aprovação.
- Tabelas claras, cabeçalhos discretos, hover compartilhado e tamanho único. Prioridade móvel definida pelo trabalho de cada módulo.
- Indicadores antes das abas nas telas ajustadas; filtros e alternância Lista/Kanban separados. Aviso de avaliações em atenção agora é recolhível e não se repete na própria lista de avaliações.

### Entregas por área

| Área | Implementação / revisão concluída nesta sequência |
|---|---|
| Fundação / tabelas | Tipografia, IDs, avatares neutros, abas, resumo móvel, seleção de colunas, contexto de filtros e retorno de scroll. Ordenação e paginação nativas por teclado; limites da paginação realmente desabilitados. |
| Dashboard / Riscos | Regra canônica de incidentes críticos ativos, alertas com origem e paginação; falhas não viram zero. Metodologia dos oito domínios explicada em seção recolhível. Histórico de risco usa registros históricos; comparação fictícia sobre dados atuais removida. |
| Controles / Auditorias | Visão geral antes dos comentários, ausência de testes/evidências evidente, planejamento de teste por plano vinculado respeitando permissões. Auditorias mostram itens concluídos e prazo, com tipo neutro. |
| Gap Analysis | Entrada por objetivo, início versus continuação preservados; rótulos decorativos reduzidos. Indicadores leem todos os lotes e propagam falhas. |
| Ativos / Licenças / Chaves | Pendência de classificação acionável; renovação em 30 dias, custo e responsável priorizados; valor zero válido preservado. Ambientes traduzidos, validade/rotação/status visíveis. Segredos e políticas de acesso não foram alterados. |
| Sistemas / Contas privilegiadas | Estado semântico, responsável mais visível e URL menos dominante. Prazo ausente não é apresentado como autorização de acesso permanente. |
| Revisão de Acessos | Primeiro uso orienta escopo, campanha, respostas e histórico. Contadores e consultas não escondem falhas. |
| Incidentes | Responsável e próximo prazo de tratamento na lista/detalhe. Diálogo relacionado substitui temporariamente o painel e retorna a ele ao fechar. Consultas auxiliares usam IDs dos incidentes autorizados, sem presumir FK inexistente. |
| Privacidade | Jornada/navegação simplificadas, glossário no contexto, estados não iniciado/sem dados, filtro de cadastro incompleto acionável e preservado. Sem índice positivo calculado sobre ausência de evidência. |
| Due Diligence | Classificação cadastral distinta de resultado de avaliação; ausência de score explícita. Validade/status prioritários; vencidos por data local e somente avaliações não encerradas. Consulta paginada, erro persistente/retry, troca de empresa protegida de resposta antiga. |
| Planos de Ação | Fila em aberto como foco, histórico acessível; origem canônica e consulta ao contexto real. Lista/Kanban, indicadores/abas e loading/erro consistentes com o escopo selecionado. |
| Projetos | Minhas tarefas e primeiro projeto orientados. Falhas de tarefas auxiliares não são apresentadas como ausência de trabalho. |
| Contratos | Gestor, prazo e fornecedor com acesso a Due Diligence. Tipos neutros e custo zero válido. |
| Documentos | Cadastro incompleto abre o filtro. Classificação ausente fica “Por classificar”, não “Interna”. Ordenação do conjunto antes de paginar; campo real de validade e ordenação compartilhada entre desktop/mobile. Página e tamanho preservados; paginação acessível. |
| Continuidade | Primeiro plano, preparação e teste explicados; RTO/RPO em horas. Cadastro ou zero tarefas não comprovam prontidão. Tipo e metadados discretos. |
| Relatórios | Modelos por diretoria/operação/auditoria, escopo e prévia; abertura por botão nativo. Exportação paginada sem cortes de 15/30/50 registros. Scores de Due Diligence 0–100, ausentes fora da média; estados de incidentes/denúncias/contratos reconciliados. |
| Configurações | Seções na URL, contexto de usuário/permissões preservado, papel/perfil/permissão explicados; navegação continua condicionada às permissões existentes. |
| Denúncias internas | Prazo, responsável e ação explícita preservados; consultas auxiliares com falha persistente e proteção contra resposta de outra empresa/contexto. |
| Canal público / landing | Orientação existente de código/acompanhamento e identidade organizacional conferida. Diferenciação demonstração/produto preservada. Movimento reduzido também aplicado à landing. Não foram inventados casos ou imagens de clientes. |
| Login / MFA / recuperação | Legibilidade da composição preservada. Foco e mensagens associados aos campos. MFA não reativa código expirado/limite excedido, não envia novamente após sucesso e possui expiração/reenvio consistente. Recuperação mantém mensagem neutra sobre existência de conta. |

### Confiabilidade dos dados

A utilidade visual depende do dado correto. Por isso esta rodada também removeu cortes silenciosos nas consultas de indicadores e nas listas de Documentos, Avaliações, Incidentes e Planos, além das exportações revisadas.

O helper `readAllPages` lê lotes ordenados, cancela quando solicitado e falha por inteiro quando um lote falha. Para relacionamentos sem FK, `readAllPagesByIds` usa lotes de IDs já autorizados. Foram preservados filtros de empresa e RLS; não houve mudança de política de acesso.

Isso não é uma auditoria universal de todas as consultas do repositório nem uma garantia de snapshot transacional sob escritas concorrentes.

### Evidências finais

- **142 arquivos de teste / 781 testes aprovados**, execução completa. Incluem paginação além de 1.000 registros, erro em lote posterior, cancelamento, consulta por IDs, dados dos relatórios, origens, reenvio/expiração/foco do MFA e recuperação, paginação nativa e ordenação controlada de documentos.
- TypeScript sem erros; ESLint dos arquivos TypeScript modificados/novos sem erros; `git diff --check` sem falhas.
- Build concluído: 4.864 módulos, 15,30 s na execução final. Aviso de chunks acima de 500 kB permanece.
- Navegador autenticado na aplicação real: Relatórios, Due Diligence, Documentos, Incidentes, Planos de Ação e Continuidade, além das telas verificadas nos lotes anteriores.
- Documentos: 25 registros existentes; filtro de cadastro incompleto, ordenação por Enter com `aria-sort`, paginação 20→5 registros por Enter e retorno por Espaço. Em 390×844, largura documental de 390 px, sem overflow horizontal.
- Incidentes: falha de relacionamento auxiliar reproduzida e corrigida; retry recuperou os seis incidentes. Abertura de Tratamentos e cancelamento retornaram ao detalhe, sem salvar dados e sem empilhar diálogos interativos.
- Planos: cinco ações atrasadas na fila em aberto; alternância Lista/Kanban e retorno do detalhe conferidos. Item sem vínculo continua identificado como sem origem ligada.
- Continuidade: primeiro uso sem afirmação de prontidão, unidades RTO/RPO visíveis; orientação conferida em português e inglês, idioma original restaurado.
- Due Diligence: amostra móvel em tema escuro e desktop claro; prazo, avaliação e status conferidos. Evidência responsiva é amostral, não certificação global.
- Nenhum cadastro, convite, denúncia ou e-mail foi enviado durante esta QA. Nenhum segredo foi exposto. Nenhum deploy executado.

### O que não foi declarado concluído

1. Homologação com perfis reais de clientes restritos e testes de usabilidade com usuários. Os testes de isolamento/permissões existentes passaram; isso não substitui aceitação operacional com cada perfil.
2. Matriz integral de leitor de tela, zoom de 200%, todos os formulários, temas e idiomas. Houve testes automatizados e amostras no navegador, não certificação WCAG.
3. Taxonomia de denúncias: depende do responsável pelo canal. Casos e capturas reais de clientes na landing dependem de material/autorização. Não criar conteúdo fictício para marcar estes itens como concluídos.
4. Publicação: prebuild ainda registra `permission denied for function is_super_admin` ao buscar posts para o sitemap. O build usa o fallback de 16 URLs; datas conhecidas são preservadas. A permissão deve ser investigada antes de publicar, sem enfraquecer RLS. O aviso de tamanho dos chunks também permanece registrado.

Esse foi o fechamento de então. A conferência posterior reabriu pontos técnicos de Controles, listas incompletas e contexto de revisão das contas, tratados abaixo.

## Reauditoria e complementação — 05/09/2026

Pedido: executar as pendências confirmadas. Durante a execução, o responsável confirmou que campanhas devem abranger **todos os usuários dos sistemas e contas privilegiadas**, não apenas um dos cadastros. Esta é a situação corrente; os números e limites anteriores são históricos.

### Pendências confirmadas implementadas

- Controles: consultas principal, testes, responsáveis e filtros auxiliares leem todos os lotes com ordenação estável. Falhas das consultas auxiliares chegam ao estado persistente de erro e à nova tentativa. Falha de KPI não vira zero; responsável ausente e responsável indisponível são situações distintas.
- Listas: leitura completa aplicada também a Ativos, Licenças, Chaves, Sistemas, Auditorias, Contratos, Riscos, Contas Privilegiadas e Revisão de Acessos. Os relacionamentos usam empresa/IDs autorizados; falha em lote posterior interrompe o resultado em vez de apresentar uma lista parcial como completa.
- Contas Privilegiadas: responsável pelo sistema, campanha aberta, prazo e última decisão realmente vinculada à conta. A campanha do sistema não é tratada como prova de revisão individual. Filtros de expiradas reconciliados com os indicadores e o detalhe. Campos decisivos priorizados no celular; sem badges decorativos adicionais.
- Navegação conta → campanha: abertura direta pelo ID da revisão e filtro por sistema, preservando a empresa. Consulta independente dos filtros da lista. Falha e registro indisponível não são confundidos com primeiro uso.

### Campanhas com os dois cadastros

A criação antiga buscava `sistemas_usuarios`, mas gravava seu ID em uma FK exclusiva de `contas_privilegiadas`. A finalização antiga também só alterava contas privilegiadas e não verificava todas as escritas. Isso foi corrigido na mesma integração, conforme a decisão explícita do responsável.

- Cada item/histórico possui exatamente uma origem: conta privilegiada ou usuário do sistema. Nenhuma identidade é inferida por nome/e-mail.
- A população inicial reúne todos os registros **ativos** dos dois cadastros no sistema e na empresa selecionados. Inativos/revogados não viram uma nova concessão. Ausência de população impede criar campanha vazia.
- Cópias legadas importadas de contas privilegiadas, identificadas pelo `origem_id` exato, não duplicam o item canônico. Alteração/revogação da conta atualiza essas cópias explícitas na mesma transação. Pessoas distintas que compartilham e-mail continuam separadas.
- Criação e finalização passam por transações no banco com as permissões do usuário (`SECURITY INVOKER`), mantendo RLS e MFA. A falha de qualquer escrita desfaz os efeitos; repetir a finalização não duplica histórico nem notificação.
- Revogação e nova expiração são aplicadas ao cadastro correto. Aprovar não reativa acesso já desativado. A tela explica que alterações no Akuris **não equivalem a executar ou comprovar revogação em um diretório externo**.
- Origem/empresa/sistema dos itens são validados no banco. Decisões recebem revisor/data no servidor; justificativa mínima e nova expiração para “Modificar” são exigidas. Campanhas encerradas não aceitam novas decisões nem são reabertas ao editar metadados.
- Formulário com escopo explicado, mensagens por campo, foco no primeiro erro, bloqueio durante envio e pré-requisitos de sistema/responsável. Editar não troca o sistema ou criador.
- Participantes em tabela paginada com busca, origem em texto discreto e progresso calculado sobre itens carregados corretamente. Confirmação antes de aplicar decisões; contexto de decisão substitui temporariamente o detalhe, sem empilhar diálogos interativos.
- Indicadores antes das abas; campanhas ativas separadas do histórico. Exportação de campanhas e participantes usa o mesmo conjunto e ordenação da tela, campos reais e texto protegido contra fórmulas de planilha. Busca/lista de usuários do sistema migradas para consultas paginadas e cache invalidado após decisões.

### Sitemap e inicialização

- Causa do sitemap confirmada: políticas administrativas do blog eram aplicadas também a `anon`, que não pode executar `is_super_admin`. A migração `20260905172000_blog_admin_policies_authenticated.sql` limita essas políticas a `authenticated`; não concede a função administrativa a visitantes e não remove MFA ou proteção de rascunhos.
- Correção aplicada e testada **somente no banco local**. A consulta do prebuild ao projeto remoto ainda registra a falha, pois a migração não foi publicada. O fallback de 16 URLs continua sendo usado nessa situação; não confundir build bem-sucedido com sitemap remoto corrigido.
- Dicionários de idioma passam a ser normalizados sob demanda e reutilizados por idioma. O build separa as traduções para permitir cache independente do código operacional.
- Essa separação **não reduz, sozinha, o download inicial total**. O aviso de chunks acima de 500 kB permanece; otimização adicional do peso inicial não é declarada concluída.

### Verificação desta complementação

- **147 arquivos / 815 testes automatizados aprovados**. Novos testes cobrem leituras além de 1.000 registros, erros auxiliares, origem/decisão de contas, mutações transacionais, rejeição de escrita com zero linhas, mensagens sem SQL interno, exportação e ordenação compartilhada.
- Build final concluído: 4.869 módulos, 15,57 s. Avisos conhecidos de sitemap remoto e chunks grandes permanecem documentados abaixo, não suprimidos.
- TypeScript e ESLint dos arquivos alterados/novos sem erros; `git diff --check` sem falhas.
- Testes SQL locais com `ROLLBACK`: leitura pública de posts publicados, isolamento de rascunhos, escrita anônima negada e nenhuma liberação da função administrativa.
- Testes SQL de campanhas: origens separadas mesmo com e-mail igual, deduplicação apenas por referência explícita, empresa externa negada, MFA obrigatório, campanha vazia desfeita, decisões pendentes bloqueadas, revogação e expiração em ambos os cadastros, histórico/notificação sem duplicação e bloqueio de decisões após encerramento.
- Caso com **1.002 acessos**: criação sem corte, falha de histórico injetada após efeitos parciais, reversão integral confirmada e finalização posterior de todos os itens. Os cadastros, acessos e notificações usados nesses testes eram fixtures temporárias e foram desfeitos.
- Navegador real: Controles (14 registros, 2/14 avaliados), Auditorias (7 registros), Contas Privilegiadas, acesso às revisões por sistema e formulário de nova campanha. Troca para inglês e retorno ao português conferidos.
- Amostras móveis de Contas Privilegiadas e Revisão de Acessos em 390×844 sem overflow horizontal. No formulário, quatro campos inválidos foram associados às mensagens e o foco foi para o primeiro campo. Nenhuma campanha de cliente foi criada para essa validação.

### Publicação e limites restantes

1. **Não houve deploy.** As duas migrações novas foram aplicadas somente ao Supabase local. A função de compatibilidade `finalize-review` e o frontend estão preparados no código, mas não publicados.
2. A próxima publicação deve coordenar banco, função de compatibilidade e frontend. O novo frontend depende das RPCs da migração `20260905180000_access_review_dual_scope.sql`. Não ativar campanhas mistas com o endpoint antigo de finalização; validar o conjunto em homologação antes da liberação. Regenerar e conferir o sitemap após aplicar a correção do blog no destino.
3. Homologação com perfis reais restritos, teste de usabilidade com clientes e matriz integral de acessibilidade/temas/idiomas continuam necessários. Testes SQL e amostras visuais não são certificação global. O endpoint de compatibilidade não teve fluxo HTTP autenticado completo executado nesta QA; a transação que ele chama foi exercitada diretamente nos testes SQL.
4. Revisão de taxonomia do canal exige o responsável; provas/casos de clientes na landing exigem material autorizado. Nenhum conteúdo fictício foi criado para encerrar esses itens.
5. O aviso de tamanho do bundle continua registrado. Não foi ocultado aumentando o limite de aviso, nem convertido em uma promessa de ganho de desempenho sem medição.

As pendências funcionais confirmadas nesta reauditoria foram implementadas e verificadas nos limites descritos. Isso não transforma o relatório em auditoria universal de todas as consultas, operações de diretório externo ou permissões do produto.

## Anexo 111 e preparação da publicação — 05/09/2026

Esta seção substitui o estado histórico de implantação acima. O responsável autorizou executar o documento `111.docx`, aplicar o logotipo fornecido ao canal de denúncia e publicar o conjunto acumulado.

### Alterações do anexo

- Alertas críticos e pendências atribuídas centralizados no sino, em abas próprias junto às novidades. Retirados os dois blocos correspondentes do dashboard e a seção “Como interpretar estes indicadores”. O sino distingue aviso lido de trabalho concluído; não mostra “Tudo em dia” enquanto há alertas críticos.
- Pendências com paginação, links para o registro de origem, leitura completa dos lotes e erro com nova tentativa. Falha de consulta não aparece como ausência de tarefas. Consultas/cache respeitam empresa e usuário; leitura de pendências ou novidades não marca avisos como lidos.
- Configurações recebe o mesmo destaque violeta do menu ativo. Corrigida a composição entre o link e o botão que estava transformando uma função de classes em texto. Sair recebe destaque durante a confirmação, sem simular um módulo permanentemente selecionado.
- Abas horizontais em linha única, com nomes completos e setas acessíveis quando há transbordamento. Grades de navegação das configurações e assistentes verticais foram preservados. Rolagem respeita movimento reduzido.
- Templates de Due Diligence sem os rótulos “Padrão” e categoria ao lado do título. Filtros de categoria e status sempre visíveis; estado ativo, versão e informações operacionais preservados.
- Painel do plano de ação reorganizado com título, ações, dados de responsável/prazo e origem. Notas vazias não ocupam seção; abas com nomes completos e ícones.
- Painéis de indicadores do dashboard com cabeçalho coerente, linhas discretas, subtítulos e paginação. A indicação de quantidade diferencia o conjunto carregado do total quando existe limite de consulta; “Ver todos” mantém o recorte aplicável.
- Células padrão de status nas tabelas, em desktop e celular, usam rótulos legíveis em vez de códigos com sublinhado. Não foram alterados os valores persistidos no banco.
- Logotipo fornecido copiado sem edição para `src/assets/akuris-logo-light.png`, preservando proporção e transparência. Aplicado no canal Akuris e na assinatura da plataforma; logotipos próprios dos clientes permanecem no cabeçalho de seus canais.
- Textos novos em português e inglês. Sem acrescentar badges decorativos.

### Evidências desta entrega

- **149 arquivos / 823 testes aprovados**, além de TypeScript sem erros. ESLint dos arquivos alterados sem erros; avisos de estilo/tipagem preexistentes não foram apresentados como resolvidos.
- Build de produção concluído com 4.870 módulos. Sitemap de 16 URLs gerado sem a antiga falha de permissão do blog. O aviso de chunks acima de 500 kB permanece.
- Navegador da aplicação local real: sino, painel de ativos, plano de ação, filtros de templates, abas de Controles, seleção de Configurações e cabeçalho/rodapé do canal de denúncia. A navegação aberta pelo usuário foi preservada durante as verificações finais.
- Testes SQL locais repetidos com rollback, incluindo a campanha de 1.002 acessos e falha injetada no histórico. Não foram criadas/finalizadas campanhas reais, nem enviadas denúncias, convites ou e-mails de clientes durante esta validação.

### Publicação coordenada

- Destino Supabase conferido com o projeto vinculado. Backup de esquema armazenado fora do repositório, antes da migração; ele não substitui um backup de dados.
- Aplicadas em produção as migrações `20260905172000_blog_admin_policies_authenticated.sql` e `20260905180000_access_review_dual_scope.sql`, após dry-run limitado a essas duas. Não foram executados seeds, alterações de autenticação ou revogações de acessos reais.
- Publicada a função de compatibilidade `finalize-review`, mantendo verificação JWT. Requisição sem autenticação devolveu 401. Login por e-mail permanece habilitado no serviço.
- Frontend validado e preparado para sincronização GitHub e publicação pelo fluxo existente do Lovable. A confirmação da publicação e os smoke tests do domínio devem ser registrados somente após a operação, não inferidos do build local.
- O Lovable apresenta um aviso genérico preexistente sobre funções `SECURITY DEFINER` acessíveis publicamente. Não foi ignorado nem corrigido com revogações indiscriminadas: há RPCs públicas intencionais do canal/portal. As novas RPCs de revisão não concedem execução a `anon`. Isso não constitui auditoria integral de todas as funções públicas.

Permanecem os limites de homologação com clientes, matriz integral de acessibilidade, taxonomia do canal, peso inicial do bundle e teste HTTP autenticado integral da função de compatibilidade, já descritos acima.

### Resultado da tentativa de publicação

- Código acumulado enviado ao `main` no commit `0769cc7b0494bc05b1cefa7618ba7cb0510de105`.
- [CI Segurança dessa versão](https://github.com/mathewscruz/akuris-grc/actions/runs/33984166303) concluído com sucesso: qualidade, varredura de segredos e relatório de dependências. Lint e auditoria de dependências continuam informativos, conforme a política existente do pipeline; “success” não significa ausência de todos os avisos.
- Smoke tests remotos: leitura pública de posts publicados retorna 200; execução anônima das duas novas RPCs de revisão retorna 401 / SQLSTATE 42501. Histórico remoto confirma as duas migrações aplicadas.
- **Frontend ainda não publicado.** O Lovable reconhece `mathewscruz/akuris-grc`, branch `main`, como conectado, mas informa “Couldn't check sync status right now” e “Lovable couldn't read this project's history. Try again shortly.” Atualização da página e nova verificação de sincronização não trouxeram o commit novo.
- O histórico de publicação permanece na versão anterior `664df366`, identificada como publicada às 09:28 de 05/09/2026. A opção “Publicar alterações” continua desabilitada. O sucesso do push/build local não foi apresentado como implantação da interface.
- Não foi desconectada a integração, criado outro repositório, alterado DNS, migrado provedor ou revertido código de produção para tentar contornar a falha. A documentação do Lovable informa que desconectar e reconectar cria outro repositório; essa ação não é uma tentativa segura de atualização do mesmo vínculo.
- Próximo passo: assim que o Lovable voltar a sincronizar, conferir a versão recebida, executar “Publicar alterações” e validar o domínio e o novo logotipo. Banco e função de compatibilidade já estão publicados; não reaplicar as migrações ou executar campanhas reais como teste.

## Anexo 23 — refinamento e orientação incluída na plataforma

Pedido: melhorar o popup de requisitos, não cobrar créditos dos clientes pela orientação, persistir e reutilizar esse conteúdo, corrigir o corte das abas de Controles e alinhar busca/filtros dos templates. O texto do DOCX e suas três imagens originais foram conferidos. O renderizador de Word não estava disponível; o documento original não foi alterado.

### Implementação

- Popup de requisitos com título completo, atalhos para orientação/diagnóstico/evidências/responsável, rodapé fixo e critérios de conclusão recolhíveis. Orientação sem caixas aninhadas; perguntas com separadores discretos e alternativas maiores com estado acessível. No desktop os painéis rolam independentemente; no celular há uma única sequência vertical com atalhos e foco na seção escolhida.
- Corrigida a causa do corte das abas: o elemento de medição interno do ScrollArea expandia a largura intrínseca e empurrava inclusive o botão Editar para fora. Conteúdo e abas agora respeitam a largura disponível; detalhe de Controles ampliado. Nomes completos em linha única, com setas de rolagem quando necessário.
- Busca, categoria e status dos templates compartilham uma faixa. Em telas menores, reorganizam-se sem overflow. Busca, filtro combinado, estado vazio e limpeza de filtros foram exercitados sem alterar templates.
- Orientação de requisitos classificada como custo da plataforma, tanto na geração individual quanto no lote. Removida a dedução de créditos no servidor e os eventos/mensagens de cobrança dessa operação no cliente. Outras funcionalidades de IA continuam com sua política de cobrança; o catálogo histórico de custos foi preservado. Não houve estorno ou alteração retroativa de lançamentos.
- Conteúdo persistido no catálogo de requisitos, separado por idioma, é lido antes de consultar o modelo. Geração só é considerada concluída após confirmação da gravação. As duas interfaces compartilham cache de consulta; alternar requisito/idioma não reutiliza indevidamente o texto anterior.
- Autenticação e perfil ativo continuam obrigatórios. Regeneração forçada e geração em lote ficam restritas ao superadministrador. Ausência de cache tem limitação de frequência por conteúdo e usuário no banco, sem usar a franquia de IA do cliente. Essa janela limita concorrência, mas não é uma garantia de execução exatamente uma vez.
- Falhas de leitura, geração ou gravação não são apresentadas como sucesso. Requisição pendente pode ser consultada novamente com intervalo e limite; lote incompleto não recebe confirmação de conclusão integral. Conteúdo já salvo permanece disponível mesmo se o provedor de IA estiver indisponível.

### Verificação

- **152 arquivos / 841 testes aprovados**, incluindo persistência e reutilização, falha de gravação/modelo, geração concorrente limitada, consultas compartilhadas, troca de idioma/requisito e ausência de eventos de cobrança para orientação. Testes das demais operações de IA mantidos.
- TypeScript sem erros; testes/hook novos sem avisos de lint. O diálogo possui avisos preexistentes de tipagem/dependências, sem erros; não foram declarados resolvidos. `git diff --check` aprovado.
- Build de produção concluído: 4.870 módulos, 16,59 s, sitemap de 16 URLs sem erro de permissão. Aviso conhecido de chunks grandes permanece.
- Navegador local real: orientação 4.1 já salva carregada; atalhos com foco correto; popup a 390×844 ocupa a tela sem overflow horizontal e mantém Cancelar/Salvar rascunho visíveis. Não foram gravadas respostas de avaliação.
- Controles: sete rótulos completos no desktop, largura interna 1.150/1.150 px e Editar dentro dos limites. No celular, largura 388/388 px, setas operantes e acesso à última aba. Templates: busca/filtros com a mesma coordenada vertical também a 1.024 px; a 390 px reorganizam-se sem transbordamento.
- O runtime local de Edge Functions não foi iniciado: a instância local existente usa outro identificador de projeto. O fluxo completo HTTP autenticado com geração real não foi executado, evitando chamadas pagas ou mudanças em avaliações de clientes. Serviço de geração/cache exercitado por testes isolados; compilação/publicação remota e teste anônimo devem ser registrados abaixo após execução.

### Publicação desta complementação

Preparada para a função `populate-requirement-guidance` no projeto Supabase existente, mantendo JWT, sem nova migração. O estado final do backend, sincronização e publicação da interface será registrado após cada operação; a falha anterior do Lovable não autoriza trocar repositório ou provedor.

- Função `populate-requirement-guidance` publicada com sucesso em `lnlkahtugwmkznasapfd`, incluindo o serviço compartilhado de geração/cache. Verificação JWT preservada; POST sem autenticação confirmado com HTTP 401. Nenhuma migração ou configuração de login foi alterada nesta complementação.

### Publicação confirmada — fechamento do anexo 23

Esta confirmação substitui o bloqueio de frontend registrado nas tentativas anteriores.

- Código enviado ao `main` no commit `858c89f91a0248c4006e1bbac2defdc3a4ae28cc`, incluindo o conjunto acumulado de `0769cc7b`. [CI Segurança](https://github.com/mathewscruz/akuris-grc/actions/runs/33986306568) concluído com sucesso nos três jobs. Mantida a ressalva de que lint/auditoria de dependências são informativos no pipeline existente.
- O Lovable voltou a apresentar os novos commits, passou pelo estado “Atualizando projeto…” e marcou **“feat: refine requirement dialogs and include guidance at platform cost” como Publicado**, com “Seu site está atualizado”. Não houve desconexão, migração de provedor ou alteração de DNS.
- `https://akuris.pt/` respondeu HTTP 200 e passou do asset antigo `index-CQ8tLNGl.js` para **`index-PU4uxMAq.js`**. A versão foi conferida também por elementos reais da aplicação, não apenas pelo nome do arquivo ou status do painel.
- Canal público `/akuris/denuncia`: cabeçalho e rodapé carregam `akuris-logo-light-B_VAGyfp.png` com dimensões naturais 650×195 e a imagem fornecida, sobre fundo branco.
- Controles em produção: diálogo com largura interna 1.151/1.151 px, sete abas completas e acesso a “Planos de ação” confirmado. Nenhum plano, comentário, teste ou controle foi criado/alterado nessa conferência.
- Gap Analysis em produção: requisito 4.1 abriu o novo popup com navegação por seções, largura contida e orientação previamente salva. Mensagem de orientação incluída, sem desconto de créditos, presente. Diálogo fechado por Cancelar; não foram gravadas respostas nem solicitada regeneração.
- Templates em produção: busca, categoria e status medidos na mesma coordenada vertical, confirmando a nova faixa no domínio publicado.
- Banco, funções atualizadas e interface estão publicados. Permanecem apenas os limites de validação explicitados acima (sem teste de geração real autenticada nem homologação universal de todas as permissões/temas); não se trata de uma certificação global de segurança ou acessibilidade.
