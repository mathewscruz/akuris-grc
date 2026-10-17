# Configurações idênticas ao modelo escolhido

## O que muda na tela
- **Título**: ícone roxo de engrenagem + "Configurações" grande, com a busca logo abaixo (largura ~60%).
- **Cartão de progresso** em três partes:
  - à esquerda, um anel com um check verde, o título "Configuração X de Y concluída" e o texto de apoio;
  - no centro, uma barra roxa grossa com "N concluídas" e "N pendentes" abaixo;
  - à direita, a lista "Itens pendentes": cada item tem um ícone âmbar, um título, uma descrição curta e um botão roxo "Resolver".
- **Títulos de grupo** (Conta, Plataforma, Administração): ícone roxo + texto grande, em vez do rótulo pequeno em caixa alta.
- **Cartões das áreas**: grade de 4 colunas em telas largas. Cada cartão tem o ícone num quadrado roxo suave, título, descrição em duas linhas, selo com bolinha colorida (verde = ok, âmbar = pendente, roxo = plano) e seta no canto inferior direito.
- Os números e estados continuam vindo dos dados reais da empresa. Nada é inventado: áreas sem estado medido ficam sem selo.

## Detalhes técnicos
- Só `ConfiguracoesVisaoGeral.tsx` muda, e `Configuracoes.tsx` apenas no cabeçalho, se necessário.
- O anel usa SVG com tokens `success`/`primary`; a barra usa `Progress` com altura de 2,5 e `bg-primary`.
- Nas pendências, ícone `text-warning`, e `configVisao.itensDesc.*` novos em PT/EN.
- Quadrado do ícone `bg-primary/10 text-primary rounded-lg h-10 w-10` (exceção pedida pelo modelo à regra "sem aura"). O selo usa `Chip` com ponto.
- Grade `sm:grid-cols-2 xl:grid-cols-4`.
- Ícones dos grupos: pessoa, camadas, escudo.
- Verificar typecheck e a captura da tela autenticada.
