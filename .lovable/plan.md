# Novo carregamento: "A" desenhado em traço

## O que você vai ver
- Em qualquer carregamento do sistema (entre páginas, blocos e botões), o contorno do "A" da Akuris é desenhado em linha roxa. Depois ele se preenche suavemente, esvazia e recomeça, em um ciclo de cerca de 1,8 s.
- Um brilho leve percorre a linha enquanto ela é desenhada, sem os anéis pulsantes de hoje.
- Em tamanhos pequenos (dentro de botões, até cerca de 20 px), só o traço gira em volta do "A" para continuar legível.
- Quem ativa "reduzir movimento" no aparelho vê o "A" preenchido com uma pulsação leve de opacidade.
- Na troca de página, o conteúdo novo aparece com um fade curto.

## Detalhes técnicos
- Reescrever o interior de `AkurisPulse` mantendo o mesmo nome, as mesmas props e `role="status"`. Assim as 144 telas que já o usam mudam sozinhas, sem edições espalhadas.
- A animação usa `stroke-dasharray`/`stroke-dashoffset` sobre `AKURIS_PATH` com `pathLength=1`, e o preenchimento usa `fill-opacity`. Os keyframes novos (`akuris-draw`, `akuris-fill`) vão no CSS global, e os antigos de anel saem.
- A cor vem do token `--primary`, sem hex fixo.
- Usar `@media (prefers-reduced-motion)` para a versão estática.
- Variante compacta automática quando `size <= 20`.
- Verificar visualmente com Playwright em 80 px e 16 px. Atualizar a memória "AkurisPulse Loader" com o novo visual.
