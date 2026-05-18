## Problema

A tela `/gap-analysis/framework/:id` quebra com:
> Failed to fetch dynamically imported module: src/pages/GapAnalysisFrameworkDetail.tsx
> Vite overlay: Unexpected token `div`. Expected jsx identifier — RemediationTabV2.tsx:230

A linha 230 é apenas `<div className="space-y-6">` dentro do `return`. O erro real está mais acima, na linha 270:

```tsx
<SegmentToggle<'causa' | 'secao' | 'esforco'>
  value={grouping}
  onChange={setGrouping}
  ...
/>
```

O parser SWC do Vite, em `.tsx`, não interpreta corretamente argumento de generic com union de string literals na abertura da tag JSX (`<Comp<'a' | 'b'>`). Ele consome até o próximo `>` e a partir daí o JSX seguinte fica órfão — por isso o erro aponta para o `<div>` do return.

## Correção

Remover o argumento explícito de generic — o TypeScript já infere `T` corretamente a partir de `value` + `options`.

Em `src/components/gap-analysis/v2/RemediationTabV2.tsx`, trocar:

```tsx
<SegmentToggle<'causa' | 'secao' | 'esforco'>
```

por:

```tsx
<SegmentToggle
```

Não há outras mudanças necessárias — `SegmentToggle` continua tipado como `<T extends string>` e `setGrouping` já restringe `T` para `'causa' | 'secao' | 'esforco'`.

## Validação

- Recarregar a rota `/gap-analysis/framework/:id` e confirmar que o overlay do Vite some e a aba Remediação renderiza os 4 KPIs, segment toggle e Kanban.
- Conferir que o segment continua alternando entre Por causa-raiz / Por seção / Por esforço.
