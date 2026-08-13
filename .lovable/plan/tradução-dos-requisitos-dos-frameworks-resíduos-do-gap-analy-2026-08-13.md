# Tradução dos requisitos dos frameworks + resíduos do Gap Analysis

Hoje o conteúdo dos frameworks (título, descrição, categoria e os textos de orientação) está gravado no banco somente em português. Trocar o idioma da interface não muda esse conteúdo, porque ele é dado, não texto de tela. Além disso, algumas telas do Gap Analysis ainda têm texto fixo em português.

## O que será feito

### 1. Estrutura para conteúdo bilíngue
Cada requisito passa a ter uma versão em inglês guardada ao lado da versão em português. O sistema escolhe automaticamente qual mostrar conforme o idioma selecionado, e se a versão em inglês ainda não existir, exibe a portuguesa (nunca fica em branco).

Campos que ganham versão em inglês:
- Requisito: título, descrição, categoria, orientação de implementação, exemplos de evidências, perguntas de diagnóstico
- Framework: nome e descrição

### 2. SOC 2 Type II e ISO/IEC 27001 traduzidos
- SOC 2 Type II (63 requisitos) e ISO/IEC 27001:2022 (121 requisitos) recebem título, descrição e categoria em inglês usando a redação oficial dos padrões (Trust Services Criteria e Anexo A), não uma tradução literal do português.
- Os textos longos de orientação/evidências/perguntas existem em poucos requisitos (18 no ISO, 1 no SOC 2) e também serão traduzidos.
- As categorias (ex.: "Security - Governança" → "Security - Governance") passam a aparecer em inglês nas abas e nos agrupamentos.

### 3. Ferramenta para traduzir os demais frameworks depois
Uma função de tradução assistida por IA (super-admin, em Configurações) permite traduzir os outros 22 frameworks sob demanda, gravando o resultado nos campos em inglês. Assim não é preciso um novo desenvolvimento a cada framework.

### 4. Resíduos de tradução dentro do Gap Analysis
Telas com texto fixo em português que serão internacionalizadas:
- Detalhe do requisito (maior concentração: rótulos, mensagens de erro, avisos de créditos de IA)
- Tabela de requisitos (filtros, cabeçalhos, agrupamento "Outros")
- Aba de remediação, aba de SoA, biblioteca de evidências, gaveta de requisito
- Hero de maturidade, fila de prioridades, gráfico de evolução, trilha de auditoria
- Exportações PDF (board, framework, SoA) passam a sair no idioma ativo

## Detalhes técnicos

- Migração adicionando colunas `*_en` em `gap_analysis_requirements` (titulo, descricao, categoria, orientacao_implementacao, exemplos_evidencias, perguntas_diagnostico) e em `gap_analysis_frameworks` (nome, descricao). Sem alteração de RLS/grants (tabelas já existentes, templates globais com `empresa_id IS NULL`).
- Helper `src/lib/gap-i18n.ts` com `localizeRequirement(req)` / `localizeFramework(fw)` usando `getAppLocale()`, com fallback para PT. Aplicado nos pontos de exibição: `GenericRequirementsTable`, `RequirementDrawer`, `RequirementDetailDialog`, `SoATabV2`, `RemediationTabV2`, `PriorityQueueCard`, `CommandPalette`, `AIRecommendationsCard`, `DocumentsHero`, `GapAnalysisFrameworkDetail`, `GapAnalysisFrameworks` e os exportadores PDF.
- Migrações de conteúdo em lotes por `codigo` + `framework_id` (SOC 2 e ISO 27001), idempotentes via `UPDATE ... WHERE codigo = ...`.
- Novo dicionário `src/i18n/modules/gap-analysis-ui.ts` para os resíduos de tela, registrado em `src/i18n/modules/index.ts`.
- Edge Function `translate-framework-content` (verify_jwt, restrita a super-admin, consumo de crédito via `consume_ai_credit`, tratamento de 402) para traduzir os frameworks restantes sob demanda.
- Scoring, filtros e cálculos continuam usando os campos originais em português como chave — apenas a exibição muda, então nenhum score ou status é afetado.

## Ordem de execução
1. Migração de colunas `_en` + helper de exibição + aplicação nos componentes.
2. Conteúdo em inglês do SOC 2 Type II.
3. Conteúdo em inglês do ISO/IEC 27001:2022.
4. Resíduos de tradução das telas do Gap Analysis.
5. Função de tradução assistida para os demais frameworks.
