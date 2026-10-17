# Aba "Conexões" (Planos de Ação) com visual único e limpo

## O que muda
Hoje a aba mostra um quadro com borda e, dentro dele, uma lista solta de textos, datas e botões. A ideia é ter **um único bloco**, sem quadro dentro de quadro, no mesmo estilo das linhas da lista de planos (anexo 2).

```text
Conexões entre módulos                              Verificado em 16/10/2026   [↻]
Apontamentos baseados nos registros da empresa. Abra as fontes antes de decidir.
────────────────────────────────────────────────────────────────────────────────
▌ Cloud AWS                         Fim do contrato 30/07/2026 · Avaliação —     Criar plano →
▌ Contrato perto do fim sem avaliação de fornecedor...      Fontes: Cloud AWS, Microsoft Brasil
────────────────────────────────────────────────────────────────────────────────
▌ Plano de Continuidade – Data Center Principal   Último teste — · RTO 4h        Criar plano →
▌ Último teste ausente ou com mais de um ano...      Fonte: Plano de Continuidade...
```

- **Um só bloco**: some a borda externa; o título e o botão Atualizar ficam no topo, como nas outras abas. Os itens ficam separados só por linhas finas, sem cartões.
- **Faixa colorida à esquerda** em cada item, conforme a prioridade (alta = âmbar/vermelho, média = neutra), igual à lista de planos.
- **Linha organizada em colunas**: à esquerda o título e a explicação (até 2 linhas, o resto aparece ao passar o mouse); no meio os dados principais em uma linha só ("Fim do contrato 30/07/2026 · Avaliação —"); à direita a ação "Criar plano de ação" como link discreto com seta, sem caixa com borda.
- **Fontes** viram uma linha pequena "Fontes: A, B" com links.
- **Topo mais limpo**: data e versão da regra viram "Verificado em 16/10/2026" ao lado do botão Atualizar, que vira um botão de ícone. O código da versão aparece só ao passar o mouse.
- Valores técnicos como "aprovado_com_ressalvas" aparecem com a primeira letra maiúscula e sem sublinhado.
- O carregamento usa o indicador padrão do Akuris. O estado vazio e as mensagens de erro ficam alinhados ao mesmo bloco.
- No celular, as colunas viram uma pilha: título, explicação, dados e ação.

Nada muda nos dados nem nas regras. Só a forma de exibir.

## Detalhes técnicos
- Alterar apenas `src/components/planos-acao/ComplianceContextPanel.tsx`: remover `rounded-lg border bg-background p-4`, usar `divide-y` com `border-l-[3px]` por `origin.prioridade` via tokens semânticos (`border-l-warning`/`border-l-destructive`/`border-l-border`), grid `md:grid-cols-[minmax(0,1fr)_auto_auto]`, `AkurisPulse` no loading, `IconRefresh` em botão `variant="ghost" size="icon"` com aria-label/tooltip, ação `variant="link"` com `IconArrowRight`.
- Formatar fatos com `formatDateOnly` e helper de capitalização já existente (`STATUS_LABELS`/text-utils).
- Novas strings PT/EN: `evidenceIntelligence.checkedAt`, `evidenceIntelligence.sources` em `src/i18n/modules/evidence-intelligence.ts`.
- Rodar o teste de chaves de tradução.
