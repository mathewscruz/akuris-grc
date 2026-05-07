Validação geral do módulo de Riscos + Aceite de Risco + sidebar.

## 1. Sidebar — sub-item ativo sem cor roxa

**Sintoma:** ao entrar em `/riscos` ou `/riscos/aceite`, o submenu fica destacado no roxo apenas brevemente, ou perde o destaque ao recolher/expandir o grupo.

**Causa raiz:** em `src/components/AppSidebar.tsx`, no fluxo de sub-itens (linhas 410–432) o `<NavLink>` usa `getNavCls`, mas esse `getNavCls` aplica `bg-primary` apenas quando `isActive` do React Router é `true` (rota exata). Para `/riscos`, isso funciona; o problema acontece quando o submenu se "fecha" ao trocar `openGroups` (linha 209: `return [groupTitle]` substitui em vez de manter), e em alguns sub-itens (`/riscos/aceite`) o highlight visual é sobreposto pelo `data-[active=true]` do `SidebarMenuButton` que NÃO está sendo passado (`isActive` da prop não é setado), então ele cai no estilo padrão `bg-sidebar-accent` (cinza), ofuscando o roxo.

**Correção:**
- No `<SidebarMenuButton>` dos sub-itens (linha 411) e do item simples (linha 438), passar `isActive={isActive(subItem.url)}` / `isActive={isActive(item.url!)}`. Isso garante que o `data-[active=true]` aplique o estado consistente.
- Manter o pill roxo via `getNavCls` no `NavLink` interno (já correto).
- Garantir contraste do ícone ativo para `text-primary-foreground` (já existe).

## 2. Módulo Riscos (`/riscos`) — padronização visual

**Itens identificados:**
- `RiscoFormWizard.tsx` tem 13 `console.log/error` ativos (proibido pelas regras Core: usar `logger.ts`). Substituir por `logger.debug/error`.
- `MatrizVisualizacao.tsx`, `RiscoAnexosIcone.tsx`, `RiscoAnexosUpload.tsx`, `UserSelect.tsx` também usam `console.*`. Trocar por `logger`.
- `AprovacaoRiscoDialog.tsx` usa `console.warn` em fluxo de e-mail. Trocar por `logger.warn`.
- Botões de toolbar em `Riscos.tsx` (linhas 647–658): "Categorias", "Matriz", "Novo Risco" — adicionar `strokeWidth={1.5}` aos ícones para alinhar com a assinatura Akuris.
- Ícones do dropdown de ações na tabela (linhas 535–552): adicionar `strokeWidth={1.5}`.
- O DataTable continua usando filtros via `Select` cinza padrão; manter (já é shadcn). Não há violação.

## 3. Módulo Aceite de Risco (`/riscos/aceite`) — padronização

- Substituir `console.*` se existir (não encontrado, ok).
- Adicionar `strokeWidth={1.5}` aos ícones dos `StatCard` e do dropdown de ações (`Eye`, `CalendarClock`, `XCircle`).
- `AceiteDetalheDialog.tsx`: ícone `CheckCircle` no título já recebe estilo, mas não tem `strokeWidth={1.5}` — adicionar.

## 4. Validação de fluxos e conexões

Verifiquei e estão coerentes:
- Drawer de detalhe (`RiscoDetailDrawer`) chama corretamente `onEdit`, `onAccept` (abre `AprovacaoRiscoDialog`) e `onOpenTratamentos` (abre `TratamentosDialog`).
- Tabela: ações Editar / Tratamentos / Aprovação / Histórico / Trilha / Excluir todas conectadas a estados e dialogs existentes.
- Saved views (Todos, Acima do apetite, Sem responsável, Revisão vencida, Meus riscos) filtram corretamente.
- KPIs do `RiskKpiQuad` fazem CTA para mudar `view=matrix|table` via searchParams — funciona.
- `AppetiteBanner` → "Ver na matriz" muda `view` corretamente.
- `RiscosAceite` revoga aceite, agenda revisão (30/90d) e abre `AprovacaoRiscoDialog` para revisar pendentes — todos conectados.
- Invalidação de cache (`invalidateAll`, `invalidateRiscos`) cobre todas as queries.

**Nada quebrado** nos fluxos — apenas as inconsistências visuais e de logging acima.

## Arquivos a editar

1. `src/components/AppSidebar.tsx` — propagar `isActive` ao `SidebarMenuButton` dos sub-itens e do item flat.
2. `src/components/riscos/RiscoFormWizard.tsx` — `console.*` → `logger.*`.
3. `src/components/riscos/MatrizVisualizacao.tsx` — idem.
4. `src/components/riscos/RiscoAnexosIcone.tsx` — idem.
5. `src/components/riscos/RiscoAnexosUpload.tsx` — idem.
6. `src/components/riscos/UserSelect.tsx` — idem.
7. `src/components/riscos/AprovacaoRiscoDialog.tsx` — idem.
8. `src/pages/Riscos.tsx` — `strokeWidth={1.5}` em ícones de toolbar e dropdown.
9. `src/pages/RiscosAceite.tsx` — `strokeWidth={1.5}` em ícones.
10. `src/components/riscos/AceiteDetalheDialog.tsx` — `strokeWidth={1.5}` em ícones do header e seções.

Sem mudanças de estrutura, sem alteração de queries (todas já com `.eq('empresa_id', ...)`), sem mexer em RLS ou Edge Functions.