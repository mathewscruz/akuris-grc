# Corrigir a landing page e detectar o país do visitante

## O problema real

A landing page aparece "desconfigurada" porque **nenhum texto está sendo traduzido**: em vez das frases, a página mostra as chaves cruas (`publico.landing.hero.titulo`, `publico.landing.nav.produto`, ...). Isso quebra todo o layout, já que as chaves são muito mais longas que os textos e estouram os blocos.

Causa confirmada: o agregador de dicionários (`src/i18n/modules/index.ts`) espalha o conteúdo de cada módulo direto na raiz. Todos os módulos por isso embrulham o conteúdo no próprio namespace (`residuos: { ... }`), mas `src/i18n/modules/publico.ts` expõe `landing`, `blog`, `demo` e `privacidade` sem o nível `publico`. Resultado: as chaves viram `landing.*` e qualquer busca por `publico.landing.*` falha e devolve a própria chave.

## Correção 1 — restaurar os textos da landing

Em `src/i18n/modules/publico.ts`, envolver o conteúdo de `pt` e de `en` em um nó `publico`, mantendo `landing`, `blog`, `demo` e `privacidade` como estão. Nenhuma mudança nos componentes: `LandingPage`, `Blog`, `BlogPost`, `PoliticaPrivacidade` e `DemoRequestDialog` já usam `publico.*`.

Depois disso o layout volta ao normal — não há problema de CSS, só de texto.

## Correção 2 — idioma pelo país de acesso

Hoje o idioma inicial vem do idioma do navegador. Passa a ser pela localização do visitante:

- Brasil, ou Portugal/PALOP com navegador em português: **português**
- Qualquer outro país: **inglês**

A detecção usa o fuso horário do dispositivo (`Intl.DateTimeFormat().resolvedOptions().timeZone`), que é instantâneo, funciona offline, não depende de serviço externo e não envia dados do usuário. Fusos brasileiros (`America/Sao_Paulo`, `America/Bahia`, `America/Manaus`, `America/Fortaleza`, `America/Recife`, `America/Belem`, `America/Cuiaba`, `America/Campo_Grande`, `America/Porto_Velho`, `America/Boa_Vista`, `America/Rio_Branco`, `America/Maceio`, `America/Araguaina`, `America/Santarem`, `America/Eirunepe`, `America/Noronha`) → `pt`. Se o fuso não for identificável, cai no idioma do navegador como hoje.

Regras preservadas:
- Escolha manual no seletor PT/EN continua tendo prioridade e é gravada em `localStorage`.
- `preferred_locale` do perfil continua mandando para usuários logados.
- A detecção por país só vale no primeiro acesso, sem preferência salva.

## Detalhes técnicos

- `src/i18n/modules/publico.ts`: aninhar sob `publico` em ambos os idiomas (mudança estrutural, sem alterar strings).
- `src/lib/i18n-locale.ts`: nova função `detectLocaleByRegion()` com a lista de fusos e fallback para `navigator.language`; usada em `readInitial()`.
- `src/contexts/LanguageContext.tsx`: `detectInitialLocale()` passa a chamar o mesmo helper, mantendo a ordem localStorage → região → fallback.
- Validação: `src/i18n/__tests__/i18n-parity.test.ts` para garantir paridade PT/EN após o aninhamento, `tsgo` para o build e uma verificação visual da landing renderizada em PT e EN.
