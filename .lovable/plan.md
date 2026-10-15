# Akuris com menos cliques: mais valor por interação

Complementa o plano anterior (coleta automática, sugestões e resumo semanal). Aqui o foco é cortar passos no dia a dia.

## 1. Começar pronto
- **Onboarding em 3 perguntas:** setor, país e frameworks desejados. O Akuris monta sozinho os riscos iniciais da biblioteca, os controles, o escopo do Gap Analysis e um cronograma de 90 dias.
- **Importar o que o cliente já tem:** um arquivo solto (planilha de riscos, inventário ou política) é lido e distribuído pelos módulos certos.

## 2. Uma tela "O que fazer hoje"
- Na entrada, até 5 ações priorizadas por impacto, por exemplo "Aprovar 3 planos de ação" ou "Renovar contrato AWS em 12 dias".
- Cada ação resolve-se ali mesmo, num clique (aprovar, adiar, delegar), sem abrir o módulo.

## 3. Ações em lote e um clique
- Aprovar ou recusar várias sugestões de uma vez.
- "Aplicar a todos os semelhantes": uma evidência ou justificativa usada num requisito é proposta para os requisitos equivalentes de outros frameworks (ISO 27001, SOC 2 e LGPD).
- Respostas por e-mail: o responsável aprova ou conclui uma tarefa respondendo ao e-mail do aviso, sem entrar no sistema.

## 4. Preenchimento inteligente
- Formulários já chegam preenchidos com valores prováveis: responsável, prazo pela severidade, categoria pelo título.
- Ao criar um risco, um incidente ou um contrato, o Akuris sugere os vínculos (ativos, controles, fornecedor), que o usuário só confirma.

## 5. Entregas prontas para terceiros
- **Pacote de auditoria num clique:** evidências, SoA e relatórios de um framework, organizados por cláusula, num único arquivo.
- **Portal de confiança (Trust Center):** página pública opcional com o estado de conformidade, para responder a clientes sem preencher questionários.
- **Resposta automática a questionários de segurança** enviados por clientes, a partir do que já está no Akuris.

## Ordem sugerida
1. Tela "O que fazer hoje", com ações num clique.
2. Preenchimento inteligente e vínculos sugeridos.
3. Reaproveitamento de evidências entre frameworks e aprovações em lote.
4. Onboarding em 3 perguntas e importação de arquivos.
5. Pacote de auditoria, Trust Center e resposta a questionários.

## Detalhes técnicos
- Todas as sugestões ficam como "proposta" até alguém aprovar. Tudo com escopo `empresa_id` e avisos pelo sino.
- A IA por empresa segue a regra de créditos (`consume_ai_credit`, 402). Os conteúdos globais da plataforma não descontam créditos das empresas.
- Responder por e-mail exige um endereço de entrada e links assinados de uso único.
- Cada item terá um plano próprio antes de ser construído.
