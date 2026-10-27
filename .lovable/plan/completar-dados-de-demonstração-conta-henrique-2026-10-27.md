# Completar dados de demonstração — conta Henrique

Escopo: apenas a empresa de henrique.mathews@gmail.com. Só dados (sem mudar telas). Tudo com empresa_id dessa empresa, usando os 3 usuários existentes como responsáveis.

## Situação atual (contada no banco)
- Vazios: Avaliações de privacidade (DPIA/RIPD), Avaliações regulatórias.
- Muito rasos: Revisões de acesso (1), Biblioteca de evidências (1), Consentimentos (3), Projetos (3), Due diligence (3), Continuidade (4), Solicitações de titulares (5), Auditorias (6).
- Já razoáveis: Riscos, Ativos, Controles, Planos de ação, Gap Analysis, Documentos, Contratos, Fornecedores, Incidentes, Denúncias, Contas privilegiadas.

## O que será criado
1. Revisões de acesso: 4 campanhas (concluída, em andamento, agendada, atrasada) sobre os sistemas privilegiados existentes, cada uma com 6–10 itens (aprovado, revogado, pendente, com justificativa) e histórico de decisões.
2. Privacidade: 3 avaliações (DPIA/RIPD) com riscos e status distintos; +5 consentimentos; +4 solicitações de titulares com eventos.
3. Regulatório: 2 avaliações (ex.: BACEN 4.893 e ANPD) com itens, achados e vínculos de evidência.
4. Biblioteca de evidências: ~10 evidências ligadas a controles/requisitos.
5. Auditorias: completar as existentes com itens, achados, evidências e recomendações; +1 auditoria em andamento.
6. Continuidade: tarefas e testes (um aprovado, um com falhas) para os planos existentes.
7. Due diligence: +3 avaliações com respostas e score.
8. Testes de controle: 1–2 testes por controle principal com resultado.
9. Varredura final: para cada módulo, conferir que painéis laterais/abas de detalhe têm conteúdo (comentários, anexos, histórico) e preencher o que estiver vazio.

## Validação
- Contagem por módulo após a carga.
- Abrir as telas principais logado como Henrique (Playwright) e confirmar que listas e detalhes abrem sem erro, com foco em Revisões de acesso.

## Detalhes técnicos
- Inserções via SQL de dados respeitando colunas/enums/FKs de cada tabela (consultadas antes de cada lote); nenhum colaborador fictício novo.
- Datas relativas a hoje (27/10/2026) para status coerentes (atrasado, vencendo, concluído).
