/**
 * Textos fixos do DocGen que precisam ser reutilizados fora do componente
 * (testes de regressão, acessibilidade).
 *
 * AKURIS QA-002: o diálogo do DocGen abria sem descrição acessível, gerando o
 * aviso do Radix "Missing `Description` or `aria-describedby={undefined}`" e
 * deixando tecnologias assistivas sem contexto sobre a finalidade da janela.
 */
export const DOCGEN_DIALOG_DESCRIPTION =
  'Assistente de IA que conduz um briefing guiado, gera o documento de governança, ' +
  'permite refinar seções, analisar aderência a requisitos e salvar o resultado em Documentos.';
