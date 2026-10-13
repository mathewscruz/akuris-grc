# Completar os dados de demonstração além das tabelas

Os registros de demonstração já aparecem nas listas, mas alguns detalhes ainda abrem vazios ao clicar. Exemplos: documentos sem arquivo para abrir e questionários de due diligence sem respostas e sem nota por tema.

## O que já foi confirmado
- **Documentos:** 18 documentos da Nexure não têm arquivo ligado, então "visualizar" e "baixar" não têm o que mostrar.
- **Due diligence:** as 3 avaliações têm um questionário modelo com perguntas, mas nenhuma resposta e nenhuma nota detalhada.

## O que será feito

1. **Documentos com arquivo de verdade**
   - Gerar arquivos PDF curtos e realistas, com título, objetivo, escopo, regras, responsáveis e histórico de versões, para as 12 políticas e procedimentos de demonstração.
   - Guardar os arquivos na área de documentos da Nexure e ligá-los a cada registro, para que a pré-visualização e o download funcionem.
   - Adicionar histórico de versões, aprovações (aprovada e pendente) e comentários.

2. **Due diligence com avaliação completa**
   - Responder todas as perguntas das 2 avaliações concluídas: uma de risco baixo (nota em torno de 82) e outra de risco alto (nota em torno de 54).
   - Calcular a nota por tema e um parecer resumido, para que a tela de resultado mostre o gráfico e a classificação.
   - Manter a 3ª avaliação como "enviada", com o link do questionário funcionando para o fornecedor responder.

3. **Outros detalhes que hoje abrem vazios**
   - **Contratos:** ligar um arquivo PDF a cada contrato e acrescentar aditivos e marcos.
   - **Controles e Gap Analysis:** anexar arquivos de evidência a alguns testes e requisitos e preencher a Declaração de Aplicabilidade (SoA) da ISO 27001.
   - **Incidentes:** registrar a comunicação à ANPD e aos titulares no caso de vazamento, além de evidências.
   - **Auditorias:** acrescentar itens de verificação e recomendações para os achados.
   - **Riscos:** ligar riscos a ativos e a requisitos, e incluir comentários e histórico de avaliações.
   - **Denúncias:** acrescentar mensagens com o denunciante e o histórico de andamento.
   - **Revisão de acessos:** criar uma revisão em andamento, com itens para aprovar ou revogar.
   - **Projetos:** acrescentar comentários, checklist e horas registradas nas tarefas.
   - **Continuidade:** registrar um teste realizado com resultado.

4. **Conferência pelo sistema**
   - Entrar como henrique.mathews@gmail.com e abrir o detalhe de cada módulo para confirmar que nada aparece vazio ou com erro. Isso inclui pré-visualizar um documento, abrir o resultado de uma due diligence e abrir o link público do questionário.
   - Corrigir na hora qualquer tela que ainda apareça vazia por falta de dados.

## Notas técnicas
- Os arquivos são gerados localmente e enviados aos espaços de arquivo que já existem (documentos, contratos, evidências), dentro da pasta da Nexure. As regras de acesso atuais continuam valendo, então outras empresas não veem esses arquivos.
- As notas da due diligence seguem o mesmo cálculo que o sistema já usa.
- Não há mudança de estrutura do banco nem de código, salvo se a conferência revelar algum erro de exibição.
