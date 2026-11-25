# Cartões de Integrações no estilo do anexo 1

Mudança só visual no cartão compartilhado de Integrações (Configurações → Integrações). Conectar, desconectar, importação e dados exibidos continuam iguais.

## O que muda em cada cartão
- Fundo levemente tingido (cinza-azulado suave) com borda fina colorida em tom verde-azulado, cantos mais arredondados — como no anexo 1. No tema escuro, a mesma ideia com superfície elevada e borda sutil.
- Logo maior (≈56px), nome em negrito maior.
- Chip de categoria colorido (fundo suave + texto na cor do tom), em vez de cinza; cada categoria ganha um tom fixo (ex.: Nuvem, Identidade, Desenvolvimento, Comunicação, Automação).
- Estado com bolinha + texto: vermelho para falha, âmbar para revisar, verde para conectado, cinza para não conectado.
- Ícones de ação no canto superior direito: lápis (quando existir edição) e lixeira vermelha para Desconectar quando o cartão estiver conectado — substituindo o botão "Desconectar" grande.
- Rodapé em duas colunas como "Dono/Revisor": "Módulos importados" e "Última coleta", cada valor com um pequeno círculo de ícone à esquerda (como os avatares do anexo); quando vazio, aparece em âmbar ("Nenhum módulo" / "Ainda não coletado"), igual a "Sem revisor".
- Ações extras (Avisos no Teams, Adicionar computadores) ficam como links discretos abaixo do rodapé.

## Detalhes técnicos
- Editar só `IntegrationCard.tsx` (nova prop `onDisconnect` e `extra`) e os pontos que hoje passam o botão Desconectar via `extra`.
- Cores via tokens semânticos (`--success`, `--warning`, `--destructive`, `--primary`, novo tom `--teal` se necessário) e `Chip`, sem classes de cor cruas.
- Textos novos em PT/EN via `t()`.
- Desconectar mantém a confirmação/undo atual.
