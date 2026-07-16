## Validação do fluxo de senha e primeiro acesso

Percorri as peças: `create-user` → `send-welcome-email` → e-mail com link → `/definir-senha` → `updateUser({password})`, além de `resend-welcome-email`, `send-password-reset` e `ForgotPasswordDialog`.

### Estado geral

O fluxo está **funcional** após a correção do 401 (Authorization service_role) aplicada na última rodada. Estrutura correta:

- `create-user` gera senha aleatória interna, cria auth user com `email_confirm=true`, gera **invite link** (fallback recovery), envia via `send-welcome-email`.
- E-mail leva a `https://akuris.com.br/definir-senha?token_hash=...&type=invite|recovery`.
- `/definir-senha` é rota pública em `App.tsx`. `DefinirSenha.tsx` verifica token via `verifyOtp`, aplica `updateUser({password})`, faz `signOut` e redireciona para `/auth`.
- Validação de senha (zod: 8+, maiúscula, minúscula, número) igual client-side e visual de requisitos.

### Correções recomendadas (não-bloqueantes)

**1. Rate limiting em `send-password-reset`**
Hoje qualquer IP pode disparar reset repetido (função retorna 200 silencioso, mas gera link + e-mail real). Adicionar mesmo padrão de `provision-new-account` (mapa em memória: N reqs por IP por janela).

**2. Mensagens de erro em `DefinirSenha.handleSubmit`**
`toast.error(error.message)` propaga texto cru do Supabase. Trocar por mensagem genérica traduzida (`t('defineSenhaPage.error')`) e logar `error.message` via `logger.error`.

**3. Dead code de `temporary_passwords` em `DefinirSenha`**
O fluxo atual (invite link) não popula `temporary_passwords`. O `update` na linha 123-126 sempre falha silenciosamente. Remover.

**4. Consistência de `resend-welcome-email`**
Hoje ele monta HTML e envia via Resend direto — duplica lógica do `send-welcome-email`. Refatorar para invocar `send-welcome-email` passando `Authorization: Bearer <service_role>` (mesmo padrão que aplicamos em `create-user`). Reduz superfície de manutenção e mantém validação de allowlist de URL centralizada.

**5. Fallback quando `generateLink(invite)` retorna erro `email_exists`**
Já existe fallback para `recovery` em `create-user`. Confirmar que o UX comunica bem: quando um usuário órfão é recriado, o e-mail hoje é enviado com `type=recovery` mas o template diz "Bem-vindo, sua conta foi criada". Ajustar copy do template para ser neutro ("Defina sua senha para acessar o Akuris"), ou selecionar variante do template conforme o tipo.

### O que **não** vou mexer (está correto)

- `verify_jwt = false` em `send-welcome-email`, `send-password-reset`, `resend-welcome-email`: gate é in-code (service_role interno ou admin autenticado). Correto.
- Allowlist de hosts em `send-welcome-email.isSafeSetupUrl`: correto.
- Rota `/definir-senha` pública, sem `ProtectedRoute`: correto.
- `verifyOtp({type})` para invite/recovery + `updateUser({password})`: fluxo padrão Supabase, correto.
- `signOut` + redirect após definir senha: correto.
- Validação zod local: OK.

### Escopo

Aplicar itens 1–5 acima. Sem migrations. Sem mudanças em RLS ou tipos.

### Verificação

1. Criar usuário novo via UI → conferir log "E-mail de boas-vindas enviado com sucesso" e recebimento.
2. Clicar no link do e-mail → tela `/definir-senha` valida token e permite definir senha.
3. Enviar senha → `updateUser` → `signOut` → redireciona para `/auth`, login com nova senha funciona.
4. "Esqueci senha" (ForgotPasswordDialog) → chamar 6x rapidamente do mesmo IP → 6ª deve retornar 429.
5. "Reenviar convite" (Gerenciamento de Usuários) → e-mail chega, link `/definir-senha?type=recovery` funciona.
