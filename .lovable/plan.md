Vou corrigir o problema na origem, não apenas aumentando margens.

O problema real está no componente compartilhado `TabsList`: ele sempre renderiza um wrapper externo com `w-full` e `border-b`. As classes de margem aplicadas no `TabsList` atual ficam no elemento interno, mas o wrapper externo continua ocupando 100% da largura do drawer. Por isso a linha/área ativa de “Controles” visualmente continua indo até o limite direito da tela/container.

Plano de correção:

1. Ajustar o bloco de abas em `RiscoDetailDrawer.tsx`
   - Criar um container próprio para a área das abas com padding horizontal real (`px-6`, ou equivalente) e borda inferior.
   - Fazer a lista de abas ocupar apenas a largura interna desse container, sem encostar na lateral direita.
   - Remover a tentativa atual com `mx-6 mr-10`, que não resolve a causa raiz e gera comportamento inconsistente.

2. Manter todos os rótulos completos
   - Garantir que “Tratamento” não seja abreviado/truncado.
   - Garantir que “Controles” apareça inteiro e com respiro visual na borda direita.
   - Se necessário, reduzir levemente fonte/gap/padding das abas para caberem bem nos 540px do drawer sem corte.

3. Preservar o restante do drawer
   - Não alterar as consultas, dados, permissões ou regras de negócio.
   - Manter o footer com quebra de linha já ajustada.
   - Manter a identidade visual Akuris e os ícones com `strokeWidth={1.5}`.

Resultado esperado:
- A aba “Controles” não ficará mais colada no limite direito.
- A linha ativa roxa ficará contida dentro da área útil do drawer.
- Os textos das abas ficarão completos e visualmente equilibrados.