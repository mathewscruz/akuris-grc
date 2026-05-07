## Plano de remediação dos findings de segurança (sem quebrar funcionalidade)

Análise: dos 10 findings, **9 são corrigíveis sem impacto funcional**. O finding do `mfa_codes` é falso positivo do scanner (a policy real já está correta — `roles: {authenticated}` e `USING (user_id = auth.uid())`); apenas marcaremos como fixed com explicação. Nada que impacte o login/MFA será alterado.

---

### 🔴 Erros críticos

**1. `profiles.invitation_link` exposto a usuários comuns da empresa**
- Frontend usa duas vias: (a) listagem que lê `invitation_link` direto no SELECT; (b) RPC `get_user_invitation_link` (admin-only).
- Ação: revogar permissão de coluna — `REVOKE SELECT (invitation_link) ON public.profiles FROM authenticated, anon;` e remover o campo do `select` da listagem em `GerenciamentoUsuariosEnhanced.tsx` (manter o RPC como única forma do admin obter o link).
- Impacto funcional: nenhum — a UI já busca o link sob demanda via RPC.

**2. `denuncias.nome_denunciante` / `email_denunciante` visíveis a qualquer usuário da empresa**
- A política ampla "View denuncia by token or auth" expõe PII para qualquer authenticated. A política admin-only correta já existe (`Admins/responsavel can view denuncias`), mas é sobreposta.
- Ação: 
  1. Reescrever "View denuncia by token or auth" para suportar **apenas o caminho do token público** (`token_publico = header`); remover o ramo `auth.uid() IS NOT NULL`.
  2. Manter "Admins/responsavel can view denuncias" como única via authenticated (admin ou responsável atribuído).
- Impacto funcional: usuários comuns deixam de ver denúncias — **comportamento esperado** já existente em `Admins/responsavel can view denuncias`. Acesso anônimo via token continua funcionando (formulário público de consulta).

**3. `mfa_codes` lido por usuários não autenticados** ✅
- Já corrigido: a policy real é `roles {authenticated}` com `USING (user_id = auth.uid())`. Apenas marcar como fixed (a security memory antiga continha um item desatualizado).

**4. `api_keys` em texto plano legível pelos admins da empresa**
- A policy ALL é admin-only mas a coluna armazena chave em texto. Risco residual aceito porque admins criam suas próprias keys; mascarar no SELECT.
- Ação rápida sem quebrar: criar RLS RESTRICTIVE adicional ou view `api_keys_listagem` que retorne apenas prefixo (`LEFT(api_key, 8) || '...'`), e fazer o frontend listar a partir dessa view; manter a tabela base apenas para o momento da criação (que já mostra a chave inteira uma vez).
- Aceitável (seguro e sem impacto): revogar `SELECT (api_key)` da role `authenticated` e expor RPC `get_api_key_full(_id uuid)` security-definer com check `is_admin()` para casos pontuais. A listagem passa a usar `api_key_prefixo` (coluna existente no schema, ou derivar via view).
- Impacto funcional: nenhum — usuário admin continua vendo prefixo na tabela; chave inteira só no momento da criação (já é o fluxo).

---

### 🟡 Warnings

**5. `due_diligence_templates` padrão visíveis a qualquer authenticated**
- Ação: alterar policy `Users can view templates from their empresa or standard templates` para exigir authenticated (já é) E manter `padrao = true` aberto. Aceitar como **ignored** pois templates padrão são intencionalmente compartilhados (igual aos frameworks de gap analysis). Atualizar security memory.

**6. `asset_agents.agent_token` legível por toda a empresa**
- Ação: revogar `SELECT (agent_token)` de `authenticated`; criar RPC `get_agent_token(_agent_id)` security-definer com `is_admin()`.
- Impacto: zero — token só é exibido em tela de admin.

**7. `api_inbound_webhooks.webhook_token` legível por toda a empresa**
- Ação: alterar a policy "Empresa pode gerenciar seus webhooks de entrada" — separar em SELECT (admin only via `is_admin_or_super_admin()`), INSERT/UPDATE/DELETE (admin only). 
- Verificado: `InboundWebhooksManager.tsx` é uma tela de configurações (admin). Nenhum impacto.

**8. `due_diligence_questions` de templates padrão expostas cross-tenant**
- Ação: alterar policy "Users can view questions from standard templates" para exigir também `empresa_id = get_user_empresa_id()` ao nível do assessment (não do template). Ou aceitar como decisão de produto — questões de templates padrão são parte do conteúdo compartilhado.
- Recomendação: aceitar (ignored) com justificativa, igual ao item 5.

**9. `gap_analysis_frameworks` globais legíveis por anon**
- Ação: alterar policies SELECT que aplicam a `{public}` para `{authenticated}`. Frontend já requer auth para acessar Gap Analysis.
- Impacto: zero.

**10. `integracoes_config.credenciais_encrypted` legível por toda a empresa**
- Ação: alterar SELECT policy "Users can view integrations from their empresa" para exigir `is_admin_or_super_admin()`.
- Verificado: `JiraConfigDialog.tsx` está dentro de Configurações > Integrações (admin). Nenhum impacto.

---

### Estratégia de execução

Uma única migração SQL que:
1. Revoga column-level SELECT em `profiles.invitation_link`, `api_keys.api_key`, `asset_agents.agent_token`.
2. Cria RPCs security-definer `get_agent_token(_id)` e `get_api_key_full(_id)` (admin-only).
3. Recria policy de `denuncias` removendo o ramo authenticated.
4. Restringe SELECT em `integracoes_config`, `api_inbound_webhooks`, `gap_analysis_frameworks` (authenticated em vez de public).
5. Remove referência a `invitation_link` da query de listagem em `GerenciamentoUsuariosEnhanced.tsx`.
6. Marca finding `mfa_codes` como **fixed** (falso positivo).
7. Marca findings 5 e 8 (templates padrão de DD) como **ignored** com justificativa de produto.
8. Atualiza @security-memory consolidando as decisões.

Nenhuma das mudanças afeta:
- Login, MFA, sessões.
- Fluxo público de denúncia (token continua válido).
- Criação de API keys (chave ainda exibida uma vez na criação).
- Telas de admin (continuam vendo tudo).

Aprovar para executar.