# Lançamento do Akuris 4.0: Novidades, notificação no app e e-mail

## O que o usuário vai ver
1. **Novidades:** uma nova entrada "v4.0", com a data de hoje e os itens abaixo.
2. **Sino:** cada usuário de empresa ativa recebe a notificação "Nova versão v4.0". Isso acontece automaticamente, pela regra que já existe nas Novidades. Clicar na notificação abre o painel de Novidades.
3. **E-mail:** um comunicado com a identidade visual Akuris é enviado uma única vez a todos os usuários de empresas ativas. O envio respeita quem desativou comunicados, e o e-mail traz o link de descadastro.

## Resumo da versão 4.0 (texto das Novidades e do e-mail)
**Novo visual**
- Menu lateral redesenhado, com ícones mais modernos e arredondados, agrupado em 10 áreas e adaptado a iPad e celular.
- Dashboard novo em blocos: índice operacional com gradiente, mapa de calor de riscos, planos de ação, conformidade com o selo de cada framework, contratos e atividade.
- Novos selos para cada framework, e cores de nota mais fiéis ao que significam (Excelente, Bom, Atenção e Crítico).
- Tabelas em cartões, com indicadores de tendência, alternância lista/grade, avatar do responsável e progresso real.
- Notificações, alertas e avisos redesenhados, e nova tela de login.
- Configurações reorganizadas numa visão geral em cartões, com progresso e pendências.

**Gap Analysis e conformidade**
- Tela inicial com comparativo entre frameworks e tabela ordenável.
- Nova janela de requisito: ler a norma de um lado e decidir do outro, com sugestão de status e "Salvar e próximo".
- Análise de políticas ("Comprovar"): a IA diz se o documento está em conformidade com a norma, para documentos de qualquer tamanho, com resultado estruturado e ajustes prontos para copiar. As análises ficam visíveis para toda a empresa.
- Frameworks revisados e completos, com novos templates regulatórios (BACEN 4.893, ANPD 15/2024, SUSEP 638 e CVM 35).
- Orientações dos requisitos salvas, sem gastar créditos de IA de novo.

**Novas funcionalidades**
- Trust Center público, respostas automáticas a questionários de segurança e pacote de auditoria em PDF.
- Ações em lote e preenchimento inteligente de formulários.
- Painéis laterais padronizados em todos os módulos.

## Detalhes técnicos
- **Novidades:** uma migration insere a linha em `changelog_entries` (versão `v4.0`, com os itens no formato `{type, text}` já usado). O trigger `notify_changelog_entry` existente cria as notificações no sino. Os textos ficam em PT, como nas versões anteriores.
- **E-mail:** uma nova Edge Function, `send-release-announcement`.
  - Só um super-admin pode chamá-la (verify_jwt, com checagem de `has_super_admin_role`).
  - Recebe a versão e envia por Resend, em lotes, a todos os profiles de empresas ativas com `receber_comunicados` diferente de false.
  - Usa o template HTML Akuris e o link de descadastro por `email_unsubscribe_token`.
  - É idempotente: uma marca de envio na própria linha do changelog impede o segundo envio.
  - Não consome créditos de IA, porque não usa IA.
- **Disparo:** botão "Enviar por e-mail" na lista de Novidades em Configurações (só para super-admin). Também vou executá-lo uma vez para a v4.0, depois de confirmar com um envio de teste para o seu e-mail.
- **Validação:** conferir no banco a quantidade de notificações criadas e os logs da Edge Function (enviados e falhas).
