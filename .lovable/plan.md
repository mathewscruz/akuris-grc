# Inventário de máquinas via MeshCentral (servidor único do Akuris)

## Como funciona
```text
Máquina do cliente ──(agente Mesh com visual Akuris)──► Servidor MeshCentral do Akuris
                                                         │  um grupo de máquinas por empresa
Akuris (sincronização de hora em hora) ◄─────────────────┘
        └─► Módulo Ativos da empresa dona do grupo
```

## O que o usuário vê
1. **Ativos → Agentes de inventário**: botão "Baixar instalador" (Windows, macOS, Linux). Cada empresa baixa um instalador que só reporta para o grupo dela.
2. **Instalador com visual Akuris**: nome "Akuris Agent", logo, cores navy/roxo no ícone da bandeja e na janela de instalação; instalação silenciosa opcional para TI (Intune/GPO).
3. **Ativos preenchidos sozinhos**: nome, sistema operacional, processador, memória, discos, IP/MAC, número de série, usuário logado, programas instalados e último contato. Máquinas novas entram como ativos "Descoberto"; as conhecidas são atualizadas, sem duplicar.
4. **Status do agente** na ficha do ativo (online/offline, última sincronização) e aviso no sino quando uma máquina fica sem contato por mais de 7 dias.
5. Recursos de acesso remoto do Mesh ficam **desligados** no instalador dos clientes (só inventário).

## Separação por empresa
Cada empresa tem um grupo próprio no servidor; o Akuris guarda o vínculo grupo ↔ empresa e só grava ativos na empresa dona do grupo. Nenhuma empresa vê máquinas de outra.

## O que depende de você
- Um servidor (VPS, ~2 GB RAM) com domínio, ex. `agent.akuris.com.br`, e o MeshCentral instalado. Posso deixar o arquivo de configuração e o passo a passo prontos.
- Um usuário de serviço no MeshCentral; o login dele vai para os segredos do projeto.

## Detalhes técnicos
- Branding via `config.json` do MeshCentral (`domains."".agentCustomization`: displayName, companyName, serviceName, image, foregroundColor/backgroundColor; `agentFileInfo` para o instalador Windows) e `agentConfig` desativando desktop/terminal/arquivos.
- Tabela `mesh_grupos` (empresa_id, mesh_id, criado_em) com RLS por empresa; colunas em `ativos`: `mesh_node_id` (único por empresa), `agente_ultimo_contato`, `agente_online`.
- Edge Function `mesh-provisionar` (admin da empresa): cria o grupo via API websocket do MeshCentral e devolve link de download do instalador do grupo.
- Edge Function `mesh-sincronizar` (cron de hora em hora = 24 execuções/dia): lê nós e `sysinfo` de cada grupo e faz upsert em `ativos` por `mesh_node_id`; gera notificação no sino para máquinas sem contato.
- Segredos: `MESH_URL`, `MESH_USER`, `MESH_PASSWORD`. As funções antigas `agent-*` (desativadas) são removidas.
- Testes: mapeamento sysinfo → ativo e regra de isolamento por empresa.
