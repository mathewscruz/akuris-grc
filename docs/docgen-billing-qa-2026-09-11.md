# DocGen: cobrança após a geração

## Solicitação

Corrigir o desconto de crédito percebido ao abrir/preparar o DocGen. O crédito de
geração deve ser descontado somente quando houver um documento gerado válido.

## Evidências no código

- A abertura atual da interface chama `load_company_context`, que já retorna antes
  do processamento de IA. Esse caminho foi protegido por teste de abertura/reabertura.
- A ação `chat`, usada pelo briefing conversacional e pelo prompt inicial de preparação,
  cobrava mesmo sem entregar documento. Cada mensagem podia descontar outro crédito.
- `auto_refine` cobrava novamente quando alterava o documento, embora seja continuação
  automática da geração.
- `refine_document` cobrava antes de interpretar a resposta; um JSON inválido retornava
  502 diretamente, deixando o débito aplicado.
- O recibo de um débito duplicado era tratado como débito novo: uma tentativa repetida
  que falhasse depois podia estornar uma geração anterior bem-sucedida.

Não houve consulta de saldos/histórico de clientes para atribuir o relato a uma
transação específica. As reproduções usam o handler real com fronteiras simuladas.

## Regras após a correção

| Etapa | Consumo de crédito |
| --- | --- |
| Abrir/reabrir e carregar contexto | Nenhum |
| Preparar o briefing e conversar antes da geração | Nenhum |
| Gerar documento válido | Um, ao concluir a resposta |
| Repetir a mesma tentativa com a mesma chave | Sem débito adicional |
| Quality gate e refino automático | Incluídos na geração |
| Refino manual de seção/documento e análise de aderência | Mantêm a cobrança por resultado já existente |
| Geração/refino inválido ou falha do provedor | Nenhum débito novo |

O helper compartilhado serializa e valida o resultado antes de cobrar, honra a resposta
do débito idempotente, preserva a chave do pedido e só estorna um débito novo se houver
cancelamento durante a confirmação. Uma repetição cancelada não estorna a entrega anterior.
Erros do serviço de cobrança e saldo esgotado não são apresentados como sucesso.

A galeria e o briefing explicam a regra de cobrança em PT/EN, sem adicionar badges.
Não foram alterados valores de planos, autenticação, isolamento de empresas, saldos
históricos ou regras de crédito das demais funcionalidades.

## Validação

- 21 testes específicos: 14 da política/entrega e 7 do handler HTTP real.
- Handler executado com Supabase e provedor de IA simulados: abertura repetida,
  preparação, geração válida, repetição idempotente, JSON inválido, falha de refino,
  provedor indisponível e autenticação obrigatória.
- Demais testes relacionados: exportação DocGen, catálogo de créditos, limites de
  segurança e paridade PT/EN. Total desta rodada: 73 testes aprovados.
- TypeScript e lint dos arquivos novos/galeria aprovados; build do frontend aprovado.

## Publicação e limites

- Em 11/09/2026, publicada a função `docgen-chat`, versão **295**, no projeto de
  produção `lnlkahtugwmkznasapfd`, incluindo `_shared/docgen-billing.ts`.
- Confirmados estado `ACTIVE` e `verify_jwt: true`. O código baixado após o deploy
  corresponde integralmente ao código local da função e das cinco dependências.
- Verificação no endpoint de produção: chamada sem autenticação recusada com HTTP
  401; preflight com origem `https://akuris.pt` respondeu 200.
- Os 21 testes específicos e a checagem TypeScript foram repetidos antes do deploy,
  com sucesso. A validação de cobrança usa serviços simulados; não foi disparada
  geração paga nem alterado saldo de cliente para testar em produção.
- Preservada cópia privada local da versão anterior **294**, fora do Git.
- O frontend exibe a explicação de cobrança e segue pelo Git. A publicação da
  interface no Lovable fica com o usuário, conforme solicitado. O deploy desta
  rodada não publica a interface. Não há migração de banco a executar.

Créditos históricos não foram estornados automaticamente. Uma revisão desses débitos
exige identificar as transações e evitar reembolsar gerações entregues corretamente.
Perda de conexão depois de o servidor retornar uma resposta não é confirmação de que
o cliente recebeu o arquivo; o mecanismo mantém a chave idempotente para a repetição.
