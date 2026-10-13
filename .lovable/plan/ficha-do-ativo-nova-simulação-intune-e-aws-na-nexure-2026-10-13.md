# Ficha do ativo nova + simulação Intune e AWS na Nexure

## 1. Ficha de detalhes do ativo (no estilo do anexo, com o visual do Akuris)

Hoje, ao clicar num ativo, abre um painel lateral simples. Ele passa a ser uma ficha em duas colunas:

**Coluna esquerda (identidade e ações)**
- Ícone grande do tipo de ativo (notebook, servidor, nuvem, celular…), usando os ícones do Akuris (não usamos foto).
- Nome, número de série, chips de situação, tipo e fornecedor (com o componente de chip padrão).
- Caixa de etiquetas com "editar".
- Ações: Ver QR Code, Vincular a uma pessoa, Registrar manutenção, Ver trilha de auditoria, Editar e Arquivar.
- Setas para ir ao ativo anterior/próximo da lista.
- Selo de origem quando o ativo veio de uma integração (por ex. "Sincronizado via Intune", "AWS", com data do último scan).

**Coluna direita (abas)**
- **Detalhes:** cartões Hardware/Recurso (tipo, situação, marca/modelo, condição, localização), Identificação (série, IMEI, patrimônio, ID externo), Contrato (fornecedor, contrato ligado, custo mensal) e Gestão (responsável, último check-in, cadastrado em, observações).
- **Riscos:** riscos ligados ao ativo, clicáveis.
- **Manutenções / Uso:** histórico de manutenções.
- **Linha do tempo:** trilha de auditoria do ativo.

Cores: navy/roxo do Akuris, roxo só no botão principal, vermelho só em Arquivar, sem as cores verde-água do anexo. Funciona em celular (vira uma coluna, tela cheia). Tudo em PT e EN.

## 2. Simulação de Intune e AWS conectados (só na Nexure)

Os dados ficam apenas na empresa Nexure, do usuário henrique.mathews@gmail.com.

**Integrações**
- Em Configurações → Integrações, Intune e AWS aparecem como "Conectado", com último scan bem-sucedido e histórico de execuções. Não há ligação real com Microsoft/Amazon (nenhuma credencial); o botão de nova sincronização fica informativo para essas conexões de demonstração.

**Do Intune**
- ~15 dispositivos no módulo Ativos (notebooks Dell/HP/Lenovo, MacBooks, iPhones/Android), com série, usuário, sistema, situação de conformidade e último check-in.
- ~5 riscos no módulo Riscos: dispositivos sem criptografia, sistema desatualizado, fora de conformidade há mais de 30 dias, sem check-in, jailbreak/root — cada um ligado aos dispositivos afetados.

**Da AWS**
- ~15 recursos no módulo Ativos (instâncias EC2, bancos RDS, buckets S3, funções Lambda, balanceador), com região e conta.
- ~6 riscos no módulo Riscos: bucket S3 público, conta root sem MFA, grupo de segurança com porta 22 aberta, RDS sem criptografia, chaves de acesso antigas, CloudTrail desligado — ligados aos recursos afetados.
- No módulo Contratos: um contrato "AWS – Serviços de Nuvem" com fornecedor Amazon Web Services e custos mensais dos últimos 6 meses por serviço (EC2, RDS, S3…), e um alerta de aumento de custo.

Tudo marcado como demonstração (etiqueta `demo` + origem da integração) para poder ser removido depois.

## Detalhes técnicos
- Novo componente `src/components/ativos/AtivoFicha.tsx` substituindo o painel aberto por `detalheAtivo` em `src/pages/Ativos.tsx`; reutiliza `StatusBadge`, `Chip`, `AkurisPulse`, ícones de `@/components/icons`, `ManutencaoDialog`, `TrilhaAuditoriaAtivos`, `EntidadeSelect`. Campos que não existem em `ativos` (série, marca, custo, origem) são lidos de `descricao`/`tags` ou de `integration_resources.signals` quando o ativo vier de integração; se faltar algo, mostra "—". Sem migration de esquema, a menos que a leitura mostre necessidade de colunas (nesse caso, migration aditiva com GRANT).
- Dados via SQL em `integration_connections` (provider `intune`/`aws`, status conectado, sem credenciais), `integration_runs`, `integration_resources` (kind device/ec2/s3…, signals jsonb), `ativos`, `riscos` + vínculos risco-ativo, fornecedor e `contratos` + marcos/custos. CHECK constraints consultadas em `pg_constraint` antes de inserir; todos os registros com `empresa_id` da Nexure.
- Chaves i18n novas em pt/en, teste de paridade i18n e checagem de tipos.
