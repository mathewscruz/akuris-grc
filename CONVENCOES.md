# Convenções do projeto Akuris

## 1. Idiomas obrigatórios (regra permanente)

Todo texto de interface, conteúdo semeado (seed) e mensagem ao utilizador **tem
de existir em português (pt) e inglês (en)**. O português cobre pt-BR e pt-PT:
a redação deve ser neutra e compreensível nos dois; quando houver divergência
relevante de termo, prefere-se a forma usada no Brasil (pt-BR) por ser o público
maioritário, mantendo a grafia correta.

Regras práticas:

- **Nunca criar texto num só idioma.** Cada chave nova entra em `pt` e `en` no
  mesmo commit.
- **Nada de strings soltas no JSX.** Todo texto visível passa por
  `const { t } = useLanguage()` (ou `tGlobal()` fora do React) com chave.
- Dicionários vivem em `src/i18n/modules/<modulo>.ts`, exportando
  `{ pt: {...}, en: {...} }`, e são registados em `src/i18n/modules/index.ts`.
- O teste `src/i18n/__tests__/i18n-parity.test.ts` valida a paridade PT/EN e
  deve ser executado antes de concluir qualquer alteração de texto.
- Conteúdo semeado no banco (frameworks, biblioteca de riscos, templates) tem
  colunas equivalentes em inglês (`*_en`) ou registos bilingues.

## 2. Isolamento multi-tenant

Toda consulta ao Supabase inclui `.eq('empresa_id', empresaId)` quando a tabela
tem essa coluna, além das políticas de RLS.

## 3. Ligações entre registos

Nunca pedir UUID ao utilizador. Vínculos entre módulos usam o seletor genérico
`src/components/common/EntidadeSelect.tsx`, alimentado pelo registo de entidades
`src/lib/entity-search.ts` — que também alimenta a busca global (Cmd+K) e a
navegação profunda `?focus=<id>`.

## 4. Overlays

Dialog, AlertDialog, Sheet e Popover usam os wrappers de `src/components/ui/`,
que aplicam `useReleaseBodyPointerEvents()` para evitar o bug do primeiro clique
engolido após fechar overlays empilhados.

## Camada regulatória (proteção de dados)

- Nunca escrever "LGPD", "RGPD" ou "GDPR" fixo na interface. A lei aplicável, a
  autoridade de controlo, os prazos de resposta ao titular e de notificação de
  violação e os nomes dos direitos vêm de `useJurisdicao()` / `src/lib/jurisdicao.ts`,
  alimentados pelo campo `empresas.jurisdicao` (BR, PT_EU, INTL).
- Quando a empresa ainda não configurou, a jurisdição é inferida do idioma da
  conta, do fuso horário e do domínio.
- Chaves em falta no dicionário passam a mostrar texto legível de recurso
  (`fallbackForKey`) e um aviso na consola em desenvolvimento — isso não dispensa
  criar a chave em pt e en.
