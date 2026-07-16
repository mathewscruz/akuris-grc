# Validação dos achados no Akuris + Plano de Remediação

Investiguei cada item apontado contra o código real (migrations, edge functions, RLS, componentes). Segue o veredito e, depois, o plano de correção em ondas.

## 1. Veredito por achado

| # | Achado | Status | Evidência principal |
|---|--------|--------|---------------------|
| 1 | MFA pode ser contornado | **CONFIRMADO** | `mfa_codes.code` em texto puro (migration 20260220…) + RLS permite `SELECT` do próprio código (20260505…). Pior: **nenhuma** RLS/edge function de negócio consulta `mfa_sessions` — o gate é só no frontend (`AuthProvider.tsx`). JWT do 1º fator já autoriza REST/Edge |
| 2 | Edge Functions públicas com poder | **CONFIRMADO (severidade mista)** | `verify_jwt=false` em `send-welcome-email`, `send-password-reset`, `send-licenca-reminder`, `process-due-diligence-reminders`, `send-contrato-vencimento-notification` etc. `send-welcome-email` aceita `setupPasswordUrl` + e-mail arbitrários → phishing pelo domínio Akuris |
| 3 | Cross-tenant em `analyze-document-adherence` | **CONFIRMADO** | Valida JWT e deriva `empresaId`, mas as queries seguintes (framework, requirements, `storage.download`, `.update(assessmentId)`) usam IDs do cliente com service-role **sem filtro por `empresaId`** |
| 4 | Storage sem isolamento por empresa | **CONFIRMADO / PARCIAL** | Bucket `auditoria-evidencias` só checa `auth.role()='authenticated'`. Em `denuncias-anexos` a policy antiga permissiva (`Public can upload anexos via valid denuncia`) não aparece em nenhum `DROP POLICY` — coexiste com as novas (OR). Precisa validar `pg_policies` |
| 5 | Config de denúncias muito pública | **NÃO CONFIRMADO** | As policies anônimas foram efetivamente removidas em 20260424… e 20260308…; hoje só admins da mesma empresa fazem SELECT completo. View pública expõe apenas campos seguros |
| 6 | AkurIA burla RBAC por módulo | **CONFIRMADO** | `akuria-chat` usa service-role e `buildContextSummary()` lê 14 tabelas filtrando **só por `empresa_id`**, sem checar `user_module_permissions` |
| Outros | SSRF em `analyze-evidence-against-requirement` | **CONFIRMADO** | `fetch(fileUrl)` com URL do payload, sem allowlist |
| Outros | SECURITY DEFINER sem `search_path` | **PARCIAL** | 19 definições nas migrations sem `SET search_path`, mas muitas superseded — precisa inspeção do `pg_proc` ao vivo |
| Outros | Sem CSP / anti-framing | **CONFIRMADO** | Nada em `index.html`/`vite.config.ts` |
| Outros | Histórico AkurIA em localStorage | **CONFIRMADO** | `useAkurIASession.tsx` — sem criptografia |
| Outros | Bundle grande | **NÃO MEDIDO** | Fora de escopo desta revisão |
| A | `docgen-chat` referencia `user_id_eff`/`empresa_id_eff` | **CONFIRMADO — função quebrada** | Linhas 266-267 e 272-273; variáveis reais chamam-se `authedUserId`/`authedEmpresaId`. Todo action ≠ `load_company_context` estoura `ReferenceError` (500) |
| B | `docgen-chat` cross-tenant na conversa | **CONFIRMADO** | Carrega `docgen_conversations` só por `id` com service-role, sem `empresa_id`/`user_id` |
| C | `send-contrato-vencimento-notification` público | **CONFIRMADO** | `verify_jwt=false` + confia em `empresa_id`/`gestor_id`/`contrato_id` do payload |
| D | `api-public` não valida `expires_at`/`ip_whitelist` | **CONFIRMADO** | Colunas lidas no SELECT mas nenhum check depois; só `ativo` é validado |
| E | `api-inbound-webhook` fraco | **CONFIRMADO** | Token reutilizável na query string, texto puro, sem HMAC/timestamp/nonce; loga payload inteiro em `api_request_logs` |
| F | Funções não versionadas | **PARCIAL** | `create-checkout`, `check-subscription`, `customer-portal` declarados no `config.toml` sem código — confirmado. `create-denuncia` **não** é chamado em lugar nenhum do `src/**` hoje; provavelmente achado obsoleto |
| G | URL/anon key hardcoded em `client.ts` | **CONFIRMADO, mas não é vulnerabilidade** | É a chave publicável (`role: "anon"`), desenhada para ir no bundle. Fica no nível "melhoria de DX/migração" |
| Comercial | Descrição Start/Manager conflita com bullets | **CONFIRMADO — bug de dados, não de UI** | `Planos.tsx` é 100% data-driven. Migration 20260430… setou bullet "10 créditos" / "50 créditos", 20260507… bumpou `creditos_franquia` para 20 / 75 sem atualizar o `recursos_destacados` |

## 2. Plano de Remediação (4 Ondas)

### Onda 1 — Críticos de segurança (bloqueiam abuso real hoje)

1. **MFA de verdade (achado 1)**
   - Criar função `has_valid_mfa_session(uid)` `SECURITY DEFINER` que consulta `mfa_sessions` válida (<24 h).
   - Aplicar em todas as RLS de tabelas de negócio via `AND public.has_valid_mfa_session(auth.uid())`.
   - Hashear `mfa_codes.code` (SHA-256 + `pgcrypto`) e alterar `verify-mfa-code` para comparar hash. Bloquear `SELECT` do próprio código na RLS (só service-role lê).
   - Manter gate visual atual.

2. **`analyze-document-adherence` cross-tenant (achado 3)**
   - Validar que `assessmentId`, `frameworkId` e `storageFileName` pertencem à `empresa_id` do JWT antes de baixar/atualizar. Rejeitar 403 caso contrário.

3. **`docgen-chat` (achados A + B)**
   - Corrigir `user_id_eff`/`empresa_id_eff` → `authedUserId`/`authedEmpresaId`.
   - Em toda leitura/escrita de `docgen_conversations`, `docgen_generated_docs`, `docgen_feedback_implicit`: filtrar por `empresa_id = authedEmpresaId` e `user_id = authedUserId`.

4. **Edge functions públicas de e-mail (achado 2 + C)**
   - `send-welcome-email`, `send-password-reset`, `send-contrato-vencimento-notification`, `send-denuncia-notification`, `send-incidente-notification`: mudar para `verify_jwt=true` **ou** validar via `X-Cron-Secret` (secret dedicado) quando disparadas por cron. Nunca aceitar `setupPasswordUrl`/`gestor_id`/`empresa_id` do cliente — derivar do JWT/DB.
   - `send-licenca-reminder` e `process-due-diligence-reminders`: proteger com `X-Cron-Secret` e rate limit.

5. **AkurIA respeitando RBAC (achado 6)**
   - Em `akuria-chat/index.ts`, antes de cada bloco de `buildContextSummary`, checar `user_module_permissions.can_read` do usuário para o módulo correspondente. Pular blocos sem permissão e informar isso no prompt.

6. **Storage isolado (achado 4)**
   - Reescrever policies do bucket `auditoria-evidencias` para exigir que o path comece com `<empresa_id>/…` e que a `empresa_id` bata com `get_user_empresa_id()`.
   - Padronizar convenção de path `<empresa_id>/<recurso>/<uuid>` em uploads (auditoria, evidências, denúncias, adherence, gap analysis).
   - `DROP POLICY IF EXISTS "Public can upload anexos via valid denuncia" ON storage.objects` explicitamente e revalidar `pg_policies`.

### Onda 2 — Altos (endurecimento de superfícies públicas)

7. **`api-public` (achado D)** — validar `expires_at > now()` e, se `ip_whitelist` estiver setada, comparar contra `X-Forwarded-For`. Log de tentativa negada.
8. **`api-inbound-webhook` (achado E)** — exigir header `X-Signature` (HMAC-SHA256 sobre body + timestamp), rejeitar `timestamp` >5 min, guardar `nonce` para replay, redigir campos sensíveis antes de logar em `api_request_logs`, mover token do query para header.
9. **SSRF em `analyze-evidence-against-requirement`** — só aceitar URLs assinadas do próprio Supabase Storage (checar host + prefixo `/storage/v1/object/`) ou trocar por `storage_path` interno.
10. **SECURITY DEFINER hardening** — rodar `SELECT proname FROM pg_proc WHERE prosecdef AND proconfig IS NULL` no DB ao vivo e adicionar `SET search_path = public` nas que faltarem.

### Onda 3 — Melhorias (defesa em profundidade)

11. **CSP + anti-framing** em `index.html` (`Content-Security-Policy` restritiva, `X-Frame-Options: DENY`, `frame-ancestors 'none'`).
12. **Histórico AkurIA server-side** — mover chat do `localStorage` para tabela `akuria_conversations` com RLS por `user_id`/`empresa_id`. Migração + purge do localStorage.
13. **Limpeza `config.toml`** — remover blocos `create-checkout`, `check-subscription`, `customer-portal` (não têm código). Validar se `create-denuncia` era usado no histórico do repo antes de descartar.
14. **`.env` no client** — trocar hardcode em `src/integrations/supabase/client.ts` por `import.meta.env.VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` (facilita staging, mantém segurança inalterada).

### Onda 4 — Bug comercial visível

15. **Discrepância Start (20 vs 10) e Manager (75 vs 50)** — migration única fazendo `UPDATE planos SET recursos_destacados = jsonb_set(...)` para refletir `creditos_franquia` real em ambos os planos.

## 3. Detalhes técnicos por onda

- **RLS MFA (Onda 1.1):** `CREATE FUNCTION public.has_valid_mfa_session(_uid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT EXISTS (SELECT 1 FROM public.mfa_sessions WHERE user_id = _uid AND expires_at > now()) $$;` e envolver policies com `USING (empresa_id = get_user_empresa_id() AND has_valid_mfa_session(auth.uid()))`. Impacto: sessões atuais sem `mfa_sessions` válida param — comunicar via banner e forçar re-login.
- **Storage policies (Onda 1.6):** usar `(storage.foldername(name))[1] = get_user_empresa_id()::text` como convenção.
- **AkurIA (Onda 1.5):** criar helper `hasModuleRead(userId, moduleName)` chamando `user_module_permissions` para cada seção do `buildContextSummary`.
- **HMAC webhook (Onda 2.8):** algoritmo `sha256(secret + timestamp + body)` (igual Stripe), rotacionar secret por webhook via `api_inbound_webhooks.secret_hash`.
- **Comercial (Onda 4.15):** migration ajusta bullets sem tocar em `creditos_franquia`.

## 4. Fora deste plano

- Auditoria completa de todas as 82 `SECURITY DEFINER` (só as que faltam `search_path` na Onda 2.10).
- Análise de bundle e code-splitting (assunto de perf, não segurança).
- Testes automatizados de isolamento entre tenants (proposta separada, exige suíte E2E).

## 5. Aprovação

Ao aprovar, executo **começando pela Onda 1** (críticos) em migrations + edge functions numa sequência de PRs pequenos, com verificação após cada onda. Se preferir outra ordem (ex.: bug comercial primeiro, ou pular Onda 3), me avise antes de aprovar.
