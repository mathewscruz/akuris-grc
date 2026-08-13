# Idioma por país (Brasil/Portugal em PT) + título da aba

## Problema

Hoje o idioma inicial é decidido em `src/lib/i18n-locale.ts` por fuso horário, com uma lista que cobre apenas fusos do Brasil — Portugal (`Europe/Lisbon`, `Atlantic/Madeira`, `Atlantic/Azores`) cai em inglês. Além disso, o idioma detectado é gravado em `localStorage` (`governaii-locale`) mesmo sem escolha do usuário: quem já abriu o site uma vez em inglês continua preso ao inglês, mesmo acessando do Brasil. Esse é o caso do acesso relatado.

## O que será feito

1. **Detecção por país mais confiável**
   - Ordem: fuso horário (Brasil + Portugal → `pt`) → idioma do navegador (`pt*` → `pt`) → inglês.
   - Incluir todos os fusos de Brasil e Portugal.

2. **Não travar mais no idioma detectado**
   - O `localStorage` passa a guardar apenas escolha **manual** do usuário (toggle de idioma) ou preferência do perfil autenticado.
   - Sem escolha manual, cada visita redetecta pelo país — corrigindo sessões já "presas" em inglês (a chave antiga é migrada/limpa uma vez).

3. **Título da aba do navegador**
   - Novo título padrão em `index.html`, alinhado à marca e a SEO.
   - Título e descrição da aba passam a acompanhar o idioma ativo na landing e páginas públicas via o componente `SEO` (Helmet) já existente: versão PT e versão EN.

## Detalhes técnicos

- `src/lib/i18n-locale.ts`: `detectLocaleByRegion()` com `BR_TIMEZONES` + `PT_TIMEZONES`, fallback `navigator.language`; `readInitial()` lê apenas a chave de escolha manual.
- `src/contexts/LanguageContext.tsx`: `detectInitialLocale()` alinhado ao mesmo critério; persistência somente em `setLocale` manual e no sync com `profiles.preferred_locale`; migração única da chave legada.
- `index.html`: `<title>` e `<meta name="description">` atualizados (mantendo og/twitter coerentes).
- Landing/páginas públicas: `SEO` recebe título/descrição vindos do dicionário (`publico.*`) para PT e EN; chaves novas adicionadas em `src/i18n/modules/publico.ts` nos dois idiomas (o teste de paridade i18n continua verde).
- Validação com Playwright simulando fusos `America/Sao_Paulo`, `Europe/Lisbon` e `America/New_York`, incluindo o caso de `localStorage` legado com `en`.

## Fora de escopo

Nenhuma tradução de conteúdo nova além das chaves de título/descrição; comportamento do toggle manual permanece igual.
