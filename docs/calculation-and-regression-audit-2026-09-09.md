# Akuris — revisão de cálculos e regressões

Data: 09/09/2026. Este relatório registra a implementação e validação local. A publicação posteriormente autorizada e a homologação externa estão em `evidence-score-release-2026-09-09.md`; não houve mudança de credenciais.

## Resultado

Foram corrigidos os cinco problemas da revisão anterior e divergências adicionais em aderência, escopo, projeções, questionários, indicadores e cobrança. Aritmética consistente não significa certificação: pesos, faixas e índices operacionais são convenções do Akuris que precisam ser interpretadas dentro do escopo da empresa.

## Os cinco pontos anteriores

1. **Planos de Ação:** faltava a migração do histórico de exclusão de controles no banco local. A dependência mínima foi instalada sem executar o antigo preenchimento que poderia recriar controles históricos. A tela voltou a carregar. Exclusão, preservação das evidências/comentários, bloqueio de formulário antigo e vínculo explícito foram testados em banco isolado.
2. **Biblioteca de evidências:** erros na leitura de vínculos não viram mais contagem zero. Evidências, vínculos e sugestões são paginados; falhas têm aviso e nova tentativa. Respostas antigas não substituem a biblioteca após troca de empresa ou nova consulta.
3. **Ações sugeridas:** prioridade alta chega ao rascunho, sem ser substituída pelo padrão médio. Nenhum plano é criado automaticamente.
4. **Reutilização e impactos:** retirada a limitação silenciosa de 100 registros nas consultas de planos reutilizáveis e vínculos. Consultas relacionadas preservam os filtros de empresa e usam lotes de identificadores.
5. **Análise de evidências:** cobrança feita junto com a entrega válida, em transação. JSON inválido, veredito nulo, erro de OCR ou repetição interna não debitam novas unidades. Conclusões repetidas são idempotentes. Uma tentativa antiga não recupera a posse do processamento após reinício da janela de retentativas.

As rotinas internas de score e débito reconhecem o papel autenticado do servidor; chamadas de usuários continuam limitadas à empresa da sessão. Não foi dispensado MFA nem liberada execução de rotinas internas a usuários.

## Metodologia e correções por módulo

| Área | Regra e significado | Correção/validação |
|---|---|---|
| Riscos | P × I, ou P + I quando essa é a matriz configurada; classificação e apetite definidos pela empresa | 175 células das matrizes locais conferidas contra o cálculo do banco. Campos vazios, fracionários ou fora da escala não geram uma classificação na prévia. |
| Risco financeiro | Impacto monetário informado, não perda esperada | Removida a conversão automática da escala qualitativa de probabilidade em dinheiro. Sem frequência/probabilidade quantitativa não se inventa uma exposição financeira. |
| GAP Analysis | Soma de peso × pontos, dividida pela soma dos pesos aplicáveis; conforme 100, parcial 50, não conforme/não avaliado 0 | Mesma regra no resumo, categorias, áreas, pilares e banco. Peso legado inválido usa 1; pesos fracionários são preservados. N/A sai do numerador e do denominador. |
| Cobertura de avaliação | Avaliados aplicáveis ÷ requisitos aplicáveis | Catálogo completo separado do total aplicável; removido desconto duplo de N/A no cabeçalho e na jornada. Leituras paginadas não truncam os denominadores. |
| Portfólio de frameworks | Média simples dos scores dos frameworks ativos com requisitos aplicáveis | Mesmo critério entre dashboard e página de frameworks. Responder mais perguntas não muda o peso relativo do framework. |
| Evolução do GAP | Mesmos frameworks, cada qual contra seu último registro anterior ao corte de 30 dias | Sem base comparável, não exibe variação inventada. Retirada previsão de um framework feita a partir do delta agregado do portfólio. |
| Ganho potencial | Simulação dos requisitos selecionados passando a conforme | IDs repetidos ou fora do universo não aumentam o ganho. É ganho de aderência, não redução financeira nem probabilidade de ataque. |
| Due Diligence | Média ponderada das respostas pontuáveis, normalizada para 0–100 | Zero é resposta válida; vazio não é zero. Sem respostas mensuráveis, score final fica ausente. Checkbox compara opções inteiras, não substrings ou curingas. Respostas numéricas preservam o valor original. |
| Controles | Efetividade com o último teste dos controles pertencentes ao inventário consultado | Testes de controles excluídos ou fora do conjunto não entram na nota; sem testes não representa 0% de eficácia. |
| Continuidade | Completude do planejamento; RTO/RPO em horas, inclusive frações e zero | Banco deixa de truncar horas fracionárias. RTO não pode superar MTPD; RPO permanece uma dimensão independente. Linha vazia de processo/equipe não comprova prontidão. |
| Privacidade | Índice de organização operacional dos registros | Prazo de hoje não é tratado como vencido durante o próprio dia. O índice não mede conformidade jurídica automática. |
| Ativos / índice operacional | Cobertura de classificação do valor de negócio | Identificar um ativo crítico não reduz mais a nota como se isso demonstrasse insegurança. A descrição explica o que o indicador mede. |
| IA e documentos | Estados sugeridos pela análise; percentual calculado deterministicamente | Retirada tolerância que aceitava score da IA diferente da conta. O limiar interno de qualidade de 80 não equivale mais a resultado conforme; arredondar 99,8 para 100 não oculta lacuna conhecida. |

No histórico de riscos, o alerta sobre a carteira atual passou a usar os cadastros atuais, não o último ponto histórico. Pontos históricos não consultam registros com data futura. Não foram reescritas avaliações antigas nem inventada recomposição de históricos incompletos.

Nos questionários públicos, opções e escala 0–10 são validadas no servidor. Perguntas de arquivo exigem upload efetivamente registrado para aquele questionário. O carregamento e a conclusão leem o conjunto completo de perguntas/respostas. Na AkurIA, os resumos usam contagens paginadas e score do banco; somas de contratos sem conciliação de moeda/período foram retiradas.

### Exemplos conferidos manualmente

- Quatro conformes, dois parciais, um não conforme, um não avaliado e um N/A: `(400 + 100) / 8 = 62,5`, exibido como **63**.
- Parcial de peso 3 e conforme de peso 1: `(3 × 50 + 1 × 100) / 4 = 62,5`, também **63** no navegador e SQL.
- Excluir do escopo esse requisito conforme de peso 1 deixa **50**, não mantém pontos de um requisito excluído.
- Prévia local ISO/IEC 27001: **121 no catálogo, 118 aplicáveis, 114 avaliados, 97% de cobertura e 49% de aderência**. Jornada e cabeçalho conferidos no Akuris real.
- RTO 0,5 h e RPO 0 h são válidos; RTO 5 h com MTPD 4 h é incoerente. RPO 24 h e RTO 1 h não são, por si só, uma contradição.

## O que “padrão de mercado” significa aqui

O NIST trata avaliação de risco como suporte à decisão, não como um score universal para toda organização. A matriz e o apetite precisam refletir o contexto; esta revisão não trocou os critérios aprovados pelas empresas. Referência: [NIST SP 800-30 Rev. 1](https://csrc.nist.gov/pubs/sp/800/30/r1/final).

Tiers do CSF caracterizam o rigor da governança e da gestão de riscos. Por isso um percentual de requisitos não deve ser rotulado como Tier NIST ou maturidade formal. Os indicadores revisados usam “aderência” e “faixa de aderência”. Referência: [NIST SP 1302](https://csrc.nist.gov/pubs/sp/1302/final).

Planejamento, análise de impacto e recuperação devem ser distinguidos de recuperação demonstrada por teste. A prontidão operacional não é uma certificação de resiliência. Referência: [NIST SP 800-34 Rev. 1](https://csrc.nist.gov/pubs/sp/800/34/r1/upd1/final).

**As regras 100/50/0, faixas percentuais e pesos do índice operacional são convenções do produto, não fórmulas impostas por ISO ou NIST.** O índice operacional agrega rotinas e situações dos módulos com dados; não representa chance de ataque, perda esperada ou maturidade formal. Não foi implantado modelo FAIR, scan de nuvem ou MITRE.

## Evidências de validação

- Aplicação: **1.019 testes aprovados em 183 arquivos**. Após os últimos ajustes de escopo, mais **40 testes direcionados** passaram.
- Processamento e documentos: **41 testes Deno aprovados**, incluindo leitores, paridade gerador/analisador e proteção contra falso “conforme” por limiar ou arredondamento. O teste de PDF emite um aviso de fonte padrão, sem falha de extração.
- Typecheck aprovado; build aprovado, com avisos de pacotes grandes já existentes.
- Lint dos arquivos alterados: **zero erros**, com avisos de tipagem e dependências de hooks; não é uma base livre de avisos.
- Testes SQL transacionais: `scripts/qa/calculation-integrity.sql` e `scripts/qa/evidence-intelligence.sql`, revertidos ao final.
- Exclusão de controles: scripts `audit-control-delete-setup.sql` e `audit-control-delete-assert.sql`, executados com migrações em banco local isolado.
- Concorrência real: duas conexões PostgreSQL disputaram uma franquia de um crédito. Uma retornou sucesso, outra recusou; contador final 1 e um único lançamento. Teste realizado com fixtures em banco isolado, posteriormente removido.
- Navegador: dashboard, lista e detalhe de framework e Planos de Ação conferidos. Não foram salvas avaliações ou ações artificiais no cadastro do cliente.
- Os cancelamentos normais de consultas durante navegação/atualização local não são mais registrados como erros operacionais nos três hooks identificados.

## Limites e publicação

Ainda exige homologação ponta a ponta do provedor externo de IA/OCR com documentos reais autorizados. Os testes de leitores e matemática não demonstram precisão semântica da IA nem qualidade de OCR em toda digitalização. Não foi realizado teste de carga amplo, auditoria formal de certificação ou revisão de todos os registros legados de clientes.

Nenhuma avaliação histórica de cliente foi recalculada em massa. Scores históricos de questionários e percentuais antigos permanecem registros daquele momento; não devem ser corrigidos retrospectivamente sem rastreabilidade e decisão explícita.

Para publicação futura, verificar no destino a presença das migrações anteriores e aplicar em ordem:

1. Dependências do histórico de controles e `20260908143000`, se ainda ausentes. Não executar preenchimento histórico indiscriminado para resolver uma dependência local.
2. Migrações de evidências/revisões `20260909110000`, `20260909111000`, `20260909112000`.
3. Migrações desta revisão: `20260909150000`, `20260909151000`, `20260909152000`.
4. Publicar as funções e dependências compartilhadas: `analyze-evidence-against-requirement`, `evidence-cross-match`, `akuria-chat`, `public-assessment`, `analyze-document-adherence` e `docgen-chat`.
5. Homologar o provedor e os fluxos, então publicar o frontend. Não liberar somente a interface contra banco/funções antigos.

Esses passos não foram executados em produção nesta solicitação.
