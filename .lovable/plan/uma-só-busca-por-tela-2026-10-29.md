# Uma só busca por tela

## Diagnóstico
Em Riscos, o "Buscar" no alto, ao lado das abas, e o "Buscar por nome ou ID…", junto aos filtros, alteram exatamente a mesma pesquisa. Um é cópia do outro, então não precisamos dos dois.

O mesmo acontece em mais 6 módulos:
- Governança (Controles e Auditorias)
- Planos de ação
- Privacidade (Catálogo e Solicitações)
- Contratos
- Revisão de acessos (Ativas e Histórico)
- Due diligence (Fornecedores)

## O que muda
- Remover o "Buscar" do alto em todos esses módulos.
- Manter só a busca ao lado dos filtros, que tem texto específico (ex.: "Buscar por nome ou ID…") e fica junto da lista que ela filtra.
- A busca global do cabeçalho (⌘K) continua igual.

## Detalhes técnicos
- Retirar `searchValue`/`onSearchChange` dos `TabsList` em `RiscosTabs.tsx`, `Governanca.tsx`, `PlanosAcao.tsx`, `Privacidade.tsx`, `Contratos.tsx`, `RevisaoAcessos.tsx` e `DueDiligence.tsx`.
- Retirar essas props de `TabsList`/`ModuleSubbar` (e de `Riscos.tsx` ao chamar `RiscosTabs`), para ninguém voltar a duplicar a busca.
- Atualizar a regra do `AGENTS.md` sobre `ModuleSubbar`: a busca local vive só na barra de filtros da tabela.
