# Completar demonstração da Nexure: riscos, fotos de ativos e integrações

## 1. Riscos completos
Situação hoje na Nexure (56 riscos): 11 sem categoria, 32 sem tratamento, 36 sem controle ligado.

Preencher todos os riscos que estão incompletos:
- Categoria adequada (Tecnologia, Nuvem, Endpoint, Privacidade, Terceiros, etc.), usando as categorias já existentes da empresa e criando só as que faltarem.
- Tratamento (mitigar / aceitar / transferir) com descrição, responsável, prazo e situação.
- Controles existentes ligados ao risco (ex.: criptografia de disco para "notebook sem criptografia").
- Plano de ação ligado a cada risco alto/crítico, com responsável, prazo e situação variada (aberto, em andamento, concluído).
- Avaliação residual e responsável preenchidos onde faltar.

## 2. Fotos nos detalhes dos ativos
- Gerar um conjunto pequeno de fotos de produto realistas por modelo (notebook HP EliteBook, Dell Latitude, MacBook, iPhone, Samsung Galaxy, servidor, firewall, impressora, etc.) e ícones visuais para recursos da AWS (EC2, RDS, S3, Lambda...).
- Associar a foto certa a cada ativo da Nexure.
- Na tela de detalhes do ativo, mostrar a foto no topo da coluna esquerda no lugar do ícone genérico; ativos sem foto continuam com o ícone atual.

## 3. Integrações: AWS e Intune conectados
Hoje a aba de integrações de coleta mostra só o catálogo "Em breve" (recurso desligado), por isso os dois não aparecem conectados.
- Na mesma aba, adicionar uma seção "Conectadas" no topo que lê as conexões reais da empresa e mostra AWS e Intune com: selo "Conectado", data do último scan, quantidade de ativos encontrados e histórico dos últimos scans.
- Os demais provedores continuam como "Em breve". Nada de conexão real com Microsoft ou Amazon.

## Detalhes técnicos
- Dados via SQL só com `empresa_id` da Nexure; consultar `pg_constraint` antes dos INSERTs; planos de ação ligados pela FK de risco existente em `planos_acao`.
- Fotos: imagegen → `src/assets/ativos/*.jpg`; mapeamento em `src/lib/ativo-fotos.ts` por `atributos.modelo`/tipo (sem gravar caminhos de build no banco); `AtivoFicha.tsx` usa a foto quando houver.
- Integrações: componente `ConexoesAtivas` em `IntegrationCollections.tsx` consultando `integration_connections` + `integration_runs` com `.eq('empresa_id', empresaId)`, renderizado também quando `INTEGRATION_COLLECTIONS_ENABLED=false`. Textos PT/EN via `t()`.
- Verificação: contagem final de riscos sem categoria/tratamento/controle = 0, tsgo e teste de paridade i18n.
