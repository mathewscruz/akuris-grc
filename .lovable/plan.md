Vou ajustar o fluxo de autenticação para que o toast “Login realizado com sucesso” apareça somente uma vez, imediatamente após um login real/MFA concluído, e nunca ao apenas navegar de volta ao Dashboard.

Plano de correção:

1. Centralizar o toast pós-login fora do Dashboard
- Remover do `Dashboard.tsx` a lógica que lê `sessionStorage.akuris_show_login_toast`.
- Criar/usar uma chave de intenção pós-login com validade curta e consumo único.
- Exibir o toast a partir do fluxo de `/auth` quando o `AuthProvider` efetivamente expuser o usuário autenticado, evitando que qualquer montagem futura do Dashboard dispare o toast novamente.

2. Eliminar a causa do toast reaparecer na navegação
- Não deixar uma flag persistente no `sessionStorage` aguardando o Dashboard montar.
- Limpar a flag em todos os caminhos críticos: login inválido, cancelamento do MFA, logout, sessão expirada, MFA pendente e sessão restaurada.
- Garantir que o toast só seja armado nos dois casos corretos:
  - MFA validado com sucesso.
  - Login direto porque já existe sessão MFA válida dentro das 24h.

3. Revisar o `AuthProvider` para evitar reavaliações ambíguas
- Manter a proteção de sequência monotônica já adicionada, mas adicionar proteções para não refazer `fetchProfile`, `temporary_passwords` e permissões quando o mesmo usuário/sessão já foi promovido.
- Garantir que `SIGNED_OUT` limpe também a flag do toast pós-login, não apenas MFA.
- Manter o padrão correto do Supabase: `onAuthStateChange` sem `await` direto e `getSession()` para restauração inicial.

4. Revisar a tela `/auth` e MFA
- Ajustar a máquina de estados para finalizar o login sem depender do Dashboard.
- No retorno para `/auth` quando já existe usuário autenticado, redirecionar silenciosamente para `/dashboard`, sem toast.
- Manter MFA simples: se não há sessão MFA válida, envia/mostra código; se há sessão MFA válida em 24h, entra direto sem e-mail e sem tela MFA.

5. Corrigir pontos de sessão que podem gerar mensagens indevidas
- Revisar logout por sidebar, logout por inatividade e cancelamento de MFA para limpar flags temporárias.
- Evitar que “Falha no login”/erros genéricos apareçam em transições normais de MFA ou em navegação entre páginas.
- Corrigir `console.error` remanescente no componente de perfil para usar `logger.ts`, mantendo o padrão do projeto.

6. Validação final do fluxo
- Validar por leitura/execução estática os cenários:
  - Login com senha + MFA: toast aparece uma vez.
  - Navegar para outra página e voltar ao Dashboard: nenhum toast de login.
  - Login dentro das 24h: entra direto, sem código por e-mail, toast uma vez.
  - Sessão restaurada ao abrir o app: sem toast de login.
  - Logout/cancelamento MFA/inatividade: flags limpas e sem toast indevido.

Detalhes técnicos:
- A causa provável é que `Dashboard.tsx` consome uma flag global (`akuris_show_login_toast`) no `sessionStorage`. Como ela é definida no fluxo de `/auth` e só é removida quando o Dashboard monta, qualquer falha/interrupção ou remount posterior pode fazer o Dashboard exibir “Login realizado com sucesso” fora de contexto.
- A correção será transformar isso em um evento/intenção de login de consumo imediato no próprio fluxo de autenticação, com limpeza defensiva no `AuthProvider.signOut()` e nos estados de erro/cancelamento.
- Não há necessidade de alteração no banco para este ajuste.