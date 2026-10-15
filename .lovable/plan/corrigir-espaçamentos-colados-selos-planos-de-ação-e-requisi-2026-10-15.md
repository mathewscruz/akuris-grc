# Corrigir espaçamentos colados (selos, planos de ação e requisitos)

## O que está errado
1. **Selos colados na linha (anexo 1):** no painel lateral (ex.: contrato com "Ativo" e "Risco do fornecedor: Crítico"), os selos encostam na linha divisória do cabeçalho.
2. **Status colado no título do plano de ação (anexo 2):** no painel do risco, cada plano de ação ligado devia aparecer como um cartão com borda, espaço interno e o status alinhado à direita. Hoje o cartão perde o formato: o título encosta no status e o ícone de abrir cai para a linha de baixo.
   - Causa confirmada: o atalho que torna a linha clicável substitui o estilo do cartão em vez de somar a ele.
3. **Itens muito próximos (anexo 3):** em "Requisitos de compliance relacionados", o título, o botão "Relacionar requisito" e o texto de ajuda ficam encostados.

## O que vou fazer
1. **Cabeçalho do painel lateral:** mais espaço entre os selos e a linha divisória, e entre os selos e os botões. Vale para os 8 módulos que usam esse painel.
2. **Planos de ação ligados:** devolver o formato de cartão (borda, espaço interno), título com reticências quando for longo, status e ícone sempre na mesma linha, à direita.
3. **Requisitos relacionados:** mais espaço entre o título, o botão e o texto de ajuda, no mesmo padrão das secções "Controles" e "Planos de ação" do painel de risco. Os textos fixos desta secção (título, ajuda, "Eficácia estimada") passam a ter versão em inglês.
4. **Varredura no sistema:**
   - Já verifiquei: este é o único lugar onde o atalho de linha clicável apaga o estilo do cartão.
   - Vou conferir os outros painéis e as listas com selos (contratos, incidentes, fornecedores, planos de ação, controles, documentos e auditorias) e corrigir qualquer selo encostado em texto ou linha.

## Detalhes técnicos
- `PlanosAcaoVinculados.tsx`: o `className` do `<li>` é sobrescrito por `{...rowOpenProps(...)}`, que devolve o seu próprio `className`. Juntar os dois com `cn(base, rowOpenProps(...).className)` e passar `CARD_HOVER` como realce.
- Proteção para não voltar a acontecer: um teste que percorre os ficheiros `.tsx` e falha se `className=` aparecer antes de `...rowOpenProps(` no mesmo elemento.
- `RecordDetailDrawer.tsx`: `pb-1` no bloco de selos, `mt-5` antes das ações e `gap-2.5` entre os selos.
- `RiscoDetailDrawer.tsx` (secção de requisitos): cabeçalho com `mb-2`, ajuda com `mt-1 mb-4`, e textos fixos movidos para `t()` com chaves em PT e EN.
- Validação: verificação de tipos, teste de paridade i18n e o novo teste de padrão.
