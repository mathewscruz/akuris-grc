/**
 * Rótulos do assistente de escopo.
 *
 * O bloco inglês repete o português: o conteúdo foi escrito para o mercado
 * brasileiro e ainda não foi traduzido. Repetir é honesto e mantém a paridade
 * de chaves; traduzir texto de conformidade à pressa não é.
 */
const TEXTO = {
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

export const gapEscopo = {
  pt: { gapEscopo: TEXTO },
  en: { gapEscopo: TEXTO },
};
