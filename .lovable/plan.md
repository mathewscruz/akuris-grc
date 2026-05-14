## Objetivo

Aplicar a estética do anexo (pill horizontal, ícone circular sólido à esquerda, faixa diagonal listrada tingida pelo tom e botão "Action" branco à direita) em **toda** a superfície de notificações do Akuris — sem alterar regras de negócio, fluxos, RLS ou edge functions.

## Anatomia do novo padrão

```text
┌──────────────────────────────────────────────────────────┐
│ ●  Título                                       ┌──────┐ │
│    Descrição secundária aqui.                   │Action│ │
│                                                 └──────┘ │
└──────────────────────────────────────────────────────────┘
 ↑ chip 24px sólido na cor do tom (glyph branco)
 ↑ fundo: gradient horizontal — branco/transparente à esquerda
   → listras diagonais tingidas pela cor do tom à direita
 ↑ pill: rounded-2xl, borda border/40, shadow suave
```

5 tons do mock → tokens HSL existentes:
- **Success** → `--success` (verde)
- **Information** → `--info` (azul)
- **Reminder** → `--primary` (roxo Akuris) — novo tom adicionado
- **Error** → `--destructive` (vermelho)
- **Warning** → `--warning` (laranja)

Listras diagonais: `repeating-linear-gradient(135deg, transparent 0 8px, hsl(var(--TOM)/0.10) 8px 10px)` sobreposto a um gradient horizontal `linear-gradient(90deg, hsl(var(--background)) 0%, hsl(var(--TOM)/0.06) 100%)`.

## Arquivos afetados

### 1. `src/components/ui/sonner.tsx`
Reescrever `toastOptions.classNames` do Sonner:
- Remover acento vertical 2px (`before:`).
- Substituir o slot `icon` por um chip **sólido 24×24** circular na cor do tom (`bg-success`, `bg-info`, `bg-destructive`, `bg-warning`) com glyph branco.
- Aplicar fundo listrado por tom via `success`/`error`/`warning`/`info` no `classNames` (background-image inline através de `style` controlado por classes utilitárias adicionadas em `src/index.css`).
- `actionButton`: pill branco (`bg-background border border-border/60 text-foreground hover:bg-muted/40 rounded-lg px-3 py-1.5 text-xs font-semibold shadow-sm`).
- Aumentar largura para `380px` para acomodar o botão.

### 2. `src/lib/akuris-toast.tsx`
Atualizar `akurisToast` (custom renderer):
- Adicionar tom `reminder` em `AkurisToastTone` e `TONE_CLASSES` (cor `primary`).
- Trocar chip ringed por **chip circular sólido 24px** na cor do tom (glyph branco, ícone proprietário do módulo continua sendo a fonte do glyph).
- Aplicar fundo listrado diagonal pelo tom.
- Botão de ação no lado direito como pill branco (alinhado verticalmente ao centro).
- Manter eyebrow opcional, título e descrição.

### 3. `src/index.css`
Adicionar utilitários reutilizáveis:
```css
.akuris-stripes-success { background-image: linear-gradient(90deg, hsl(var(--background)) 0%, hsl(var(--background)) 35%, transparent 100%), repeating-linear-gradient(135deg, transparent 0 8px, hsl(var(--success)/0.14) 8px 10px); }
/* idem para -info / -warning / -destructive / -reminder (primary) */
```
Cinco classes — uma por tom. Mantém tokens HSL semânticos (sem cores cruas).

### 4. `src/components/NotificationCenter.tsx`
`renderItem` (linhas 479–566):
- Trocar layout `divide-y` por **lista de pills com gap** (`space-y-2 px-3 py-3`).
- Substituir o acento vertical 2px + chip ringed pelo **chip circular sólido 24px** (cor do tom, glyph branco com `ModuleIcon`).
- Aplicar a classe `akuris-stripes-{tom}` ao botão.
- Mover a meta (módulo + tempo) para uma linha compacta abaixo do título; remover ponto de unread (passa a ser implícito pelo destaque do fundo).
- Adicionar **chip "Abrir"** à direita quando `link_to` existir, com o mesmo estilo do botão "Action" do mock.
- Manter agrupamento por prioridade (urgent/attention/info) — cabeçalhos das seções continuam iguais.
- Adicionar mapeamento `type === 'reminder'` → tom `reminder` (caso futuro); por ora só amplia `getTypeTone`.

### 5. Sem mudanças
- `src/hooks/use-toast.ts` (shim) — a API legada continua funcionando, só herda o novo visual.
- `src/components/ui/toast.tsx` / `toaster.tsx` (Radix antigo) — sistema já migrou para Sonner; permanecem como dead code conforme memória registrada.
- Nenhuma migração SQL, edge function ou regra de RLS.

## QA

- Disparar `toast.success / .error / .warning / .info` e `akurisToast({tone:'reminder',...})` — conferir 5 visuais no preview.
- Abrir o sino do header com notificações de cada tipo (error/warning/info) e validar a nova lista pill.
- Verificar dark mode (tokens HSL garantem contraste; listras usam alpha sobre `--background`).
- Responsivo: pill encolhe para `92vw` no mobile, botão "Action" colapsa para ícone-only abaixo de 380px.

## Fora do escopo

- Não alterar conteúdo/origem das notificações automáticas.
- Não tocar em edge functions de envio de e-mail.
- Não criar novos endpoints nem tabelas.
