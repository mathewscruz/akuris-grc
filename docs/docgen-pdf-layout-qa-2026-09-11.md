# DocGen: revisão da exportação PDF

## Escopo

Melhoria do exportador PDF a partir do documento estruturado já gerado pelo DocGen.
Não altera o texto normativo, prompts, créditos, permissões, banco de dados nem a exportação DOCX.
Não publica em produção automaticamente.

## Problemas reproduzidos

- Títulos extensos ultrapassavam a área do cabeçalho.
- Toda seção começava em uma página nova, mesmo quando havia espaço disponível.
- Numeração automática podia se sobrepor à numeração existente no Markdown.
- Listas não tinham recuo suspenso e URLs/identificadores longos excediam a largura.
- Tabelas não reservavam margens superior/inferior para cabeçalho e rodapé.
- Números de um sumário com várias páginas eram desenhados somente na primeira página.
- Evidências na matriz de cobertura eram truncadas em 240 caracteres.
- Logotipos eram deformados para uma proporção fixa de 2:1; imagens corrompidas podiam impedir o download.

## Implementação

- Capa com hierarquia alinhada à esquerda, detalhes discretos na cor do Akuris,
  metadados em painel próprio e título integral com tamanho adaptável.
- Texto principal de 10,5 pt, entrelinha de 1,55, margens constantes e cabeçalho/rodapé
  em colunas independentes. Rótulos repetidos longos abreviam; os valores integrais
  permanecem na capa e nos metadados do PDF.
- Fluxo contínuo entre seções, títulos junto do início do conteúdo e controle de linhas
  isoladas nas quebras de parágrafo. Apenas títulos iniciais realmente repetidos são omitidos.
- Numerações existentes são preservadas. Listas usam recuo suspenso.
- Sumário multipágina com números reais, links internos e marcadores de navegação.
- Tabelas com cabeçalhos repetidos, espaçamento legível e linhas mantidas juntas quando
  cabem na página. Linhas maiores que uma página continuam sem truncar o conteúdo.
- Evidências completas, inclusive além de 240 caracteres; colunas adicionais preservadas.
- Logo proporcional com limites de tamanho e fallback não bloqueante para falhas.
- Sem novas dependências, chamadas de IA ou serviços externos obrigatórios.

## Verificações

- 41 testes relacionados: parser (14), exportadores (5), fixture real (9), layout PDF (8),
  descrição do diálogo (2), fidelidade da exportação (3).
- Os testes de layout abrem os bytes reais com PDF.js: verificam coordenadas, conteúdo,
  títulos, acentos, referências, 48 destinos do sumário, 90 linhas de tabela, evidência
  maior que uma página, colunas extras e falha de imagem.
- TypeScript, lint dos arquivos alterados e build de produção aprovados.
- Amostra de 11 páginas gerada pelo próprio exportador com a fixture já existente do
  projeto; todas as páginas renderizadas e inspecionadas. Capa com o título extenso do
  caso reportado também conferida em um teste visual separado.
- Build mantém o aviso já existente de chunks acima de 500 kB.

## Entrega e limites

A amostra está em `output/pdf/docgen-amostra-exportacao.pdf`, ignorada pelo Git para
não versionar documentos de clientes. É uma amostra de diagramação baseada na fixture
de controle de acesso, não uma revisão jurídica da política anexada pelo usuário.

Esta revisão é somente frontend. Para disponibilizar aos usuários, publicar a versão
do frontend pelo fluxo habitual; não há migração nem Edge Function a publicar.
Arquivos PDF já baixados não mudam: é necessário exportá-los novamente no DocGen.
