Plano para corrigir de forma definitiva o fluxo MFA e as referências quebradas do logotipo Akuris.

1. Simplificar o MFA para não haver “loga e desloga”
- Ajustar o `AuthProvider` para separar sessão Supabase bruta de sessão liberada para o app, impedindo que rotas internas recebam `user` antes do MFA estar confirmado.
- Evitar múltiplas avaliações concorrentes do MFA causadas por `INITIAL_SESSION`, `SIGNED_IN`, `TOKEN_REFRESHED` e `refreshSession()`.
- Criar uma proteção contra resultados antigos sobrescreverem o estado mais recente.
- Manter o gate seguro: sem MFA confirmado, o app não expõe `user/session`.

2. Corrigir o comportamento de login + MFA
- No login com senha, decidir uma regra única e simples:
  - Se já existe `mfa_session` válida dentro de 24h: entrar direto, sem enviar código.
  - Se não existe sessão válida: enviar/reutilizar código e abrir a tela MFA.
- Parar de tratar `skipped: true` como erro ou fluxo ambíguo.
- Remover `signOut()` automático em falha transitória de envio/checagem do MFA sempre que possível; em vez disso, mostrar uma tela de MFA estável com opção de reenviar/cancelar.
- Após validar o código, fazer o app liberar o usuário com base no retorno confiável do backend, sem depender de um refresh que pode disparar eventos duplicados.

3. Fortalecer Edge Functions do MFA
- Atualizar `verify-mfa-code` para retornar `expires_at` da sessão MFA criada, permitindo cache local preciso de 24h.
- Atualizar `send-mfa-code` para retornar claramente `{ success, skipped, expires_at }` quando já houver sessão MFA válida.
- Manter validação por JWT em todas as funções e uso de service role apenas no backend.
- Remover logs com `console.*` desses arquivos e usar respostas controladas, reduzindo ruído e comportamento inesperado.

4. Ajustar mensagens e tela MFA
- Garantir que toasts de “falha no login” só apareçam em falha real de credenciais ou falha definitiva.
- Garantir que sucesso de login só apareça depois que o MFA/checagem de 24h estiver concluído.
- Validar a tela MFA: envio inicial, reenvio forçado, código inválido, código expirado, cancelar e retorno ao login.

5. Padronizar o logotipo Akuris no sistema
- Trocar todas as URLs antigas `governaii-grc.lovable.app` por uma URL pública atual e estável do Akuris.
- Corrigir `src/lib/brand-logo.ts`, `supabase/functions/_shared/constants.ts` e os templates/Edge Functions que usam HTML inline de e-mail.
- Padronizar cabeçalhos de e-mail para usar o mesmo logo: `https://akuris-grc.lovable.app/akuris-logo-email.png` ou o domínio público atual quando apropriado.
- Revisar itens citados como notícias/campanhas, templates de e-mail, notificações de risco, contratos, incidentes, due diligence, revisão de acessos e outros envios.

6. Reduzir risco de regressão
- Fazer buscas finais por URLs antigas e por chamadas conflitantes de logout no fluxo MFA.
- Testar mentalmente os cenários principais:
  - primeiro login do dia recebe código;
  - login dentro de 24h entra direto e não envia e-mail;
  - sessão restaurada dentro de 24h entra direto;
  - sessão restaurada após expirar MFA pede código;
  - código correto libera sem logout/toast de erro;
  - código errado mantém usuário na tela MFA.
- Atualizar a memória do fluxo MFA se a regra final mudar de “fresh login sempre exige MFA” para “24h vale também para login novo”, pois essa parece ser a expectativa atual.