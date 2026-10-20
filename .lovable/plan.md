# Novas sugestões de simplificação visual

Sugestões diferentes das anteriores (indicadores, cartões do dashboard e cabeçalhos ficam como estão). Escolha quais quer aplicar.

1. **Menos variações de botão**
   Hoje há vários estilos (sólido, contorno, fantasma, suave, link, novos variantes). Proposta: só três — principal (roxo, uma por tela), secundário (contorno) e discreto (texto).
   Por quê: o usuário encontra a ação principal sem pensar.

2. **Formulários em uma coluna**
   Os formulários dos módulos misturam duas e três colunas. Proposta: uma coluna com campos opcionais recolhidos em "Mais detalhes".
   Por quê: leitura de cima para baixo, menos erros e funciona igual no celular.

3. **Menos bordas, mais espaço**
   Muitas áreas têm borda + fundo + divisória ao mesmo tempo. Proposta: separar blocos só por espaçamento e um tom de fundo; bordas apenas em cartões clicáveis.
   Por quê: a tela fica mais leve e o que é clicável fica óbvio.

4. **Hierarquia de texto com 4 tamanhos**
   Existem muitos tamanhos e pesos de fonte. Proposta: título, subtítulo, corpo e legenda — nada além disso.
   Por quê: consistência imediata entre módulos.

5. **Painel lateral com menos abas**
   O painel de detalhe tem abas Detalhes/Ligações/Atividade. Proposta: uma rolagem única com âncoras no topo.
   Por quê: tudo visível sem cliques escondidos.

6. **Ícones só onde ajudam**
   Ícones aparecem em títulos, colunas, linhas e botões ao mesmo tempo. Proposta: manter em navegação e ações; retirar de títulos de seção e células de tabela.
   Por quê: reduz ruído visual e destaca o conteúdo.

## Detalhes técnicos
- 1: reduzir variantes em `button.tsx`, mapear as antigas para as três novas.
- 2: padrão de formulário compartilhado com seção recolhível.
- 3–4: tokens em `index.css`/`tailwind.config.ts` e CSS global; atualizar regra de linguagem visual na memória.
- 5: `RecordDetailDrawer` passa de abas para seções com âncoras.
- 6: ajustes em `PageHeader`, `DataTable` e cabeçalhos de seção.
- Rodar a suíte de testes ao final.
