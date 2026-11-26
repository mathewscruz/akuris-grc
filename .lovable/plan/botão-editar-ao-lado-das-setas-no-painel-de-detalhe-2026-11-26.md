# Botão Editar ao lado das setas no painel de detalhe

## O que muda
- No painel lateral de detalhe (ex.: fornecedor "Advocacia Ribeiro & Lima"), o botão **Editar** passa para a linha do título, imediatamente à esquerda das setas anterior/próximo.
- Fica no mesmo tamanho das setas (botão compacto de 32px de altura, ícone + texto "Editar"), mantendo o roxo de ação.
- A faixa separada abaixo dos indicadores de estado (onde o botão está hoje) deixa de existir, e o cabeçalho fica mais baixo.
- Como o painel é partilhado, a mudança vale para todos os módulos que o usam (fornecedores, riscos, ativos, etc.), mantendo um só visual.
- Painéis com mais de uma ação continuam a mostrar todas as ações na mesma linha, antes das setas.

## Detalhes técnicos
- Arquivo: `src/components/common/RecordDetailDrawer.tsx`.
- Renderizar `actions` dentro do bloco `flex shrink-0 gap-1` das setas (antes delas), com classes que reduzem os botões filhos a `h-8 px-3 text-sm`; remover o bloco `mt-5 border-t` atual.
- Também mostrar as ações quando não houver setas.
- Validar no preview abrindo um fornecedor em /due-diligence.
