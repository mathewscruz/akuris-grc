Adicionar uma transição visual suave ao trocar entre as abas do drawer de risco (`RiscoDetailDrawer.tsx`).

Mudança:
- Em cada `<TabsContent>` (Visão, Tratamento, Histórico, Controles), adicionar `data-[state=active]:animate-fade-in` ao `className`.
- Isso usa o keyframe `fade-in` já existente no design system (fade + leve translateY de 10px), garantindo consistência com o restante do app.
- Não altera estrutura, dados nem o componente compartilhado `Tabs` — apenas as 4 linhas dos `TabsContent`.

Resultado: ao clicar em outra aba, o conteúdo aparece com um fade suave em vez de troca instantânea.