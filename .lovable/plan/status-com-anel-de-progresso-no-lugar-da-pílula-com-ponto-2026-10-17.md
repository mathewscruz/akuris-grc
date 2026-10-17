# Status com anel de progresso no lugar da pílula com ponto

## O que você vai ver
- Os status de estado ("3 usuários", "2 conectadas", "Ativo", "Em andamento", "Concluído", "Vencido") deixam de ser pílulas com fundo e pontinho. Passam a ser **texto com um mini anel de 12 px** à esquerda, sem caixa em volta.
- O anel mostra o significado do status:
  - **Em repouso / neutro:** anel cinza vazado, só o contorno.
  - **Ativo / em andamento:** anel com um quarto preenchido, girando devagar.
  - **Atenção:** anel pela metade em âmbar.
  - **Concluído / conectado:** anel completo em teal.
  - **Bloqueado / vencido:** anel completo em vermelho, com um corte pequeno.
- Quando existe proporção real (por exemplo "2 de 3 conectadas"), o anel enche na proporção exata, com uma animação curta ao aparecer.
- A gravidade de risco (crítico, alto, médio, baixo) continua com o medidor atual, para não misturar gravidade com estado.
- Quem ativa "reduzir movimento" no aparelho vê o anel parado.

## Detalhes técnicos
- Alterar apenas `src/components/ui/chip.tsx`, família `state` e tom `neutral`:
  - Sai o fundo e a borda da pílula.
  - O ponto é substituído por um SVG `<circle>` com `stroke-dasharray`, usando `pathLength=100`.
  - Nova prop opcional `progress?: number` (0–1), com o valor medido e nunca inferido. Sem ela, vale o preenchimento padrão de cada nível.
- `StatusBadge` já envolve o `Chip`, então todos os módulos mudam juntos.
- Os locais que mostram contagens com total conhecido (Integrações "conectadas", usuários) passam `progress`.
- Cores vêm dos tokens `state-*` e `destructive` já existentes, sem hex fixo.
- Atualizar o teste visual que verifica `bg-*-surface` nos chips e a memória "Chips" para refletir o anel.
