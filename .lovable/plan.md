# Entrega do convite para mauricioronei@najason.com.br

## Diagnóstico (verificado)
- O problema é o **endereço do destinatário**, não o Akuris.
- O domínio `najason.com.br` **não existe** no Registro.br (consulta de DNS retorna "domínio inexistente"). Não tem servidor de e-mail, então nenhuma mensagem pode ser entregue. Por isso o status ficou como "Delivery Delayed" (o serviço de envio continua tentando, sem conseguir).
- O envio do Akuris está correto: remetente `noreply@akuris.com.br` com assinatura (DKIM), SPF e DMARC configurados.

## O que fazer
1. Confirmar com o Mauricio o e-mail certo (provável erro de digitação no domínio, ex.: nome da empresa escrito diferente).
2. Em Configurações → Usuários, corrigir o e-mail dele e usar "Reenviar convite".

## Melhoria opcional (se aprovar)
- Ao criar ou editar usuário, verificar se o domínio do e-mail existe e tem servidor de e-mail; se não tiver, mostrar o aviso "Este domínio não recebe e-mails, confira o endereço" antes de salvar. Evita convites perdidos por erro de digitação.
