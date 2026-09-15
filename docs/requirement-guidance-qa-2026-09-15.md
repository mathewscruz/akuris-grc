# Orientações dos requisitos: exibição e conteúdo compartilhado

## Evidência e causa

Consulta somente de leitura no catálogo de produção, em 15/09/2026, confirmou que
`A.5.11 — Devolução de ativos` já tinha orientação de 2.377 caracteres, exemplos de
evidências e diagnóstico persistidos. O texto usa o título `Faça nesta ordem`.
`A.5.1` tinha orientação de 3.086 caracteres no formato histórico de implementação.

O extrator da seção “O que implementar” reconhecia o formato histórico, mas não
`Faça nesta ordem` nem `Do this in order`, usados pelo gerador atual. Isso escondia
as instruções do primeiro anexo, embora o conteúdo existisse no banco. Estados de
geração/falha também ficavam escondidos dentro de um painel inicialmente recolhido.

O catálogo ainda contém requisitos sem orientação, preparados sob demanda. Não foi
executado preenchimento em massa, nem reescrita de conteúdo de produção nesta rodada.

## Correções

- Extrator compartilhado reconhece títulos antigos e atuais em PT/EN, emojis,
  diferentes níveis de cabeçalho e quebras de linha Windows. Preserva o texto de
  origem e mantém a orientação integral acessível no painel detalhado.
- A primeira etapa apresenta instruções salvas sem exigir expansão do painel.
  Preparação, falha e nova tentativa ficam visíveis; a gratuidade é explicada sem badges.
- Diálogo e gaveta usam a mesma regra de completude: instruções de implementação,
  exemplos de evidências e perguntas válidas. Conteúdo parcial é completado ao abrir,
  sem descartar o material existente se o provedor estiver indisponível.
- A resposta nova do modelo precisa conter os três blocos delimitados e cinco
  perguntas válidas. Respostas truncadas, mensagens do provedor e JSON inválido não
  são persistidos como conteúdo pronto.
- A função só responde com sucesso após a escrita no catálogo compartilhado e sua
  confirmação. Ao completar lacunas, preserva instruções/evidências existentes e a
  ordem das perguntas já cadastradas, evitando alterar diagnósticos respondidos.
- A função permanece custeada pela plataforma: não consulta saldo nem chama rotinas
  de débito do cliente. Usuários autenticados podem solicitar conteúdo ausente;
  substituição forçada e processamento em lote continuam restritos ao super-admin.
- Permanecem a janela de proteção de geração no banco e a releitura periódica pelo
  cliente. Isso limita chamadas concorrentes; não constitui uma garantia de geração
  exatamente uma vez nas transições da janela de tempo.

## Verificações

- Testes do componente real: instruções atuais visíveis, conteúdo detalhado opcional,
  carregamento e erro fora do painel recolhido, nova tentativa e navegação preservada.
- Testes do hook: geração na abertura, reutilização após perder o cache do navegador,
  idioma, troca de requisito, conteúdo parcial e falha de leitura/provedor.
- Testes do handler HTTP real, com apenas Supabase e provedor simulados: persistência,
  consulta por usuários de empresas diferentes, processamento concorrente, falha de
  escrita, resposta truncada, preservação de perguntas e restrições de autenticação.
- Nenhuma geração paga, envio de dados de clientes ao modelo, mudança de saldo,
  senha, sessão ou avaliação real foi usado para validar a correção.
- TypeScript, lint dos módulos compartilhados/hook e build de produção aprovados.
  O build mantém avisos preexistentes de tamanho de alguns pacotes.
- Suíte completa: **1.091 testes em 191 arquivos aprovados**, com Node 20 e quatro
  workers, sem erros do executor. Uma rodada anterior teve timeout de comunicação
  do executor sob concorrência com o build e foi repetida integralmente; não foi
  considerada uma validação bem-sucedida apenas pelos testes individuais.

## Publicação

Backend publicado em 15/09/2026: `populate-requirement-guidance`, versão **148**,
ativo e com `verify_jwt = true`. O código baixado de produção foi comparado por
SHA-256 com `index.ts`, `guidance-service.ts`, `_shared/requirement-guidance-content.ts`
e `_shared/modelos.ts` locais; os quatro arquivos correspondem. POST sem autenticação
retornou 401 e preflight OPTIONS retornou 200. Não há migração de banco.

O frontend desta entrega inclui o helper compartilhado e as correções de navegação
documentadas em `framework-status-navigation-qa-2026-09-15.md`. Sua publicação pelo
Git/Lovable deve usar este pacote completo após as verificações de integração.
Validação conjunta final: **1.103 testes em 193 arquivos aprovados**.
Não é necessário regenerar orientações completas existentes para corrigir a exibição.
