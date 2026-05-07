## Objetivo

Modernizar o popup **Matriz de Riscos** (`MatrizDialog` + `MatrizForm` + `MatrizVisualizacao`) para que tenha o mesmo padrão editorial dos demais dialogs do módulo Riscos (Aprovação, Histórico, Trilha, Tratamento) — sem alterar regras de negócio, queries ou RLS.

Hoje o popup usa `max-w-4xl` com tudo concorrendo no mesmo `overflow-y-auto`, header genérico, escalas em inputs apertados (valor de 20px, descrição cortada como "Muit…"), color picker default e ações inconsistentes com o resto do módulo.

## Mudanças

### 1. `MatrizDialog.tsx` — shell editorial e responsivo
- `DialogContent`: trocar `max-w-4xl max-h-[90vh] overflow-y-auto` por `max-w-full sm:max-w-5xl max-h-[100dvh] sm:max-h-[92vh] flex flex-col p-0 gap-0` (viewport-safe, fullscreen no mobile, padrão alinhado aos outros dialogs do Riscos).
- `DialogHeader` editorial: `flex-shrink-0 px-6 pt-6 pb-4 border-b` + chip 36px com ícone `Grid3X3` em `bg-primary/10 text-primary` + eyebrow `text-[11px] uppercase tracking-wider text-muted-foreground` ("Configuração de Riscos") + título `text-base font-semibold` ("Matriz de Riscos") + `DialogDescription` muted, com `CornerAccent` opcional.
- `Tabs` em container `flex-1 min-h-0 flex flex-col`:
  - `TabsList` sticky no topo da área scrollável (`px-6 pt-4`), com mesmo visual atual mas full-width consistente.
  - `TabsContent` com `flex-1 overflow-y-auto px-6 py-5` — cada aba tem seu próprio scroll, evitando o duplo scroll atual.
- `strokeWidth={1.5}` em todos os ícones Lucide para alinhar ao sistema de ícones Akuris.

### 2. `MatrizForm.tsx` — densidade, espaçamento e usabilidade
- Remover os `Card` aninhados redundantes ("Nova Matriz" e "Matrizes Existentes") quando dentro do dialog → usar seções com `border rounded-lg p-5 bg-card` e títulos editoriais (eyebrow + heading), evitando o efeito "card dentro de card dentro de modal".
- Espaçamento: `space-y-7` entre seções, `gap-5` em grids; `Separator` substituído por divisórias mais sutis (`border-t border-border/60 pt-6`).
- **Escala de Probabilidade / Impacto** (problema visível no print "Muit…", "Insig…"):
  - Layout em linha: `Input` valor `w-16`, `Input` descrição `flex-1 min-w-0`, botão remover `shrink-0`.
  - Adicionar `placeholder` mais claro ("Ex.: Muito Provável") e `aria-label`.
  - Botão `+ Adicionar nível` em texto + ícone (não só ícone), no rodapé da lista.
  - Wrapper das listas com `space-y-2.5` e cada linha com `bg-muted/30 hover:bg-muted/50 rounded-md p-2 transition-colors`.
- **Níveis de Risco**:
  - Substituir `<input type="color">` raw por um trigger compacto: swatch 32x32 arredondado com `Popover` contendo paleta sugerida (verde, amarelo, laranja, vermelho, cinza) + input de hex livre.
  - Layout: `min`/`max` lado a lado em mini-grid, `Nome do nível` `flex-1`, swatch + remove à direita.
  - Manter o `Alert` de validação de faixas (já existe), com `strokeWidth={1.5}`.
- **Método de cálculo**: transformar em um par de cards selecionáveis (P × I e P + I) com explicação curta — mais visual que o `Select` atual e ocupa a mesma altura.
- **Lista de matrizes existentes**: mover para uma segunda seção dentro da própria aba Configuração, com cabeçalho eyebrow "Matrizes salvas". Cada item com hover discreto, ações `Editar`/`Excluir` como ghost icon buttons com tooltip (padrão dos outros módulos do Riscos).
- Estado vazio: já usa `EmptyState` — manter, ajustando o ícone com `strokeWidth={1.5}`.
- **Footer sticky**: a aba Configuração ganha um footer fixo `border-t px-6 py-4 bg-background` com:
  - Esquerda: hint sutil ("Alterações afetam novos cálculos de risco").
  - Direita: `Cancelar Edição` (quando editando) + `Salvar Matriz` / `Atualizar Matriz` (primary).
- Remover o `DialogFooter` solto com botão "Fechar" (o X do header já fecha).

### 3. `MatrizVisualizacao.tsx` — leitura e drill-down
- Remover wrapper `Card` interno (já está dentro do dialog), usar bloco `space-y-4`.
- Header da matriz: eyebrow "Matriz Visual" + título com nome da matriz + chip com método de cálculo ("P × I" ou "P + I") e contagem total de riscos plotados.
- Grid: aumentar `min-h` da célula para `min-h-[64px]` e `max-w-2xl` (dialog agora é `max-w-5xl`), tipografia das letras (B/M/A/C) em `text-xs font-semibold` ao invés de `text-[9px]` — leitura muito melhor que no print atual.
- Eixo Y/X com labels textuais ("Probabilidade ↑" à esquerda em escrita vertical, "Impacto →" abaixo) e números nas células de cabeçalho com `text-xs`.
- Tooltip nativo substituído por `Tooltip` do shadcn mostrando: nível, probabilidade × impacto = resultado, lista dos primeiros 3 riscos da célula + "ver todos" se houver mais.
- Ao clicar numa célula com riscos, manter `navigate('/riscos?ids=...')` e fechar o dialog (passar callback `onClose` opcional via prop).
- Adicionar uma legenda horizontal abaixo da matriz: chips com cor + nome de cada nível de risco configurado (ex.: ● Baixo  ● Médio  ● Alto  ● Crítico), respeitando as cores da configuração.
- Loading via `<AkurisPulse/>` (já é) — manter.
- Empty state ilustrado: usar `EmptyState` quando não houver matriz, com CTA "Configurar agora" que muda para a aba Configuração.

### 4. Itens fora de escopo
- Sem alterações em queries Supabase, RLS, schema ou Edge Functions.
- Sem mexer no fluxo de categorias (não aparece no print e está em outra tela).
- Sem trocar `react-hook-form`/`zod`.

## Detalhes técnicos

- Imports novos: `Popover`, `PopoverTrigger`, `PopoverContent`, `Tooltip*` (shadcn) em `MatrizForm`/`MatrizVisualizacao`; `CornerAccent` em `MatrizDialog`.
- Paleta sugerida para níveis (constante local): `['#22c55e','#84cc16','#eab308','#f97316','#dc2626','#6b7280']`.
- `MatrizVisualizacao` recebe nova prop opcional `onNavigate?: () => void` para fechar o dialog ao drill-down.
- `MatrizDialog` passa `onNavigate={() => onOpenChange(false)}` para `MatrizVisualizacao` e controla a aba ativa via `useState` para permitir o CTA "Configurar agora" do empty state.
- Manter `strokeWidth={1.5}` em todos os Lucide (regra Akuris).
- Sem novos toasts/notificações; reutilizar `sonner` já presente.

## Arquivos editados
- `src/components/riscos/MatrizDialog.tsx`
- `src/components/riscos/MatrizForm.tsx`
- `src/components/riscos/MatrizVisualizacao.tsx`
