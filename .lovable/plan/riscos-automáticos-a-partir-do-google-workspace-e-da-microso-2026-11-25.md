# Riscos automáticos a partir do Google Workspace e da Microsoft

## O que o usuário verá
- Depois de cada coleta, o Akuris analisa os dados da integração e encontra falhas de configuração (ex.: administradores sem verificação em duas etapas, arquivos compartilhados publicamente, dispositivos sem criptografia).
- Cada falha vira uma **sugestão de risco** no módulo de Riscos, em uma aba "Sugeridos pelas integrações", com logotipo do provedor, evidência (quantos usuários/itens, quais) e probabilidade/impacto sugeridos.
- O usuário clica em **Aceitar** (vira um risco normal, com responsável e matriz da empresa) ou **Descartar** (com motivo). Nada entra no registro de riscos sem essa decisão, mantendo o registro confiável para auditoria.
- Quando a falha é corrigida no provedor, a sugestão/risco ligado recebe o aviso "Corrigido na origem em DD/MM" e o responsável é avisado no sino. O risco não é fechado sozinho.
- Uma nova falha encontrada gera um aviso no sino para administradores.

## Verificações iniciais (com os dados que já coletamos)
Google Workspace (sem pedir novas permissões):
- Super administradores sem verificação em duas etapas
- Usuários ativos sem verificação em duas etapas (acima de um limite)
- Excesso de super administradores
- Contas sem login há mais de 90 dias ainda ativas
- Arquivos do Drive compartilhados com "qualquer pessoa com o link" ou fora do domínio
- Tentativas de login suspeitas na auditoria
- Dispositivos móveis/Chromebooks sem bloqueio ou desatualizados (quando houver)

Microsoft 365 (com as permissões atuais):
- Administradores globais sem MFA registrado
- Excesso de administradores globais
- Contas inativas há mais de 90 dias
- Dispositivos Intune não conformes ou sem criptografia
- Logins de risco/falhas recorrentes na auditoria

Fase 2 (exige nova autorização do administrador, opcional): Microsoft Secure Score e políticas de Acesso Condicional (Policy.Read.All, SecurityEvents.Read.All). Para o Google, as configurações de segurança da organização não têm API pública somente leitura completa, então ficamos nos sinais acima.

## Detalhes técnicos
- Nova tabela `integracao_riscos_sugeridos` (empresa_id, connection_id, provider, regra_id, titulo, descricao, evidencia jsonb, probabilidade, impacto, estado `aberta|aceita|descartada|corrigida`, risco_id FK riscos, primeira/última detecção). Única por (empresa_id, connection_id, regra_id). RLS por empresa; escrita só pelo servidor e por RPCs `aceitar_risco_sugerido` / `descartar_risco_sugerido` que checam permissão do módulo Riscos.
- Catálogo de regras puro em `_shared/integration-risk-rules.ts` (uma função por regra recebendo os recursos coletados, retornando achado ou null; dados ausentes = sem achado, nunca "risco presumido"). Testes unitários por regra.
- O `integration-worker` roda as regras ao final de uma coleta bem-sucedida, faz upsert idempotente e marca "corrigida" quando a regra deixa de disparar. Avisos no sino via tabela de notificações existente.
- Desconectar/expurgo: sugestões abertas da conexão são removidas; riscos aceitos permanecem (são decisão da empresa), apenas perdem o vínculo.
- Frontend: aba no módulo Riscos usando DataTable e o painel lateral RecordDetailDrawer; textos PT/EN; ícone do provedor como na importação.
- Textos das regras localizados por `regra_id`, sem citar LGPD/RGPD fixo.

## Fora do escopo
- Criar riscos automaticamente sem aceitação.
- Corrigir configurações no Google/Microsoft (acesso continua somente leitura).
