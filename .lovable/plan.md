# Retirar o caminho repetido dentro dos módulos

O caminho "Governança > Controles 30", que aparece à esquerda da linha das abas, sai de todos os módulos. Esse caminho já aparece no topo do sistema. As abas, os contadores e a busca rápida à direita continuam iguais.

## Detalhes técnicos
- `src/components/ui/module-subbar.tsx`: remover o bloco que mostra `title`/`activeLabel`/`icon`. As props continuam sendo aceitas, para não quebrar quem as usa, mas deixam de aparecer na tela.
- Como a mudança fica no componente compartilhado, ela vale para todos os módulos (Governança, Riscos, Planos de Ação, Contratos, Privacidade, Revisão de Acessos e Aceite de Riscos).
