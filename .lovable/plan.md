# Estabilização definitiva do DocGen

## Objetivo
Transformar o DocGen num fluxo crítico previsível: toda geração deve terminar em documento utilizável ou em erro claro e recuperável, sem perder briefing, conversa, crédito ou progresso.

## Diagnóstico confirmado
- A geração depende de várias etapas assíncronas entre frontend, Edge Function, gateway de IA e banco; o refino é encadeado pelo navegador.
- Existem conversas recentes persistidas sem documento gerado, comprovando interrupções parciais do fluxo.
- O último documento persistido teve score inicial de 14%, embora o catálogo tivesse 121 requisitos; portanto, o gate de qualidade ainda pode exigir refinos demorados e frágeis.
- Os testes atuais validam principalmente funções matemáticas puras. Não cobrem o fluxo real Galeria → Briefing → Geração → Refino → Restauração → Publicação, nem timeout, JSON truncado, falha de persistência ou isolamento entre empresas.

## Implementação

### 1. Execução durável e recuperável
- Criar um registo de execução do DocGen por empresa e utilizador, com estados explícitos: `preparing`, `generating`, `generated`, `refining`, `ready`, `failed` e `cancelled`.
- Persistir briefing, `conversation_id`, documento mais recente, score, etapa, tentativa, erro sanitizado e timestamps a cada checkpoint.
- Usar uma chave de idempotência por geração para impedir duplo clique, duplicação de documento e cobrança repetida.
- Aplicar RLS e filtros redundantes por `empresa_id`; conceder somente os acessos necessários a `authenticated` e `service_role`.

### 2. Simplificar o caminho crítico
- Fazer `generate_document` ter uma única obrigação: validar contexto, gerar um documento válido, persistir o primeiro snapshot e devolvê-lo.
- Tornar análise e auto-refino etapas posteriores, retomáveis e de melhor esforço; uma falha nelas nunca apagará nem bloqueará o documento já gerado.
- Remover dependências frágeis de objetos opcionais e validar a resposta da IA com schema antes de qualquer acesso ou persistência.
- Tratar JSON truncado/malformado, timeout, gateway indisponível e persistência falhada com códigos de erro estáveis e mensagens traduzidas.

### 3. Score honesto e determinístico
- Fixar e persistir o escopo temático antes da geração, em vez de recalculá-lo de forma variável depois que a IA responde.
- Separar claramente: qualidade do documento, aderência ao escopo escolhido e cobertura total do framework.
- Fazer geração, refino e análise independente usarem exatamente o mesmo escopo e denominador persistidos.
- Se o gate não convergir, entregar o documento como rascunho com lacunas explícitas, sem simular conformidade e sem transformar isso numa falha de geração.

### 4. Recuperação e experiência do utilizador
- Restaurar automaticamente a execução incompleta ao reabrir o DocGen, inclusive após refresh, timeout ou fecho do modal.
- Exibir progresso baseado nos estados persistidos, não numa percentagem estimada por temporizador.
- Oferecer “Tentar novamente” a partir do último checkpoint seguro e “Usar rascunho atual” quando apenas o refino falhar.
- Manter títulos reais do documento e da empresa; remover fallbacks genéricos do conteúdo final.

### 5. Observabilidade e prontidão para demonstração
- Adicionar `run_id`/correlation ID aos logs e respostas, com duração e resultado de cada etapa, sem conteúdo sensível.
- Criar uma verificação administrativa de prontidão que valide configuração, template, acesso ao banco e resposta mínima do modelo antes de uma demonstração.
- Centralizar erros no logger e mostrar ao utilizador um código de suporte pesquisável.

### 6. Testes contra regressão
- Testes de contrato da Edge Function para: sucesso, resposta truncada, schema inválido, timeout, falha de insert/update, retry idempotente e crédito esgotado.
- Testes de segurança provando que uma empresa não lê, retoma ou altera a execução de outra.
- E2E autenticado do fluxo completo: gerar direto, gerar via chat, interromper/reabrir, refinar, analisar, publicar e exportar.
- Validar no PDF/DOCX o conteúdo essencial, não apenas a existência de um Blob.
- Executar um smoke test real da função implantada e do fluxo no navegador antes de considerar a estabilização concluída.

## Critérios de aceite
- Nenhuma conversa fica sem estado final ou erro recuperável.
- Refresh/fecho durante geração permite retomar sem nova cobrança indevida.
- Documento inicial permanece disponível mesmo se análise/refino falhar.
- Retry não duplica documento nem consumo de crédito.
- O mesmo documento apresenta o mesmo escopo e denominador na geração e na análise.
- O fluxo E2E completo passa em desktop e mobile e o smoke test implantado retorna sucesso.

## Detalhes técnicos
- Migração Supabase para a execução durável, com grants, RLS, índices e idempotência por empresa.
- Refatoração incremental do `docgen-chat`; sem reescrever a experiência visual nem os exportadores fora do necessário.
- Manter `invokeEdgeFunction`, Sonner, `AkurisPulse`, i18n PT/EN e todas as regras atuais de isolamento multi-tenant.