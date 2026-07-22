# Pente Fino Akuris — Plano de Correções

4 subagentes auditaram o app inteiro. Abaixo, apenas achados **confirmados** (arquivo:linha, causa e correção), agrupados em 4 ondas por prioridade e risco.

---

## Onda 1 — Crítico (segurança / vazamento cross-tenant / bypass)

1. **MFA bypassável via API direta** — `src/components/AuthProvider.tsx:300-358`
   MFA é apenas gate de UI: `signInWithPassword` já grava `access_token` válido no localStorage antes do código. Nenhuma policy nem Edge Function crítica valida `mfa_sessions`.
   → Criar função `SECURITY DEFINER` `public.has_valid_mfa(uid)` e aplicar em policies sensíveis; nas Edge Functions admin (`create-user`, `delete-user-complete`, `get-user-access-info`), checar MFA server-side.

2. **`send-password-reset` aceita `userId` sem auth** — `supabase/functions/send-password-reset/index.ts:69-108`
   Qualquer pessoa pode gerar link de recovery para qualquer UUID. Também permite enumerar `user_id`s válidos.
   → Remover branch por `userId`; manter apenas por e-mail com resposta uniforme (200).

3. **Bucket `documentos`: SELECT sem filtro por empresa** — migration `20250723112905`
   Policy `USING (bucket_id = 'documentos')` permite qualquer usuário autenticado baixar arquivo de qualquer tenant.
   → Reescrever policy usando `(storage.foldername(name))[1] = get_user_empresa_id()::text`.

4. **URLs públicas em bucket privado quebram downloads** — `UploadMultiplosDialog.tsx:71-84`, `RequirementDetailDialog.tsx:569-571`
   `getPublicUrl` em bucket `public:false` — link salvo nunca funciona.
   → Salvar apenas o `path`; gerar `createSignedUrl` sob demanda.

5. **Aprovação/aceite de risco sem enforcement server-side** — `AprovacaoRiscoDialog.tsx:34-195`
   `isAprovador` é só UI; UPDATE em `riscos` filtra só por `empresa_id`. Qualquer usuário aprova risco alheio via API.
   → Policy RLS `UPDATE ... WITH CHECK (aprovador_id = auth.uid())` ou mover para Edge Function.

6. **`process-due-diligence-reminders` quebrado + público** — `supabase/functions/process-due-diligence-reminders/index.ts:28-51`
   Faz `select('token')` mas coluna é `link_token`; rota do link diverge de `send-due-diligence-email`. `verify_jwt=false` sem checagem interna → vetor de spam.
   → Corrigir coluna/rota; exigir Authorization (service-role) como `daily-reminder-processor`.

---

## Onda 2 — Alto (integridade de dados / créditos IA / silent failures)

7. **7 Edge Functions de IA debitam crédito ANTES do sucesso** — `suggest-risk-treatment:47`, `evidence-cross-match:176`, `projeto-suggest-tasks:74`, `projeto-status-report:65`, `analyze-document-adherence:88`, `calculate-assessment-score:65`, `docgen-chat:336`
   Usuário perde crédito em erro 429/500/timeout/JSON inválido. Padrão correto já existe em `akuria-chat` e `gap-analysis-ai-diagnostic`.
   → Mover `consume_ai_credit` para depois de `response.ok` e parse bem-sucedido.

8. **Sem timeout/AbortController em `fetch` ao AI Gateway** — todas as functions de IA
   Chamada lenta trava função até 150s sem feedback; combinado com #7 gera perda de crédito garantida.
   → Criar helper `_shared/fetchWithTimeout.ts` (30s) e usar em todas as chamadas ao gateway.

9. **Modelo `google/gemini-3-flash-preview` inválido em 10+ functions** — `akuria-chat:389`, `docgen-chat:72`, etc.
   ID não documentado no gateway; família suportada é `gemini-2.5-*` ou `gemini-3.6-flash`.
   → Centralizar em `_shared/ai-model.ts` e padronizar para modelo válido atual.

10. **Renderização "Titular" sempre "-"** — `src/pages/Privacidade.tsx:388-397`
    `dados_titular` é `jsonb`; `JSON.parse(objeto)` lança e cai no catch.
    → `typeof value === 'string' ? JSON.parse(value) : value`.

11. **Denúncia pública não notifica admins** — `DenunciaFormulario.tsx`
    `send-denuncia-notification` existe mas nunca é chamado (nem via trigger).
    → Invocar após insert; ajustar `verify_jwt` para permitir fluxo anônimo com validação de protocolo server-side.

12. **`delete-user-complete` deixa RBAC/MFA órfãos e permite autoexclusão** — `supabase/functions/delete-user-complete/index.ts:98-132`
    Não remove `user_roles`, `user_module_permissions`, `mfa_sessions`, `mfa_codes`, `temporary_passwords`.
    → Cleanup explícito + bloquear autoexclusão.

13. **Duas fontes de verdade para role: `profiles.role` vs `user_roles`** — `create-user:194-250`
    `role` do body sem validação de enum; `readonly`→`user` só em `user_roles`.
    → Zod enum no body; unificar via trigger que sincroniza `profiles.role` a partir de `user_roles`.

14. **`create-user` não valida `permission_profile_id` do mesmo tenant** — `create-user:201-207`
    Admin pode atribuir perfil de outra empresa (leak potencial de permissões).
    → Validar `empresa_id = finalEmpresaId` antes de aplicar.

---

## Onda 3 — Médio (defesa em profundidade / paginação / concorrência)

15. **Paginação ausente (corte silencioso em 1000)** — `Riscos.tsx`, `useRiscosStats:57`, `useControlesStats:29`, `useIncidentesStats:26`, `generateTemplatePDF:100/141/187/218`
    → Usar `fetchAllPaginated` (já existe em `src/lib/supabase-paginate.ts`) ou `count:'exact', head:true` para stats.

16. **Hooks/queries sem `.eq('empresa_id')` explícito** — `useRiscoDetail.ts:44-56`, `Riscos.tsx` (query impacto financeiro), `useNotifications.tsx:24`, `NotificationCenter.tsx:68`, `markAllAsRead`
    Dependência única de RLS.
    → Adicionar filtro redundante (defesa em profundidade).

17. **`continuidade_planos` delete sem `empresa_id`** — `Continuidade.tsx:83`.

18. **Tabelas LGPD `ropa_dados_vinculados` e `dados_mapeamento` sem `empresa_id`** — schema
    Isolamento só via JOIN em FK.
    → Migration adicionando coluna denormalizada + policies diretas.

19. **`documentos.contrato_id` NOT NULL quebra upload solto** — `UploadMultiplosDialog.tsx:79-89`
    → Tornar nullable e adicionar `empresa_id` próprio na tabela.

20. **`send-password-reset` / `provision-new-account` rate-limit em memória** — inefetivo em serverless
    → Migrar para tabela Postgres (padrão de `password_reset_limits`).

21. **`signOut()` limpa cache MFA antes de confirmar sucesso** — `AuthProvider.tsx:423-429`.

22. **`api-public` conta `total_requisicoes` sem atomicidade** — `api-public/index.ts:284-290`
    → RPC `increment_api_key_usage` com `total_requisicoes + 1` em SQL.

23. **CSV de Ativos usa `split(',')` — corrompe linhas com vírgula/aspas** — `ImportacaoAtivos.tsx:168-177`
    → Trocar para `papaparse`.

---

## Onda 4 — Baixo (UX / KPIs incorretos / validações leves)

24. **`usePlanosAcaoStats`: "concluídos = total − pendentes"** — `usePlanosAcaoStats.ts:44`
    Mistura `cancelado` com `concluído`.
    → Contadores separados por status real.

25. **`useRiscosStats`: variação percentual pode ser Infinity/NaN** — `useRiscosStats.tsx:138-141`
    → Guard `scoreAntigo > 0`.

26. **`RiscoSelect` filtra status incompatível com enum real** — `RiscoSelect.tsx:44`
    Riscos aceitos ficam invisíveis para vinculação a controles.
    → Alinhar com enum real.

27. **`SprintDialog`: sem validação `data_fim > data_inicio`** — `SprintsPanel.tsx:110`, `SprintDialog:224-225`
    Burndown quebra silenciosamente.

28. **`projeto-status-report` / `projeto-suggest-tasks` não persistem resultado** — retornam só ao frontend
    Fechou aba, perdeu o crédito.
    → Persistir rascunho ligado ao `projetoId`.

29. **`ForgotPasswordDialog` sempre exibe sucesso** — `ForgotPasswordDialog.tsx:45-53` (correto para anti-enumeração, mas `create-user` também esconde falha de e-mail sem highlight persistente)
    → No fluxo admin, exibir badge persistente "convite não entregue" na lista de usuários.

30. **`docgen-chat` sem limite/sanitização de `message`/`instruction`** — `docgen-chat:416,682`
    Prompt injection controla documento final.
    → Truncar 4000 chars; escapar marcadores `===`, `[DOCGEN_READY]`.

31. **`integration-webhook-dispatcher`: sem backoff exponencial nem `error_detail` claro** — `:341-349, :463-469`.

---

## Técnico — como executar

- **Onda 1** = 1 migration (policies MFA, storage, riscos) + edições nas 3 Edge Functions críticas + 2 refactors de client.
- **Onda 2** = 1 helper compartilhado (`fetchWithTimeout`, `ai-model.ts`), retrabalho em 10 Edge Functions (mover `consume_ai_credit`), 1 bugfix client (Privacidade), 1 fluxo novo (denúncia → notificação), 1 migration (cleanup user + trigger role sync).
- **Onda 3** = migrations (colunas `empresa_id`, rate limit em DB) + refactors client-side (paginação, papaparse, empresa_id redundante).
- **Onda 4** = ajustes pontuais em hooks/dialogs, sem migration.

Todas as Edge Functions modificadas serão re-deployadas ao final de cada onda; migrations rodam via ferramenta padrão com aprovação do usuário.

## Confirmação pedida

Confirma execução na ordem Onda 1 → 2 → 3 → 4? Ou prefere que eu foque só em uma onda específica primeiro (ex.: só Onda 1 crítica de segurança)?
