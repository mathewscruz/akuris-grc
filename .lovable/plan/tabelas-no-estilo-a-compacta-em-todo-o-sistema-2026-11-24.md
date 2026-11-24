# Tabelas no estilo "A — Compacta" em todo o sistema

Todas as tabelas do Akuris passam a ter linhas mais baixas, menos destaque visual e status discretos, como no mockup A. O que cada tabela mostra, a ordenação, os filtros e as ações continuam iguais.

## O que muda
- **Linhas mais baixas:** cerca de 36 px em vez de 48 px, com uma linha divisória fina entre elas.
- **Cabeçalho mais leve:** mais baixo, com texto pequeno em cinza.
- **Status e prioridade dentro das tabelas:** sem a etiqueta com fundo e borda. Fica só um pontinho colorido e o texto. A prioridade aparece só como texto colorido, ou como as barrinhas de severidade nos lugares que já as usam.
- **Responsável:** a foto fica menor (24 px) e o nome alinhado ao lado.
- **Linha aberta ou selecionada:** mantém o traço roxo à esquerda, que já existe.
- **Fora das tabelas:** fichas, painéis laterais e cabeçalhos continuam com as etiquetas atuais, porque ali elas ajudam a leitura.

## Onde vale
Vale para todas as tabelas que usam o componente padrão de tabela do sistema, como Planos de ação, Riscos, Controles, Ativos, Documentos, Fornecedores, Incidentes e Auditorias, além das listas de Projetos e Minhas tarefas. A opção de densidade de tabela que já existe continua funcionando, mas passa a ter o estilo compacto como padrão.

## Detalhes técnicos
- `ui/table.tsx`: TableHead `h-8 px-3`; TableCell `px-3 py-2`. O ajuste de densidade (useTableDensity) é mantido, com o modo confortável somando espaço sobre essa base.
- O Chip e o StatusBadge ganham a aparência "inline" (pontinho de 6 px + texto, sem fundo nem borda) quando estão dentro de `.akuris-table`, via `@layer components` em index.css (seletor `.akuris-table [data-chip]`). Assim nenhuma tela precisa ser editada uma a uma. O Chip passa a emitir o atributo `data-chip`, com tom e família.
- Chips da família severidade dentro de tabela: só texto colorido; o SeverityMeter continua onde já é usado.
- OwnerCell: o avatar fica com `h-6 w-6` dentro de tabela, pelo mesmo seletor de escopo.
- As cores vêm dos tokens semânticos atuais (state-*, severity-*), sem cores novas.
- Verificação: abrir Planos de ação, Riscos e Controles no navegador, nos temas claro e escuro, e conferir que nenhum status ficou ilegível nem colado ao texto.
- Registrar a regra em AGENTS.md ("dentro de tabela, chip = ponto + texto").
