# Gap Analysis: limpeza e unificação

## O que encontrei
- **Dois editores de requisito:** a página cheia e uma janela antiga em 4 etapas, aberta por "Mais opções". Esse botão está quebrado: fecha a página e não abre nada.
- **A busca rápida (⌘K) dentro do framework** usa o mesmo caminho quebrado. Além disso, existem dois atalhos ⌘K competindo.
- **Escopo e aplicabilidade** tem 5 entradas: boas-vindas, dois botões lado a lado na barra lateral, menu "…" e dentro da própria tela. Mesmo assim, não aparece nas etapas principais.
- **"Gerar documento"** aparece em 5 lugares. Os chips de "documentos faltando" dizem um tema, mas todos abrem o mesmo gerador genérico.
- **Exportações** (PDF técnico, relatório executivo, pacote de auditoria) estão escondidas atrás de um "…" sem nome.
- **"Aplicar à avaliação"** aparece duas vezes no resultado da análise. "Ver detalhes" repete o clique na linha.
- **Uma janela de "marco"** existe na tela, mas nenhum botão a abre.

## O que vou mudar
1. **Um só lugar para o requisito:** a página cheia. Ela ganha as seções que hoje só existem na janela antiga: anexar evidência ou link, reaproveitar evidência, revisão ou exceção e plano de ação. A janela antiga e o "Mais opções" saem.
2. **A busca do framework abre direto a página do requisito.** Fica um único atalho ⌘K, e os requisitos do framework aparecem como um grupo nessa busca.
3. **Escopo vira a 4ª etapa visível:** Escopo → Diagnosticar → Adequar → Comprovar. O assistente de perguntas fica dentro dela. Saem os botões duplicados da barra lateral e do menu "…".
4. **Botão "Exportar" visível** no topo, com PDF técnico, relatório executivo, pacote de auditoria, declaração de aplicabilidade e evolução. O "…" fica só com tarefas secundárias: criar tarefa e rever o tour.
5. **Gerar documento:** fica no topo de "Comprovar" e no requisito. Os chips de tema passam o tema escolhido para o gerador; se não houver tema, o chip sai. Sai a entrada do menu "…".
6. **Uma única "Adicionar evidência"** com as opções enviar arquivo, ligar documento existente, colar link e analisar documento.
7. **Pequenas limpezas:**
   - "Aplicar à avaliação" aparece uma vez só.
   - Sai "Ver detalhes" repetido.
   - A janela de marco sem acesso é removida.
   - Rótulos ficam claros: "Documentos e evidências" para o framework e "Evidências do requisito" para o requisito.

## Detalhes técnicos
- Arquivos afetados:
  - `GapAnalysisFrameworkDetail.tsx`: abas, topo, menu "…", remoção do marco e de `abrirRequisitoCompleto`.
  - `FrameworkTopo.tsx`: etapa Escopo.
  - `RequirementDrawer.tsx`: novas seções, reaproveitando `EvidenceReusePanel`, `RequirementReviewPanel` e o plano de ação; remoção do `?req=`.
  - `GenericRequirementsTable.tsx`: desmontar `RequirementDetailDialog`.
  - `CommandPalette.tsx`: deixa de registrar atalho e passa a fornecer um grupo para a busca global de `Layout`.
  - `DocumentsHero.tsx`: tema nos chips.
  - `AdherenceResultView.tsx` e `AdherenceAssessmentView.tsx`.
- O link antigo `?req=` continua funcionando como redirecionamento para a rota da página, para não quebrar links já enviados nem planos de ação.
- Atualizar a regra do AGENTS.md sobre `RequirementDetailDialog` e rodar os testes de gap e de visual.
