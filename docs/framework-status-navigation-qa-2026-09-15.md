# Framework: preservar a posição ao atualizar requisitos

## Causa

Uma mudança de status incrementava `scoreRefreshKey`. O hook de indicadores
voltava ao estado vazio/com carregamento; a página substituía todo o workspace
por um skeleton. A tabela era desmontada e perdia a ordenação/seleção/diálogo.
Além disso, seu efeito de filtros redefinia a página para 1 até na montagem,
ignorando a página recuperada da URL. A própria tabela e o painel de prioridades
também substituíam seu conteúdo por carregamento a cada atualização.

## Ajustes

- Indicadores diferenciam carga inicial de atualização em segundo plano e mantêm
  os últimos valores enquanto a leitura atual termina. Erros de atualização são
  sinalizados sem desmontar o workspace nem apresentar zeros artificiais.
- Exportações ficam indisponíveis durante a atualização ou enquanto houver erro
  de leitura do score. A fórmula de cálculo não foi alterada.
- O cache visual dos indicadores e prioridades é separado por empresa/framework.
  Uma troca de contexto não exibe valores anteriores; respostas atrasadas são ignoradas.
- A tabela mantém linhas, controles, filtros, ordenação, seleção e diálogo montados
  durante a atualização. O painel de prioridades mantém sua lista e expansão,
  sem encolher provisoriamente e deslocar a tabela abaixo.
- A página inicial fornecida pela URL é preservada. Somente mudanças reais de
  filtros reiniciam a paginação. Se o último item sai de um filtro após alteração
  de status, a paginação é limitada à página válida mais próxima, usando a seção ativa.
- A sincronização da URL evita navegações redundantes e solicita preservação de rolagem.
- O status salvo dentro do diálogo atualiza a linha e os indicadores sem fechar
  o requisito. Salvar/fechar o diálogo também recarrega os dados sem desmontar a tabela.

## Validação

- 12 testes novos: score em segundo plano, falha de leitura, troca de empresa,
  resposta atrasada de outro framework, erro inicial, tabelas com/sem seções na
  página 3, diálogo aberto, falha de gravação, última página filtrada, pesquisa
  alterada intencionalmente e painel de prioridades expandido durante a atualização.
- Os testes de componente confirmam a identidade dos elementos da tabela/linha/lista,
  não apenas a presença do texto após uma nova montagem. Não simulam a geometria
  completa de um navegador nem alterações em dados reais de produção.
- TypeScript, lint dos novos testes/hook e build aprovados. Avisos de tamanho dos
  pacotes do frontend são preexistentes.
- Suíte completa, incluindo os ajustes pendentes das orientações: **1.103 testes
  em 193 arquivos aprovados**, sem erros do executor (Node 20, quatro workers).

## Entrega

Este ajuste é de frontend, sem migração nem função de banco nova, e integra o
mesmo pacote de publicação das orientações de requisitos. O backend das orientações
já foi publicado e verificado em 15/09/2026 (versão 148); a interface deve ser
publicada pelo Git/Lovable após as verificações de integração deste pacote.
A edição preexistente do documento de auditoria de cálculos não faz parte da entrega.
