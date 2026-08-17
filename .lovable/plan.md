# DocGen: documento limpo, compliance por conhecimento do modelo

Objetivo: o utilizador escolhe o tipo de documento e os frameworks; a IA escreve esse documento em conformidade com esses frameworks a partir do seu próprio conhecimento normativo. Sem códigos de requisito no corpo, sem confronto obrigatório com o catálogo inteiro da ferramenta, sem bloqueios por score.

## 1. Corpo do documento sem numeração de requisitos

- Deixar de inserir códigos ([A.5.15], [CC6.1]) no corpo do texto — passa a ser o comportamento único, não uma opção.
- Remover o interruptor "Exibir referências normativas no corpo do texto" do briefing.
- Manter uma secção final "Referências Normativas" em texto corrido (nomeia as normas atendidas, não lista códigos item a item).
- Anexo de rastreabilidade passa a ser opcional e só é gerado quando o utilizador pedir no chat ("gere o anexo de rastreabilidade").

## 2. Compliance vem do modelo, não do catálogo

- A geração deixa de puxar e injetar todos os requisitos dos frameworks no prompt. O prompt passa a instruir: "escreva esta política de forma que satisfaça as exigências de ISO 27001 e SOC 2 conforme o teu conhecimento das normas".
- Fim do `coverage_map` obrigatório, do cálculo de gaps residuais e do refino automático dirigido por requisitos em falta.
- Fim do gate de publicação por score (80%): o documento gerado é sempre entregável e publicável.
- O chip de score de compliance no diálogo é substituído por uma indicação simples dos frameworks contemplados. A avaliação numérica continua a existir onde faz sentido — no módulo Análise de Aderência, executada pelo utilizador quando quiser.
- Efeito colateral positivo: a chamada à IA fica muito mais curta (sem centenas de requisitos no prompt), o que reduz drasticamente truncagem de JSON e timeouts.

## 3. Refino conduzido pelo utilizador

- O chat continua a refinar o documento com o contexto do briefing e dos frameworks escolhidos.
- Sugestões rápidas no chat: aprofundar uma secção, ajustar papéis, acrescentar controlos específicos, gerar anexo de rastreabilidade.
- Cada refino devolve o documento completo atualizado, sem recálculo de cobertura.

## 4. O que mais falta para o DocGen não voltar a falhar

Já resolvido em levas anteriores: crédito idempotente com estorno, abort real por timeout, quality gate e retry em invocações separadas, erros com código estável.

Fica por fazer, e entra nesta leva:

- **Resposta mais curta e resistente a truncagem**: com o catálogo fora do prompt, pedir o documento em JSON enxuto; se ainda assim truncar, retry automático com secções em duas partes em vez de falhar.
- **Retomar execução ao reabrir**: se o utilizador fechar o separador durante a geração, ao reabrir o módulo a conversa e o documento já persistidos são restaurados sem nova cobrança.
- **Um único caminho de erro**: qualquer falha mostra mensagem traduzida com ação ("tentar de novo" reutiliza a mesma chave de idempotência).
- **Menos etapas no caminho crítico**: gerar → validar → persistir → mostrar. Quality gate passa a opcional, disparado por botão, nunca bloqueante.
- **Testes**: contrato da função (JSON truncado, falha de gravação, retry idempotente, crédito esgotado) e conteúdo (ausência de códigos no corpo, presença do cabeçalho documental e da secção de premissas).

## 5. Preservar o que já está bom

Não mexer em: estrutura editorial (Objetivo, Escopo, Definições, Responsabilidades com RACI, Diretrizes, Disposições Finais), linguagem normativa ("deve"), secção "Premissas a validar", cabeçalho de controlo documental (versões, proprietário, aprovador, classificação), papéis reais informados no briefing, exportação PDF/DOCX.

## Detalhes técnicos

- `supabase/functions/docgen-chat/index.ts`: remover `fetchFrameworkRequirements` do caminho de geração, remover coverage/score/gaps/auto-refine dirigido; prompt passa a citar apenas os nomes dos frameworks; `quality_gate` fica opcional.
- `supabase/functions/_shared/compliance-score.ts`: mantido para a Análise de Aderência; deixa de ser importado pelo DocGen.
- `src/components/documentos/DocGenBriefing.tsx`: remover o interruptor de referências inline e o contador de requisitos (`useFrameworkRequirementCount`).
- `src/components/documentos/DocGenDialog.tsx`: remover chip de score, tooltip de base de cálculo, diálogo de confirmação de publicação por score baixo e o fluxo de auto-refino por gaps; adicionar restauro de execução e botão opcional de revisão de qualidade.
- `src/lib/docgen-pdf.ts` / `docgen-docx.ts` / `docgen-render.ts`: garantir que nenhum código de requisito é impresso no corpo.
- `src/i18n/modules/docgen.ts`: novas cadeias e remoção das obsoletas em pt-PT, pt-BR e en.
