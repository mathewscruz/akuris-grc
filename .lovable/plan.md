# Revisão geral: correções pendentes + Configurações

## O que encontrei
O app compila sem erros. Mas 24 verificações automáticas falham e o monitoramento do projeto aponta 3 problemas reais. Separei pelo impacto para quem usa.

### Prioridade 1: o usuário percebe
1. **Janela do requisito (feita agora há pouco):** a largura não está sendo aplicada. Em telas grandes ela pode abrir estreita, em vez de larga com duas colunas.
2. **Planos de Ação, mudar status de vários de uma vez:** quase sempre responde "0 aplicados". Os planos criados no app ou vindos de riscos e frameworks são tratados como "somente leitura" por engano.
3. **QR code do ativo:** quem escaneia cai na lista geral de ativos, não na ficha daquele ativo.
4. **Orientação do requisito:** pode aparecer "Não foi possível concluir a orientação" mesmo com o texto da orientação visível na tela.
5. **Questionário de segurança com IA:** continua respondendo quando os créditos de IA acabaram. Entrega IA fora do plano e não registra o uso.
6. **Datas:** em dois pontos, uma data pode ser gravada como o dia seguinte e, em outro, exibida como o dia anterior, por causa do fuso horário de Brasília.
7. **Gravidade de risco:** duas contagens usam só o risco inerente, ignorando o residual. Assim, o número na tela pode diferir do número no PDF.
8. **Cadastro de contratos:** 4 verificações do formulário falham, como a mensagem de erro visível, o bloqueio de nomes só com espaços e o pedido de confirmação ao cancelar. Vou primeiro reproduzir e confirmar se o defeito é real ou se é a verificação que ficou desatualizada.

### Prioridade 2: consistência visual
9. **Padrões visuais:** campos sem nome acessível, tamanhos de letra e raios fora do padrão, realce de passagem em cinza, avisos com tempo de exibição próprio e texto de gráfico fora da escala.
10. **Cores do índice operacional:** as verificações ainda esperam a paleta antiga, em degradê contínuo. A regra atual, que você aprovou, usa faixas: Excelente verde, Bom teal, Atenção âmbar, Crítico vermelho. Vou atualizar as verificações, sem mudar as cores.
11. **Verificações de pedidos antigos:** as do menu de Configurações e das orientações em lote vou ajustar ao comportamento atual, desde que ele esteja certo.

### Prioridade 3: já aprovado, ainda não feito
12. **Configurações, visão geral em cartões (opção B):** página inicial com o progresso da configuração, pendências com "Resolver", busca e cartões com o estado real de cada área. Ao entrar numa área, o topo mostra "← Configurações / Área" e o menu fica agrupado em Conta, Plataforma e Administração. Os links antigos continuam funcionando.

## Ao final
Rodo todas as verificações de novo e marco os 3 problemas do monitoramento como resolvidos. Sempre que eu não conseguir confirmar algo, digo claramente.

## Detalhes técnicos
1. `RequirementDrawer`: `sm:max-w-6xl sm:p-0`, e a altura com prefixo `sm:`.
2. `PlanosAcao.tsx`: os elegíveis passam a ser `!p._isExternal`, em vez de checar `modulo_origem`.
3. `Ativos.tsx` lê `?ativo=` (ou `AtivoFicha` passa a usar `?focus=`), consultando sempre por `empresa_id`.
4. `useOrientacaoRequisito`: com texto salvo, mostrar o texto e só completar o restante em segundo plano, sem estado `falha` quando já existe orientação. O mesmo ajuste vale em `RequirementDrawer` e em `RequirementDetailDialog`.
5. `answer-security-questionnaire`: tratar o retorno `false` de `consume_ai_credit` com resposta 402, e depois fazer o redeploy.
6. Trocar pelos helpers `parseDataLocal` e `formatarDiaParaDB` nos pontos que os testes apontam.
7. Usar `severidadeRisco()` nos dois pontos apontados.
8. Contratos: reproduzir o teste e corrigir o formulário ou a verificação.
9. a 11. Corrigir os pontos que cada guarda lista; atualizar `operational-score-color` e os testes dos documentos 23 e 111 conforme a regra vigente.
12. Conforme o plano já aprovado: `secoes.ts`, `useConfiguracoesStatus` (tenant-scoped), `calcularProgressoConfiguracao` com teste, `ConfiguracoesVisaoGeral.tsx` e a reorganização de `Configuracoes.tsx`, com textos em PT e EN.
