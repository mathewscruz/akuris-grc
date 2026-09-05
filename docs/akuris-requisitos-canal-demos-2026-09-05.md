# Requisitos, identidade do canal e demonstrações do produto

Implementação local em 05/09/2026. Nenhuma publicação em produção nesta rodada.

## Entregas

- O popup de requisito usa quatro etapas: Entender, Avaliar, Comprovar e Revisar e encaminhar. Há uma única área principal de rolagem, navegação livre e indicação da próxima pendência.
- A abertura apresenta a descrição do requisito, orientações práticas e até três itens de implementação extraídos da orientação existente. O artigo completo permanece disponível sob demanda, sem alterar o conteúdo armazenado.
- Respostas são preservadas ao trocar de etapa. O fechamento protege alterações não salvas; o status mantém sua persistência imediata, explicitada na interface. Uma recomendação incompleta não pode ser aplicada.
- A revisão distingue evidências, plano de ação, responsável, prazo e justificativa conforme o estado do requisito. Salvar não equivale a aprovar evidências ou certificar conformidade. Regras de escopo e critérios existentes foram preservados.
- O seletor de conformidade é compartilhado entre tabela e popup: campo neutro, marcador semântico, título e descrição em cada opção, com navegação por teclado.
- O canal público usa o arquivo fornecido, com escrita escura, como alternativa padrão para qualquer empresa sem logo próprio ou cujo logo falhe. Logos próprios continuam sendo respeitados. O arquivo já presente em `src/assets/akuris-logo-light.png` é idêntico ao anexo.
- As demonstrações da landing usam componentes reais e dados fictícios: matriz de riscos interativa, execução do controle, documento de revisão de acessos e gráfico de distribuição por criticidade. As quatro cenas continuam presentes simultaneamente. A demonstração de Gap Analysis inclui contexto e revisão do avaliador.
- Novas mensagens estão nos dicionários PT/EN. A preferência por movimento reduzido e os controles de pausa foram preservados.

## Validação no navegador

- A conta local existente foi acessada pelo fluxo de link de autenticação entregue na caixa de e-mails de desenvolvimento. Não houve redefinição de senha, alteração de MFA ou de autenticação.
- Popup validado no framework ISO/IEC 27001 da empresa de QA existente. Não foram gravadas avaliações pela interface durante a inspeção.
- Verificadas navegação das etapas, preservação de estado, menu de status e descrições sem corte. Popup e demonstrações conferidos em 320 e 390 pixels, sem transbordamento horizontal nos componentes avaliados.
- Portal anônimo conferido em entrada, registro e acompanhamento: logo escuro carregado sobre fundo branco.
- Movimento reduzido conferido no navegador: efeitos decorativos interrompidos e informações dos gráficos disponíveis.
- Emulações de tamanho e movimento foram restauradas. O popup real ficou aberto na sessão local para conferência.

## Verificações técnicas

- TypeScript: aprovado (`npm run typecheck`).
- Build: aprovado (`npm run build`), incluindo as 14 páginas públicas pré-renderizadas. Permanece o aviso de chunks maiores que 500 kB; esta rodada não resolve todo o peso dos módulos existentes.
- ESLint dos componentes alterados: sem erros. Alertas não bloqueantes existentes não foram tratados como escopo desta reformulação.
- `git diff --check`: aprovado.
- Suíte completa final: 158 arquivos, 877 testes aprovados (`npx vitest run --maxWorkers=2`), incluindo proteção de rascunho, navegação, logo alternativo e interações das demonstrações.

## Limites

- As demonstrações são interativas e usam elementos reais da interface, mas não são gravações de sessões de clientes.
- Não houve mudança em RLS, MFA, políticas de autenticação, dados de clientes, certificações ou aprovação automática de compliance.
- Alterações pendentes de trabalhos anteriores foram preservadas. A publicação continua pendente de uma rodada de deploy.
