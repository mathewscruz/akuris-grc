# Tabela de Riscos (e demais) idêntica ao mockup A

Comparando o print com o mockup A, quatro coisas ainda fogem do padrão. Todas vêm do padrão comum das tabelas, então a correção vale para todos os módulos de uma vez, sem mexer nas colunas de cada um.

## O que muda
1. **Caixa de seleção deformada** — a caixinha da primeira coluna aparece como um oval roxo alto. Volta a ser um quadrado pequeno (14 px), com borda cinza suave; fica roxa só quando marcada.
2. **Linha com duas linhas de texto** — o título vem com um ícone de alerta na frente e a descrição embaixo, o que dobra a altura da linha. No mockup é só o título numa linha. O ícone sai e a descrição deixa de aparecer na tabela (continua visível ao parar o mouse no título e no painel do registro). As linhas voltam à altura do mockup.
3. **Textos quebrando em duas linhas** — "Segurança da Informação" e nomes longos passam a ficar numa linha só, cortados com "…" quando não cabem, com o texto completo ao parar o mouse.
4. **Bolinha do status sem cor** — hoje todas saem cinza-escuro. Passam a seguir o mockup: verde para em andamento/em tratamento, verde-azulado para concluído/tratado, cinza para não iniciado/rascunho, âmbar para atenção/em revisão e vermelho para atrasado/bloqueado. O texto do status continua cinza suave.

Severidade/prioridade (só a palavra colorida), responsável, datas e o botão "…" já estão como no mockup e não mudam.

## Detalhes técnicos
- `src/index.css`: a regra `.akuris-table td > button { height: 24px }` estica o `Checkbox` (Radix renderiza `<button role="checkbox">`). Excluir `[role="checkbox"]` dessa regra e adicionar estilo da caixa dentro de `.akuris-table` (14 px, `border-border`, checked em primary).
- `data-table.tsx` (célula principal, ~linhas 770-781): remover o ícone `emptyState.icon` e a linha `descricao`; usar `descricao` como `title` do título. A versão de cartão/mobile (linha ~601) fica como está.
- `.akuris-table td`: `white-space: nowrap` com `truncate` nas células de texto (exceto a célula de ações e anéis medidos); `max-width` na célula principal.
- Cores do ponto: mapear `primary`/`info` para `active` em `STATE_FROM_TONE` (status-badge.tsx) e, dentro de `.akuris-table`, usar tokens mais vivos para `--table-state-dot` (active = verde, done = verde-azulado, attention = âmbar, blocked = destructive, rest = cinza), em claro e escuro. Fora das tabelas o anel continua discreto.
- Conferir com o mesmo script Playwright das tabelas (claro/escuro, 1280/768/390): altura da linha ≈ 46 px, caixa 14×14, uma linha por célula, cores dos pontos distintas; rodar os testes das tabelas e de Riscos.
