# Simplificação do Akuris: funcionalidade + visual

## Funcionalidade

1. **Uma só lista de pendências pessoais**
   "Minhas tarefas" vira uma aba "Atribuídas a mim" dentro de Planos de Ação; o link antigo continua funcionando.
   Por quê: o usuário passa a ter um único lugar para ver o que precisa fazer.

2. **Uma só rota para Planos de Ação**
   Hoje existem dois endereços (/planos e /planos-acao). Fica um oficial; o outro redireciona.
   Por quê: links compartilhados e atalhos deixam de divergir.

3. **Canal de denúncia com menos telas públicas**
   Uma página com duas opções: "Fazer denúncia" e "Consultar protocolo". Links antigos redirecionam.
   Por quê: o denunciante só precisa dessas duas ações.

## Visual

4. **Menos variações de botão** — só principal (roxo, uma por tela), secundário (contorno) e discreto (texto).
5. **Menos bordas, mais espaço** — blocos separados por espaçamento e tom de fundo; borda só em cartões clicáveis.
6. **Hierarquia de texto com 4 tamanhos** — título, subtítulo, corpo e legenda.

## Fora do escopo
- Sem mudanças em permissões, isolamento por empresa ou dados.
- Favoritos e links antigos continuam funcionando.

## Detalhes técnicos
- 1: `MinhasTarefas` passa a ser filtro `responsavel = usuário` em `PlanosAcao`; `/projetos/minhas-tarefas` redireciona.
- 2: manter `/planos-acao`; `/planos` vira `<Navigate replace>`.
- 3: unificar `DenunciaMenu`/`DenunciaPublicLanding`/`DenunciaRouter` numa página; RPCs públicas inalteradas.
- 4: reduzir variantes em `button.tsx`, mapeando as antigas para as três novas.
- 5–6: tokens em `index.css`/`tailwind.config.ts` e CSS global; atualizar regra de linguagem visual na memória.
- Registrar no roadmap e rodar a suíte de testes ao final.
