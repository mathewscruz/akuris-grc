## Problema

Nos logs de `create-user`:
```
Erro ao enviar e-mail: FunctionsHttpError ... status: 401 ... url: .../send-welcome-email
```

A função `send-welcome-email` valida o chamador comparando `Authorization: Bearer <token>` contra `SUPABASE_SERVICE_ROLE_KEY`. Quando `create-user` chama:

```ts
await supabaseAdmin.functions.invoke('send-welcome-email', { body: {...} })
```

o cliente supabase-js dentro do runtime Deno **não injeta** automaticamente a chave do `createClient` no header `Authorization` de chamadas function-to-function. Resultado: o token recebido não bate com `SERVICE_ROLE` → 401 → e-mail nunca é enviado.

O mesmo padrão ocorre em qualquer outro ponto que faça `supabaseAdmin.functions.invoke('send-welcome-email', ...)`.

## Correção

Passar o header `Authorization` explicitamente nas invocações internas.

**1. `supabase/functions/create-user/index.ts`** — na chamada de `send-welcome-email`:
```ts
await supabaseAdmin.functions.invoke('send-welcome-email', {
  headers: {
    Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
  },
  body: { userName: nome, userEmail: email, setupPasswordUrl, companyName, companyLogoUrl },
})
```

**2. `supabase/functions/resend-welcome-email/index.ts`** — hoje a função monta e envia via Resend diretamente (não invoca `send-welcome-email`), então não precisa de mudança. Verificar mesmo assim se não há outro caller interno; se houver, aplicar o mesmo padrão.

**3. Buscar em toda `supabase/functions/` por `functions.invoke('send-welcome-email'` e aplicar o header nos que faltarem** (ex.: `check-trial-expiration`, `process-invitation-reminders` se aplicável).

## Verificação

1. Redeploy de `create-user`.
2. Criar um usuário novo pela UI.
3. Conferir logs: `create-user` deve logar "E-mail de boas-vindas enviado com sucesso" e `send-welcome-email` deve retornar 200.
4. Confirmar recebimento na caixa do destinatário.

## Escopo fora

- Não alterar `verify_jwt` no `config.toml` (já está `false` para `send-welcome-email`, o gate é in-code).
- Não mexer no fluxo de geração de link/OTP.
