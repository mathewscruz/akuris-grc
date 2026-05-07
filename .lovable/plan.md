# Refinos visuais — Riscos

## 1. Barra de tabs (anexo 1 → estilo anexo 2)

Hoje `RiscosTabs.tsx` usa `TabsList` com `bg-muted/40` em pílula. Trocar para o padrão "underline" do anexo 2: linha de itens sobre uma borda inferior única, com sublinhado de 2px no item ativo.

Editar `src/components/riscos/RiscosTabs.tsx`:
- `TabsList` → `bg-transparent`, sem padding, `border-b border-border`, `gap-1`, alinhado à esquerda.
- Cada `TabsTrigger`:
  - `rounded-none`, `bg-transparent`, sem shadow.
  - `border-b-2 border-transparent`, `-mb-px` para sobrepor a linha.
  - Ativo: `data-[state=active]:border-primary`, `text-primary`, `font-semibold`.
  - Inativo: `text-muted-foreground hover:text-foreground/85`.
  - Padding `px-3 py-2.5`, ícone `h-3.5 w-3.5` (sem mudar).

Resultado: visual idêntico aos chips de "Todos / Acima do apetite / ..." (anexo 2), porém com cor `primary` no ativo (mantendo a identidade roxa do Akuris e diferenciando da barra de visões salvas que usa `foreground` preto).

## 2. Drawer de detalhe (anexo 3)

Editar `src/components/riscos/RiscoDetailDrawer.tsx`:

### 2.1 Espaçamento das bordas
- `SheetContent`: adicionar `px` interno deixando o `p-0` apenas no eixo vertical do container raiz, mas como o conteúdo já vive em seções com `px-6`, o problema é o **título "teste"** e os **metadados** colados na lateral. Conferir que `SheetHeader` tem `px-6` (já tem) e adicionar `px-6` no `TabsList` e nos `TabsContent` — alguns hoje estão com `px-5` ou sem padding, gerando o "colado" visto no print.
- Aumentar respiro vertical: `SheetHeader` `py-5` → `py-6`, `space-y-3` → `space-y-4`.
- Footer: garantir `px-6 py-4` e `gap-3` entre "Última revisão" e os botões.

### 2.2 Botão fechar × Editar
O `SheetContent` do shadcn injeta um `SheetPrimitive.Close` em `absolute right-4 top-4` (X). Hoje o botão "Editar" do nosso header fica em `right-6` aproximadamente, então o X cai por cima/colado.

Opções:
- Mover o "Editar" para a esquerda do X com folga: envolver o cluster de ações em um `div className="flex items-center gap-3 pr-8"` (o `pr-8` reserva espaço para o X nativo).
- Alternativa mais limpa: esconder o X nativo via `[&>button.absolute]:hidden` no `SheetContent` e renderizar nosso próprio `SheetClose` ao lado do "Editar" com `gap-2`, mantendo ambos com a mesma altura (`h-7`, ícone `h-3.5`).

Vamos pela alternativa 2 (controle total do espaçamento):
```
<div className="flex items-center gap-2">
  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => onEdit(risco)}>
    <Edit className="h-3.5 w-3.5 mr-1" /> Editar
  </Button>
  <SheetClose asChild>
    <Button variant="ghost" size="icon" className="h-7 w-7">
      <X className="h-4 w-4" />
    </Button>
  </SheetClose>
</div>
```
E no `SheetContent`: `className="... [&>button.absolute]:hidden"` para esconder o X nativo.

### 2.3 Grid de metadados
- `grid grid-cols-4 gap-x-6 gap-y-1` → `gap-x-8` para mais respiro entre Categoria/Responsável/Próx. revisão/SLA, e adicionar `pt-1` para separar do título.

## Não-mexer
- Lógica de `?view=` em `RiscosTabs`.
- Conteúdo das abas, hooks, queries, RLS.
- `RiscosViewChips` (anexo 2 já está no padrão).
- Wizard de criação/edição de risco.

## Arquivos
- Editar `src/components/riscos/RiscosTabs.tsx` (tabs underline com cor primary).
- Editar `src/components/riscos/RiscoDetailDrawer.tsx` (paddings, X custom, gap entre Editar e X, grid metadados).
