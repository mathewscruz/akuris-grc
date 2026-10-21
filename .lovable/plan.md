# Atribuir um responsável ao framework no Gap Analysis

## Como funciona hoje (verificado)
- A coluna "Responsável" da lista de frameworks **não tem campo próprio**: ela mostra a pessoa que é responsável pelo maior número de requisitos daquele framework.
- Para aparecer alguém hoje é preciso abrir o framework, entrar num requisito e escolher o "Responsável" de cada requisito. Como a ISO 27001 ainda não tem nenhum requisito com responsável, aparece "Não atribuído".
- Não existe forma de atribuir um dono ao framework inteiro de uma vez.

## O que vamos criar
1. **Clique em "Não atribuído"** (ou no nome atual) na lista de frameworks abre um seletor de usuários da empresa, com foto e nome. Escolher grava o **responsável pelo framework**.
2. Ao escolher, uma opção marcada por padrão: "Também atribuir aos requisitos sem responsável". Assim a pessoa já fica dona dos requisitos em aberto, sem sobrescrever quem já foi atribuído.
3. A coluna passa a mostrar o responsável do framework. Se não houver, continua mostrando quem tem mais requisitos.
4. O novo responsável recebe aviso no sino e e-mail: "Você é responsável pelo framework ISO/IEC 27001".
5. Só administradores (ou quem tem permissão de edição no Gap Analysis) podem atribuir.

## Detalhes técnicos
- Nova tabela `gap_analysis_framework_owners` (empresa_id, framework_id, user_id, atribuído por), única por empresa+framework, com RLS por empresa e GRANTs; frameworks seguem globais.
- Atribuição em massa: update de `gap_analysis_evaluations.responsavel_avaliacao` só onde é nulo, filtrado por `empresa_id`; requisitos sem avaliação ganham uma linha com status pendente.
- `FrameworksComparativo`: `OwnerCell` vira gatilho de popover com `UserSelect`; `GapAnalysisFrameworks` lê o dono e usa o mais frequente como fallback.
- Aviso via `criar_notificacao` + e-mail no padrão operacional existente.
- Textos pt/en; teste da regra "não sobrescreve responsáveis já definidos".
