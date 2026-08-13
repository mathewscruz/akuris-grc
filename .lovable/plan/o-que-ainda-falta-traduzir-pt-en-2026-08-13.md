# O que ainda falta traduzir (PT/EN)

Já concluído (Onda 1): Riscos (páginas e maior parte dos componentes), Documentos + DocGen, Gap Analysis, Planos de Ação e Minhas Pendências.

## Ainda pendente

### 1. Módulos GRC sem nenhuma tradução
- Projetos (`Projetos`, `ProjetoDetalhe`, `ProjetoTemplates` + 17 componentes)
- Due Diligence (15 componentes)
- Controles (11), Contratos (9), Auditorias (9), Ativos (7)
- Revisão de Acessos (6), Incidentes (4), Continuidade (4), Contas Privilegiadas (2)
- Dados/LGPD (8), Governança (3), Relatórios (2)

### 2. Configurações
`Configuracoes.tsx` e 26 componentes de configuração (perfis, permissões, empresa, integrações, changelog).

### 3. Áreas públicas / não autenticadas
- Landing Page, Blog, BlogPost, FrameworkSEO, Política de Privacidade, Planos de Assinatura
- Canal de Denúncias público (menu, formulário, consulta, landing, redirects)
- Assessment de fornecedor (`Assessment.tsx`) e Review Externa

### 4. Resíduos dos módulos já tratados
- 15 componentes de Riscos e 8 de Gap Analysis ainda sem `useLanguage`
- 3 componentes de Dashboard

### 5. Fora do React (opcional, decidir depois)
- Textos de e-mails nas Edge Functions (boas-vindas, reset de senha, due diligence, denúncias)
- Rótulos em exportações PDF/CSV dos módulos ainda não traduzidos

## Ordem sugerida
1. Onda 2 — Módulos GRC internos (Projetos, Due Diligence, Controles, Contratos, Auditorias, Ativos)
2. Onda 3 — Módulos menores + resíduos de Riscos/Gap/Dashboard
3. Onda 4 — Configurações
4. Onda 5 — Landing, Blog, SEO e páginas públicas (Denúncias, Assessment, Review Externa)
5. Onda 6 (opcional) — E-mails e exportações

## Notas técnicas
- Mesmo padrão atual: um dicionário por módulo em `src/i18n/modules/`, registrado em `modules/index.ts`, consumido via `useLanguage()` + `t()`.
- Valores PT idênticos às strings atuais; datas/números via `src/lib/i18n-format.ts`.
- Nenhuma alteração em queries, filtros `empresa_id` ou lógica de negócio.
- Páginas públicas precisam respeitar o idioma detectado sem sessão autenticada.
- Cada onda finaliza com `tsgo --noEmit` e a suíte de testes dos módulos tocados.
