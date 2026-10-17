# Popup do requisito: ler e decidir lado a lado (opção B)

## O que muda para o usuário
Hoje, ao clicar num requisito, aparece um painel lateral de "triagem rápida". Dele sai um botão "Edição completa", que abre uma segunda janela longa, em 5 etapas, com rolagem. Isso dá duas telas diferentes para a mesma tarefa.

Passa a existir **uma única janela larga**, dividida em duas colunas:

```text
┌──────────────────────────────────────────────┬─────────────────────────────┐
│ ISO 27001 · A.5.15  Controle de acesso      ‹ 2/93 ›                    ✕ │
├──────────────────────────────────────────────┼─────────────────────────────┤
│ O QUE A NORMA EXIGE                          │ DECISÃO                     │
│ texto do requisito                           │ [Conforme|Parcial|Não|N/A]  │
│                                              │                             │
│ COMO CUMPRIR                                 │ ✦ Sugestão: Parcial         │
│ • passos práticos (orientação já salva)      │   2 de 3 evidências  [Usar] │
│                                              │                             │
│ EVIDÊNCIAS ESPERADAS            2 de 3       │ Justificativa (obrigatória  │
│ ✓ Política de acesso  → doc.pdf  Encontrada  │  se Parcial/Não conforme)   │
│ ✓ Revisão trimestral  → controle Encontrada  │ Prazo   ·   Responsável     │
│ ○ Registro de MFA           [Anexar] Falta   │                             │
│                                              │ Plano de ação: [Criar]      │
│ VÍNCULOS  controles · riscos · planos        │                             │
│ PERGUNTAS DE DIAGNÓSTICO (recolhível)        │ Rascunho guardado  [Salvar] │
└──────────────────────────────────────────────┴─────────────────────────────┘
```

- **Esquerda, para ler:** o texto da norma, como cumprir e as evidências esperadas. Cada evidência mostra se já há documento ou controle ligado ("Encontrada") ou se ainda falta ("Falta"), com o botão de anexar ali mesmo. Abaixo ficam os vínculos e as perguntas de diagnóstico, que abrem só se a pessoa quiser.
- **Direita, para decidir (sempre visível):**
  - status em quatro botões, com as teclas 1 a 4;
  - sugestão de status;
  - justificativa;
  - prazo e responsável;
  - criar plano de ação;
  - salvar, também pelo atalho ⌘/Ctrl+Enter.
- **Sugestão de status:**
  - **Sem custo:** a sugestão é calculada pelas evidências já ligadas, sem gastar créditos de IA. Por exemplo, todas encontradas resultam em "Conforme sugerido".
  - **Com custo:** o "Diagnóstico com IA" continua disponível num botão e consome crédito, como hoje.
  - **Decisão humana:** a sugestão nunca é aplicada sozinha; só entra quando a pessoa clica em "Usar".
- **Justificativa obrigatória** quando o status for Parcial ou Não conforme, com aviso claro.
- **Navegação** ‹ › para o requisito anterior ou o próximo sem fechar a janela. Ao salvar, a janela pode ir direto ao próximo.
- **Rascunho guardado** enquanto a pessoa escreve, separado por empresa e por usuário.
- **Celular:** as colunas viram uma pilha, com a decisão fixa no rodapé.
- Visual de bloco único: só a borda da janela e uma linha fina entre as colunas, sem cartões dentro de cartões.

## Detalhes técnicos
- Novo `RequirementWorkspace.tsx` em `gap-analysis/v2`, usando `DialogShell` em tamanho largo (`max-w-6xl`) e grid `lg:grid-cols-[minmax(0,1.5fr)_minmax(340px,1fr)]`. A coluna da direita fica `sticky` com rolagem própria.
- Reaproveitar a lógica existente, sem duplicar:
  - carregamento e salvamento de `gap_analysis_evaluations` com `.eq('empresa_id')`;
  - `useOrientacaoRequisito`, `DocumentosDoRequisito`, `gap-analysis-ai-diagnostic` via `invokeEdgeFunction` (com o tratamento de 402);
  - vínculos e plano de ação de `RequirementDetailDialog`, extraídos em subcomponentes.
- O responsável usa `UserSelect`, gravado em `responsavel_avaliacao`.
- Sugestão local: função pura `sugerirStatus({ esperadas, encontradas })`, com teste.
- `RequirementDrawerProvider` e o `?req=` da tabela passam a abrir o `RequirementWorkspace`. `RequirementDrawer` e `RequirementDetailDialog` são removidos depois da migração, e os testes existentes são atualizados (estabilidade de status, ExecutiveFramework).
- Textos novos em PT e EN. Validar com typecheck, os testes do Gap Analysis e o teste de chaves de tradução.
