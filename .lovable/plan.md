# Tradução final: popups, avisos e textos residuais

Uma varredura no código encontrou cerca de 434 textos ainda fixos em português em ~240 arquivos, concentrados em diálogos (popups), mensagens de aviso (toasts), confirmações de exclusão, estados vazios ("Nenhum...") e placeholders de seleção. O objetivo desta etapa é zerar isso.

## O que será feito

Varredura completa e sistemática, módulo a módulo, trocando todo texto fixo por chaves de tradução PT/EN nos dicionários já existentes em `src/i18n/modules/`.

### Onda 1 — Riscos, Controles e Auditorias
- Wizard de risco, formulários de matriz, tratamentos, vínculo de controles, anexos, perfil completo, histórico de avaliações, drawer de detalhe.
- Diálogos de item de auditoria, importação de controles, selects de área/sistema/controle.

### Onda 2 — Documentos, DocGen e Gap Analysis
- DocGen (chat, avisos de qualidade, exportação), aprovação de documentos, lista de documentos.
- Gap Analysis: drawer de requisito, diálogo de detalhe, tabela genérica, cards de conformidade e prontidão, exportações em PDF, biblioteca de evidências, aderência.

### Onda 3 — Operacional
- Incidentes (tratamento), Continuidade, Ativos (licenças, chaves), Contas Privilegiadas, Revisão de Acessos (todos os diálogos e formulário externo), Contratos e templates, Privacidade, Relatórios.

### Onda 4 — Transversais e avisos
- Notificações (`useNotifications`, NotificationCenter), autenticação (`AuthProvider`), tooltips de ajuda, `stat-card`, estados vazios genéricos.
- Denúncias (formulário público e configurações), Due Diligence (assessment, templates), Configurações (usuários, empresas, lembretes, webhooks, teste de e-mail), Landing Page e Política de Privacidade.

### Validação final
- Script de verificação: nenhuma chave faltando, paridade 100% PT/EN, build sem erros.
- Checagem visual das telas principais alternando o idioma para EN.

## Detalhes técnicos

- Novas chaves adicionadas aos dicionários de módulo existentes; criação de novos módulos apenas onde não houver correspondente (ex.: notificações/auth).
- Esquemas Zod que usam mensagens traduzidas continuam sendo criados via `useMemo` dentro do componente, nunca em escopo de módulo.
- Textos vindos do banco (nomes de frameworks, requisitos, guidance) continuam usando as colunas `_en` e `src/lib/gap-i18n.ts` — não serão duplicados em dicionário.
- Arquivos de teste (`__tests__`) ficam fora do escopo.
- Ondas executadas em paralelo por subagentes por módulo, com validação de tipos após cada onda.
