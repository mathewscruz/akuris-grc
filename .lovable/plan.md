# Retirar a frase da tela de login

Remover a frase "Conformidade hoje. Um amanhã mais seguro." (e a versão em inglês "Compliance today. A safer tomorrow.") que aparece acima do título no lado esquerdo da tela de login. O restante da tela fica igual.

## Detalhes técnicos
- `src/components/auth/AuthShell.tsx`: remover o parágrafo que renderiza `auth.splitEyebrow`.
- `src/i18n/pt.ts` e `src/i18n/en.ts`: remover a chave `splitEyebrow`, que não será mais usada.
