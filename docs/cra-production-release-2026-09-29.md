# Publicação CRA Readiness e retirada de preços — 29/09/2026

## Escopo autorizado

O usuário solicitou colocar em produção a entrega CRA e a retirada dos preços
do site. A publicação não altera valores de assinaturas nem apaga avaliações
organizacionais existentes. O catálogo CRA continua sendo uma base inicial de
prontidão em preparação, não uma certificação ou cobertura jurídica integral.

## Versão e destino

- Código CRA: `fbbca46f`.
- Retirada de preços: `720f2579100a51a92eaca268e4d83f6514b763a3`.
- Repositório: `mathewscruz/akuris-grc`, ramo `main`.
- Supabase: `lnlkahtugwmkznasapfd` (Akuris).
- Lovable: `e64d00f7-1631-421a-bcc8-86aa27d8fb2a` (akuris-grc).
- Endereço oficial: https://akuris.pt.
- Referência anterior para rollback da interface: `20560c7637f689170693b9970c394a2862607627`.

## Banco e função — concluídos

Backup do esquema `public,storage`, sem dados de clientes, e cópia da versão
anterior da função salvos localmente em `.tmp` ignorado pelo Git. Segredos não
foram exportados, alterados nem incluídos no repositório.

O dry-run identificou somente as sete migrações novas, aplicadas em ordem:

1. `20260929145826`
2. `20260929145827`
3. `20260929151841`
4. `20260929152800`
5. `20260929153208`
6. `20260929160133`
7. `20260929162719`

Não houve replay de migrações antigas, seeds indiscriminados ou alteração de
Vault/roles. Confirmados no destino: 22 domínios, 22 controles universais,
30 requisitos, 35 vínculos de catálogo (30 internos e cinco de apoio).

`analyze-evidence-against-requirement` publicada na versão **126**, incluindo as
dependências compartilhadas e o contexto CRA. A verificação de JWT continua
ativada; chamada sem autenticação respondeu **401**. O provedor de IA tem chave
configurada, cuja existência foi conferida apenas pelos metadados.

As 15 novas tabelas têm RLS/políticas e não concedem SELECT a `anon`. As novas
funções RPC são invoker, com search_path fixo e sem execução anônima. Os advisors
não apontaram novos avisos WARN de desempenho. Apontaram 15 avisos de descoberta
do **schema** GraphQL para usuários autenticados; o SELECT é necessário à
aplicação e continua sujeito a RLS/MFA/permissões. Isso não foi tratado como
permissão de leitura entre empresas. Avisos preexistentes ficaram fora do escopo.

Referência do aviso de descoberta de schema:
https://supabase.com/docs/guides/database/database-linter?lint=0027_pg_graphql_authenticated_table_exposed

## Validações

- Suíte local: **1.168 testes em 197 arquivos**, todos aprovados.
- Typecheck, build Vite e lint dos arquivos alterados aprovados (avisos legados
  de bundle/tipagem já registrados na implementação).
- Testes reais locais do fluxo, isolamento, MFA, evidências, finding, plano de
  ação, SBOM, relatório PDF e responsividade descritos no plano de implementação.
- Pré-publicação Lovable: `/planos` redireciona para `/?demo=1&interest=plans`,
  abrindo o formulário de contato sem preços.
- CI: https://github.com/mathewscruz/akuris-grc/actions/runs/36617463646

## Verificação final — concluída

- Lovable publicou a versão `720f2579` no domínio oficial. Deployment:
  `99c7e79e-2fae-4caf-a453-121145b31790`; painel confirmou site atualizado.
- CI concluído com sucesso, incluindo testes, tipagem/lint, detecção de segredos
  e verificação de dependências.
- HTTP 200 em `/`, `/auth`, `/gap-analysis/cra`, `/sitemap.xml`, `/robots.txt`
  e `/llms.txt`. Bundle servido: `/assets/index-DJmc2Q4I.js`.
- Sessão normal do usuário, sem alteração de senha/MFA, abriu Gap Analysis e
  CRA em produção. O cadastro de produto, versão, triagem e avaliação funcionou.
  O escopo sintético de fabricante gerou 24 requisitos; pendentes não viraram
  conformidade: score vazio, cobertura 0% e 24 pendentes.
- Upload privado e vínculo de evidência funcionaram. A análise real retornou
  `parcial`, citou as linhas do arquivo e apresentou lacunas/próximos passos,
  sem modificar automaticamente a avaliação humana.
- Uma geração consumiu um crédito. Consultar novamente reutilizou o mesmo
  resultado sem cobrança adicional. O único crédito do teste foi estornado,
  sem alterar consumo de outros trabalhos.
- Na versão publicada, `/planos` redireciona para `/?demo=1&interest=plans` e
  abre o formulário comercial sem preços. Navegação pública e sitemap sem
  página de preços. Dados internos de assinaturas preservados.
- Registros fictícios do produto `QA Publicacao CRA 20260929`, sua avaliação,
  evidência, análise e arquivo privado foram removidos após a conferência,
  com filtros por identificadores exatos e validação da identidade do teste.
  Nenhum cadastro ou avaliação real foi removido.
- Tela final capturada localmente em `.tmp/cra-production-release-20260929.png`;
  aba autenticada deixada na visão CRA, pronta para uso.

O painel Lovable mantém avisos de revisão de segurança sobre catálogos legados
(`riscos_biblioteca`, `gap_analysis_requirement_crosswalk`, `changelog_entries`
e `planos`), fora das novas tabelas CRA. Esses avisos não foram tratados como
uma auditoria concluída nem motivaram alterações automáticas de permissões.

## Limite da entrega

O CRA é uma avaliação inicial de prontidão com catálogo versionado, não uma
certificação ou parecer jurídico. Não foram habilitados envio automático a
autoridades ou antivírus de anexos. O usuário dispensou a integração antivírus;
os arquivos continuam privados e a interface informa essa limitação.

## Recuperação

Se necessário, republicar a interface anterior e a cópia da função versão 125.
Preservar as tabelas/migrações aditivas e eventuais novos registros de clientes;
não executar DROP, reset ou exclusões de histórico como rollback da interface.
