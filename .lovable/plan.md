# Corrigir o acesso público ao questionário de Due Diligence

## Diagnóstico confirmado

O link e o token da captura são válidos: o assessment existe, está com status `enviado` e expira somente em 13/08/2026.

O erro atual vem das políticas de acesso. A consulta anônima chega ao Supabase com o header correto `x-assessment-token`, mas a política também executa `get_user_empresa_id()`. Essa função não pode ser executada pelo papel `anon`, então o banco responde `401 permission denied for function get_user_empresa_id` antes de devolver o questionário. A tela converte qualquer falha desse carregamento na mensagem genérica “Questionário não encontrado”.

Também foram confirmados bloqueios posteriores que precisam ser tratados no mesmo fluxo:
- a finalização usa o cliente Supabase comum, sem o header do token;
- o cálculo de score exige usuário autenticado, embora o fornecedor seja externo;
- os uploads usam o cliente comum, sem propagar o token, e o bucket é privado;
- a página usa URL e chave pública do Supabase fixadas no componente.

## Implementação

1. **Corrigir as políticas RLS do fluxo público**
   - Separar explicitamente o caminho anônimo por token do caminho autenticado por empresa, sem executar funções de usuário para visitantes.
   - Aplicar a mesma regra segura em assessments, perguntas e respostas.
   - Restringir o token público ao assessment correspondente, aos status permitidos e ao prazo de expiração.
   - Manter usuários internos limitados por `empresa_id` e preservar o isolamento entre empresas.

2. **Consolidar as operações públicas em uma API segura por token**
   - Criar uma Edge Function específica para carregar o questionário, salvar respostas, anexar evidências e concluir o assessment.
   - Validar o token no servidor em todas as operações e nunca aceitar `empresa_id` informado pelo navegador.
   - Retornar somente os campos necessários ao fornecedor, sem expor e-mail, IDs ou dados internos além do indispensável.
   - Tornar salvamento e conclusão idempotentes para evitar respostas duplicadas durante autosave/reenvio.

3. **Corrigir a página pública**
   - Substituir chamadas REST manuais e credenciais fixadas por chamadas à API pública validada.
   - Preservar carregamento, autosave, retomada das respostas e conclusão.
   - Diferenciar link inválido, expirado, já concluído e indisponibilidade técnica, em vez de exibir “não encontrado” para qualquer erro.
   - Enviar anexos pelo fluxo autenticado pelo token e gerar acesso temporário seguro, sem URL pública permanente.

4. **Corrigir a conclusão e o score**
   - Permitir que a conclusão externa dispare o cálculo no servidor somente depois de validar o token e o assessment.
   - Manter o cálculo vinculado à empresa real do assessment e impedir chamadas para assessments de outras empresas.
   - Registrar a conclusão mesmo se a análise de IA precisar ser repetida, sem perder as respostas do fornecedor.

5. **Validar ponta a ponta**
   - Testar o token da captura sem sessão: abrir, carregar perguntas, salvar/retomar respostas, anexar arquivo e concluir.
   - Testar token inexistente, expirado, concluído e tentativa de usar um token em outro assessment.
   - Confirmar no banco status, respostas, evidências e score sem alterar ou expor dados de outra empresa.
   - Executar testes da Edge Function e validação das políticas/RLS antes do deploy; depois publicar frontend e backend necessários.

## Arquivos e banco envolvidos

- `src/pages/Assessment.tsx`
- Nova Edge Function pública de assessment e sua configuração
- Migration para as políticas de `due_diligence_assessments`, `due_diligence_questions`, `due_diligence_responses` e Storage
- Testes do fluxo público por token

Nenhum assessment existente ou resposta será apagado ou recriado.