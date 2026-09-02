/**
 * Rótulos do assistente de escopo.
 *
 * O bloco inglês era o objecto português — a mesma referência nas duas chaves.
 * Com a aplicação em inglês, o assistente inteiro saía em português: os botões,
 * as perguntas, e a justificativa que a empresa assina na Declaração de
 * Aplicabilidade. Uma Declaração em português numa auditoria conduzida em
 * inglês não é mais segura, é ilegível.
 *
 * Aqui ficam só os rótulos. As perguntas e as justificativas, que são texto de
 * conformidade e não interface, vivem em `src/lib/gap-escopo-en.ts` — fora do
 * `t()`, que humaniza chaves em falta e transformaria um buraco de tradução
 * numa frase de aspecto plausível dentro de um documento assinado.
 */
const PT = {
  titulo: 'Vamos encurtar a sua lista',
  conviteTitulo: 'Antes de começar: nem tudo isto se aplica a você',
  conviteTexto: 'São {total} requisitos, e uma parte deles não tem objeto na sua empresa. Responda a algumas perguntas sobre como a empresa funciona — se desenvolve software, se tem escritório, se usa nuvem — e nós tiramos da lista o que não se aplica, já com a justificativa escrita para o auditor ler.',
  conviteLinha: 'São {total} requisitos, e uma parte não tem objeto na sua empresa. Responda algumas perguntas e tiramos da lista o que não se aplica, com a justificativa pronta.',
  conviteBotao: 'Responder as perguntas',
  irDireto: 'Prefiro ir direto para a lista completa',
  revisarTexto: 'A sua empresa mudou? Abriu escritório, passou a usar nuvem, começou a desenvolver software? Responda de novo e o escopo se ajusta.',
  revisarBotao: 'Rever escopo',
  revisar: 'Revisar o que sai',
  voltar: 'Voltar às perguntas',
  aplicar: 'Aplicar ao meu escopo',
  progresso: '{feitas} de {total} respondidas',
  resumoParcial: '{fora} saem, restam {resta}',
  saiDoEscopo: '{n} requisito(s) saem do escopo com esta resposta.',
  justificativaLabel: 'O QUE FICARÁ ESCRITO NA DECLARAÇÃO DE APLICABILIDADE',
  confirmarResumo: 'Vão sair {fora} requisitos do seu escopo. Ficam {resta} para trabalhar.',
  confirmarAviso: 'Leia cada justificativa antes de aplicar. Elas afirmam coisas sobre a sua empresa e é a sua empresa que assina, não o Akuris. Pode editar o texto agora, e pode rever tudo depois na aba Aplicabilidade.',
  nadaAExcluir: 'Nenhum requisito sai com estas respostas.',
  gravado: '{n} requisitos marcados como não aplicáveis, com justificativa.',
  erroGravar: 'Não foi possível gravar o escopo. Tente novamente.',
  resposta: { sim: 'Sim', nao: 'Não', nao_sei: 'Não sei' },
};

const EN: typeof PT = {
  titulo: 'Let us shorten your list',
  conviteTitulo: 'Before you start: not all of this applies to you',
  conviteTexto: 'There are {total} requirements, and some of them have no object in your company. Answer a few questions about how the company works — whether it develops software, whether it has an office, whether it uses cloud — and we will take off the list what does not apply, with the justification already written for the auditor to read.',
  conviteLinha: 'There are {total} requirements, and some have no object in your company. Answer a few questions and we will take off the list what does not apply, with the justification ready.',
  conviteBotao: 'Answer the questions',
  irDireto: 'I would rather go straight to the full list',
  revisarTexto: 'Has your company changed? Opened an office, started using cloud, started developing software? Answer again and the scope adjusts.',
  revisarBotao: 'Review scope',
  revisar: 'Review what leaves',
  voltar: 'Back to the questions',
  aplicar: 'Apply to my scope',
  progresso: '{feitas} of {total} answered',
  resumoParcial: '{fora} leave, {resta} remain',
  saiDoEscopo: '{n} requirement(s) leave the scope with this answer.',
  justificativaLabel: 'WHAT WILL BE WRITTEN IN THE STATEMENT OF APPLICABILITY',
  confirmarResumo: '{fora} requirements will leave your scope. {resta} remain to work on.',
  confirmarAviso: 'Read each justification before applying. They assert things about your company, and it is your company that signs them, not Akuris. You can edit the text now, and you can review everything later on the Applicability tab.',
  nadaAExcluir: 'No requirement leaves the scope with these answers.',
  gravado: '{n} requirements marked as not applicable, with justification.',
  erroGravar: 'The scope could not be saved. Please try again.',
  /* «Not sure» e não «I do not know»: é a mesma resposta e cabe no botão, que
     está numa fila de três e não pode partir a linha. */
  resposta: { sim: 'Yes', nao: 'No', nao_sei: 'Not sure' },
};

export const gapEscopo = {
  pt: { gapEscopo: PT },
  en: { gapEscopo: EN },
};
