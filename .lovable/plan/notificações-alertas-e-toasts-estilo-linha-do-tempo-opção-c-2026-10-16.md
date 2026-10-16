# Notificações, alertas e toasts: estilo "Linha do tempo" (opção C)

## O que muda para o usuário
**Sino de notificações (aba Alertas, Pendências e Novidades)**
- Sai o cartão com listras diagonais vermelhas. Entra uma linha do tempo vertical: um ponto colorido por item ligado por uma linha fina, agrupado por **Hoje / Ontem / Esta semana / Mais antigos**.
- Cada item: módulo em texto pequeno, título em negrito, 2 linhas de descrição, horário à direita ("Há 2 h") e "Abrir" como link roxo (sem botão).
- Cor do ponto pela gravidade: vermelho (crítico/urgente), âmbar (atenção), azul (informação), verde (concluído); não lidos com ponto cheio, lidos com ponto vazado.
- O resumo do topo ("52 alertas críticos por decidir") fica mais enxuto, com o número em vermelho e a seta.
- Abas com sublinhado roxo, em vez da pílula de fundo.

**Toasts (avisos no canto)**
- Pílula escura arredondada, ícone colorido do estado (sem fundo), texto claro, "X" para fechar e link de ação opcional. Igual no tema claro e escuro, para chamar atenção sem poluir.

**Alertas dentro das telas (caixas de aviso)**
- Mesma linguagem: ícone sem fundo na cor do estado, borda fina à esquerda, fundo neutro, título + texto. Sem listras e sem blocos coloridos fortes. Vale para as ~15 telas que usam essas caixas.

## Etapas
1. Redesenhar a central do sino (lista em linha do tempo, agrupamento por dia, abas sublinhadas).
2. Redesenhar o toast em pílula escura.
3. Atualizar o componente de caixa de alerta usado nas telas.
4. Remover as listras diagonais do tema.
5. Conferir em claro/escuro, celular e desktop.

## Detalhes técnicos
- `NotificationCenter.tsx`: helper `agruparPorDia(itens, agora)` (Hoje/Ontem/Semana/Antigos) com teste; `ol` com `border-l` e pontos `bg-destructive|warning|info|success`.
- `ui/sonner.tsx`: classes do toast para pílula `rounded-full bg-foreground text-background` (tokens), ícone na cor do tom.
- `ui/alert.tsx`: variantes com `border-l-2` e ícone colorido, fundo `bg-card`.
- Remover `.akuris-stripes-*` de `index.css`; atualizar memórias de Notificações.
- Teste: `agruparPorDia` com datas fixas.
