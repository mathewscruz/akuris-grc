# Evidências, revisão e contexto — 09/09/2026

## Escopo autorizado

Implementação local dos itens **2, 3, 4, 6 e 7** da proposta de evolução funcional.
**Não incluídos:** item 1 (diagnóstico automático por novas integrações/scans AWS) e item 5 (reformulação do dashboard). As integrações continuam indisponíveis/“Em breve”. Não houve publicação, push, alteração de configuração de fornecedores, MFA ou autenticação em produção.

## Entregas

### 2. Análise de evidências com fontes

- O analisador do requisito lê o conteúdo de PDF, DOCX, XLSX e arquivos de texto; imagens PNG/JPEG têm caminho de OCR pelo serviço de IA existente.
- Resultados identificam página, parágrafo ou linha/planilha e reproduzem trechos conferíveis. Citações inexistentes não sustentam um parecer conclusivo.
- Diferencia política/intenção de comprovação de execução. Mostra lacunas, próximos passos e critérios para concluir, sem percentuais de confiança inventados.
- Leitura parcial, OCR ou referências inválidas resultam em análise indeterminada e revisão humana. A IA nunca grava o status de conformidade.
- Sugestões podem ser adicionadas às notas do plano como rascunho.
- Somente arquivos do Storage do projeto, nos buckets permitidos e no caminho da empresa autenticada, são baixados. Links externos não são seguidos.

### 3. Reuso e revisão

- Biblioteca: consulta de onde cada evidência está vinculada, sem disparar uma análise de IA para consultar seus vínculos.
- Sugestões de reaproveitamento usam trechos extraídos; não são aprovadas por similaridade ou por percentual.
- No requisito, “Revisar e encaminhar” permite vincular um plano existente, registrar revisão e solicitar uma exceção temporária com justificativa.
- Aprovação/rejeição de exceções exige outro administrador autorizado; há prazo, histórico e bloqueio de decisões duplicadas.
- Mudanças em requisito, avaliação, controles ou evidências vinculadas deixam a revisão sinalizada para nova conferência. Expiração é calculada a partir da validade cadastrada.
- A interface exige salvar o requisito antes de registrar decisões. Evidência vencida não pode ser recém-aceita ou usada para substituir outra prova. Vínculos históricos permanecem consultáveis.

### 4. Conexões entre módulos

Nova aba em **Planos de Ação → Conexões entre módulos**, baseada em vínculos existentes e respeitando permissões/RLS:

1. Contrato próximo do fim ou vencido, sem a última avaliação do fornecedor concluída.
2. Risco ligado a ativo que também está mapeado para dados pessoais.
3. Revogação registrada na revisão de acesso com a conta ainda ativa no cadastro.
4. Plano de continuidade sem teste aprovado recente, usando um ano como regra explícita de triagem, não como obrigação universal.

Cada apontamento informa dados de origem e sua regra. Criar ação abre um rascunho; para riscos e contratos, um plano aberto já vinculado é reaproveitado. Nenhum apontamento altera automaticamente cadastros ou comprova incidentes. As fontes levam aos módulos de origem, não a detalhes individuais em todos os casos.

### 6. AkurIA com contexto verificável

- Consultas passam pelo usuário autenticado, MFA, permissões de módulo e RLS, não por leitura irrestrita com credencial de serviço.
- Cache separado por empresa, usuário e permissões, com validade de um minuto e limite de entradas.
- Contexto inclui identificadores, títulos, rotas e instante da consulta. Falhas de leitura são apresentadas como contexto incompleto, não como contagens zeradas.
- Instruções separam fatos, limitações e sugestões, solicitam fontes e critérios de conclusão e proíbem tratar conteúdo dos cadastros como instrução.
- Mensagens recebidas aceitam apenas papéis de usuário/assistente e possuem limites de tamanho.

### 7. Confiabilidade do processamento de evidências

- Chave por empresa, conteúdo do arquivo, requisito, leitor e modelo: resultados idênticos são reutilizados por até sete dias.
- Exclusão mútua na admissão, até duas análises simultâneas por empresa, até 40 novos trabalhos/hora e limite de tentativas. Chamadas duplicadas consultam o mesmo trabalho.
- Lease com fencing por tentativa impede uma execução antiga de sobrescrever uma retomada.
- Extração possui checkpoint; nova tentativa do mesmo arquivo pode reutilizá-lo após interrupção. Não é uma fila autônoma: a retomada é solicitada pelo usuário.
- Histórico com requisito, estado e versão do leitor na biblioteca. Erros não mudam a conformidade.
- O texto integral extraído do checkpoint é descartado ao concluir. Checkpoints antigos são limpos oportunisticamente, por empresa, em novas admissões após sete dias; o resultado mantém apenas as citações e a análise. Não foi criado um cron de expurgo global.

## Validação

- Suíte da aplicação: **1.008 testes aprovados** em 181 arquivos, com saída zero na execução final com dois workers. A execução paralela irrestrita havia apresentado timeout do canal do executor mesmo com os testes aprovados.
- Leitor de evidências: **9 testes aprovados**, com arquivos gerados de PDF, DOCX, XLSX, texto, OCR simulado, ZIP excessivo/conteúdo ativo e citações fabricadas.
- Typecheck e build aprovados; verificação das três funções de IA pelo Deno aprovada.
- Lint dos arquivos de frontend alterados: nenhum erro; permanecem avisos de tipagem/hook em arquivos existentes e de testes.
- QA transacional no banco local: deduplicação, cache, lease, retomada, limites, revisão, aprovação separada, detecção de fontes alteradas, validade, integridade dos vínculos e RLS com papel autenticado. Fixtures integralmente revertidas por `ROLLBACK`.
- Interface real local: popup do requisito e aba de conexões conferidos no navegador do Akuris, sem criar avaliações ou planos fictícios persistentes.

## Limites e verificação antes de publicar

Atualização: a revisão complementar em `docs/calculation-and-regression-audit-2026-09-09.md` registra as correções posteriores, os cálculos revisados, a cobrança idempotente e a sequência de publicação atualizada.

A publicação posteriormente autorizada e a homologação com arquivos sintéticos no provedor externo estão documentadas em `evidence-score-release-2026-09-09.md`. Os limites abaixo continuam relevantes para documentos de clientes.

- **Falta validar ponta a ponta o serviço externo de IA/OCR com documentos reais autorizados.** Os testes de OCR usam um leitor simulado; isso não certifica sua qualidade em documentos digitalizados reais. A validação determinística de trechos não garante que a interpretação semântica do modelo esteja correta.
- PDF: até 40 páginas; OCR de PDF cobre no máximo duas páginas sem texto com uma imagem incorporada por página e permanece parcial. PDF complexo/digitalizado pode exigir cópia pesquisável. DOCX com desenhos/conteúdo externo permanece parcial; planilhas têm limites de abas/linhas/colunas. Até 12 MB de arquivo, 90 mil caracteres e 600 trechos.
- A aceitação de anexos de outras extensões permanece. Isso não significa que a IA consiga interpretar qualquer formato. Não foi implantado antivírus; limites de arquivo e rejeição de macros não substituem detecção de malware.
- Conversas da AkurIA agora leem contagens paginadas completas; os exemplos enviados ao modelo continuam limitados. Não há RAG completo de todos os anexos. A conferência literal obrigatória está nas análises de evidências.
- Não foi feito teste de carga ou medição comparativa de desempenho. A revisão complementar passou a cobrar uma única entrega válida da análise de evidência, na mesma transação da conclusão. Repetições internas inválidas não debitam créditos do cliente; podem continuar gerando custo no provedor externo. Cache não é promessa de latência medida.
- O histórico de revisões não é apagado por expiração de cache. Exceções não dispensam avaliação do auditor nem representam certificação.
- Para uma futura publicação autorizada, seguir a sequência atualizada de migrações e funções no relatório complementar `docs/calculation-and-regression-audit-2026-09-09.md`. Não publicar apenas o frontend com o banco/funções antigos.

## Artefatos de QA

- `scripts/qa/evidence-intelligence.sql` — apenas ambiente local com sessão de teste existente; nunca executar contra clientes reais.
- `supabase/functions/_shared/evidence-document.test.ts` — leitores e referências.
- `src/__tests__/evidence-intelligence.test.tsx` e `src/__tests__/requirement-review.test.tsx` — experiência e decisões humanas.
