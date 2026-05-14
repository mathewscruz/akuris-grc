## Objetivo

Adicionar animações suaves de **entrada** e **saída** em todos os toasts (Sonner padrão + `akurisToast`) e animação de **entrada** nos pills do NotificationCenter.

## Diagnóstico

- **Toasts**: existe apenas `@keyframes toast-slide-in` em `index.css` (entrada). Não há animação de saída. O Sonner possui atributos `data-[state=open]` e `data-[state=closed]` que podemos usar para ligar/desligar animações, mas o `classNames` atual sobrescreveu esse controle.
- **NotificationCenter**: os pills aparecem sem nenhuma animação — inseridos de forma abrupta no DOM.
- **Framer Motion**: não está instalado — solução será puramente CSS via Tailwind keyframes.

## Implementação

### 1. `tailwind.config.ts`
Adicionar 3 novos keyframes + mapeamentos em `animation`:

```
toast-enter:    translateX(40px) scale(0.95) opacity 0 → translateX(0) scale(1) opacity 1
                duração 0.35s, easing cubic-bezier(0.16, 1, 0.3, 1), overshoot em 60%
toast-exit:     translateX(0) scale(1) opacity 1 → translateX(40px) scale(0.95) opacity 0
                duração 0.25s, easing ease-intnotification-enter: translateX(16px) opacity 0 → translateX(0) opacity 1
                duração 0.3s, easing cubic-bezier(0.16, 1, 0.3, 1)
```

### 2. `src/components/ui/sonner.tsx`
- `toast` classNames: remover `animate-toast-slide-in` manual.
- Adicionar `data-[state=open]:animate-toast-enter data-[state=closed]:animate-toast-exit`.
- Sonner aplica `data-[state]` no wrapper de **todos** os toasts (padrão e custom), então a animação cobre ambos automaticamente.

### 3. `src/lib/akuris-toast.tsx`
- Remover `animate-toast-slide-in` do container custom — o wrapper do Sonner já cuida da animação via `data-[state]`.
- O conteúdo visual interno (chip, listras, botão) permanece idêntico.

### 4. `src/components/NotificationCenter.tsx`
- `renderItem`: adicionar `animate-notification-enter` à classe do botão-pill.
- Garantir que cada novo item notificado deslize suavemente da direita ao aparecer na lista.

### 5. Sem alterações
- `src/index.css`: o keyframe `@keyframes toast-slide-in` legado continua existindo para não quebrar código antigo, mas deixa de ser usado pelos 3 renderizadores principais.
- Não toca em regra de negócio, RLS, edge functions ou lógica de notificação.

## QA

- Disparar `toast.success("Teste")` → conferir entrada suave da direita e saída suave ao clicar no X ou esperar o timeout.
- Disparar `akurisToast({title:"Teste",tone:"info"})` → mesmo comportamento.
- Abrir o sino com novas notificações → conferir slide-in suave dos pills.

## Nota sobre saída do NotificationCenter

A saída (quando o usuário marca como lida e o item some) exige controle de estado para atrasar a remoção do DOM durante a animação. Isso pode ser feito em passo futuro se necessário; neste ciclo priorizamos entrada + saída de toasts e entrada de notificações.
