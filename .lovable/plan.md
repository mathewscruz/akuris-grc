# DocGen: estabilidade + qualidade auditável

Premissa: a estrutura, profundidade técnica e mapeamento normativo já alcançados devem ser preservados. Nada aqui pode simplificar o documento gerado.

## Parte A — Qualidade auditável (Leva 1, prioridade máxima)

### A1. Linguagem normativa, nunca afirmação de estado atual
- Reescrever as instruções de geração e refino para separar declaração normativa ("deve ser", "exige aprovação") de descrição de estado atual ("bloqueia", "não possuem").
- Afirmação sobre o que já existe na empresa só é permitida quando o utilizador informou no briefing ou quando vem do contexto real da organização já disponível no sistema.
- A IA passa a devolver, junto com o documento, a lista de premissas assumidas: controlo assumido, secção onde aparece e origem (briefing, contexto do sistema ou suposição).
- Marcar no preview cada trecho baseado em suposição, com aviso para confirmar a existência do controlo antes de publicar.
- Acrescentar ao final do documento a secção "Premissas a validar", com cada controlo assumido, responsável e prazo a definir. Essa secção acompanha o documento no preview e nas exportações PDF/DOCX.

### A2. Elementos de controlo documental (ISO 27001, cláusula 7.5)
- Adicionar cabeçalho estruturado ao documento gerado: tabela de controlo de versões (versão, data, autor, descrição da alteração), proprietário do documento, aprovador formal com data de aprovação, periodicidade de revisão, classificação da informação, referências normativas e data da próxima revisão.
- Tornar esses campos preenchíveis no briefing, como campos opcionais adicionais.
- Quando não preenchidos, renderizar sempre o marcador visível "[A DEFINIR]" — nunca omitir o campo.
- Refletir o mesmo cabeçalho no preview e nos exportadores.

### A3. Papéis reais em vez de papéis inventados
- Novo campo no briefing para listar os cargos/papéis que existem na organização.
- Restringir a matriz RACI e o corpo do texto a esses papéis.
- Sem informação do utilizador, usar termos genéricos ("Responsável pela Segurança da Informação", "Gestor da Área") e sinalizar no documento que precisam de mapeamento para cargos reais.

### A4. Todos os frameworks selecionados chegam à geração
- Hoje a geração reduz a seleção a um único framework, o que explica documento com referências ISO e nenhuma referência SOC 2.
- Passar todos os frameworks escolhidos para o prompt, com os requisitos de cada um identificados pela sua origem.
- Exigir no contrato de saída que o mapeamento cite explicitamente critérios de cada framework selecionado (por exemplo, controlos do Anexo A da ISO e Common Criteria do SOC 2).
- Validar a resposta: se um framework selecionado ficar sem nenhuma referência, o refino direcionado passa a cobri-lo antes de entregar o documento.
- O score volta a considerar cada framework separadamente, evitando que a soma dos catálogos afunde o resultado.

## Parte B — Transparência e leitura (Leva 2)

### B5. Score com base de cálculo explícita
- Mostrar a composição do score: requisitos cobertos sobre requisitos no âmbito, discriminado por framework.
- Adicionar "ver requisitos não cobertos", listando o que ficou de fora com ligação para o requisito no Gap Analysis.

### B6. Referências normativas inline opcionais
- Novo interruptor "Exibir referências normativas no corpo do texto", ligado por defeito.
- Desligado: texto limpo e mapeamento requisito-a-secção movido para um anexo de rastreabilidade no fim do documento.
- O anexo acompanha preview, PDF e DOCX.

### B7. Recomendações técnicas atualizadas
- Remover orientações superadas, como rotação periódica obrigatória de senha sem indício de comprometimento.
- Orientar o modelo para controlos compensatórios atuais: MFA, deteção de credencial vazada, monitorização de uso anómalo, cofre de segredos.

### B8. Pendências anteriores
- Histórico de conversas: nomear pelo modelo escolhido e data, por exemplo "Política de Controle de Acesso — 16/08/2026", em vez do título repetido por framework.
- Corrigir "mensagems" para "mensagens".
- Adaptar o diálogo de descarte ao estado real: briefing em preenchimento, conversa sem documento, ou documento gerado não salvo.

## Parte C — Estabilidade do fluxo (mantida do plano anterior)

- Execução durável por empresa e utilizador, com estados explícitos e checkpoints persistidos (briefing, conversa, documento, score, etapa, erro).
- Idempotência por geração, para que duplo clique ou nova tentativa não dupliquem documento nem consumo de crédito.
- Caminho crítico simples: gerar, validar por schema, persistir e devolver. Análise e refino tornam-se etapas posteriores e retomáveis; falha nelas nunca apaga o documento já gerado.
- Restauro automático de execução incompleta ao reabrir o módulo, inclusive após atualização da página ou tempo limite.
- Erros com códigos estáveis e mensagens traduzidas, distinguindo crédito, falha do modelo e falha de gravação.

## Testes e validação

- Testes de contrato da função para: múltiplos frameworks no prompt, resposta truncada, schema inválido, falha de persistência, retry idempotente e crédito esgotado.
- Testes de conteúdo: ausência de afirmações de estado atual sem origem no briefing, presença do cabeçalho documental, presença da secção de premissas e presença de referências de cada framework selecionado.
- Testes de isolamento entre empresas.
- E2E autenticado do fluxo completo: gerar direto, refinar, alternar o interruptor de referências, exportar e publicar.
- Roteiro de aceitação: gerar a mesma Política de Controle de Acesso com ISO 27001 e SOC 2 e conferir linguagem normativa, premissas a validar, cabeçalho documental, critérios SOC 2 presentes, base de cálculo do score, texto limpo com anexo de rastreabilidade e títulos distintos no histórico.

## Detalhes técnicos

- `supabase/functions/docgen-chat/index.ts`: deixar de truncar a lista de frameworks, contrato de saída com premissas e metadados documentais, refino direcionado por framework em falta.
- `supabase/functions/_shared/compliance-score.ts`: âmbito e score por framework, com composição exposta na resposta.
- `src/components/documentos/DocGenBriefing.tsx`: campos de controlo documental, papéis existentes e interruptor de referências inline.
- `src/components/documentos/DocGenDialog.tsx` e exportadores PDF/DOCX: cabeçalho documental, marcação de premissas, anexo de rastreabilidade, detalhe do score, títulos do histórico e mensagens de descarte.
- `src/i18n/modules/docgen.ts`: todas as novas cadeias em pt-PT, pt-BR e en.
- Migração Supabase apenas para a execução durável da Parte C, com grants, RLS e isolamento por empresa.
