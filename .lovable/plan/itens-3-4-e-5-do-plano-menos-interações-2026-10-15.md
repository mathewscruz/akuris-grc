# Itens 3, 4 e 5 do plano "menos interações"

## Situação atual
Estes três itens foram aprovados na conversa, mas ainda não foram construídos. O que já existe e serve de base:
- **Gap Analysis** já tem uma barra de ações em lote (aprovar vários requisitos de uma vez).
- O sistema já cruza evidências entre requisitos equivalentes, mas só dentro do mesmo framework.
- Não existe Trust Center, pacote de auditoria nem resposta automática a questionários de clientes.

## 3. Ações em lote e um clique
- **Barra de ações em lote nos módulos principais** (Riscos, Controles, Planos de Ação, Incidentes, Contratos): selecionar vários itens e aprovar, atribuir responsável, mudar situação ou exportar de uma vez. Hoje só o Gap Analysis tem isso.
- **Reuso entre frameworks:** ao avaliar um requisito (evidência ou justificativa), o Akuris propõe aplicar o mesmo conteúdo nos requisitos equivalentes dos outros frameworks ativos (ISO 27001, SOC 2, LGPD, BACEN). O usuário confere a lista e aprova com um clique.
- **Resposta a avisos por e-mail:** os e-mails de alerta (tarefa vencida, contrato a vencer) passam a ter botões de ação com link assinado de uso único, por exemplo "Concluir tarefa" ou "Adiar 7 dias", sem precisar entrar no sistema.

## 4. Preenchimento inteligente
- **Formulários pré-preenchidos:** ao criar risco, incidente, contrato ou plano de ação, o Akuris sugere responsável, prazo (conforme a severidade), categoria (a partir do título) e situação inicial. O usuário só confirma ou ajusta.
- **Ligações sugeridas:** ao criar um risco ou incidente, o sistema sugere os ativos, controles e fornecedores mais prováveis para ligar, com base no texto digitado e no histórico da empresa.
- As sugestões aparecem já preenchidas, nunca salvas sozinhas: nada entra no banco sem o usuário confirmar.

## 5. Entregas prontas para terceiros
- **Pacote de auditoria com um clique:** por framework, gera um PDF (ou pasta compactada) com a situação de cada requisito, as evidências ligadas e os planos de ação abertos, pronto para entregar ao auditor.
- **Trust Center:** página pública opcional por empresa, com selos de conformidade, frameworks ativos e documentos que a empresa escolher publicar, para responder a clientes e parceiros.
- **Resposta a questionários de segurança de clientes:** o usuário envia a planilha ou o PDF do questionário recebido; o Akuris responde cada pergunta com base nos controles, evidências e documentos da empresa, e devolve o rascunho para revisão antes de enviar.

## Ordem de entrega
1. **Item 3** (lote + reuso entre frameworks): maior ganho imediato, reusa o que já existe no Gap Analysis.
2. **Item 4** (preenchimento inteligente): melhora cada criação de registro.
3. **Item 5** (pacote de auditoria → Trust Center → questionários): entrega em três partes, começando pelo pacote de auditoria.

## Detalhes técnicos
- Barra de lote: generalizar o padrão do `BulkActionBar` do Gap Analysis para os demais módulos, sempre filtrado por `empresa_id`, com confirmação e aviso pelo sino ao concluir.
- Reuso entre frameworks: usar o mapeamento já existente entre requisitos equivalentes; a cópia vira "proposta" e só vale após aprovação.
- Links de ação por e-mail: tokens assinados de uso único e validade curta, validados em Edge Function; nenhuma ação sensível sem confirmação na tela de destino.
- Preenchimento inteligente: sugestões via IA (seguindo a regra de créditos da empresa, com tratamento de 402) combinadas com regras simples (prazo por severidade, categoria por palavras-chave). Nada é salvo sem confirmação.
- Pacote de auditoria: monta a partir dos dados já existentes (avaliações, evidências, planos), usando os utilitários de PDF/CSV padronizados.
- Trust Center: página pública com token por empresa, mostrando apenas o que a empresa marcar como público; desligada por padrão.
- Questionários: leitura do arquivo enviado via IA, respostas sempre como rascunho para revisão humana.
- Todos os textos novos em PT e EN via `t()`, com teste de paridade. Visual conforme a identidade Akuris (Chip, StatusBadge, AkurisPulse).
