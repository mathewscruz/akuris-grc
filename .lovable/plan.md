## Objetivo
Padronizar os dois diálogos do fluxo de tratamento de risco (lista e formulário) para o visual editorial Akuris já usado em outros módulos (header com ícone, descrição, footer fixo, mais respiro, micro-acentos).

## Mudanças

### 1. `TratamentosDialog.tsx` — Lista de Tratamentos
- Migrar para o padrão editorial: header com chip de ícone proprietário (`AkurisRiscosIcon` ou `Shield` stroke 1.5) + título + descrição.
- Remover o `Card` interno duplicado (atualmente o título "Tratamentos do Risco" aparece duas vezes — no header do dialog e no header do Card). A lista será renderizada diretamente, sem Card aninhado.
- Aumentar largura para `sm:max-w-5xl` e usar paddings `px-8 py-6` para mais respiro.
- Adicionar `CornerAccent` sutil no canto do header (consistente com outros dialogs editoriais).
- Empty state ilustrado com `EmptyState` (se já existir no projeto) ou ícone proprietário grande + texto + CTA centralizado, com mais espaçamento vertical (`py-16`).
- Botão "Novo Tratamento" mantém visual primário roxo.

### 2. `TratamentosList.tsx` — Ajustes para suportar uso sem Card wrapper
- Adicionar prop opcional `embedded` que, quando true, remove o Card externo e renderiza apenas header inline + tabela/empty state.
- Aplicar `useTableDensity` na tabela (já é o padrão Akuris) para herdar densidade global.
- Header inline com título menor (apenas contador "X tratamento(s)") ao lado do botão "Novo Tratamento", já que o título principal vem do dialog.

### 3. `TratamentoDialog.tsx` — Wrapper do formulário
- Migrar para `DialogShell` (já existente em `src/components/ui/dialog-shell.tsx`) para ganhar:
  - Header padronizado com ícone (`Shield` ou ícone proprietário de Riscos).
  - ScrollArea no body.
  - Footer sticky com Cancelar + Salvar (com Ctrl+S).
  - Guard de "alterações não salvas".
- Tamanho `lg`.

### 4. `TratamentoForm.tsx` — Refino do formulário
- Remover o footer interno (`flex justify-between pt-4`) — o submit passa a ser controlado pelo footer do `DialogShell` via `onSubmit`. O componente expõe `formRef` ou recebe `onSubmitRef`.
- Espaçamento: trocar `space-y-6` por `space-y-7` e usar `gap-5` nos grids para mais respiro.
- Corrigir o botão "Sugerir Tratamento": hoje renderiza dois `AkurisAIIcon` lado a lado por engano (linhas 235-236). Manter apenas um.
- Trocar o badge "1 crédito de IA" para o componente padrão `AiCostHint` integrado ao botão (visualmente compacto, à direita do label da descrição) — remover o `<AiCostHint>` solto.
- Realçar o campo "Descrição" como hero do form: label maior (`text-base font-semibold`), textarea com `min-h-[140px]` e placeholder mais limpo.
- Substituir os emojis (🛡️ 🚨 💡) do dialog de sugestões por ícones Lucide stroke 1.5 (`Shield`, `AlertTriangle`, `Lightbulb`) para alinhar à identidade.
- Trocar o loader local `AkurisPulse size={12}` no botão por um spinner inline mais discreto (mantendo `AkurisPulse` apenas para overlays/estados grandes — padrão do sistema).

### 5. Acessibilidade & consistência
- Garantir `strokeWidth={1.5}` em todos os ícones Lucide novos.
- Garantir que todas as datas usem `formatDateOnly` (já em uso) e selects herdem o estilo padrão.

## Arquivos editados
- `src/components/riscos/TratamentosDialog.tsx`
- `src/components/riscos/TratamentosList.tsx`
- `src/components/riscos/TratamentoDialog.tsx`
- `src/components/riscos/TratamentoForm.tsx`

## Fora do escopo
- Mudanças no schema do banco ou em Edge Functions.
- Refatorar lógica de IA (`suggest-risk-treatment`) — apenas o visual do botão/dialog de sugestões.
