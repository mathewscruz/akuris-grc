# Finalizar tradução de cards, tabelas e popups

Auditoria concluída: os módulos de domínio já têm dicionários, mas muitos diálogos, tabelas e cards internos ainda usam texto fixo em português (rótulos de formulário, cabeçalhos de tabela, estados vazios, mensagens de validação e toasts). Três áreas não têm dicionário nenhum: Denúncias, Configurações e Empresas/Admin.

## Situação atual (o que falta, por módulo)

| Módulo | Dicionário | Textos fixos restantes |
|---|---|---|
| Configurações | não existe | ~530 (31 arquivos: usuários, empresas, integrações, webhooks, API keys, campanhas, financeiro IA) |
| Denúncias | não existe | ~151 (categorias, dialog de denúncia, configurações, relatórios, dashboard) |
| Acessos / Contas Privilegiadas | parcial | ~145 (ContaDialog, SistemaDialog, listas de usuários, formulários de revisão) |
| Due Diligence / Fornecedores | parcial | ~60 (TemplatesManager, dialogs de assessment) |
| Empresas/Admin | não existe | ~46 (GerenciamentoEmpresas: tabela, dialog, toasts) |
| Contratos | parcial | ~45 (documentos, aditivos, marcos, templates, relatórios) |
| Dados / LGPD-ROPA | parcial | ~44 (UrlScannerDialog concentra a maioria) |
| Continuidade | parcial | ~18 (TarefaDialog, TesteDialog) |
| Incidentes | parcial | ~16 (evidência, comunicação, tratamento) |
| Auditorias | parcial | ~16 |
| Controles | parcial | ~11 |
| Ativos | parcial | ~5 |
| Projetos | parcial | ~2 |
| Planos de Ação | completo | 0 |

## Ondas de execução

**Onda 1 — Módulos sem dicionário (maior impacto visível)**
- Criar `src/i18n/modules/denuncias.ts`, `configuracoes.ts` e `admin-empresas.ts`.
- Traduzir Denúncias (categorias, dialog, configurações, relatórios, dashboard) e `GerenciamentoEmpresas`.

**Onda 2 — Configurações**
- Percorrer os 29+ componentes de Configurações: abas, cards, tabelas, dialogs de integração (Azure), webhooks, API keys, campanhas de e-mail, contexto da empresa, financeiro IA.

**Onda 3 — Acessos, Due Diligence, Contratos, Dados**
- Completar as chaves faltantes nos dicionários existentes e conectar os diálogos/tabelas que ainda escapam do `t()`.

**Onda 4 — Ajustes finais**
- Continuidade, Incidentes, Auditorias, Controles, Ativos, Projetos (poucos textos cada).
- Passada final de verificação por regex para garantir que não sobrou texto PT fora de `t()` nesses arquivos.

## Detalhes técnicos

- Cada módulo ganha (ou estende) um arquivo em `src/i18n/modules/`, registrado em `src/i18n/modules/index.ts`, seguindo o padrão atual `{ pt: {...}, en: {...} }`.
- Mensagens do Zod passam a usar schemas criados dentro do componente com `t()`, como já feito nos portais públicos.
- Toasts e estados vazios entram no escopo; `console`/`logger` não.
- Textos de PDF/CSV (`generateTemplatePDF.ts`, `exportProjeto.ts`) também são traduzidos usando o idioma ativo no momento da exportação.
- Nenhuma mudança de banco, RLS ou Edge Function; o trabalho é só de apresentação.
