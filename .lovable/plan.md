# Uma linha só debaixo das abas

Nos módulos com abas e busca (Planos de ação, Riscos, Contratos, Privacidade, Governança, Revisão, Due Diligence...), aparecem duas linhas: a das abas (com o traço roxo na aba ativa) e outra linha clara logo abaixo. O resultado vai ser uma linha só, com o traço roxo em cima dela.

## Mudança
- A faixa que junta abas e busca deixa de ter linha própria. Fica só a linha das abas, que é onde o traço roxo da aba ativa se apoia.
- Isso corrige todos os módulos que usam essa faixa de uma vez. As abas sem busca já têm uma linha só.

## Detalhes técnicos
- `src/components/ui/module-subbar.tsx`: remover `border-b border-border` do contêiner e `py-1`, para que o indicador e a borda de `TabsList` fiquem na base.
- Conferir com Playwright em /planos-acao: apenas uma borda horizontal sob as abas.
