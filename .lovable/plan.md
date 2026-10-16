# Menu lateral: parar o "pisca" de tamanho no iPad

## Causa
O menu escolhe entre 3 tamanhos de ícone (confortável, compacto, denso) medindo a altura disponível. Só que cada tamanho também muda o espaço interno do próprio menu (margem de cima e de baixo). Quando a altura do iPad fica bem no limite entre dois tamanhos, a troca muda a medida, que pede a troca de volta, sem parar. A barra do Safari que aparece e some no iPad agrava, porque altera a altura o tempo todo.

## Correção
1. Medir só o espaço útil: descontar o espaço interno real, para que a escolha do tamanho não altere a própria medida.
2. Margem de tolerância: só sobe de tamanho com folga de alguns pixels acima do limite e só desce abaixo dele, evitando ir e voltar no limite.
3. Ignorar variações pequenas de altura (menos de 8px), como a barra do Safari aparecendo.
4. Manter a adaptação ao girar a tela e redimensionar a janela.

## Validação
Simular iPad (vários tamanhos, retrato e paisagem) e alturas exatamente no limite, confirmando que o tamanho fica estável após 2 segundos; teste automático da regra de tolerância.

## Detalhes técnicos
- `useAutoFit` em `src/hooks/useSidebarFit.tsx`: altura = `clientHeight - paddingTop - paddingBottom`; função pura `escolherDensidade(per, atual)` com histerese (±4px nos limites 64/54); guardar última altura e ignorar deltas < 8px.
- Teste em `src/__tests__/sidebar-fit.test.ts` para a histerese.
