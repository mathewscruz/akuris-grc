# Menu de estado da tarefa: pílulas soltas e animadas

## O que muda (popup da tarefa, seletor de estado no topo)
- **Sem caixa atrás:** o menu deixa de ter fundo, borda e sombra. Aparecem só as pílulas de estado (A Fazer, Em Andamento, Em Revisão, Concluído), empilhadas logo abaixo do botão.
- **Sem destaque de linha:** a faixa cinza ao passar o mouse desaparece. A própria pílula reage: fica um pouco maior e ganha um contorno roxo leve. O ✓ do estado atual continua ao lado da pílula.
- **Animação ao abrir:** as pílulas descem e aparecem em cascata, uma após a outra, com um intervalo curto.
- **Animação ao fechar:** as pílulas sobem e desaparecem juntas, de forma rápida.
- **Acessibilidade:** quem preferir menos movimento no sistema vê o menu sem animação. Teclado e leitores de tela continuam funcionando como hoje.
- Só este seletor muda. Os demais menus do sistema continuam com a caixa padrão.

## Detalhes técnicos
- `TarefaDialog.tsx`, linha do `SelectContent` de estado:
  - `className="border-0 bg-transparent shadow-none p-0"`;
  - itens com `focus:bg-transparent` e `data-[highlighted]:bg-transparent`, mais `group` para estilizar a pílula (`group-data-[highlighted]:ring-2 ring-primary/30 scale-[1.03]`);
  - `transition-ui`.
- Cascata: classe `animate-in fade-in slide-in-from-top-1` com `style={{ animationDelay: i*40ms, animationFillMode: 'both' }}` em cada item. A saída usa a animação `data-[state=closed]` já existente no conteúdo (fade + slide).
- Respeita `motion-reduce:animate-none`.
