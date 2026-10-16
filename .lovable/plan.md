# Menu lateral mais enxuto (16 → 10 itens)

## Hoje
Dashboard, Planos de Ação, Projetos, Riscos, Governança, Gap Analysis, Ativos, Contratos, Documentos, Privacidade, Acessos, Incidentes, Terceiros, Continuidade, Relatórios, Configurações — 16 itens, o que aperta os ícones e encosta no "Sair".

## Proposta de agrupamento
| Item no menu | Abre o painel com |
|---|---|
| Dashboard | — |
| **Execução** | Planos de Ação, Projetos |
| **Riscos** | Gestão de Riscos, Incidentes, Continuidade |
| **Conformidade** | Gap Analysis, Governança (controles e auditorias), Documentos |
| Ativos | Ativos, Licenças, Chaves (como hoje) |
| Acessos | Sistemas, Contas privilegiadas, Revisão de acessos (como hoje) |
| **Terceiros** | Due Diligence, Contratos, Denúncias |
| Privacidade | — |
| Relatórios | — |
| Configurações | — |

Lógica: o que o usuário faz (execução), o que pode dar errado (riscos e resposta), o que precisa provar (conformidade) e quem está fora da empresa (terceiros).

## Limite de 85%
- Os ícones passam a ocupar no máximo 85% da altura do menu; o restante fica livre acima do "Sair", que continua separado.
- O espaço entre os ícones continua igual e se adapta à tela e à rotação.

## Mantido
- Endereços das páginas, permissões por módulo e planos não mudam: um grupo só aparece se o usuário tiver acesso a ao menos uma das opções dentro dele, e só mostra as opções permitidas.
- Busca (Cmd+K) e atalhos continuam levando direto a cada página.
- Nomes em PT e EN com frase curta em cada opção.

## Detalhes técnicos
- `navigation.ts`: novos grupos com `subItems`, `shortTitle` e `description` (chaves `sidebar.*` PT/EN); filtragem por `moduleName` já aplicada por subitem.
- `AppSidebar.tsx`: `ul` com `maxHeight: 85%` do `SidebarContent` (desktop/tablet) mantendo `justify-between`; recalcular densidade com o novo número de itens.
- Conferir que o grupo ativo marca corretamente as rotas filhas (ex.: `/governanca/controles` destaca "Conformidade").
