# Continuidade bloqueada e acesso dos usuários indisponível

## O que encontrei

**1. Continuidade bloqueada mesmo para super admin (confirmado)**
O plano da Nexure, "Akuris Manager", não inclui o módulo Continuidade. Para super admin, o sistema libera tudo, menos o que está fora do plano contratado pela empresa. Por isso aparece a tela de bloqueio.
Na mesma situação estão Ativos, Auditorias, Privacidade e Contas Privilegiadas, que também ficam fora desse plano.

**2. "Informação de acesso indisponível" (confirmado)**
Os registros de login mostram "sessão não encontrada" toda vez que essa tela tenta ler os dados. Ou seja, sua sessão foi encerrada no servidor, mas o navegador continuou usando a sessão antiga.
- **Causa:** o botão "Sair" encerra a sessão em todos os dispositivos e abas, e não só na atual. Basta sair no site publicado, por exemplo, para a sessão da pré-visualização (ou de outro computador) parar de funcionar sem aviso.
- **Efeito na tela:** as listas continuam aparecendo, mas tudo que depende de verificação no servidor falha, como a informação de acesso dos usuários.

**3. Bloqueio que continua ao trocar de módulo (ainda não confirmado)**
Ainda não confirmei a causa. A suspeita é que a área de conteúdo não se redesenha ao mudar de página depois de mostrar o bloqueio.

## O que será feito

1. **Liberar Continuidade nos planos**
   - Incluir Continuidade nos planos de GRC, como foi feito antes com Painel e Projetos, para que ninguém com esses planos fique bloqueado.
   - Para os outros módulos fora do plano Akuris Manager (Ativos, Auditorias, Privacidade e Contas Privilegiadas), vou perguntar antes se devem entrar. Isso muda o que cada plano vende.

2. **"Sair" encerra só a sessão atual**
   - O botão "Sair" e a saída automática por inatividade passam a encerrar apenas a sessão do aparelho atual.
   - "Sair de todos os dispositivos" continua disponível no perfil, e a troca de senha continua encerrando todas as sessões, como hoje.

3. **Sessão encerrada no servidor**
   - Quando o servidor responder que a sessão não existe mais, o sistema tenta renovar a sessão. Se não conseguir, leva a pessoa ao login com uma mensagem clara, em vez de mostrar "indisponível".

4. **Bloqueio ao trocar de módulo**
   - Reproduzir o problema na tela, achar a causa e corrigir, para que a tela de bloqueio desapareça ao trocar de módulo.

5. **Testes**
   - Continuidade liberada no plano de super admin.
   - "Sair" comum mantém as outras sessões ativas.
   - Sessão inexistente leva ao login.

## Ação imediata para você
Saia e entre de novo no sistema. Isso cria uma sessão nova e a informação de acesso dos usuários volta a aparecer. Continuidade só será liberada depois do passo 1.
