# Usuários e permissões + IA mais forte

## 1. Usuários e permissões: resposta e ajuste

**Como está hoje:** melhorou (só perfis), mas ainda há vários caminhos para a mesma coisa:
- aba "Usuários", com "Gerenciar permissões" no menu de cada linha;
- botão "Gerenciar permissões" no rodapé da lista;
- aba "Permissões" separada;
- botão "Restaurar todas as permissões".

Os três primeiros abrem a mesma lista de perfis, e nada mostra qual perfil a pessoa tem sem abrir o cadastro.

**Padrão de mercado** (Google Workspace, Microsoft 365, Jira, Vanta): duas abas apenas.

```text
Usuários e acesso
 ├─ Usuários  → tabela: nome | e-mail | perfil (trocável na própria linha) | MFA | último acesso
 └─ Perfis    → lista de perfis; abrir um perfil = editar módulos e ver quem o usa
```

O que muda:
- Coluna "Perfil" na tabela de usuários, trocável ali mesmo (aplica na hora e mostra aviso com opção de desfazer).
- Removidos "Gerenciar permissões" do menu da linha e o botão do rodapé.
- A aba "Permissões" passa a se chamar "Perfis"; ao abrir um perfil, aparece quem o usa e o número de pessoas.
- "Restaurar todas as permissões" vira uma ação dentro de cada perfil ("Reaplicar a todos que usam este perfil").
- "Lembretes" sai daqui e vai para Organização, porque não tem a ver com acesso.

## 2. IA: onde um modelo mais forte faz diferença

Hoje quase todas as análises usam um modelo rápido. Só a análise de documento usa o modelo de topo.

Proposta: criar um nível "Análise" com o modelo de topo (o mesmo da análise de documento) para tarefas em que o usuário depende do julgamento da IA:

| Funcionalidade | Hoje | Proposta | Ganho para o usuário |
|---|---|---|---|
| Diagnóstico do Gap Analysis | rápido | topo | lacunas priorizadas com justificativa por requisito |
| Verificação de itens da evidência | rápido | topo | menos falso "conforme", motivo claro do que falta |
| Avaliação de fornecedor | rápido | topo | risco explicado por pergunta e ações sugeridas |
| Questionário de segurança | rápido | topo | respostas citando políticas/controles reais da empresa |
| Tratamento de risco sugerido | rápido | topo | tratamento ligado a controles existentes, com custo/esforço |
| DocGen (geração do documento) | rápido | topo | documento mais completo e coerente com a norma |

Continuam no modelo rápido (resposta imediata importa mais): chat AkurIA, assistente de módulo, tarefas de projeto, status report, e-mails, traduções.

**Ajustes de fluxo:**
- Resposta sempre estruturada (veredito, justificativa, o que falta, próxima ação) no mesmo padrão visual da análise de documento.
- Tarefas mais longas (questionário inteiro, DocGen) passam a rodar em segundo plano com progresso real e aviso no sino ao terminar, como já acontece na análise de documento.
- Se o modelo de topo falhar, cai automaticamente para o rápido e avisa "resultado simplificado".

**Custo:** cada uso continua descontando 1 crédito do cliente. O custo de IA para a Akuris por chamada fica maior nessas 6 funções; o painel financeiro de IA já mostra esse impacto.

## Detalhes técnicos
- 1: `GerenciamentoUsuariosEnhanced` ganha coluna com `Select` de perfil chamando `apply_permission_profile` (escopo `empresa_id`, `undoableAction`); remover `handleManagePermissions`/`showPermissionMatrix`; `PermissionProfilesList` mostra usuários do perfil e ação de reaplicar; `ReminderSettings` vai para `OrganizacaoTab`.
- 2: `MODELOS.ANALISE` em `_shared/modelos.ts` com fallback para `PADRAO`; trocar nas 6 funções; saída via JSON estruturado; questionário e DocGen reutilizam o padrão de jobs em fatias já usado em `analyze-document-adherence`; manter `consume_ai_credit`/402. Atualizar `ai-usage-catalog`.
- Testes: troca de perfil aplica permissões só na mesma empresa; fallback de modelo; rodar a suíte.
