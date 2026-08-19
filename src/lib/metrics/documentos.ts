import { norm, countBy, isVencido, isAVencer } from './core';

export interface DocumentoLike {
  status?: string | null;
  data_vencimento?: string | null;
  classificacao?: string | null;
  data_aprovacao?: string | null;
}

export type EstadoDocumento =
  | 'ativo'
  | 'rascunho'
  | 'pendente_aprovacao'
  | 'arquivado'
  | 'indefinido';
const MAP_ESTADO: Record<string, EstadoDocumento> = {
  ativo: 'ativo',
  ativa: 'ativo',
  publicado: 'ativo',
  vigente: 'ativo',
  rascunho: 'rascunho',
  em_elaboracao: 'rascunho',
  pendente_aprovacao: 'pendente_aprovacao',
  em_aprovacao: 'pendente_aprovacao',
  aguardando_aprovacao: 'pendente_aprovacao',
  arquivado: 'arquivado',
  obsoleto: 'arquivado',
  inativo: 'arquivado',
};

export const estadoDocumento = (d: DocumentoLike): EstadoDocumento =>
  MAP_ESTADO[norm(d.status)] ?? 'indefinido';
export const isDocumentoAtivo = (d: DocumentoLike) => estadoDocumento(d) === 'ativo';
export const isDocumentoPendenteAprovacao = (d: DocumentoLike) =>
  estadoDocumento(d) === 'pendente_aprovacao';
// Só documento ATIVO vence. Um rascunho nunca foi publicado e um arquivado já
// saiu de circulação — nenhum dos dois tem vigência para expirar. A faixa
// dizia "vencendo em 30 dias: 2" e um dos dois era um rascunho.
export const isDocumentoVencido = (d: DocumentoLike, ref: Date = new Date()) =>
  isDocumentoAtivo(d) && isVencido(d.data_vencimento, ref);
export const isDocumentoAVencer = (d: DocumentoLike, ref: Date = new Date(), dias = 30) =>
  isDocumentoAtivo(d) && isAVencer(d.data_vencimento, ref, dias);

export const contarDocumentos = (
  documentos: DocumentoLike[] | null | undefined,
  ref: Date = new Date(),
) => ({
  total: documentos?.length ?? 0,
  ativos: countBy(documentos, isDocumentoAtivo),
  vencidos: countBy(documentos, (d) => isDocumentoVencido(d, ref)),
  vencendo30Dias: countBy(documentos, (d) => isDocumentoAVencer(d, ref, 30)),
  confidenciais: countBy(documentos, (d) => norm(d.classificacao) === 'confidencial'),
  aprovados: countBy(documentos, (d) => !!d.data_aprovacao),
  pendentesAprovacao: countBy(documentos, isDocumentoPendenteAprovacao),
});
