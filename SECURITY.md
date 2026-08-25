# Segurança e desenvolvimento seguro no Akuris

Este documento é o padrão de DevSecOps do Akuris: o que o pipeline garante
automaticamente, e as regras que **todo código novo** — escrito à mão ou gerado
pelo Lovable — tem de seguir. Não é teoria; cada regra aqui nasceu de uma
vulnerabilidade real encontrada e corrigida, e a maioria tem uma guarda que a
faz cumprir sozinha.

## Como reportar uma vulnerabilidade

Não abra issue pública. Escreva para **henrique.mathews@gmail.com** com o
detalhe e um passo-a-passo de reprodução. Respondemos em dias úteis.

---

## O que o pipeline garante (`.github/workflows/ci-seguranca.yml`)

Corre em cada push e cada PR para `main`:

| Portão | O que barra |
|---|---|
| **Typecheck + Lint** | Erros de tipo e de estilo |
| **Testes** | Os ~380 testes, incluindo **todas as guardas de segurança** abaixo |
| **gitleaks** | Qualquer segredo real (service_role, chave privada) num commit |
| **npm audit** | Vulnerabilidade **crítica** bloqueia; o resto informa |

> **Passo manual, uma vez:** nas definições do repositório no GitHub →
> *Branches* → *Branch protection rules* para `main`, ligar **"Require status
> checks to pass before merging"** e escolher os jobs `qualidade` e `segredos`.
> Sem isto, o pipeline avisa mas não impede o merge. É o que fecha o portão.

---

## As dez regras do código seguro no Akuris

Cada uma tem, entre parênteses, a guarda que a verifica. Adicione a sua quando
criar um padrão novo.

### 1. O inquilino vem da sessão, nunca do parâmetro
Uma função `SECURITY DEFINER` ignora o RLS. Se recebe `p_empresa_id` e filtra só
por ele, um inquilino lê/escreve no outro passando o id alheio. O `empresa_id`
efectivo vem sempre de `get_user_empresa_id()` (leitura) ou
`exige_empresa_da_sessao()` (escrita).
*(guarda: `scripts/auditoria-rls.sql` bloco 4)*

### 2. RLS em toda tabela de negócio, com MFA
Tabela nova com dados de inquilino: RLS ligado, política por `empresa_id`, e a
política restritiva de `has_valid_mfa_session()`. Uma tabela com RLS e **sem
política** nega tudo em silêncio — se a app escreve nela, falta política ou a
escrita devia passar por uma função `DEFINER`.
*(guarda: `scripts/auditoria-rls.sql` blocos 1 e 2)*

### 3. Verifique com RLS, não com service_role
Ao testar acesso, impersone o utilizador em `psql`
(`SET LOCAL role authenticated; SET request.jwt.claims ...`). A chave
service_role ignora o RLS e daria um verde falso.

### 4. Nenhum `fetch` de servidor alcança o interno
Toda edge function que busca um URL vindo do utilizador (ou de
`integracoes_config`) valida-o com `validarUrlExterno()` de `_shared/ssrf.ts`
**antes** do fetch. Cobre metadata da cloud, loopback, IP disfarçado.
*(guarda: `src/__tests__/ssrf-nao-alcanca-o-interno.test.ts`)*

### 5. Busca de texto não se interpola crua
Nunca `.or(`campo.ilike.%${termo}%`)` com texto de utilizador — a vírgula do
PostgREST injecta filtros. Use `orIlike()` de `@/lib/busca-segura`.
*(guarda: `src/__tests__/busca-nao-se-injeta.test.ts`)*

### 6. Segredos cifrados em repouso
`integracoes_config.credenciais_encrypted` é cifrado (`pgp:...`). Nenhuma edge
function faz `JSON.parse` da coluna crua — lê por `lerCredenciais()` de
`_shared/credenciais.ts`. Segredo novo entra pelo mesmo caminho.
*(guarda: `src/__tests__/credenciais-cifradas-em-repouso.test.ts`)*

### 7. HTML de terceiros passa por DOMPurify
Todo `dangerouslySetInnerHTML` sanitiza a fonte com DOMPurify — incluindo o
HTML de `.docx` importado. Sem excepção.

### 8. Os cabeçalhos de segurança não regridem
CSP, X-Frame-Options, HSTS e afins vêm de `src/lib/seguranca/politica-csp.ts`.
O `script-src` nunca ganha `'unsafe-inline'` nem `'unsafe-eval'`. Mudou uma
ligação externa? Actualize a política e corra `node scripts/gerar-headers.mjs`.
*(guarda: `src/__tests__/cabecalhos-de-seguranca.test.ts`)*

### 9. Segredo nenhum no repositório
O repo é público. A service_role, tokens de integração e chaves de conta de
serviço vivem nos secrets das Edge Functions e em `.env.local` (git-ignored).
O `.env` versionado só tem `VITE_*` (público). O gitleaks apanha o resto.
*(guarda: `.gitleaks.toml` + job `segredos`)*

### 10. Paridade PT/EN, e a cor do aviso não depende da língua
Chave de tradução nova entra em PT **e** EN no mesmo commit. Toast sem
`variant` explícito ganha cor por heurística de texto — que tem de dar a mesma
cor nas duas línguas.
*(guardas: `i18n-parity`, `aviso-tem-a-mesma-cor-nas-duas-linguas`)*

---

## Quando o Lovable empurra um commit

O Lovable reescreve blocos inteiros e já reabriu uma fuga de sigilo assim. Por
isso: **depois de cada `git rebase origin/main`, corra `npm run test` antes de
empurrar.** Foi uma guarda que apanhou a regressão. O pipeline apanha-a também,
mas mais vale vê-la localmente.

## Rodar as guardas à mão

```bash
npm run test           # os ~380 testes, guardas incluídas
npm run typecheck
npm run lint
# a auditoria de RLS/DEFINER precisa de um Postgres com as migrations aplicadas:
psql "$DATABASE_URL" -f scripts/auditoria-rls.sql
```
