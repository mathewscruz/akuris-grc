# Trocar o amarelo mostarda por um âmbar alaranjado mais limpo

## O que muda
O tom amarelo-mostarda usado em "Em compliance com ressalvas", em pontuações intermediárias (ex.: o anel de 84%) e em avisos/atenção será substituído por um **âmbar alaranjado** (próximo de laranja-mel, `#E07B14`). Esse tom:
- comunica claramente "atenção / quase lá", sem parecer sujo;
- fica bem distinto do verde (ok) e do vermelho (crítico);
- funciona no tema claro e no escuro.

A troca é feita uma única vez na cor central do sistema, então vale para todos os lugares que hoje usam esse amarelo (selos, anéis de pontuação, alertas, severidade média), mantendo tudo consistente.

## Detalhes técnicos
Em `src/index.css`:
- Tema claro: `--warning: 40 90% 38%` para `28 88% 46%`; `--severity-medium: 45 90% 38%` para `30 85% 45%`.
- Tema escuro: `--warning: 38 70% 56%` para `30 90% 60%`; `--severity-medium: 45 80% 60%` para `32 88% 62%`.
- Conferir o contraste do texto nos selos (`text-warning` sobre `bg-warning/10`) e checar se há amarelos hardcoded no código de pontuação (`ScoreRing`, chart-tokens) para alinhar ao mesmo token.
