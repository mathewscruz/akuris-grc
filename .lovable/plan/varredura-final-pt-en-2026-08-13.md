# Varredura final PT → EN

Uma varredura no código mostra que os textos visíveis no JSX já estão praticamente todos traduzidos, mas ainda restam **cerca de 300 textos fixos em português dentro de strings** (mensagens de toast, validações, placeholders, rótulos de opções e títulos de diálogo) espalhados por ~140 arquivos. Esses aparecem em português mesmo com o sistema em inglês.

## Onde estão as falhas

Arquivos com maior concentração:

- Configurações: gestão de usuários, empresas, lembretes, campanhas de e-mail, integrações
- Documentos: DocGen, aprovações, comentários, categorias, vinculações
- Due Diligence: templates, assessment, formulário público
- Denúncias: formulário, categorias, configurações, menu público
- Riscos: wizard de risco, configuração da matriz
- Gap Analysis: tabela de requisitos, biblioteca de evidências, exportações PDF/SoA
- Contratos, Ativos, Privacidade, Revisão de Acessos, Projetos
- Relatórios e PDFs gerados (cabeçalhos, rótulos de colunas)

Além do código, dois pontos fora do JSX:

1. **Conteúdo vindo do banco** (categorias, status personalizados, nomes de campos livres) — depende do dicionário `STATUS_LABELS`/`STATUS_LABELS_EN` e das colunas `_en`.
2. **E-mails enviados pelas Edge Functions** — hoje sempre em português.

## O que será feito

1. **Inventário automatizado**: script de varredura que lista toda string em português restante nas telas, para garantir que nada fique de fora e servir de base para a checagem final.
2. **Tradução por lote**, seguindo a estrutura já existente em `src/i18n/modules/` — novas chaves nos módulos correspondentes (ou um módulo `residuos-2`), sempre em par PT/EN.
3. **Substituição no código**: cada string fixa passa a usar `t('chave')`. Em arquivos sem acesso ao hook (utilitários, geradores de PDF, schemas Zod), aplico o padrão já adotado no projeto: helpers de `i18n-global`/`i18n-format` ou fábricas que recebem `t`.
4. **Rótulos derivados do banco**: completar `STATUS_LABELS_EN` com os valores ainda sem tradução (tipos, categorias, criticidades, status de módulos).
5. **E-mails**: os modelos das Edge Functions passam a escolher PT ou EN conforme o `preferred_locale` do destinatário, com PT como padrão.
6. **Guardas de regressão**: manter o teste de paridade PT/EN e adicionar uma verificação que falha se voltarem strings em português fixas nas telas.
7. **Validação visual**: navegar pelas telas principais com o idioma em inglês e conferir que não sobrou português.

## Detalhes técnicos

- Nenhuma mudança de regra de negócio; apenas apresentação e dicionários.
- Novas chaves entram em `src/i18n/modules/*.ts` respeitando o formato `{ pt: {...}, en: {...} }` e o teste `i18n-parity.test.ts`.
- PDFs/CSV passam a receber o locale ativo via `getAppLocale()`.
- Nas Edge Functions, a seleção de idioma é feita por um mapa de textos simples (`pt`/`en`), sem novas dependências.

## Escopo em ondas

Pelo volume (~300 pontos), a execução será em ondas por área de módulo, cada uma verificada antes da próxima, para não quebrar o que já funciona.
