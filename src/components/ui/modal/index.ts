/**
 * Kit de popups Akuris — padrão único para diálogos/sheets.
 *
 * Dois níveis de uso:
 *  1. FormModal — envelope pronto p/ formulários (criar/editar). Escolhe
 *     Dialog (centralizado) ou Sheet (lateral), já com cabeçalho/rodapé e
 *     fechar-ao-salvar + loading centralizados. Ideal p/ forms simples.
 *  2. Primitivos (ModalHeader/Body/Footer, FieldRow, DetailSection, SubCard)
 *     — para compor popups de DETALHE ou forms complexos (react-hook-form,
 *     abas) dentro do próprio DialogContent/SheetContent, mantendo o mesmo
 *     cabeçalho/rodapé sem remontar à mão.
 *
 * Badges de status: usar sempre <StatusBadge> (src/components/ui/status-badge).
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
export { FormModal, type FormModalProps } from './FormModal';
