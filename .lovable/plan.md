## Causa raiz

`src/components/documentos/DocGenBriefing.tsx:79` declara um arrow function genérico:

```ts
const update = <K extends keyof BriefingDefaults,>( ... )
```

O parser do `vite-plugin-react-swc` (SWC) confunde `<K extends ...>` com a abertura de um elemento JSX. A vírgula que adicionei antes (`<K,>`) é o workaround padrão do TS oficial, mas o SWC tem um bug conhecido em que essa heurística nem sempre funciona dentro de componentes `.tsx` — o erro continua sendo `Expected jsx identifier` apontando para o primeiro `<div>` do JSX.

## Correção

Trocar o arrow genérico por uma **função interna não-genérica**, eliminando totalmente a ambiguidade com JSX. Como `BriefingDefaults` é uma interface controlada e `update` só é chamado internamente, perdemos zero segurança de tipos relevante — o tipo `keyof BriefingDefaults` continua sendo usado no parâmetro.

Substituir as linhas 79–82 por:

```ts
const update = (
  key: keyof BriefingDefaults,
  value: BriefingDefaults[keyof BriefingDefaults],
) => setBriefing((prev) => ({ ...prev, [key]: value }));
```

Isso mantém o comportamento idêntico, remove o `<K extends …>` problemático e desbloqueia o build do SWC.

Nada mais precisa mudar — os call-sites de `update('frameworks', […])`, `update('docType', …)` etc. continuam válidos porque os valores passados já são compatíveis com `BriefingDefaults[keyof BriefingDefaults]`.