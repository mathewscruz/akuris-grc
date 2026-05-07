## Popular dados fictícios para Mathews Cruz (Nexure)

**Usuário:** `mathews.cruz@nexure.com.br`  
**user_id:** `929968a9-886e-4307-82bd-8fd99e94c1ea`  
**empresa_id:** `6c3ebb8f-c182-4006-8252-5c970ad295a6`  
**Status atual:** todos os módulos zerados — pronto para popular.

### Estratégia
Replicar exatamente o mesmo seed bem-sucedido do Halan (CyberMe), trocando apenas `empresa_id` e `created_by/responsavel_id` para os IDs do Mathews. Os volumes, categorias e padrões de dados serão os mesmos para manter consistência demo entre representantes.

### Volume por módulo

| Módulo | Volume |
|---|---|
| Riscos (categorias + riscos) | 5 cat + 10 riscos |
| Controles (categorias + controles) | 4 cat + 10 controles |
| Incidentes | 5 |
| Denúncias (categorias + denúncias) | 5 cat + 4 denúncias |
| Planos de Ação | 6 |
| Ativos & TI (locais, ativos, chaves, licenças, manutenção) | 3 + 10 + 3 + 4 + 3 |
| Fornecedores + Contratos | 5 + 4 |
| Documentos (categorias + docs) | 4 cat + 10 docs |
| Auditorias | 2 |
| Continuidade (planos + testes + tarefas) | 3 + 3 + 6 |
| LGPD (dados pessoais, fluxos, ROPA, solicitações) | 6 + 4 + 4 + 3 |
| Due Diligence assessments | 3 |
| Gap Analysis (assessments + evaluations parciais) | 3 (ISO 27001, LGPD, NIST) |
| Acessos Privilegiados (sistemas + contas) | 3 + 4 |

### Execução técnica
1. Migração SQL única com `set_config('request.jwt.claims', ...)` para satisfazer triggers de auditoria (mesma técnica usada no seed do Halan).
2. Todos os inserts com `empresa_id = '6c3ebb8f-c182-4006-8252-5c970ad295a6'`.
3. `created_by` / `responsavel_id` = `929968a9-886e-4307-82bd-8fd99e94c1ea`.
4. Datas distribuídas nos últimos 12 meses para alimentar gráficos de tendência.
5. Nenhuma alteração em outras empresas, schemas ou triggers globais.

### Arquivo a criar
- `supabase/migrations/<timestamp>_seed_mathews_nexure_demo.sql`

Aprovar para eu executar a migração.