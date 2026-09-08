# Evidências e recadastro de usuários — 08/09/2026

## Alterações

- Controles, testes de controles e itens de auditoria aceitam qualquer extensão, inclusive arquivos sem extensão ou MIME reconhecido pelo navegador.
- Arquivos são enviados como conteúdo binário, com nomes de armazenamento seguros e únicos. O nome original permanece na evidência e no download.
- Download autorizado por URL assinada de cinco minutos, como anexo; HTML/SVG não são apresentados como páginas executáveis. URLs legadas continuam aceitas.
- Mantido o limite de 10 MB na tela de controles e os limites configurados no armazenamento para os demais fluxos. Não há alteração nas políticas de isolamento de objetos. Os três buckets de evidências permanecem privados; suas listas de MIME são removidas.
- Cadastro procura o endereço normalizado diretamente no Auth, sem depender da primeira página da listagem de usuários.
- Perfil ativo: permanece duplicado, sem alteração. Perfil inativo da mesma empresa: reativado preservando sua identidade. Perfil removido, mas conta Auth remanescente: restaurado quando há proveniência confiável para a empresa.
- Para contas órfãs anteriores à nova trilha, sem proveniência confiável, apenas o administrador da plataforma pode recuperar o cadastro. Contas bloqueadas ou de outra empresa não são transferidas automaticamente, inclusive quando inativas.
- A senha e os fatores do Auth não são alterados. Permissões e papel são reconstruídos em transação; sessões MFA da aplicação anteriores à reativação são invalidadas.
- Limites de usuários continuam aplicados. Um perfil inativo já contabilizado utiliza sua vaga existente.
- Criação/reativação, erro por duplicidade, necessidade de revisão e falha no envio do convite têm mensagens distintas em português e inglês.
- Removida a exclusão alternativa de perfil no navegador. A exclusão completa exige alvo/empresa/papel correspondentes e informa quando o Auth permanece por dependência, em vez de anunciar exclusão total.

## Publicação (não executada em produção neste atendimento)

1. Aplicar `supabase/migrations/20260908200000_evidencias_e_recadastro_seguro.sql` no projeto correto. Esta migração não exclui usuários nem arquivos; cria a trilha privada e as rotinas de provisionamento, e remove apenas a restrição de MIME dos três buckets indicados.
2. Publicar as funções `create-user` e `delete-user-complete`, incluindo `_shared/provision-user.ts` e `_shared/auth.ts`. A nova `create-user` depende da migração; não publicar essa função antes do banco.
3. Publicar o frontend no Lovable. Publicar somente o frontend não conclui a correção do recadastro.
4. Validar com um usuário de teste autorizado: criação, exclusão e recadastro na mesma empresa; perfil inativo; duplicado ativo; tentativa de outra empresa; limite do plano; convite. Não alterar credenciais nem MFA de usuários reais para testar.
5. Validar anexos de exemplo ZIP/EML/MSG/TXT/sem extensão nas três telas, baixar e conferir o nome/conteúdo. Verificar negação sem autenticação e entre empresas.

Não foram alteradas contas, credenciais, buckets ou funções de produção. Não foram enviados convites reais.

## Validação local

- Testes unitários dos nomes de arquivo, formatos, MIME binário e download privado/legado.
- Testes Deno do provisionamento: reuso da identidade, duplicidade, limites, permissões, erro de busca e rollback somente de uma identidade recém-criada.
- Migração executada no banco local isolado `akuris_qa_registration_20260908`, copiado da base de validação de segurança. A base original não foi alterada.
- `scripts/qa/registration-assert.sql`: fixtures sintéticas em transação com rollback, exercitando as funções reais, MFA, isolamento entre empresas, reativação, vagas, remoção/recadastro, órfãos, bloqueio, permissões, credenciais e privilégios de acesso às rotinas.
- Teste dos três buckets na base isolada confirmou `public=false`, ausência de lista de MIME e preservação do limite de tamanho previamente definido.
- Frontend: build, tipagem e lint sem erros; os avisos preexistentes de lint/tamanho de bundles permanecem.
- Resultado: suíte completa de 978 testes aprovada; mais cinco novas guardas de regressão aprovadas na execução direcionada, junto dos 18 testes de arquivos e quatro de paridade de idioma. Dez testes Deno de provisionamento aprovados.

Limites desta validação: sem teste de envio real de e-mail, sem upload real em produção e sem sessão autenticada de navegador de produção. O script SQL usa dados sintéticos e reverte todos os registros de teste; os buckets de teste e o esquema permanecem apenas na base local isolada.

## Retorno à versão anterior

Reverter frontend e funções juntos, preservando a trilha de usuários removidos. Não apagar arquivos nem registros de evidência. Se for necessário restabelecer listas de MIME, usar os valores do backup específico de cada bucket — não presumir uma lista antiga. A migração não salva cópia dos valores anteriores de configuração.
