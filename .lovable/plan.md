## Plano

Adicionar duas ações no menu de cada empresa em **Configurações → Gerenciamento de Empresas** (`GerenciamentoEmpresas.tsx`):

### 1. Renovar Trial
- Item visível apenas quando `status_licenca === 'trial'` (ou ao reativar empresa em trial expirado).
- Ao clicar: confirma e atualiza `data_inicio_trial = now()`, garante `status_licenca = 'trial'` e `ativo = true`.
- Reinicia os 14 dias usados por `check_trial_expiration`.

### 2. Ativar / Inativar Empresa
- Item dinâmico: mostra "Inativar empresa" se `ativo = true`, "Ativar empresa" caso contrário.
- Ao clicar: confirma e faz `update empresas set ativo = !ativo`.
- Inativar bloqueia o acesso (mesmo efeito do trial expirado).

### Detalhes técnicos
- Edits apenas em `src/components/configuracoes/GerenciamentoEmpresas.tsx`:
  - Novas handlers `handleRenovarTrial(empresa)` e `handleToggleAtivo(empresa)` usando `supabase.from('empresas').update(...).eq('id', empresa.id)`.
  - Dois novos `DropdownMenuItem` no menu de ações (com ícones `RefreshCw` e `Power`/`PowerOff`).
  - Usar `ConfirmDialog` já importado (ou `window.confirm` simples) para confirmação.
  - Toast de sucesso/erro via `sonner` e `fetchEmpresas()` ao final.
- Sem migração: usa colunas existentes (`ativo`, `data_inicio_trial`, `status_licenca`) e RLS atual de super_admin.