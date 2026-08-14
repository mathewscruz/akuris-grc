# Um só padrão de página para todos os módulos

As quatro capturas mostram quatro montagens diferentes das mesmas peças (título, KPIs, abas, ações, filtros, tabela). Os componentes partilhados já existem (`PageHeader`, `StatStrip`, `ModuleToolbar`/`ToolbarField`, `DataTable`), mas cada ecrã compõe-os por ordem própria.

## O que está diferente hoje

| Ecrã | Ordem atual | Ação primária |
|---|---|---|
| Privacidade | título → KPIs → abas → linha de botões solta → tabela | linha solta acima do cartão |
| Controles Internos | título → abas → KPIs → linha de botões solta → tabela | linha solta acima do cartão |
| Auditorias | título → abas → KPIs → barra dentro do cartão | dentro da toolbar do cartão |
| Gestão de Riscos | título (com ação) → abas de vista → chips de segmento → filtros | no cabeçalho |

Além disso, em Controles e Riscos os filtros com 3–4 campos passam para duas linhas dentro da toolbar e empurram a pesquisa para o meio do cartão (efeito visível nas imagens 2 e 4), porque a toolbar alinha tudo pela base numa linha que quebra.

## Padrão canónico

```text
PageHeader        título + descrição .......... [ ... ]  [ + Ação primária ]
Abas de módulo    (Controles | Auditorias)  — quando o módulo tem secções
StatStrip         KPIs da aba ativa, faixa horizontal
Cartão            toolbar: pesquisa à esquerda | filtros e vista à direita
                  tabela / kanban / conteúdo
```

Regras fixas:
- A ação primária vive sempre no `PageHeader`, a roxo, canto superior direito; ações secundárias sempre no menu "..." ao lado dela. Nenhum módulo mantém linha de botões solta entre os KPIs e o cartão nem botões de criação dentro da toolbar.
- As abas de módulo ficam sempre imediatamente abaixo do cabeçalho, antes dos KPIs. Os KPIs refletem a aba ativa.
- Pesquisa e filtros vivem sempre dentro do cartão, na toolbar, nunca acima dele.
- Quando existem sub-filtros em chips (Riscos: Todos / Acima do apetite / …), passam a ficar dentro do cartão, imediatamente acima da toolbar.

## Alterações

1. `src/components/ui/module-toolbar.tsx`: a área direita passa a grelha de campos de largura fixa que quebra em linhas completas, com a pesquisa alinhada ao topo (`md:items-start`), para os filtros deixarem de descer só uma parte e a pesquisa deixar de flutuar ao centro.
2. `src/pages/Privacidade.tsx`: mover "Novo Dado" (primária) e "Mapear Dado", ROPA e Solicitações (secundárias) para o `PageHeader`, com o conjunto a mudar conforme a aba ativa; abas antes do `StatStrip`; remover as linhas de botões soltas.
3. `src/components/governanca/ControlesContent.tsx`: eliminar a linha de botões solta; "Novo Controle" e o menu "..." sobem para o `PageHeader` de `Governanca.tsx` via callbacks; `StatStrip` fica logo abaixo das abas.
4. `src/components/governanca/AuditoriasContent.tsx`: tirar "Nova Auditoria", "Filtros" e "..." de dentro da toolbar; primária e secundárias para o `PageHeader`; os filtros passam a `ToolbarField` na toolbar, sem botão "Filtros".
5. `src/pages/Governanca.tsx`: passa a receber a ação primária e as secundárias da aba ativa e a renderizá-las no `PageHeader` (mesmo padrão já usado em Riscos).
6. `src/pages/Riscos.tsx`: mover a fila de chips de segmento para dentro do cartão, acima da toolbar, mantendo as abas de vista abaixo do cabeçalho.
7. Varredura nos restantes módulos de lista (Ativos, Contratos, Documentos, Incidentes, Continuidade, Due Diligence, Projetos, Planos de Ação, Revisão de Acessos, Sistemas, Contas Privilegiadas, Relatórios): aplicar a mesma ordem e mover qualquer botão de criação solto para o `PageHeader`.

## Notas técnicas

- Sem alterações de dados, consultas ou regras de negócio — só composição e apresentação.
- Nenhuma string nova em JSX: qualquer rótulo novo entra nos dicionários pt-PT, pt-BR e en.
- No fim, verificação visual com capturas dos quatro ecrãs das imagens, lado a lado, para confirmar a mesma ordem e o mesmo alinhamento.
