# Novos ícones em todo o Akuris: Hugeicons Stroke Rounded

## O que muda para o usuário
- Todos os ícones do sistema (menu lateral, botões, cabeçalhos, tabelas, painéis, notificações, canal de denúncia, módulos) passam para o estilo Hugeicons "Stroke Rounded": pontas e cantos arredondados, traço suave e moderno.
- Cada ícone mantém o significado atual (lupa continua lupa, escudo continua escudo etc.).
- Os ícones dos módulos GRC (Riscos, Ativos, Gap Analysis, Governança, Documentos, Incidentes, Due Diligence, Denúncias, Auditorias, Controles, Akuris IA) também passam a usar a nova família, escolhendo o símbolo Hugeicons mais representativo de cada um.
- Tamanhos e cores ficam iguais; nada muda de lugar.

## Etapas
1. Instalar Hugeicons (pacote gratuito Stroke Rounded).
2. Trocar o "motor" do componente central de ícones para Hugeicons, mantendo os mesmos nomes usados pelas telas — assim as ~350 telas que já usam o catálogo mudam de uma vez.
3. Mapear cada ícone do catálogo (ações, objetos, navegação, módulos) para o equivalente Hugeicons.
4. Migrar os ~15 arquivos que ainda importam ícones diretamente (canal de denúncia, diálogos, abas, notificações) para o catálogo.
5. Ajustar o peso do traço para o novo padrão e conferir alinhamento em tamanhos pequenos (12–16px).
6. Validar com capturas no menu, Dashboard, um painel lateral e o canal de denúncia, em claro e escuro.

## Detalhes técnicos
- `@hugeicons/react` + `@hugeicons/core-free-icons`; `Icon.tsx` passa a renderizar `HugeiconsIcon` aceitando `as`, `size`, `strokeWidth`, `className`.
- `actions.tsx`, `objects.tsx`, `modules/*`, `NavigationIcons.tsx` reexportam componentes com a mesma API (`size`, `className`, `currentColor`), sem quebrar consumidores.
- Lucide fica apenas onde bibliotecas shadcn internas exigem; arquivos que importam `lucide-react` direto passam ao catálogo.
- Atualizar `linguagem-visual.test.ts` (proíbe import direto) e a memória do sistema de ícones (stroke e família).
