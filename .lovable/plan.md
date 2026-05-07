## Objetivo

Popular dados fictícios realistas em todos os módulos para o usuário **Halan Borges** (`halan@cyberme.com.br`), empresa **CyberMe** (`empresa_id: dff833d4-5dd8-499b-b4ad-bc04d85d8172`), para uso comercial em demonstrações.

Confirmado: a empresa hoje está 100% vazia em todos os módulos. Nenhum outro usuário/empresa será afetado — todo INSERT terá `empresa_id = 'dff833d4-5dd8-499b-b4ad-bc04d85d8172'` e, quando aplicável, `created_by/responsavel_id = 'cdd5a5ad-cb74-45fa-9deb-79faae39e9de'`.

## Escopo (módulos a popular)

| Módulo | Tabelas | Volume aprox. |
|---|---|---|
| Riscos | `riscos_categorias`, `riscos`, `riscos_historico_avaliacoes` | 5 cat + 12 riscos |
| Controles | `controles_categorias`, `controles` | 4 cat + 15 controles |
| Incidentes | `incidentes` | 8 incidentes (mix de status/criticidade) |
| Denúncias | `denuncias_categorias`, `denuncias` | 5 cat + 6 denúncias |
| Planos de Ação | `planos_acao` | 10 planos vinculados a riscos/controles |
| Ativos & TI | `ativos_localizacoes`, `ativos`, `ativos_chaves_criptograficas`, `ativos_licencas`, `ativos_manutencoes` | 3 locais + 15 ativos + 5 chaves + 6 licenças + 4 manutenções |
| Contratos | `fornecedores`, `contratos` | 8 fornecedores + 10 contratos |
| Documentos | `documentos_categorias`, `documentos` | 4 cat + 12 documentos |
| Auditorias | `auditorias`, `auditoria_areas_sistemas` | 4 auditorias |
| Continuidade | `continuidade_planos`, `continuidade_testes`, `continuidade_tarefas` | 4 planos + 4 testes + 8 tarefas |
| LGPD / Privacidade | `dados_pessoais`, `dados_fluxos`, `ropa_registros`, `dados_solicitacoes_titular` | 8 + 5 + 6 + 4 |
| Due Diligence | `fornecedores` (reuso), `due_diligence_assessments` | 5 assessments |
| Gap Analysis | `gap_analysis_assessments`, `gap_analysis_evaluations`, `gap_analysis_score_history` | 3 assessments (ISO 27001, LGPD, NIST) com avaliações parciais |
| Acessos Privilegiados | `sistemas_privilegiados`, `contas_privilegiadas` | 5 sistemas + 12 contas |
| Revisão de Acessos | `access_reviews`, `sistemas_usuarios` | 3 revisões + 15 usuários |

Frameworks de Gap Analysis usarão os templates globais existentes (`empresa_id IS NULL`) — não duplicaremos catálogos, apenas criaremos `assessments` da empresa CyberMe apontando para eles.

## Estratégia de execução

1. Inspecionar o schema real (colunas obrigatórias, enums, defaults) das tabelas listadas via `information_schema` antes de inserir.
2. Gerar UM único arquivo SQL de seed idempotente em `supabase/seeds/halan_demo_seed.sql` para referência/reaplicação futura.
3. Executar os INSERTs via ferramenta `supabase--insert` (data, não schema), sempre filtrando por `empresa_id = 'dff833d4-5dd8-499b-b4ad-bc04d85d8172'`.
4. Garantir consistência entre módulos:
   - Planos de ação referenciam riscos/controles/incidentes reais.
   - Avaliações de gap analysis vinculam-se a planos de ação e a frameworks globais existentes.
   - Históricos de risco coerentes com a data de criação.
   - Status, criticidades e prazos distribuídos para gerar dashboards "ricos" (alguns em atraso, alguns críticos, alguns concluídos).
5. Datas espalhadas nos últimos 12 meses para alimentar gráficos de tendência.

## Conteúdo fictício (tema)

Cenário: **CyberMe** como empresa demo de cibersegurança/consultoria. Dados em PT-BR, com nomes plausíveis de:
- Riscos: vazamento de dados, ransomware, indisponibilidade ERP, falha de backup, fornecedor crítico, etc.
- Controles: MFA, gestão de patches, backup off-site, treinamento phishing, ISO 27001 controles A.5–A.8.
- Incidentes: phishing reportado, conta comprometida, indisponibilidade, etc.
- Fornecedores: AWS, Microsoft, Datadog, etc. (fictícios para demo).
- Frameworks (gap): ISO 27001:2022, LGPD, NIST CSF.

## Garantias de segurança multi-tenant

- Toda query/insert inclui `empresa_id = 'dff833d4-5dd8-499b-b4ad-bc04d85d8172'`.
- Nenhum UPDATE/DELETE em dados de outras empresas.
- Nenhum schema change.
- `created_by`/`responsavel_id` apontam apenas para `cdd5a5ad-cb74-45fa-9deb-79faae39e9de` (Halan).

## Entregáveis

- Banco populado para Halan ver todos os módulos com dados realistas no login.
- Arquivo `supabase/seeds/halan_demo_seed.sql` versionado, para reaplicar/limpar facilmente no futuro.
- Resumo final com contagem por tabela após o seed.

Posso aplicar?