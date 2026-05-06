Plano para validar e corrigir o fluxo de MFA com segurança e estabilidade:

1. Corrigir a causa provável do bypass
- Hoje o MFA só é exigido dentro da página `/auth`, depois de `signInWithPassword`.
- Como o Supabase mantém sessão persistida em `localStorage` com `autoRefreshToken`, um usuário que fica mais de um dia sem usar a ferramenta pode voltar/clicar em entrar e o app reaproveitar/refrescar a sessão existente sem passar pelo fluxo de login, indo direto para `/dashboard`.
- Vou mover a validação de MFA para uma camada global no `AuthProvider`, para que qualquer sessão restaurada ou refrescada também seja validada antes de expor `user/session` ao app.

2. Criar validação server-side explícita de sessão MFA
- Ajustar/criar uma Edge Function autenticada para checar se o usuário atual possui `mfa_sessions.expires_at > now()`.
- Essa checagem usará o JWT do usuário via `getClaims()` e service role internamente, sem confiar em dados enviados pelo frontend.
- O retorno será simples: `verified: true/false`, `expires_at`, e motivo quando não verificado.

3. Alterar o `AuthProvider` para bloquear sessões sem MFA válido
- Na inicialização (`getSession`) e nos eventos `SIGNED_IN` / `TOKEN_REFRESHED`, antes de setar `user`, validar MFA no backend.
- Se não houver MFA válido, o provider mantém `user/session = null`, guarda a sessão Supabase apenas para permitir chamar `send-mfa-code`/`verify-mfa-code`, seta a flag MFA pendente e redireciona para `/auth?mfa=required`.
- Isso elimina o caminho em que uma sessão antiga/refrescada entra direto no dashboard.

4. Tornar `/auth` capaz de continuar MFA de sessão restaurada
- Ajustar `Auth.tsx` para, ao detectar `?mfa=required` ou uma flag de MFA pendente, não limpar a flag automaticamente.
- Buscar a sessão Supabase atual para obter e-mail/userId, enviar/reutilizar código via `send-mfa-code` e abrir a tela MFA imediatamente.
- Manter a sessão oculta do app até `verify-mfa-code` confirmar o código.

5. Reduzir janelas de bypass e inconsistências no frontend
- Garantir que `ProtectedRoute`/`Layout` nunca renderizem conteúdo enquanto o MFA estiver pendente.
- Centralizar helpers de flag MFA para evitar limpar a flag no momento errado.
- No logout/inatividade/cancelamento do MFA, limpar flag, estado local e sessão Supabase de forma consistente.

6. Endurecer Edge Functions MFA
- Ajustar `send-mfa-code` para diferenciar claramente:
  - `skipped: true` somente quando há sessão MFA válida;
  - `success: true` quando código foi enviado/reutilizado;
  - erro explícito quando não puder enviar, sem liberar login.
- Ajustar `verify-mfa-code` para validação de entrada mais estrita: código com exatamente 6 dígitos, tratamento controlado de JSON inválido e mensagens mais úteis.
- Manter todos os retornos com CORS e autenticação por JWT.

7. Corrigir políticas/estrutura de banco que fragilizam MFA
- Remover as policies que permitem `authenticated` inserir/atualizar `mfa_sessions`; essa tabela deve ser escrita apenas pelas Edge Functions com service role.
- Manter no máximo SELECT do próprio usuário, se necessário para auditoria/diagnóstico, mas o frontend não deverá depender disso para liberar acesso.
- Não alterarei `src/integrations/supabase/types.ts` manualmente.

8. Validação do fluxo após correção
- Testar mentalmente e por inspeção os cenários principais:
  - login normal sem MFA válido → envia código e exige MFA;
  - código correto → cria sessão MFA por 24h e libera dashboard;
  - login dentro de 24h → bypass permitido;
  - retorno após mais de 24h com sessão Supabase ainda persistida → exige MFA antes do dashboard;
  - refresh de página no meio do MFA → volta para tela MFA, sem tela branca;
  - cancelar MFA → logout e retorno limpo ao login;
  - erro ao enviar/verificar código → não libera acesso.

Arquivos previstos:
- `src/components/AuthProvider.tsx`
- `src/pages/Auth.tsx`
- `src/components/MFAVerification.tsx` se necessário para mensagens/estado
- `supabase/functions/send-mfa-code/index.ts`
- `supabase/functions/verify-mfa-code/index.ts`
- possivelmente nova função `supabase/functions/check-mfa-session/index.ts` ou reaproveitamento seguro da função existente
- nova migration para corrigir policies de `mfa_sessions`

Resultado esperado: MFA deixa de ser um passo apenas do formulário de login e passa a ser um gate global de sessão. Assim, mesmo sessões antigas/refrescadas pelo Supabase não acessam a ferramenta sem uma sessão MFA válida nas últimas 24h.