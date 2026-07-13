## Contexto

Auditoria completa dos 24 frameworks globais do módulo Gap Analysis (`empresa_id = NULL`). Nenhum está vazio, mas encontrei **dois problemas**:

### 1. Duplicatas de `codigo` dentro do mesmo framework (achado colateral)

Ao validar contagens descobri que 9 frameworks têm o mesmo `codigo` repetido em várias linhas — inflando artificialmente o total de requisitos:

| Framework | Linhas | Códigos únicos | Duplicatas |
|---|---|---|---|
| HIPAA | 100 | 54 | 46 |
| PCI DSS | 100 | 64 | 36 |
| CIS Controls | 100 | 75 | 25 |
| SOC 2 Type II | 74 | 63 | 11 |
| ISO 14001 | 45 | 35 | 10 |
| LGPD | 65 | 56 | 9 |
| GDPR | 99 | 97 | 2 |
| ISO 31000 | 22 | 21 | 1 |
| CCPA | 20 | 19 | 1 |

Total: **141 linhas duplicadas** que corrompem contagem e podem duplicar avaliações no gap analysis.

### 2. Cobertura abaixo do padrão oficial (o que o usuário aprovou completar)

Descontadas as duplicatas, os 4 frameworks aprovados ficam:

| Framework | Únicos hoje | Esperado (oficial) | A adicionar |
|---|---|---|---|
| PCI DSS 4.0 | 64 | ~277 sub-requisitos (12 macro) | ~213 |
| CIS Controls v8 | 75 | 18 controles + 153 safeguards = 171 | ~96 |
| DORA (Reg. 2022/2554) | 42 | 64 artigos + RTS chave | ~25 |
| CCPA/CPRA | 19 | ~40 (com update CPRA 2023) | ~21 |

## Plano de execução

### Etapa 1 — Migração de deduplicação (defensiva, aplica a TODOS os frameworks globais)

Uma migração idempotente que:

- Para cada `(framework_id, codigo)` com duplicatas, mantém apenas a linha **mais completa** (maior tamanho de `descricao` + `orientacao_implementacao`), depois a mais recente como desempate.
- Antes de deletar, migra qualquer `gap_analysis_evaluations` que referencie IDs a serem removidos para o `requirement_id` sobrevivente (evita perder avaliações).
- Idem para `gap_analysis_adherence_details` (usa `requirement_id`).
- Só afeta frameworks globais (`empresa_id IS NULL`), sem risco de tocar dados de empresa.

### Etapa 2 — Enriquecimento dos 4 frameworks aprovados

Uma segunda migração (ou seed via `INSERT`) que adiciona os requisitos faltantes, **com o mesmo padrão dos existentes**: `codigo`, `titulo`, `descricao`, `categoria`, `orientacao_implementacao`, `exemplos_evidencias`, `ordem`, `peso` default 1.

Detalhamento por framework:

**PCI DSS 4.0** (target 277)
- Completa os 12 grupos macro com todos os sub-requisitos oficiais publicados pelo PCI SSC (ex.: 1.1.1 → 1.5.1, 2.1.1 → 2.3.2, etc.), incluindo os controles introduzidos na v4.0 (customized approach, phishing 5.4.1, autenticação 8.3.6-8.3.11).
- Categorias reaproveitam as já existentes (`Network Security`, `Access Control`, etc.).

**CIS Controls v8** (target 171)
- Adiciona as 153 safeguards nível 1/2/3 sob os 18 controles atuais (ex.: 1.1 → 1.5, 2.1 → 2.7, 3.1 → 3.14, ... 18.1 → 18.5).
- Categoria = "IG1", "IG2", "IG3" (Implementation Groups) no campo `area_responsavel`; `categoria` mantém o grupo funcional do controle pai.

**DORA — Regulamento UE 2022/2554** (target ~64)
- Adiciona artigos faltantes por capítulo: governança (Art. 5-6), gestão de risco TIC (Art. 6-16 completos), gestão de incidentes (Art. 17-23), teste de resiliência (Art. 24-27), gestão de terceiros (Art. 28-44), compartilhamento de informação (Art. 45), supervisão (Art. 46-56).

**CCPA/CPRA** (target ~40)
- Atualiza para incluir emendas do CPRA (Cal. Civ. Code §§1798.100–1798.199.100): novos direitos (correction, limit use of SPI), obrigações de service providers/contractors/third parties, requisitos CPPA, avaliações de risco e ciber-auditoria.
- Renomeia versão de `2018` para `2018/CPRA 2023`.

### Etapa 3 — Validação

Após aplicar:
- `SELECT nome, COUNT(*) total, COUNT(DISTINCT codigo) uniq FROM ... GROUP BY nome;`
- Confirmar 0 duplicatas e as novas contagens.
- Verificar que `gap_analysis_evaluations` e `gap_analysis_adherence_details` continuam consistentes (mesma linha por avaliação).

## Fora do escopo (informativo)

Detectei também gaps menores em LGPD (faltam ~9 artigos), GDPR (2 artigos) e HIPAA (implementation specs opcionais). Não farei nada agora — se quiser, sinaliza depois e completo em uma migração adicional.

## Notas técnicas

- Sem mudanças em código frontend/backend — só dados.
- Todas as inserções usam `empresa_id = NULL` (frameworks globais) e respeitam o padrão de `mem://architecture/gap-analysis-templates-globais-isolamento`.
- Duas migrações separadas para revisão isolada; a de deduplicação pode ser aprovada mesmo se o usuário quiser adiar o enriquecimento.
- Nenhuma edição em `types.ts`.
