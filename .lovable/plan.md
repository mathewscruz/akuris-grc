## Diagnóstico

### 1. Bug confirmado: scores de Riscos e Incidentes inflados no card "Maturidade GRC"
Em `src/hooks/useRadarChartData.tsx`, a fórmula está dividindo pelo denominador errado:

```ts
// ATUAL (errado)
100 - ((criticos*100 + altos*75 + medios*50 + baixos*25) / (total*100))
```

Para 1 risco crítico (total=1): numerador=100, denominador=100 → razão=1 → score = **99%** ("Excelente"). Por isso o card mostra Riscos quase no verde enquanto o **Gráfico de Evolução de Risco** mostra exposição em 100% (totalmente vulnerável). As duas vistas usam **fórmulas diferentes** para a mesma dimensão.

A fórmula correta (já usada por `RiskScoreTimeline.computeExposure`) é:
```ts
exposicao = (criticos*4 + altos*3 + medios*2 + baixos*1) / (total*4) * 100
saude     = 100 - exposicao
```

Validação manual:
| Cenário | Atual (errado) | Correto |
|---|---|---|
| 1 crítico | 99% | 0% |
| 1 alto | 99,25% | 25% |
| 5 médios | 99,5% | 50% |
| 1 baixo | 99,75% | 75% |

O mesmo bug existe em `scoreIncidentes` (mesma fórmula).

### 2. Outros scores do mesmo hook — revisão
- `scoreControles`, `scoreAtivos`, `scoreDocumentos`, `scoreDenuncias`, `scoreDueDiligence` usam ratios proporcionais corretos (somam pesos = 100). ✅
- `scoreGapAnalysis` reusa `gapStats.averageCompliance` (já validado e em produção). ✅

---

## Plano

### Etapa A — Correção do bug (obrigatória)
**Arquivo:** `src/hooks/useRadarChartData.tsx`

Substituir as fórmulas de `scoreRiscos` e `scoreIncidentes` para usarem a mesma exposição ponderada (peso 4/3/2/1) já consagrada em `RiskScoreTimeline`. Resultado: o card "Maturidade GRC" e o "Gráfico de Evolução de Risco" passarão a contar a mesma história.

```ts
// scoreRiscos / scoreIncidentes
total > 0
  ? Math.max(0, Math.round(100 - (
      (criticos*4 + altos*3 + medios*2 + baixos*1) / (total*4)
    ) * 100))
  : 0
```

Como `useGrcMaturityScore` é a média dos módulos com dados, o Hero Banner também passará a refletir a exposição real automaticamente.

### Etapa B — Evolução do card "Maturidade GRC" (recomendada)
Hoje o card exibe **8 barras horizontais** (Riscos, Controles, Ativos, Incidentes, Gap Analysis, Due Diligence, Documentos, Denúncias). Funciona, mas:
- Compete visualmente com o Hero Banner (que já mostra a maturidade consolidada).
- Não dá visão de progresso/evolução por framework, que é exatamente o que dá pulso de compliance.

**Proposta** — manter o card no mesmo slot, mas redesenhar como **"Frameworks em Avaliação"**:

```text
┌────────────────────────────────────────┐
│  Frameworks de Compliance      ▸ Ver  │
│  3 ativos · 2 concluídos              │
├────────────────────────────────────────┤
│  ⚙ ISO 27001                           │
│  ████████████░░░░░░  68% · 142/210    │
│                                         │
│  🛡 LGPD                                │
│  ██████████████████ 95% · ✓ Concluído │
│                                         │
│  📋 SOC 2                               │
│  ████░░░░░░░░░░░░░░  22% · 28/124     │
│                                         │
│  + 2 outros frameworks ▸               │
└────────────────────────────────────────┘
```

Cada linha mostraria, por framework:
- Ícone + nome
- Barra de progresso = `% conformidade média` (já calculado por framework)
- Texto: `requisitos avaliados / total` ou "✓ Concluído"
- Última atualização (tooltip)
- Click → leva para `/gap-analysis/{id}`

**Por que faz sentido**:
1. Hero Banner já entrega o número consolidado de Maturidade — duplicado hoje pelo card.
2. Frameworks são onde o usuário trabalha diariamente; ter status por framework no dashboard é mais acionável do que "Ativos: 60%".
3. Diferencia "saúde operacional" (Hero) de "progresso de auditoria" (novo card) — duas leituras complementares.
4. As outras 8 dimensões continuam visíveis via **drill-down** (já temos `KpiDrillDownDrawer`) e via os módulos individuais.

**Implementação resumida:**
1. Novo hook `useFrameworksOverview` que retorna lista de frameworks da empresa com:
   - `id`, `nome`, `icone`
   - `totalRequisitos`, `requisitosAvaliados`
   - `mediaConformidade` (já existe lógica em `useGapAnalysisStats`)
   - `status` (`em_andamento` | `concluido` | `nao_iniciado`)
   - `ultimaAtividade`
   - Filtra `empresa_id` + frameworks com pelo menos uma evaluation OU vinculados.
2. Renomear o componente `MultiDimensionalRadar.tsx` → `FrameworksOverviewCard.tsx` (ou criar novo e remover o antigo).
3. Layout: linha por framework, ordenada por `mediaConformidade` desc. Limite de 4 visíveis + "Ver todos →" indo para `/gap-analysis`.
4. Empty state: "Nenhum framework iniciado ainda. [Iniciar primeiro framework]".
5. Manter ícone proprietário Akuris (`GapAnalysisIcon` por framework, ou ícone do framework se houver).
6. Atualizar memória `mem://ux/dashboard/grc-maturity-bars` documentando a nova diretriz.

### Etapa C — Validação
1. Empresa com 1 risco crítico: card Hero mostra Maturidade derrubada e timeline mostra exposição 100%. Antes da fix, mostrava ~99% saúde.
2. Novo card de Frameworks: empresa sem frameworks mostra empty state; com 3 frameworks ativos, lista correta com barras.

---

## Pergunta para você
Quer que eu execute:
- **(A) só o bug fix** — alinha Maturidade GRC com Evolução de Risco mantendo o card atual de 8 barras; ou
- **(A + B)** — bug fix + substituir o card por "Frameworks de Compliance" (recomendado).

Sem mudança extra, sigo com **A + B**.

## Arquivos impactados (A + B)
- `src/hooks/useRadarChartData.tsx` (fix Riscos/Incidentes)
- `src/hooks/useFrameworksOverview.ts` (novo)
- `src/components/dashboard/FrameworksOverviewCard.tsx` (novo, substitui `MultiDimensionalRadar`)
- `src/pages/Dashboard.tsx` (troca do componente)
- `mem://ux/dashboard/grc-maturity-bars` (atualizar diretriz)
