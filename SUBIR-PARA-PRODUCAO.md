# Subir para produção — 19/08/2026

Tudo o que segue foi ensaiado contra o dump de produção. O código já está em
`origin/main` (29 commits). Falta o que **não** viaja com o Git.

## 1. Migrations

```bash
npx supabase db push
```

39 migrations, 36 novas. As três do Lovable já aplicadas
(`20260817011037`, `20260817111707`, `20260817112954`) são saltadas
automaticamente pelo registo em `schema_migrations`.

**Se aplicar à mão em vez do CLI, tem de saltar essas três** — senão para na
primeira com "already exists".

Ensaio: 36 OK, duas passagens com resultado idêntico (idempotentes), schema
final converge exactamente com desenvolvimento (2022 colunas, 717 políticas,
zero diferenças). Relatório em `.local-dumps/ensaio-migrations-2026-08-19.md`.

## 2. Edge functions

Não vão com `db push`. São quatro:

```bash
npx supabase functions deploy send-contact-email
npx supabase functions deploy send-password-reset
npx supabase functions deploy provision-new-account
npx supabase functions deploy public-assessment
```

## 3. Um segredo novo

A `send-contact-email` passa a ler `CONTACT_FORM_RECIPIENT` (antes tinha um
Gmail pessoal escrito no código, num repositório público). Sem o segredo cai
em `contato@akuris.com.br`; se esse alias não existir, a mensagem fica gravada
no banco mas ninguém recebe.

```bash
npx supabase secrets set CONTACT_FORM_RECIPIENT="comercial@akuris.com.br"
```

## 4. Política de senha do servidor

O `config.toml` exige 8 caracteres com maiúscula, minúscula e número — mas **em
projeto hospedado isso não se aplica sozinho**:

```bash
npx supabase config push
```

Ou, no painel: **Authentication → Policies**, definir mínimo 8 e as classes.

Enquanto não for feito, produção aceita 6 caracteres sem exigência de classe, e
um POST directo a `/auth/v1` passa por cima da validação do cliente.

## 5. Fechar o repositório — manual

`github.com/mathewscruz/akuris-grc` está **público**. Para um produto GRC
comercial é o item mais sério desta lista, e leva um clique:

**Settings → General → Danger Zone → Change repository visibility → Private**

(O `gh` CLI não está instalado nesta máquina, por isso não dá para automatizar.)

## Depois de subir — o que verificar

1. Um relatório de Contratos: deve mostrar valor **vigente**, sem os vencidos.
2. Gap Analysis de um framework: lista, cabeçalho e PDF devem dizer o mesmo
   número de requisitos avaliados.
3. Privacidade → ROPA: deve abrir a lista de ROPAs, não a de tratamentos.
4. Riscos de uma empresa com dados: "Acima do apetite" e "Sem responsável"
   devem bater com o banco.

## O que fica de fora, e é decisão sua

- 46 dos 108 achados: gravidades 4 e 5 inteiras, mais os que dependem de o
  produto guardar histórico próprio (o "Δ 30 dias" é fabricado, a "Evolução dos
  Riscos" é uma constante). São melhorias, não correcções.
- O bundle inicial: 597 KB gzipado só para abrir a primeira tela.
- 376 de 541 políticas concedidas a `public` em vez de `authenticated`.

## O que existe só na base local e NÃO sobe

O ROPA "SalesForce" com os 7 tratamentos, e o perfil de teste apontado a várias
empresas. Foram criados aqui para validar; produção não os tem nem deve ter.
