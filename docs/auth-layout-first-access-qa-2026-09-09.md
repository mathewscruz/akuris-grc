# Login e reenvio do primeiro acesso — 09/09/2026

## Correções

- O `AuthShell` tinha um limite de 1.600 px e centralizava as duas colunas, deixando faixas laterais em monitores grandes. Agora a estrutura ocupa toda a largura e a altura dinâmica da janela; apenas o formulário mantém largura limitada para leitura confortável. A prévia não usa mais margens negativas que cortavam conteúdo em telas menores.
- O reenvio administrativo podia enviar `/auth` como alternativa quando a geração do link de senha falhava. Agora exige token de recuperação válido e vínculo com o usuário solicitado; sem isso, não envia o e-mail.
- Reenvios individuais e em lote só confirmam sucesso quando o serviço confirma o envio. O aviso de espera de cinco minutos chega ao administrador em vez da mensagem genérica de erro de função.
- Preservados: autenticação, MFA, permissões de administrador, isolamento de empresa, recuperação de senha e ausência de tokens de recuperação no perfil/resposta ao administrador.

## Validação

- Navegador real em 2878×1540, 1440×900, 1024×768, 390×844 e 844×390: estrutura de ponta a ponta, sem rolagem horizontal; telas baixas podem rolar verticalmente sem cortar o formulário.
- 27 testes direcionados de interface, autenticação e identidade dos e-mails aprovados.
- Bateria completa: 1.027 testes em 185 arquivos aprovados, encerrando sem erros com dois workers. A primeira execução passou os casos, mas teve um timeout interno de comunicação do executor; a repetição controlada eliminou esse erro.
- Verificação de tipos e build aprovados. Permanecem apenas os avisos existentes de pacotes grandes no build.
- 15 testes de comportamento do reenvio aprovados: sucesso, falha de geração, token ausente/conta divergente, falha de transporte, resposta sem confirmação, intervalo de espera, MFA, administrador, empresa e dados inválidos.
- Teste integrado local com empresa e duas contas descartáveis: login de administrador, bloqueio antes do MFA, emissão/validação normal do MFA, reenvio pelo endpoint real, mensagem recebida na caixa local, token recebido verificado, definição de senha e login com a nova senha. Segundo reenvio retornou 429. Data de envio registrada sem armazenar o token.
- As contas, a empresa, as sessões/códigos MFA e os e-mails de teste foram removidos. Nenhuma conta de cliente ou configuração de produção foi alterada.

## Limites e publicação

O transporte de testes fica exclusivamente no ambiente local e fora do versionamento. Inicialmente só o MFA usava esse transporte; o envio de boas-vindas local retornou erro de chave inválida. O reenvio passou após direcionar também esse envio à caixa local. Isso não é diagnóstico da chave de produção.

Entrega externa pelo provedor de produção não foi disparada nesta tarefa. A validação demonstra o fluxo integrado local, não chegada à caixa de entrada/spam de cada cliente.

A publicação usa a função `resend-welcome-email` com seu `handler.ts` antes do frontend. Não são necessárias migrações de banco nem alterações de MFA. O código de testes e o transporte local não fazem parte do envio.

## Índice Operacional incluído na mesma entrega

- Anel e número do dashboard usam interpolação contínua entre os tokens de vermelho, âmbar e verde, sem cores constantes por faixa. A alteração é apenas visual; cálculo, rótulos e demais módulos foram preservados.
- Ausência de dados permanece neutra, distinta de zero. Movimento reduzido é respeitado.
- 17 testes direcionados de componentes e regressão aprovados; verificação de tipos e build aprovados.
- 201 pontos da escala verificados por tema, inclusive contra o fundo levemente tingido do painel: contraste mínimo de 3,15:1 no claro e 3,93:1 no escuro para o indicador e seu número grande.
