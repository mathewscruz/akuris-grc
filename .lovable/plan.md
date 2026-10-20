# Revisão geral de erros

## O que já verifiquei
- Sem erros de compilação nem erros no ecrã registados na pré-visualização.
- Testes automáticos: só falharam 2.
  1. **Números da planilha de IA sempre em formato brasileiro**: em Financeiro IA, as contagens de chamadas e tokens aparecem como "1.234" mesmo com o sistema em inglês. Bug real, pequeno.
  2. Teste de login da pré-visualização: código da plataforma, não do Akuris. Não afeta os utilizadores.
- O modelo de IA do dia a dia (chat, assistente, e-mails) está marcado como descontinuado pelo fornecedor. Ainda funciona, mas pode parar quando for retirado.

## O que vou fazer
1. Corrigir a formatação dos números na planilha de IA para seguir a língua escolhida.
2. Trocar o modelo de IA do dia a dia por um modelo atual da mesma faixa (rápido e barato), mantendo o Gemini 4 nas análises.
3. Passar uma verificação de segurança do banco de dados e corrigir só o que for crítico (acesso entre empresas, funções expostas).
4. Ver os registos das funções do servidor dos últimos dias e corrigir falhas recorrentes que o utilizador sentiria (análise de documento, orientações, DocGen, convites).
5. Percorrer com o navegador, já autenticado, as páginas principais (Painel, Riscos, Controlos, Gap Analysis, Documentos, Ativos, Incidentes, Denúncias, Configurações) à procura de páginas que quebram ou ficam em branco, e corrigir o que aparecer.
6. Repetir os testes no fim e mostrar-lhe a lista do que foi corrigido e do que ficou pendente.

## Detalhes técnicos
- `ModelosIAUsoCard.tsx`: `toLocaleString(intlLocale())`.
- `_shared/modelos.ts`: `PADRAO` para o modelo flash atual confirmado em `listModels()`; redeploy das funções afetadas; teste de modelo atualizado.
- Supabase linter + scan de segurança; `edge_function_logs` filtrados por 5xx.
- Playwright com sessão injetada, captura de erros de consola e respostas 4xx/5xx por rota.
