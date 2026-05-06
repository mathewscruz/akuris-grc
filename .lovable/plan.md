## Diagnóstico

Auditei os indicadores do Dashboard e identifiquei inconsistências em relação à regra "0% → 100%, módulo vazio não conta":

### 1. Evolução de Risco (`RiskScoreTimeline.tsx`) — **semântica invertida** ⚠️
Atualmente o gráfico calcula `score = 100 − exposição`, ou seja, **maior = melhor**. Você definiu o oposto: 0% = sem risco, 100% = totalmente vulnerável (**menor = melhor**).  
Além disso, quando não há nenhum risco no período, o ponto é plotado como `100` (parece péssimo) — deveria ser `0` ou ser omitido.

### 2. Health Score / Maturidade GRC (`useGrcMaturityScore` + `HealthScoreGauge`) — ✅ correto
Já segue a regra: módulos sem dados (`hasData=false`) são excluídos da média e o status fica "Sem dados" quando ninguém pontua. Mantém-se "maior = melhor".

### 3. Radar Multidimensional (`useRadarChartData`) — ⚠️ pequenos ajustes
- Cada módulo retorna `score=0` quando `total=0` e `hasData=false` (correto — Maturidade já ignora). Mas o card no radar ainda mostra "0%" visualmente para módulos vazios. Precisa exibir "Sem dados".
- `scoreIncidentes` aplica bônus `+10` se houver poucos incidentes no mês mesmo quando o `total=0` da empresa (irrelevante porque `hasData=false`, mas vou higienizar para evitar futuras confusões).

### 4. Banner Hero — Card "Conformidade" (`HeroScoreBanner.tsx`) — ⚠️
Recebe `gapStats.averageCompliance || 0`. Quando a empresa não tem nenhum framework avaliado, mostra "0%" em vermelho — passando a ideia errada de "péssimo". Deve mostrar "—" e cor neutra quando não houver base.

### 5. Card "Alertas Críticos" do Hero — ✅ correto
Conta itens reais; zero alertas vira verde (positivo). OK.

### 6. KPIs / Pills — ✅ correto
São contagens absolutas (não percentuais), não se aplicam à regra.

---

## Plano de Correção

### A. Inverter semântica do gráfico de Evolução de Risco
Arquivo: `src/components/dashboard/RiskScoreTimeline.tsx`

1. Renomear conceito: o valor exibido passa a ser **Índice de Exposição (0–100, menor = melhor)**.
2. Alterar `computeScore()` para retornar diretamente a exposição: `(peso/total)*25` clamp 0–100. Quando `total=0` → retornar `null` (sem dado naquele período).
3. Filtrar pontos `null` antes de calcular `latestScore`/`delta`. Se nenhum período tiver dados → empty state.
4. Inverter direção do delta: queda = bom (verde/`text-success` + `TrendingDown`), alta = ruim (vermelho + `TrendingUp`).
5. Mudar cor da área para `--destructive` com gradient suave (vermelho fade) e `ReferenceLine` "Meta" para `y=20` com label "Meta ≤ 20" em `--success`.
6. Ajustar tooltip: rótulo passa a ser "Índice de exposição" e legenda "vs. anterior" mantém comparação correta.
7. Atualizar título/subtítulo: i18n key `dashboard.riskEvolution` permanece, mas adicionar microcopy "Quanto menor, menor a exposição".

### B. Card de Conformidade do Hero respeitar base zero
Arquivo: `src/components/dashboard/HeroScoreBanner.tsx` + `src/pages/Dashboard.tsx`

1. Passar a prop `complianceScore` como `number | null` (null quando `gapStats.data?.totalFrameworks === 0` ou quando não há avaliações).
2. No banner, quando `complianceScore === null`: mostrar "—", cor `text-muted-foreground`, fundo `bg-muted/30` e tooltip "Sem frameworks avaliados".

### C. Radar mostrar "Sem dados" para módulos vazios
Arquivo: `src/components/dashboard/MultiDimensionalRadar.tsx`

1. Quando `item.hasData === false`: substituir o "0%" por "Sem dados" (texto pequeno, muted) e manter a barra zerada/tracejada — deixando claro que está fora do cálculo da Maturidade.
2. Adicionar tooltip "Cadastre itens neste módulo para começar a pontuar".

### D. Higienizar `useRadarChartData`
Arquivo: `src/hooks/useRadarChartData.tsx`

1. `scoreIncidentes`: remover bônus `+10` quando `total === 0` (defensivo; não muda comportamento atual mas elimina cálculo confuso).
2. Garantir que toda fórmula retorna exatamente `0` quando `total === 0` e `hasData=false` (já faz, apenas adicionar comentário explicativo padronizado).

### E. Documentar regra na memória
Atualizar `mem://logic/sistema-scoring-base-zero-v2`:
- Indicadores do tipo "saúde/maturidade": maior % = melhor; módulos vazios EXCLUÍDOS da média.
- Indicadores do tipo "exposição/risco": menor % = melhor; períodos sem dados retornam null.
- Cards de % nunca devem mostrar "0% em vermelho" como se fosse péssimo quando a causa é ausência de dados — usar "—" + tom neutro.

---

## Arquivos Impactados
- `src/components/dashboard/RiskScoreTimeline.tsx` (refactor de semântica)
- `src/components/dashboard/HeroScoreBanner.tsx` (prop `complianceScore: number | null`)
- `src/pages/Dashboard.tsx` (passar null quando sem frameworks)
- `src/components/dashboard/MultiDimensionalRadar.tsx` (estado "Sem dados")
- `src/hooks/useRadarChartData.tsx` (limpeza)
- `src/i18n/pt.ts` + `src/i18n/en.ts` (microcopy "Quanto menor, menor a exposição" / "Sem dados")
- `mem://logic/sistema-scoring-base-zero-v2` (regra atualizada)

## Validações pós-implementação
1. Empresa zerada (sem riscos cadastrados): timeline mostra empty state, não "100".
2. Empresa com 1 risco crítico apenas: índice ≈ 100 (vermelho), delta down quando se resolve.
3. Empresa sem frameworks: card "Conformidade" mostra "—" cinza; Maturidade exibe "Sem dados".
4. Radar: módulos sem cadastros aparecem como "Sem dados" e a média geral de Maturidade ignora-os.
