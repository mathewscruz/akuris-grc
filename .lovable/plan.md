## Objetivo

Remover da UI do módulo Gap Analysis os rótulos que expõem ao usuário que a ordenação/recomendação/sugestão é feita pela IA ("Ordenado pela IA", "Recomendado pela IA", "Sugeridos pela IA", "Planos consolidados pela IA", "RECOMENDADOS PELA IA", "Cruzamentos identificados pela IA", AIBadges visíveis etc.). A funcionalidade permanece — só removemos a menção visual à IA.

## Alterações por arquivo (apenas texto/UI)

1. `src/components/gap-analysis/v2/PriorityQueueCard.tsx`
   - Remover `<AIBadge>Ordenado pela IA</AIBadge>` do header (linha ~149). Manter o título "Fila prioritária".

2. `src/components/gap-analysis/v2/RemediationTabV2.tsx`
   - Trocar título "Planos consolidados pela IA" → "Planos consolidados" (linha ~266).
   - Atualizar comentário do bloco para "Planos consolidados".
   - Remover AIBadge associado ao chip "Cobre N requisitos" se presente.

3. `src/pages/GapAnalysisFrameworks.tsx`
   - Trocar seção "RECOMENDADOS PELA IA" → "RECOMENDADOS PARA SUA EMPRESA" (linha ~386) e ajustar comentário acima.

4. `src/components/gap-analysis/v2/AIRecommendedTile.tsx`
   - Remover `<AIBadge>Recomendado</AIBadge>` do tile (linha ~44); manter apenas o título do framework e o motivo da recomendação.
   - Atualizar comentário do header do arquivo.

5. `src/components/gap-analysis/v2/RequirementsTableToolbar.tsx`
   - Renomear chip de filtro `'Sugeridos pela IA'` → `'Parciais'` (linha ~36). Manter `key: 'ia'` (interno) para não quebrar URLs.

6. `src/components/gap-analysis/dialogs/EvidenceReusePanel.tsx`
   - Renomear aba `Recomendado pela IA` → `Recomendados` (linha ~116).

7. `src/components/gap-analysis/EvidenceLibraryHub.tsx`
   - "Cruzamentos identificados pela IA" → "Cruzamentos identificados" (linha ~44).

8. `src/components/gap-analysis/v2/AIDiagnosticCard.tsx`
   - "Status recomendado: …" → "Status sugerido: …"? Não — o pedido é remover menção a IA, então manter "Status recomendado" (já não cita IA). Sem alteração.

9. `src/components/gap-analysis/v2/MaturityHero.tsx`
   - Trocar copy "a IA cruza evidências automaticamente" → "as evidências são cruzadas automaticamente" (linha ~63).
   - Renomear comentário "Insight IA" → "Insight contextual" (linha ~197).

10. `src/components/gap-analysis/v2/InsightStrip.tsx`
    - Atualizar comentário do header para remover menção a IA (sem efeito visual, só limpeza).

11. `src/components/gap-analysis/v2/StatusSeg.tsx`
    - `aria-label="Sugestão da IA"` → `aria-label="Sugestão"` (linha ~99). Manter o pulse-dot.

12. `src/components/gap-analysis/AIRecommendationsCard.tsx`
    - Título visível "Consultor IA de Conformidade" → "Consultor de Conformidade" (linhas ~121 e ~153). Mensagens de erro de créditos permanecem (são técnicas).

## Não alterar

- Lógica de chamada de IA, RPC `consume_ai_credit`, mensagens de erro `Créditos de IA esgotados` (técnicas/administrativas).
- Componente `AIBadge` em si — apenas paramos de usá-lo nos pontos acima. Pode permanecer no codebase para uso futuro.
- Tooltips/toasts que não expõem palavra "IA" ao usuário final.

## Validação

- Após edição, `rg -n "pela IA|pelo IA|Ordenado pela IA|Recomendado pela IA|Sugeridos pela IA|RECOMENDADOS PELA IA" src/components/gap-analysis src/pages/GapAnalysis*` deve retornar vazio.
- Conferir as 4 abas (Visão geral, Requisitos, Documentos, Remediação) e a lista de frameworks no preview.
