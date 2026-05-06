## Diagnóstico

**1. MFA sendo pulado no login por senha**
Os auth logs mostram dois logins consecutivos (`grant_type: password`) de `henrique.mathews@gmail.com` sem qualquer chamada para `send-mfa-code` / `verify-mfa-code`. O bypass acontece dentro de `supabase/functions/send-mfa-code/index.ts`:

```text
linhas 77-92:
  consulta mfa_sessions com expires_at > now()
  se existir → retorna { success: true, skipped: true }
```

E em `src/pages/Auth.tsx` (linhas 195-238), `skipped: true` faz `handleSignIn` pular a tela de MFA, dar `refreshSession` e mandar para o dashboard.

O "skip de 24h" foi desenhado para sessões **restauradas** (usuário voltou no dia seguinte sem deslogar), não para login fresco com senha. Hoje os dois caminhos compartilham o mesmo bypass.

**2. Toast "Login realizado com sucesso" aparece sobre o loading**
Em `Auth.tsx` (linhas 238 e 256), o `toast.success(t('auth.loginSuccess'))` é chamado antes de o `AuthProvider` terminar `check-mfa-session` + `fetchProfile`. Como `LoadingOverlay` (fase `finalizing`) permanece visível até o `user` ser exposto, o usuário vê o toast "vazando" sobre a tela de carregamento e às vezes ainda no primeiro frame do dashboard.

---

## Mudanças

### A. Backend — distinguir "login por senha" de "checagem de skip"

**`supabase/functions/send-mfa-code/index.ts`**

- Aceitar no body um flag `context: 'fresh_login' | 'session_restore'` (default `session_restore` para retrocompatibilidade).
- Quando `context === 'fresh_login'`: **ignorar** a sessão MFA existente (não retornar `skipped`). Sempre gera/reusa código e envia e-mail.
- Quando `context === 'session_restore'`: comportamento atual (retorna `skipped: true` se houver `mfa_session` válida).
- Manter validação de JWT via `getClaims` e a regra de só operar sobre `callerUserId`.

### B. Frontend — sempre exigir MFA no login por senha

**`src/pages/Auth.tsx` — `handleSignIn`**

- Chamar `send-mfa-code` com `body: { context: 'fresh_login' }`.
- Remover toda a lógica de `mfaSkipped` no caminho de senha: depois do envio bem-sucedido, sempre setar `phase = 'mfa_required'` e abrir `MFAVerification`.
- Remover o `toast.success(t('auth.loginSuccess'))` daqui (linha 238) e o `await supabase.auth.refreshSession()` do bypass (não é mais necessário).
- Em caso de falha do `send-mfa-code`, manter o `signOut` + toast de erro + voltar para `idle`.

**`src/pages/Auth.tsx` — `handleMFAVerified`**

- Remover o `toast.success(t('auth.loginSuccess'))` daqui também (linha 256).
- Manter `setPhase('finalizing')` e `refreshSession` para acelerar a propagação.

**`src/pages/Auth.tsx` — restauração de sessão (useEffect MFA pendente)**

- Continuar chamando `send-mfa-code` mas com `body: { context: 'session_restore' }` (para preservar o skip silencioso quando legítimo — se nesse caminho voltar `skipped: true`, basta tirar o pending e deixar o `AuthProvider` propagar).

### C. Toast de boas-vindas — emitir só quando o dashboard estiver pronto

Para garantir que o toast nunca apareça por cima do loading:

- Em `handleMFAVerified` (e no caminho `fresh_login` finalizado), gravar uma flag `sessionStorage.setItem('akuris_show_login_toast', '1')`.
- Em `src/pages/Dashboard.tsx`, dentro de um `useEffect` que roda após o primeiro render efetivo (quando `profile` e `company` já estão disponíveis no `useAuth`), checar a flag, disparar `toast.success(t('auth.loginSuccess'))` e remover a flag.
- Isso garante que o toast só aparece quando a UI do dashboard já está visível, eliminando o "vazamento" durante `LoadingOverlay`.

### D. Validação manual após implementação

1. Login fresco por senha → tela de MFA **sempre** aparece, mesmo se houver `mfa_session` válida no banco.
2. Inserir código → overlay de finalização → dashboard → toast "Login realizado com sucesso" aparece já no dashboard, não antes.
3. Fechar aba e reabrir em <24h sem deslogar → sessão restaurada sem pedir MFA novamente (comportamento desejado para UX).
4. Fechar aba e reabrir em >24h → tela MFA aparece automaticamente (já funciona pelo `MFA_PENDING_KEY`, sem regressão).

### E. Observação de segurança

Forçar MFA em todo login por senha é mais restritivo que o estado atual e está alinhado com a expectativa do usuário e com a memória `auth/mfa-session-isolation-logic`. A janela de 24h continua existindo, mas só beneficia sessões já estabelecidas (refresh/restore), não autenticação por senha — que é o vetor principal de comprometimento.
