## Causa raiz real

O erro do SWC aponta `line 120 (<div>)` mas a verdadeira origem está nos **call-sites genéricos do componente `PillGroup`** nas linhas 156, 263, 271 e 279 do `DocGenBriefing.tsx`:

```tsx
<PillGroup<DocType> options={...} ... />
<PillGroup<DocTone> .../>
<PillGroup<DocLanguage> .../>
<PillGroup<DocLength> .../>
```

A sintaxe `<Component<TypeArg>` é TSX válido, mas o **plugin `lovable-tagger`** (que injeta `data-lov-id` em todos os elementos JSX antes do SWC) não lida com type arguments em elementos JSX. O resultado da transformação fica malformado, e o SWC então falha logo no próximo elemento que tenta parsear — daí o erro confuso apontando para o `<div>` da linha 120 com `Unexpected token 'div'. Expected jsx identifier`.

A correção do arrow genérico (linha 79) que fizemos antes estava certa, mas sozinha não bastava — esses 4 call-sites genéricos continuam quebrando o tagger.

## Correção

Remover os type arguments dos 4 usos do `PillGroup` — o TypeScript infere `T` automaticamente a partir do array `options`, então não há perda de tipagem:

- linha 156: `<PillGroup<DocType>` → `<PillGroup`
- linha 263: `<PillGroup<DocTone>` → `<PillGroup`
- linha 271: `<PillGroup<DocLanguage>` → `<PillGroup`
- linha 279: `<PillGroup<DocLength>` → `<PillGroup`

E remover os imports de `DocType`, `DocTone`, `DocLength`, `DocLanguage` se ficarem sem uso após o ajuste (verificar antes de remover).

Nada além disso — apenas esses quatro elementos JSX. O comportamento em runtime fica idêntico.