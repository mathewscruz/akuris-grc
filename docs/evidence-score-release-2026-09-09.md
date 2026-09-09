# Publicação — evidências e integridade dos cálculos

## Escopo

Publicação autorizada após a revisão dos cálculos e dos cinco defeitos identificados. Inclui os itens funcionais 2, 3, 4, 6 e 7; não habilita integrações, coleta AWS ou reformulação do dashboard.

## Preparação e backend

- Origem `main` sincronizada, sem divergência antes da publicação; versão anterior `2cc189a7a392e87f02ef2e95cf1deb876615b9dc`.
- Cópia local privada do schema anterior, sem dados de clientes. Nenhuma credencial, fixture de autenticação ou ferramenta temporária entra no Git.
- Histórico de exclusão de controles já presente no destino; não foi executado preenchimento histórico antigo.
- Aplicadas somente as seis migrações previstas: `20260909110000`, `20260909111000`, `20260909112000`, `20260909150000`, `20260909151000` e `20260909152000`.
- Publicadas as funções `analyze-evidence-against-requirement`, `evidence-cross-match`, `akuria-chat`, `public-assessment`, `analyze-document-adherence` e `docgen-chat`, com suas dependências compartilhadas. Os seis endpoints responderam ao preflight.
- Conferidos RLS nas tabelas novas, execução das rotinas internas restrita ao servidor e tipo numérico para RTO/RPO. O agendamento das integrações permanece inativo.

## Homologação do provedor externo

Executada pela sessão autenticada existente, com dois arquivos sintéticos criados exclusivamente para o teste. Não foram enviados documentos de clientes nem gravadas avaliações, evidências aceitas ou planos fictícios.

1. Texto: leitura completa, três citações literais com número de linha, identificação de política/intenção e ausência de comprovação de execução. Uma única cobrança.
2. Imagem PNG: OCR efetivo do provedor, duas citações transcritas e classificação conservadora como indeterminada, com aviso para conferir o original. OCR e interpretação consumiram, juntos, uma única unidade.
3. Repetição do texto: mesmo trabalho, mesma tentativa e uma única cobrança total; resultado reutilizado pelo cache.
4. O rascunho foi descartado. A avaliação original permaneceu parcial e sem anexos de teste.

Esse teste confirma a comunicação com o provedor e o fluxo dos dois formatos, não a precisão semântica em todos os documentos ou digitalizações. Os limites de leitura e a revisão humana obrigatória continuam válidos.

## Validação automatizada

Resultados completos em `calculation-and-regression-audit-2026-09-09.md`: 1.019 testes da aplicação, 41 testes de processamento, 175 células de matrizes, testes SQL transacionais, concorrência, tipos e build aprovados.

## Interface e encerramento

- Interface publicada pelo Lovable, operação `c5c22bfc-e5bb-4b68-9685-e5a2a90544e7`, fonte `66f3656e539077a7714ab8977c394f0ffe2d3447`. O painel confirmou “Seu site foi atualizado” no domínio `https://akuris.pt`. O domínio serviu `/assets/index-5EgTi9MU.js` e a sessão autenticada exibiu a nova faixa de aderência, cobertura aplicável e a seção de revisão/reaproveitamento.
- O CI do GitHub dessa fonte concluiu com sucesso (execução `34366255224`).
- Os dois objetos sintéticos foram removidos pela API de Storage após conferência SHA-256. Os dois trabalhos de teste foram removidos; os dois créditos foram estornados sem apagar os respectivos lançamentos nem restaurar um contador antigo sobre consumos concorrentes. Consulta posterior confirmou zero arquivos/trabalhos de teste e dois lançamentos estornados. Arquivos originais de teste permanecem apenas no diretório temporário local ignorado pelo Git.
- Nenhuma avaliação foi salva durante a homologação; o requisito original permaneceu parcial e sem anexos de teste. Não foram modificadas sessões MFA, senhas ou contas.
- A verificação pós-publicação encontrou uma resposta HTTP incorreta no cruzamento de evidências: acesso sem sessão era bloqueado, mas respondia 500 em vez de 401. Corrigido o tratamento de erros de autenticação e republicada a função; quatro testes HTTP no destino passaram, incluindo JWT inválido. Os demais endpoints autenticados conferidos recusaram acesso anônimo com 401.
- O endpoint de novas integrações permanece em 503/`integrations_coming_soon`, e a tarefa de coleta segue inativa.

Em caso de retorno, usar a versão anterior da interface e das funções; preservar tabelas aditivas e registros reais já criados, sem apagar histórico de clientes. O ajuste pontual de resposta de autenticação e este registro de encerramento são sincronizados em commit complementar, sem alteração adicional da interface.
