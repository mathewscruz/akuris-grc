/**
 * Kit de popups Akuris — complementa o DialogShell (que já é o padrão de
 * FORMULÁRIO centralizado, adotado em ~27 telas: header + scroll + rodapé
 * Cancel/Save + Ctrl+S + guarda de alterações não salvas).
 *
 * Este módulo NÃO reimplementa o shell de formulário. Ele fornece:
 *  - Cascas para popups LATERAIS (Sheet) e de DETALHE, que o DialogShell não
 *    cobre: ModalHeader (com navegação "N de M", badges, ações), ModalBody,
 *    ModalFooter.
 *  - Primitivos de conteúdo reutilizáveis em qualquer shell: FieldRow
 *    (ícone+rótulo+valor), DetailSection (título+ação), SubCard (borda de acento).
 *
 * Regras:
 *  - Formulário centralizado (criar/editar) → use DialogShell.
 *  - Detalhe / painel lateral → use Sheet + ModalHeader/Body/Footer + primitivos.
 *  - Badge de status → sempre <StatusBadge>.
 */
export {
  ModalHeader,
  ModalBody,
  ModalFooter,
  FieldRow,
  DetailSection,
  SubCard,
  type ModalHeaderProps,
  type RecordNav,
} from './ModalPrimitives';
