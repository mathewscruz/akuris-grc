# Mostrar quem alterou o status no e-mail

## Diagnóstico (verificado)
- O e-mail da captura veio do **teste que fiz** ontem/hoje direto no banco, sem nenhum usuário logado — por isso não havia nome e apareceu "Alguém".
- Quando um usuário muda o status pelo Akuris (Lista, Kanban, janela da tarefa), a mudança já leva a identidade dele, e o e-mail usa o nome do perfil.
- O único caminho real sem pessoa é a **automação de projeto** ("mover para coluna"), que também cairia em "Alguém".

## O que muda
- Mudança feita por usuário: "**Mathews Cruz** alterou o status de "A Fazer" para "Concluído"." (nome em destaque), e um campo "Alterado por" no quadro da atividade.
- Mudança feita por automação: "**Uma automação do projeto** alterou o status…", com "Alterado por: Automação".
- Usuário sem nome no perfil: usa o e-mail dele em vez de "Alguém".
- O texto "Alguém" deixa de existir. O mesmo vale para o e-mail de atribuição ("Mathews Cruz atribuiu a você…").
- O aviso no sino passa a mostrar também o nome de quem alterou.

## Validação
- Mudar o status de uma tarefa de teste pelo app com sessão real e conferir o nome no aviso do sino e no retorno do envio; repetir via automação.
- Teste da regra que escolhe o texto de autoria (usuário com nome, só e-mail, automação).

## Detalhes técnicos
- `send-projeto-tarefa-notification`: função pura `autoria(perfil|null)` em `regras.ts`; buscar `nome, email` do ator; campo extra "Alterado por"; mensagem do sino inclui autor.
- `projeto-automacao-executor` passa `origem: 'automacao'` não é possível pelo gatilho; o gatilho envia `ator_id` nulo e a função interpreta nulo como automação/sistema.
