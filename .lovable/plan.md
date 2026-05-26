# Popular conta de demonstração — Nexure

Conta identificada: `henrique.mathews@gmail.com` · empresa **Nexure** (`34b992d1-47bc-4bc1-bf39-df83d20e60fe`) · user `665e71d9-…`.

Hoje a conta tem apenas 1 risco, 1 documento e 1 ativo. Vou popular todos os módulos GRC com dados realistas e interligados, para que cada tela demo conte uma história coerente (riscos → controles → planos de ação → auditorias → incidentes → continuidade etc.).

## O que será criado (via INSERT, isolado por `empresa_id`)

**Fundamentos**
- Categorias de Riscos, Controles, Documentos, Denúncias (4–6 cada)
- 1 Matriz de Riscos 5×5 "Corporativa 2026"
- Localizações de Ativos (Datacenter, Sede, Filial, Home Office)

**Riscos (10)** — Vazamento LGPD, Ransomware, Fraude financeira, Indisponibilidade SaaS, Insider threat, Falha backup, Phishing, Não conformidade ISO, Perda de fornecedor crítico, Shadow IT. Com prob×impacto inicial e residual, responsável, próxima revisão, tratamento (mitigar/aceitar/transferir) e 2 aceites formais.

**Controles (12)** — MFA, Backup 3-2-1, SIEM, DLP, Patch management, Revisão de acessos trimestral, Treinamento phishing, Segregação de funções, Criptografia em repouso, Gestão de chaves, Plano de resposta a incidentes, Auditoria de logs. Vinculados aos riscos, com testes/eficácia.

**Planos de Ação (8)** — Mistura aberto / em andamento / concluído / atrasado, vinculados a riscos, controles e auditorias, com responsáveis e prazos.

**Documentos (10)** — Política SI, Política LGPD, PCN, PRD, Procedimento Backup, Norma Acesso, Termo Confidencialidade, Manual Resposta a Incidentes, Política BYOD, Código de Conduta. Com versão, vigência, classificação e aprovações.

**Ativos (15)** — Servidores, banco PostgreSQL, firewall, switches, storage, 6 laptops executivos, impressora, nobreak, AC precision; com fornecedor, valor, criticidade, localização e data de aquisição.
- **Licenças (5)**: Microsoft 365, Adobe, Antivírus, Fortinet, GitHub Enterprise.
- **Chaves (4)**: chaves de cofre/áreas restritas com responsáveis.

**Contas Privilegiadas (6)** + Sistemas Privilegiados (4): AD, AWS, GitHub, ERP — com rotação e justificativa.

**Revisão de Acessos (2)** — uma concluída, uma em andamento com itens pendentes.

**Auditorias (3)** — Interna ISO 27001 (concluída), Externa LGPD (em andamento), SOC 2 (planejada) — com 6–10 itens cada (conformes / não-conformes / parciais) e achados gerando planos de ação.

**Incidentes (6)** — Phishing detectado, Acesso indevido, Notebook perdido (LGPD), Ransomware contido em sandbox, Indisponibilidade SSO, Malware estação. Com tratamento, evidências e comunicação ANPD quando aplicável.

**Fornecedores (6) + Contratos (5)** — Microsoft, AWS, consultoria SI, limpeza, ISP, escritório jurídico. Contratos com vigência, valor mensal/total, marcos e SLA.

**Due Diligence (3)** — 1 assessment concluído (score alto), 1 em andamento, 1 enviado aguardando resposta — sobre fornecedores acima.

**Gap Analysis (2 frameworks)** — ISO 27001 e LGPD com assessment em andamento (~60% de conformidade) usando frameworks globais já existentes (sem duplicar templates).

**LGPD / Privacidade**
- **Dados Pessoais (8)**: nome, e-mail, CPF, endereço, dados de saúde, geolocalização, dados de menores, biometria — com base legal e finalidade.
- **Fluxos de Dados (4)**: RH, Marketing, Atendimento, Folha.

**Denúncias (5)** — Categorias + 5 denúncias variando entre assédio, fraude, conflito de interesses; status mistos, com protocolo público.

**Continuidade (PCN)**
- 3 Planos (Datacenter, Sistemas Críticos, Recursos Humanos), 2 testes realizados, 5 tarefas (pendentes/concluídas).

## Como vou executar

Tudo via a ferramenta de **insert** do Supabase, em um único batch transacional onde possível, sempre filtrando por `empresa_id = 34b992d1-…` e `created_by = 665e71d9-…`. Nada toca outras empresas.

Vou primeiro inspecionar as colunas obrigatórias de cada tabela (algumas têm enums específicos) e então executar os INSERTs de forma idempotente (verificando se já existe registro com nome conhecido antes de inserir, para você poder rodar de novo sem duplicar).

## Fora do escopo

- Não criar usuários adicionais (só o seu já existente é referenciado).
- Não enviar e-mails reais de notificação (triggers que disparam edge functions de e-mail não rodam por INSERT direto na maioria dos casos — confirmo antes de executar se algum trigger crítico precisa ser desativado temporariamente).
- Não mexer em frameworks globais de Gap Analysis (apenas criar o assessment da Nexure sobre os frameworks já existentes).

Posso prosseguir com esse seed completo?
