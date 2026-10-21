# Janela da tarefa: textos sem cortes e responsável com foto

## O que muda
- **Status no topo**: o botão de status deixa de cortar o texto ("Em andamen…") e mostra o nome completo.
- **Prioridade**: a bandeira e o texto ("Média") passam a ficar na mesma linha, em vez de a bandeira aparecer em cima.
- **Rótulos à esquerda**: "Data de conclusão", "Estimativa (h)" e afins ficam numa só linha; a coluna de rótulos fica um pouco mais larga e o texto não quebra.
- **Etiquetas**: o "+" fica ao lado das etiquetas existentes, sem saltar para outra linha quando há espaço.
- **Responsável**: mostra a foto do usuário (ou as iniciais, se ele não tiver foto) seguida do nome completo, sem cortar. A lista para escolher também mostra foto, nome e e-mail.
- **Subtarefas**: o avatar das subtarefas passa a usar a mesma foto.

## Detalhes técnicos
- `UserSelect` (componente partilhado): buscar também `foto_url` do perfil (já filtrado por empresa) e usar `Avatar`/`AvatarImage`/`AvatarFallback` no gatilho e nos itens, no lugar do ícone de pessoa. Melhora o campo em todos os módulos que o usam, sem mudança de dados.
- `TarefaDialog`: `SelectTrigger` de status e prioridade com `whitespace-nowrap` e sem `truncate` no pill; o conteúdo da prioridade em `inline-flex`; `Prop` com coluna de rótulo 136px e `whitespace-nowrap`; aside ligeiramente mais largo (340px); avatar das subtarefas com `foto_url` de `useUsuariosEmpresa` (adicionar o campo se faltar, mantendo o filtro por empresa).
- Verificação: abrir a janela de uma atividade do Projeto ISO 27001 por Playwright e conferir que nenhum texto aparece cortado ou quebrado.
