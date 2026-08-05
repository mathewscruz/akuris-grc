/**
 * Contrato da consulta de aprovações pendentes de documentos.
 *
 * AKURIS QA-003: `documentos_aprovacoes` não tinha FK para `documentos`, então o
 * embed `documentos(nome)` devolvia HTTP 400 / PGRST200 e derrubava a carga das
 * notificações de aprovação. Os dois embeds são resolvidos pela coluna de FK
 * (`documento_id`, `solicitado_por`) em vez do nome da tabela, mantendo o alias
 * consumido pelo componente e evitando ambiguidade caso outra FK para as mesmas
 * tabelas seja criada no futuro.
 *
 * Manter a consulta aqui permite a cobertura de regressão que confere cada embed
 * contra as FKs declaradas nas migrations.
 */
export const APROVACOES_PENDENTES_SELECT =
  'id, documento_id, status, tipo_acao, solicitado_por, created_at, documentos:documento_id(nome), profiles:solicitado_por(nome)';
