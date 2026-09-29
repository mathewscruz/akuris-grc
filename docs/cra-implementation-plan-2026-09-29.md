# CRA Readiness — plano incremental baseado na arquitetura do Akuris

## Escopo e decisão antes da implementação

Pedido: Cyber Resilience Act - CRA Readiness Assessment. Avaliar prontidão,
não certificar conformidade. Este documento antecede a primeira alteração de código.
Não há autorização nesta solicitação para publicar nem para modificar dados de produção.

## Arquitetura encontrada

- React/Vite, React Router, Supabase/Postgres; empresa ativa em `AuthProvider`.
- Catálogo existente: `gap_analysis_frameworks` e `gap_analysis_requirements`.
  Lista em `GapAnalysisFrameworks`, catálogo em `FrameworkCatalog`, detalhe em
  `GapAnalysisFrameworkDetail`, respostas em `GenericRequirementsTable` e
  `RequirementDetailDialog`; descrição/orientação PT/EN já persistida.
- `gap_analysis_evaluations` tem unicidade por `(framework_id, requirement_id,
  empresa_id)`. Seu `assessment_id` não oferece isolamento funcional por produto:
  queries, métricas, histórico e componentes seguem o escopo organização.
- Score atual (`src/lib/gap-score.ts`) inclui pendentes como zero. O CRA solicitado
  exclui pendentes e precisa mostrar cobertura separada. Não mudar a fórmula antiga.
- `gap_analysis_requirement_crosswalk` já relaciona pares de requisitos;
  `useReusoFramework` oferece propostas com aceitação humana. Isso não equivale
  a um catálogo universal de controles e não deve ser apagado ou reinterpretado.
- Já existem `evidence_library`, `evidence_library_links`, processamento de
  evidência com citações e revisão humana, `planos_acao` e históricos. Reutilizar
  esses serviços; não criar outra biblioteca, outro motor de IA ou outro GRC.
- Segurança atual: perfis ativos, empresa, permissões por módulo e MFA validado
  no banco. As novas entidades precisam usar esses mesmos limites, além de FKs
  compostas para impedir vínculos entre empresas.

## Alterações incrementais e critérios de saída

### 1. Fundação e catálogo regulatório

1. Adicionar versões de frameworks e um catálogo de Universal Controls;
   conservar `gap_analysis_frameworks`/`gap_analysis_requirements` como catálogo.
2. Relações control↔requirement com `full`, `partial`, `supporting`, notas,
   proveniência e revisão; sem herança automática de resposta/conformidade.
3. Metadados versionados: referência regulatória, pergunta, orientação,
   evidência esperada, regra de aplicabilidade, criticidade e remediação.
4. Registrar CRA e 22 domínios com um conjunto inicial explícito e rastreável
   de requisitos. Não declarar esse conjunto como cobertura integral da lei.
5. Distinguir frameworks por produto dos organizacionais. CRA não pode cair
   no questionário antigo sem passar por aplicabilidade e seleção do produto.
6. Validar migração, permissões reais no Postgres, integridade dos vínculos,
   ausência de alterações nos catálogos/respostas anteriores e testes existentes.

### 2. Produto e decisões preliminares

1. Produtos e versões separados por empresa: responsáveis, suporte, mercados,
   disponibilização na UE, deployment, repositórios e equipe.
2. Wizard determinístico e versionado, com respostas desconhecidas, exceções,
   contexto de software livre, SaaS/remote processing e papel econômico.
3. Classificação baseada na função principal e nos anexos III/IV, não na mera
   existência de login/IAM dentro de qualquer aplicação. Registrar revisão
   humana, justificativa, autor/data e valor anterior.
4. Não criar nem responder assessment automaticamente a partir da triagem.

### 3. Assessment, evidências e findings

1. Novo escopo genérico de assessment por empresa + produto + versão do produto
   + versão regulatória. Preservar os assessments organizacionais existentes.
2. Snapshot de requisitos selecionados; respostas únicas por assessment/requisito.
3. Reuso explícito da biblioteca por vínculo contextual (empresa, produto,
   versão, requisito e controle). Não compartilhar documentos entre clientes.
4. Finding criado de forma idempotente para gap confirmado; correção do status
   não apaga o histórico. `Not Assessed` não deve fingir gap confirmado.
5. Score ponderado 100/50/0 somente sobre itens avaliados; N/A fora do denominador,
   pendentes e cobertura ao lado. Sem avaliados ⇒ sem score, nunca 100% artificial.

### 4. Remediação, dashboard e relatório

1. Vincular finding a `planos_acao`; mapear estados sem mudar os estados legados.
2. Dashboard por assessment/produto e 22 domínios; criticidade, cobertura de
   evidências válidas e progresso das ações, sem confundir score com conformidade.
3. Relatório com escopo, versões, fontes, cobertura, limitações e disclaimer.
4. Reporting readiness: distinguir vulnerabilidade ativamente explorada de
   incidente grave, registrar equipes/prazos aplicáveis. Não enviar a autoridades.
5. SBOM CycloneDX/SPDX: validar formato/tamanho, relacionar versões e histórico.
   Não prometer análise de vulnerabilidades ou integração ainda não implementada.

### 5–6. IA e Regulatory Intelligence

- Adaptar a análise já existente ao contexto produto/assessment; decisão humana
  obrigatória. Não criar percentuais de confiança sem método verificável.
- Mapeamentos CRA/NIS2/DORA/ISO/NIST/SOC2 curados e rastreáveis: relações parciais
  não viram equivalência. Validar os códigos realmente existentes no catálogo.
- Reuso de evidências não implica reuso automático de conclusões ou de escopo.

## Segurança e operação

- Migrações aditivas pequenas, grants explícitos, RLS em todas as novas tabelas,
  índices das FKs/predicados, funções invoker por padrão e sem confiar em metadata
  editável do usuário. Catálogo central somente leitura para clientes.
- Auditoria protegida contra edição, com autor da sessão e valores anteriores/
  novos; não guardar conteúdo de arquivos nem segredos nos logs.
- Anexos: reaproveitar Storage privado/links temporários. Em resposta de 29/09/2026,
  o usuário retirou antivírus do escopo porque a Akuris não opera esse serviço.
  Não implementar nem prometer malware scanning. Continuam obrigatórias as
  validações de tamanho/formato, isolamento por tenant e download seguro;
  assinatura de URL, extensão ou parser não substituem antivírus.
- Não alterar senha/MFA, permissões antigas, documentos ou saldos de clientes.
- Não fazer migração de dados históricos nem liberar CRA em produção antes dos
  gates funcionais e de isolamento. Catálogo inicial fica em preparação.

## Fontes oficiais e critérios regulatórios

Verificadas em 29/09/2026; interpretação implementada é triagem, sujeita a revisão.

- Regulamento (UE) 2024/2847: https://eur-lex.europa.eu/eli/reg/2024/2847/oj
- Síntese da Comissão: https://digital-strategy.ec.europa.eu/en/policies/cra-summary
- Aplicação/fases: https://digital-strategy.ec.europa.eu/en/policies/cyber-resilience-act
- Descrições técnicas (UE) 2025/2392:
  https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32025R2392

Datas distintas: obrigações de notificação do art. 14 a partir de 11/09/2026;
aplicação geral em 11/12/2027. A vigência não deve ser resumida a um único badge.
O suporte mínimo de cinco anos admite a exceção legal de vida útil esperada
inferior; não configurar cinco anos como regra absoluta para todos os produtos.
O uso de login, nuvem ou componentes open-source isoladamente não decide classe
ou aplicabilidade. Aplicabilidade e requisitos selecionados precisam de revisão.

## Definition of Done da primeira entrega de produto (não apenas fase 1)

A primeira entrega funcional só estará completa com organização/produto/versão,
wizard, revisão da classificação, assessment, respostas, evidências, findings,
score, dashboard, ações e isolamento real por tenant testados. Fundação/catálogo
isolados não serão apresentados como cumprimento dessa definição.

## Registro do primeiro incremento — 29/09/2026

Implementado e validado somente no ambiente local:

- Fundação regulatória genérica: versões de framework, domínios, controles
  universais, metadados de requisitos e mapeamentos com força/proveniência/revisão.
- CRA em preparação: 22 domínios, 22 controles universais e 22 requisitos iniciais
  com textos PT/EN, orientações, evidências esperadas, criticidade e remediação.
  É um catálogo inicial de prontidão para fabricante, **não cobertura integral
  do regulamento nem catálogo suficiente para os demais papéis econômicos**.
- Modelo de produtos/versões com validação de responsáveis, datas e metadados;
  isolamento por empresa, MFA e permissões do Gap Analysis no banco.
- Histórico protegido com autor real da sessão, campos alterados e valores
  anteriores/novos. Repositórios e textos livres sensíveis não são duplicados no log.
- Cálculo CRA separado, testado com ponderação e cobertura. Não foi conectado
  ao dashboard nem substitui a fórmula dos frameworks organizacionais.
- Bloqueio de respostas CRA na tabela organizacional legada. CRA continua oculto
  para não oferecer um questionário sem o fluxo por produto.

Migrações aditivas, nesta ordem:

1. `20260929145826_regulatory_control_foundation.sql`
2. `20260929145827_cra_readiness_catalog.sql`
3. `20260929151841_regulatory_foundation_input_guards.sql`

Foram executadas diretamente no banco local para validação, sem alterar o
histórico de migrações. O histórico local tem divergências anteriores; **não
executar push/reset/replay de todas as migrações para tentar reconciliá-lo**.
Antes de uma publicação futura, comparar o schema e o histórico do destino,
homologar apenas estas alterações e preservar os dados existentes.

Validações deste incremento:

- 23 testes unitários CRA: catálogo, paridade com seed SQL, datas, validação dos
  produtos/versões, URLs sem credenciais e cálculo separado do legado.
- Teste real no Postgres (`scripts/qa/regulatory-foundation.sql`), com empresas,
  usuários sem senha e sessões exclusivamente de teste, tudo em `ROLLBACK`:
  isolamento, MFA, perfil inativo, anônimo, leitura/criação/edição, responsáveis,
  identidade imutável, datas, URLs, histórico protegido, catálogo global e
  criação/edição/exclusão de avaliação legada sem regressão.
- TypeScript e lint dos arquivos novos aprovados; build Vite aprovado.
- Suíte completa: **1.126 testes aprovados em 194 arquivos**. A primeira rodada
  apontou uso de conversão UTC no validador de datas; substituído por validação
  de calendário sem fuso, sem mudar o teste de regressão existente.
- Advisors: nenhum aviso WARN de segurança ou desempenho nas novas entidades.
  Há avisos anteriores no banco, incluindo `somar_dias_uteis` sem search_path
  fixo e 233 avisos de desempenho em outras entidades; não alterados neste escopo.
- Não houve publicação, alteração de senha, dispensa de MFA, chamada de IA,
  cobrança de créditos, envio de e-mail ou criação de conta de cliente.

Ainda não implementado **naquele primeiro incremento**: wizard e classificação com revisão,
telas de produtos/versões, assessments por produto, respostas, vínculos de
evidências, findings, ações, dashboard, relatório, SBOM, reporting readiness,
adaptação da IA e mapeamentos curados com os demais frameworks. A próxima fase
começa pelo wizard e pelas decisões preliminares, sem ativar o catálogo antigo.

## Entrega funcional e verificação — 29/09/2026

O registro acima descreve a fundação inicial. O fluxo funcional descrito a seguir
foi implementado e exercitado localmente, sem publicar nem alterar produção.

### Funcionalidades entregues

- Entrada CRA em Gap Analysis e workspace em `/gap-analysis/cra`, com empresa
  ativa, produtos, versões e avaliações independentes. Não usa nem altera as
  respostas organizacionais dos frameworks legados.
- Wizard de aplicabilidade com respostas desconhecidas, papel econômico,
  classificação preliminar baseada na função principal e revisão humana com
  justificativa. Alterações de produto, versão, papéis ou classe exigem novo
  assessment: o escopo anterior permanece rastreável.
- Catálogo inicial expandido para **30 requisitos, 22 domínios e 22 controles
  universais**, incluindo obrigações por papel econômico. A seleção depende do
  papel/classe; não se apresentam todas as obrigações de fabricante como se
  fossem aplicáveis ao distribuidor. Catálogo permanece identificado como base
  inicial em preparação, não cobertura jurídica integral.
- Requisitos com snapshot do texto/peso/regra, cinco estados, responsável, prazo,
  justificativa e controle de revisão para impedir sobrescrita concorrente.
  Mudanças de status mantêm a página da tabela; busca e filtros funcionam.
- Biblioteca de evidências existente reutilizada, com uploads assinados em bucket
  privado, URLs HTTPS, comentários, responsável, datas, validade e revisão humana
  específica do requisito. Retirar o vínculo não apaga o arquivo histórico.
  Evidências CRA entram na contagem de uso da biblioteca.
- Findings idempotentes para respostas parcial/não conforme, com risco, impacto,
  recomendação, evidências faltantes, responsável, área, prazo e estágios.
  Criar ação usa `planos_acao`, não outra implementação de plano de ação; a tela
  exibe e abre o plano nativo e seu status. Conclusão de ação/aceite de risco não
  converte requisito automaticamente em conforme.
- Dashboard com score ponderado 100/50/0, cobertura e pendências separadas,
  domínios, gaps por risco, evidências válidas e remediações. Sem respostas
  avaliadas, o score fica indisponível. Histórico do cálculo preservado no banco.
- SBOM por versão de produto: importação de CycloneDX JSON 1.4–1.7 e SPDX JSON
  2.2/2.3, limites de tamanho/componentes, validação estrutural, metadados e
  histórico. Não é validação integral de schema, scanner de vulnerabilidades,
  parser de XML/tag-value nem integração automática com fornecedores.
- Reporting readiness para vulnerabilidade explorada e incidente grave, equipes,
  procedimentos, último exercício e orientação 24h/72h/final. Prazos do artigo 14
  contextualizados para o fabricante; não há envio a autoridades.
- Relatório PDF com resumo, produto, escopo/classificação, metodologia, domínios,
  respostas, gaps, ações, cobertura de evidências, SBOM, reporting e limitações.
  Reaproveita o exportador DocGen, sem IA nem consumo de créditos.
- Análise de evidências adaptada ao motor existente: contexto de produto, versão,
  requisito e arquivo resolvido no servidor; hash do arquivo, cache contextual,
  autorização e vínculo ao job verificados. É uma solicitação explícita, com
  revisão humana; falha/indisponibilidade não representa análise concluída.
- Relações many-to-many e cinco mapeamentos iniciais de apoio para códigos reais
  de ISO 27001, NIST CSF, NIS2, DORA e SOC 2. São rascunhos rastreáveis, não
  equivalências nem curadoria jurídica final. Não transferem conformidade.
- Textos PT/EN registrados na internacionalização, componentes do design system,
  suporte a modo escuro e telas estreitas. Auditoria, RLS, permissões e MFA
  aplicados no banco; antivírus omitido conforme decisão explícita do usuário.

### Ordem de migrações e futura publicação

1. `20260929145826_regulatory_control_foundation.sql`
2. `20260929145827_cra_readiness_catalog.sql`
3. `20260929151841_regulatory_foundation_input_guards.sql`
4. `20260929152800_regulatory_assessment_workflow.sql`
5. `20260929153208_regulatory_catalog_role_obligations.sql`
6. `20260929160133_regulatory_workflow_guards_and_analysis.sql`
7. `20260929162719_regulatory_storage_and_action_handoff.sql`

Todas foram aplicadas diretamente **somente no Postgres local**, não registradas
como migrações remotas. Mantém-se a proibição de replay/reset indiscriminado para
resolver divergências anteriores. A última migração reutiliza o bucket privado
da biblioteca, restaura suas políticas nomeadas quando ausentes e protege
arquivos já vinculados; não copia anexos de clientes.

Com autorização futura: conferir schema/histórico e backup do destino, homologar
as sete migrações em ordem, publicar `analyze-evidence-against-requirement` e suas
dependências compartilhadas (incluindo `regulatory-evidence-context.ts` e
`evidence-analysis-handler.ts`), homologar IA/créditos e fluxos com conta de teste,
e somente então publicar o frontend. Verificar também outras funções que
empacotem o mesmo handler antes de concluir a liberação.

### Evidências de validação

- **1.165 testes aprovados em 196 arquivos**, incluindo 61 testes específicos de
  fundação, workflow e contexto de IA CRA; suite legada preservada.
- `npm run typecheck`, build Vite e lint dos arquivos implementados aprovados.
  O build mantém aviso preexistente de bundles grandes.
- `scripts/qa/regulatory-foundation.sql` e `scripts/qa/regulatory-workflow.sql`
  executados no Postgres local, com rollback: isolamento entre empresas, MFA,
  perfis/permissões, escopo por produto/versão, snapshots, decisões, evidências,
  findings idempotentes, ações nativas, scores/histórico e compatibilidade legada.
- Advisors locais: nenhum WARN nas novas entidades; 234 avisos anteriores em
  outras entidades não foram tratados como parte deste módulo.
- Navegador com empresa/conta QA isoladas, login normal e MFA real: criação de
  produto/versão/assessment, resposta parcial, manutenção da página 2, upload e
  revisão de evidência, geração de finding, criação/abertura de ação nativa,
  importação de SBOM, salvamento de reporting e busca.
- Verificados desktop 1440 px, mobile 390 px sem overflow horizontal, inglês e
  modo escuro. Sem erros JavaScript reportados pelo navegador nessa conferência.
- PDF real gerado pelo botão do módulo, 9 páginas A4, conferidas visualmente:
  capa, sumário, tabelas, evidências, reporting e avisos. O capturador de downloads
  da automação cancelou o evento; o arquivo foi inspecionado a partir do Blob
  efetivamente produzido pela interface. Não se declara homologada a captura de
  download pelo driver de automação.
- Ao terminar, removidos apenas a empresa/conta fictícias, seus registros QA e
  os dois anexos de teste, pelo serviço de Storage. Nenhum dado de cliente foi
  removido; a conta de teste e suas sessões não permanecem disponíveis.

### Limites e gate externo pendente

O ambiente local não tem `LOVABLE_API_KEY`. Uma solicitação real de análise
retornou erro, sem job concluído nem débito de crédito; a indisponibilidade tem
mensagem própria. Os testes do contrato/contexto passaram, mas **o resultado de
IA com provedor real ainda precisa ser homologado em ambiente configurado**.
Nenhuma chave foi criada, retirada de produção ou exibida para contornar isso.

Essa entrega cobre o fluxo funcional inicial, não uma certificação jurídica nem
uma expansão exaustiva de todas as cláusulas CRA. Curadoria regulatória final e
homologação do provedor são gates explícitos antes de comercializar/publicar o
catálogo como definitivo. Não houve commit, push ou publicação nesta entrega.
