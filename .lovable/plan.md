# Células das tabelas iguais ao mockup A, em todos os módulos

As colunas de cada módulo continuam as mesmas. Muda só o visual de cada célula, para ficar como no mockup.

## Por que ainda está diferente
O padrão geral já está aplicado, mas cada módulo desenha as próprias células por cima dele:
- texto miúdo (12px ou menos) e em negrito médio, em vez de 14px normal;
- severidade/prioridade num selo com caixa e letra, em vez de só a palavra colorida;
- status de Riscos com setinha e contorno, em vez de bolinha + texto cinza;
- foto do responsável em 32px e nome pequeno, em vez de 28px e nome em 14px;
- fundo da tabela num cartão, em vez de direto no fundo da página.

## O que vou fazer
1. **Regra única dentro das tabelas** que neutraliza esses tamanhos e pesos próprios: texto principal 14px normal, textos secundários (categoria, datas, "atualizado", SLA) 13px cinza, códigos/IDs 12px cinza discreto.
2. **Severidade e prioridade** em todas as tabelas: só a palavra colorida (Crítica/Alta vermelho, Média âmbar, Baixa verde), sem caixa nem letra.
3. **Status** (incluindo o menu de mudança rápida de Riscos): bolinha + texto cinza, sem contorno; a setinha só aparece ao passar o mouse.
4. **Responsável**: foto 28px e nome 14px na mesma linha, também no estado "não atribuído".
5. **Fundo**: tabela sem cartão, direto no fundo, com divisórias finas e cabeçalho cinza suave.
6. **Conferir módulo a módulo** (Riscos, Controles, Planos de Ação, Incidentes, Ativos, Documentos, Fornecedores, Auditorias, Denúncias, Privacidade, Continuidade, Projetos) com a tela logada, lado a lado com o mockup.

## Detalhes técnicos
- `src/index.css` (`.akuris-table`): sobrescrever dentro de `td` as utilidades `text-xs`, `text-micro`, `font-medium`, `text-foreground/85`; `[data-chip-family="severity"]` sem borda/fundo/letra; tabela `bg-transparent`.
- `StatusBadge`/resolver de severidade: garantir `family="severity"` e marcar a letra com `data-chip-meter` para ocultar na tabela.
- `RiscoStatusControls.tsx`: chevron com `opacity-0 group-hover:opacity-100`.
- `owner-cell.tsx`: avatar `h-7 w-7`, nome `text-sm font-normal`.
- Verificação com Playwright logado (skill browser-testing) em 1280px, claro e escuro.
