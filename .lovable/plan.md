# Selo do veredito de compliance — cor e formato claros

Hoje "Em compliance com ressalvas" usa o estado genérico "atenção": fundo cinza, texto cinza e só um pontinho âmbar. Não dá para ler o status de relance, e os três vereditos têm o mesmo formato.

## Novo selo (só para o veredito de compliance)
Cada veredito ganha uma combinação própria de **cor + ícone**, num formato discreto:

```text
 ( ✓  Em compliance )                 verde suave
 ( !  Em compliance com ressalvas )   âmbar suave
 ( ✕  Não está em compliance )        vermelho suave
```

- Formato de pílula arredondada, altura 24px, fundo bem leve (10%), borda fina na mesma cor (25%) e texto na cor do estado, com contraste legível nos temas claro e escuro.
- O ícone dentro de um pequeno círculo preenchido (check / exclamação / x) dá a forma: dá para distinguir mesmo sem perceber a cor (daltonismo).
- O mesmo selo aparece em três lugares: lista "Avaliações recentes", topo do resultado e tela de conclusão da análise.

## Fora do escopo
- Os selos de estado dos outros módulos continuam iguais. Se gostar do resultado aqui, posso levar o mesmo tratamento ao estado "atenção" em todo o sistema depois.

## Detalhes técnicos
- Novo `VeredictoBadge` em `adherence/` usando o `Chip` como base (sem criar outro tipo de pílula). As cores vêm dos tokens `success`/`warning`/`destructive` e os ícones de `@/components/icons` com traço 1.5.
- Substituir `StatusBadge tone={TOM_VEREDITO[v]}` em `AdherenceAssessmentView.tsx`, `AdherenceResultView.tsx` e no estado final de `AdherenceAnalysisProgress.tsx`.
- Rótulo sempre em texto (PT/EN já existentes); ícone com `aria-hidden`.
