## Objetivo
Validar e padronizar visualmente os 6 itens do menu de ações do risco (Editar, Tratamentos, Aprovação, Histórico Avaliações, Trilha de Auditoria, Excluir).

## Status atual (validação funcional)

| Ação | Wiring | Estado visual |
|---|---|---|
| Editar | OK — abre `RiscoDialog` (já editorial via Wizard) | OK |
| Tratamentos (N) | OK — abre `TratamentosDialog` (já refinado na rodada anterior) | OK |
| Aprovação | OK — abre `AprovacaoRiscoDialog` | **Precisa padronizar** |
| Histórico Avaliações | OK — abre `HistoricoAvaliacoesDialog` | **Precisa padronizar** |
| Trilha de Auditoria | OK — abre `TrilhaAuditoriaRiscos` | **Precisa padronizar** |
| Excluir | OK — abre `ConfirmDialog` filtrando por empresa_id | OK |

## Mudanças

### 1. `AprovacaoRiscoDialog.tsx`
- Header editorial: chip 36px com `CheckCircle` (primary), eyebrow "Aprovação do risco" + nome em destaque, descrição abaixo.
- `DialogContent` com `flex flex-col p-0 gap-0` + `max-w-xl` e fullscreen no mobile (`max-h-[100dvh]`).
- Body em `ScrollArea` flex-1 com `px-6 py-5`.
- Substituir blocos `bg-yellow-50/border-yellow-200`, `bg-green-50/border-green-200`, `bg-red-50/border-red-200` por tons semânticos (`bg-amber-500/5 border-amber-500/30`, `bg-emerald-500/10 border-emerald-500/30`, `bg-destructive/10 border-destructive/30`) — compatíveis com tema escuro.
- Adicionar `strokeWidth={1.5}` em todos os ícones Lucide.

### 2. `HistoricoAvaliacoesDialog.tsx`
- Header editorial: chip 36px com ícone `Clock` (primary), eyebrow "Histórico de avaliações" + nome do risco.
- `DialogContent` com layout flex padrão (header fixo + scroll área).
- Trocar `text-green-600` / `text-red-600` dos ícones de tendência por `text-emerald-500` / `text-destructive` (tokens semânticos).
- Manter timeline atual.

### 3. `TrilhaAuditoriaRiscos.tsx`
- Header editorial: chip 36px com ícone `History` (primary), eyebrow "Trilha de auditoria" + nome do risco.
- Substituir `bg-red-50 / text-red-800` e `bg-green-50 / text-green-800` do diff Anterior/Novo por surfaces semânticos: `bg-destructive/10 text-destructive` e `bg-emerald-500/10 text-emerald-700 dark:text-emerald-400`.
- Adicionar `strokeWidth={1.5}` aos ícones Lucide.

### 4. Validação extra
- Confirmar que `openTratamentosDialog`, `setAprovacaoRisco`, `setHistoricoRisco`, `setAuditRisco`, `openDeleteDialog` estão todos wirados (já confirmado em `Riscos.tsx` linhas 539-553 e 853-879).
- `handleDelete` já filtra por `empresa_id` (rodada anterior).

## Fora do escopo
- Mudanças de comportamento, queries, Edge Functions ou RLS.
- Refator dos forms internos (Aceite, fluxo de aprovação) — apenas pele.

## Arquivos editados
- `src/components/riscos/AprovacaoRiscoDialog.tsx`
- `src/components/riscos/HistoricoAvaliacoesDialog.tsx`
- `src/components/riscos/TrilhaAuditoriaRiscos.tsx`
