# Internacionalização (EN) — o que falta e como completar

## Situação atual

O sistema tem infraestrutura de idioma pronta (`LanguageProvider`, dicionários `pt`/`en`, coluna `profiles.preferred_locale`, seletor PT/EN no header), mas a tradução cobre só uma parte da aplicação.

Coberto hoje: login/registro, MFA, dashboard, sidebar, notificações, perfil do usuário, trial, changelog, command palette, páginas de erro e alguns componentes de UI (~1.060 chaves em cada dicionário, sem divergência de namespaces entre PT e EN).

Não coberto (texto fixo em português no código):

- 22 páginas: Configurações, Gap Analysis (lista e detalhe), Projetos e detalhe, Templates de projeto, Minhas Tarefas, Planos de Assinatura, Assessment público, Landing Page, Blog e post, Política de Privacidade, Review Externa, Aceite de Riscos, FrameworkSEO e todo o fluxo de Denúncia (menu, formulário, consulta, landing pública).
- Praticamente todos os módulos em `src/components`: riscos (25 arquivos), configurações (27), documentos/DocGen (20), projetos (17), due diligence (15), gap analysis (15), controles (11), auditorias (9), contratos (9), dados, ativos, incidentes, continuidade, denúncia, revisão de acessos, relatórios, contas privilegiadas — nenhum usa `useLanguage`.
- Todos os templates de e-mail (boas-vindas, redefinição de senha, MFA, lembretes de convite, due diligence, teste) são fixos em português; as Edge Functions não recebem nem consultam o idioma do destinatário.
- Conteúdo gerado por IA (DocGen, diagnósticos de Gap Analysis, sugestões de risco, AkurIA) e os PDFs/CSV exportados são sempre em português — apenas `akuria-chat` menciona locale hoje.

## Como vamos entregar

Ordem definida: módulos mais usados primeiro. Cada onda entrega páginas + componentes do módulo com dicionário PT/EN espelhado e revisão visual.

### Onda 1 — Núcleo operacional
Riscos, Documentos/DocGen (UI), Gap Analysis (lista, detalhe, drawer de requisito), Planos de Ação, Minhas Tarefas.

### Onda 2 — Governança e administração
Configurações (27 componentes), Controles, Auditorias, Contratos, Relatórios, Projetos e templates.

### Onda 3 — Demais módulos
Ativos, Dados/Privacidade, Incidentes, Continuidade, Due Diligence interno, Revisão de Acessos, Contas Privilegiadas, Denúncia (interno), Planos de Assinatura.

### Onda 4 — Superfícies públicas
Landing Page, Blog, Política de Privacidade, FrameworkSEO, Assessment público, Review Externa, Aceite de Riscos, portal público de Denúncia. Inclui `lang` no HTML e metadados SEO por idioma.

### Onda 5 — E-mails
Passar o idioma do destinatário (`profiles.preferred_locale`, ou o idioma da empresa/link para destinatários externos) para as Edge Functions e criar as versões EN de todos os templates, com fallback para PT.

### Onda 6 — Conteúdo de IA e exportações
Enviar o locale para as funções de IA (DocGen, gap-analysis-ai-diagnostic, suggest-risk-treatment, ai-module-assistant, akuria-chat) e instruir o modelo a responder no idioma do usuário; traduzir rótulos fixos de PDFs e CSVs.

## Detalhes técnicos

- Padrão único: `const { t } = useLanguage()` + chaves em `src/i18n/pt.ts` e `src/i18n/en.ts`, um namespace por módulo (ex.: `riscos.*`, `documentos.*`).
- Textos dinâmicos vindos do banco (nomes de frameworks, requisitos, dados do cliente) permanecem como estão — este plano não traduz dados, só a interface, e-mails e saída de IA.
- Datas, números e moeda passam a usar `src/lib/i18n-format.ts` nas telas tocadas.
- Emails: acrescentar parâmetro `locale` nas funções de envio e um dicionário compartilhado em `supabase/functions/_shared/email-templates/`.
- IA: incluir o locale no prompt de sistema, mantendo as regras já existentes de sanitização e consumo de créditos.
- Verificação por onda: navegar as telas nos dois idiomas e conferir que nenhuma chave aparece crua (ex.: `riscos.titulo`) e que os testes existentes continuam passando.

## Fora do escopo

Tradução do catálogo de frameworks e requisitos do Gap Analysis no banco de dados, e idiomas além de PT/EN.
