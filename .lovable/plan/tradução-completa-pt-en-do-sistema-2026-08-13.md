# Tradução completa PT/EN do sistema

## Diagnóstico

A infraestrutura de i18n já existe e funciona: 41 módulos de dicionário, `useLanguage()` usado em 291 dos 465 componentes, e o dicionário de status (`text-utils.ts`) já é sensível ao idioma com 215 chaves PT e 213 EN.

O que sobrou é resíduo pontual, não um problema estrutural:

- **~148 textos visíveis ainda fixos em português** espalhados por 45 arquivos (títulos de card, rótulos de KPI, placeholders, textos de estado vazio).
- **~56 opções de filtro/select escritas direto no JSX** em 7 arquivos — é o caso da tela de Contratos que está aberta agora (19 ocorrências), onde os filtros "Todos", categorias e níveis de risco não mudam de idioma.
- **2 chaves de status sem equivalente em inglês**: `autenticacao` e `em_execucao`.
- **Páginas públicas 100% em português**: Landing Page, Política de Privacidade, Blog e o portal público de denúncia não consomem o contexto de idioma.
- **Templates com conteúdo semeado em PT** em Templates de Contrato e Templates de Due Diligence.

Os requisitos dos frameworks continuam em português no banco, conforme decidido — apenas a interface do Gap Analysis será traduzida. A ferramenta de tradução em lote em Configurações continua disponível para quando quiser rodar o conteúdo.

## Onda 1 — Filtros, status e selects do app

- Substituir todas as opções fixas de `SelectItem` por chaves traduzidas em Contratos, Tratamento de Risco, Vincular Controle, Usuário de Sistema, Wizard de Risco, Auditoria e Contrato.
- Padronizar as opções genéricas ("Todos", "Todas as categorias", "Qualquer status") num conjunto único reaproveitado por todos os módulos, para nunca mais divergirem.
- Completar as duas chaves de status faltantes em inglês.

## Onda 2 — Cards, tabelas e diálogos restantes

- Traduzir os rótulos de KPI e textos de card em Contratos, Dados/Privacidade, Licenças, Chaves, Continuidade, Denúncias e Riscos.
- Traduzir os textos residuais em Gap Analysis (Biblioteca de Evidências, Evolução do Score, Histórico, barra de ferramentas), Projetos, Documentos, Perfil de Usuário e diálogos de integração.
- Traduzir os nomes e descrições dos templates semeados em Contratos e Due Diligence.

## Onda 3 — Páginas públicas bilíngues

- Ligar Landing Page, Política de Privacidade, Blog, diálogo de Demonstração e portal público de denúncia ao contexto de idioma.
- Adicionar um seletor de idioma visível no cabeçalho público, com detecção automática pelo idioma do navegador e preferência gravada.
- Ajustar os metadados de SEO (título, descrição, `og:*`, `hreflang`) para acompanharem o idioma ativo.

## Onda 4 — Trava contra regressão

- Adicionar um teste automatizado que varre o código em busca de texto visível fixo em português e falha o build quando alguém introduzir um novo.
- Adicionar um teste de paridade que garante que toda chave existente em português tenha correspondente em inglês nos 41+ módulos de dicionário.

## Detalhes técnicos

- Novas chaves entram em módulos existentes de `src/i18n/modules/` quando o módulo já existe; strings compartilhadas (filtros genéricos, ações) vão para o módulo `campos`.
- Nenhuma alteração de schema, RLS ou Edge Function. Nenhuma query de dados é tocada — o isolamento por `empresa_id` permanece intacto.
- As páginas públicas usarão o mesmo `LanguageProvider` já montado em `App.tsx`, sem novo contexto.
- O varredor anti-regressão da Onda 4 roda junto com a suíte de testes atual (`vitest`), com lista de exceções para termos de marca e siglas.
