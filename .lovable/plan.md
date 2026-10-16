# Ajustes após o novo agrupamento do menu

## O que foi conferido (nada quebrou)
- **Endereços das páginas:** não mudaram. Links salvos, avisos do sino, e-mails e atalhos continuam abrindo a página certa.
- **Caminho no cabeçalho:** é montado a partir do endereço da página, não do menu. Continua correto, por exemplo "Governança › Controles".
- **Busca (Cmd+K):** lê os módulos de dentro dos grupos, então todos continuam aparecendo.
- **Permissões:** continuam sendo checadas por módulo, também dentro dos grupos.
- **Teste automático de navegação:** passou.

## O que fica desalinhado com o menu novo (proposta)
1. **Caminho no cabeçalho sem o grupo:** quem abre Incidentes pelo menu "Riscos" vê só "Incidentes" no topo. Proposta: mostrar o grupo como primeiro passo, sem link, porque o grupo não tem página própria. Exemplo: "Riscos › Incidentes › INC-012". Vale para Execução, Riscos, Conformidade, Ativos, Acessos e Terceiros.
2. **Celular, menu "Mais" da barra de baixo:** hoje é uma lista solta, numa ordem antiga. Proposta: separar pelos mesmos grupos do menu lateral (Execução, Riscos, Conformidade…), na mesma ordem.
3. **Busca (Cmd+K):** os módulos aparecem numa lista única. Proposta: mostrar o nome do grupo ao lado de cada módulo (ex.: "Contratos · Terceiros"), para o usuário aprender onde ele fica no menu.

## Detalhes técnicos
- Criar `getModuleGroup(url, t)` em `navigation.ts`, derivado de `getMenuSections`, como única fonte de verdade.
- `useBreadcrumb`: inserir no início o rótulo do grupo, sem `path` clicável; `Layout` passa a renderizar `BreadcrumbPage` para itens sem link.
- `MobileBottomNav`: gerar a lista "Mais" a partir de `getMenuSections`, mantendo o filtro por `moduleName`.
- `CommandPalette`: subtítulo com o grupo.
- Teste: cada rota do menu resolve para o grupo esperado (ex.: `/incidentes` → Riscos, `/contratos` → Terceiros, `/documentos` → Conformidade).
