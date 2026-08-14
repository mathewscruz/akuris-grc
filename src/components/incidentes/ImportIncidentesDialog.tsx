import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import ImportCsvDialog, { ImportCsvColumn, ImportCsvDialogTexts } from '@/components/common/ImportCsvDialog';
import { formatStatus } from '@/lib/text-utils';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const tipos = ['seguranca', 'privacidade', 'disponibilidade'];
const criticidades = ['baixa', 'media', 'alta', 'critica'];
const statusOptions = ['aberto', 'investigacao', 'contido', 'resolvido', 'fechado'];

const ImportIncidentesDialog: React.FC<Props> = ({ open, onOpenChange, onSuccess }) => {
  const { t } = useLanguage();

  const columns: ImportCsvColumn[] = [
    { key: 'titulo', label: t('p3Import.incidentes.colTitulo'), required: true },
    { key: 'tipo_incidente', label: t('p3Import.incidentes.colTipo'), required: true, enumValues: tipos },
    { key: 'categoria', label: t('p3Import.incidentes.colCategoria') },
    { key: 'criticidade', label: t('p3Import.incidentes.colCriticidade'), enumValues: criticidades, defaultValue: 'media' },
    { key: 'status', label: t('p3Import.incidentes.colStatus'), enumValues: statusOptions, defaultValue: 'aberto' },
    { key: 'data_deteccao', label: t('p3Import.incidentes.colDataDeteccao'), required: true, type: 'date' },
    { key: 'data_ocorrencia', label: t('p3Import.incidentes.colDataOcorrencia'), type: 'date' },
    { key: 'descricao', label: t('p3Import.incidentes.colDescricao') },
  ];

  const texts: ImportCsvDialogTexts = {
    title: t('p3Import.incidentes.title'),
    description: t('p3Import.incidentes.description'),
    alertTitle: t('p3Import.alertTitle'),
    alertDescription: t('p3Import.alertDescription'),
    step1Title: t('p3Import.step1Title'),
    step1Description: t('p3Import.step1Description'),
    downloadTemplateButton: t('p3Import.downloadTemplateButton'),
    step2Title: t('p3Import.step2Title'),
    step2Description: t('p3Import.step2Description'),
    selectFileButton: t('p3Import.selectFileButton'),
    fieldsAvailableTitle: t('p3Import.fieldsAvailableTitle'),
    fieldsRequired: t('p3Import.fieldsRequired'),
    fieldsOptional: t('p3Import.fieldsOptional'),
    previewTitle: t('p3Import.previewTitle'),
    previewDescription: t('p3Import.previewDescription'),
    badgeValid: t('p3Import.badgeValid'),
    badgeError: t('p3Import.badgeError'),
    columnLine: t('p3Import.columnLine'),
    columnStatus: t('p3Import.columnStatus'),
    columnErrors: t('p3Import.columnErrors'),
    backButton: t('p3Import.backButton'),
    importingTitle: t('p3Import.importingTitle'),
    importingDescription: t('p3Import.importingDescription'),
    successTitle: t('p3Import.successTitle'),
    successDescription: t('p3Import.successDescription'),
    closeButton: t('p3Import.closeButton'),
    errorEmptyFile: t('p3Import.errorEmptyFile'),
    errorParseFile: t('p3Import.errorParseFile'),
    errorNoEmpresa: t('p3Import.errorNoEmpresa'),
    errorRequiredField: (field) => t('p3Import.errorRequiredField', { field }),
    errorInvalidEnum: (field, values) => t('p3Import.errorInvalidEnum', { field, values }),
    errorInvalidDate: (field) => t('p3Import.errorInvalidDate', { field }),
    errorInvalidNumber: (field) => t('p3Import.errorInvalidNumber', { field }),
    toastImportSuccess: (count) => t('p3Import.toastImportSuccess', { count }),
    toastImportError: (count) => t('p3Import.toastImportError', { count }),
    importButton: (count) => t('p3Import.importButtonWithCount', { count }),
    importingPercent: (percent) => t('p3Import.importingPercentLabel', { percent }),
  };

  return (
    <ImportCsvDialog
      open={open}
      onOpenChange={onOpenChange}
      onSuccess={onSuccess}
      texts={texts}
      columns={columns}
      tableName="incidentes"
      templateFileName={t('p3Import.incidentes.templateFile')}
      templateSample={[
        ['Acesso não autorizado ao sistema', 'seguranca', 'Acesso Indevido', 'alta', 'aberto', '2024-01-15', '2024-01-15', 'Tentativa de acesso não autorizado detectada pelo firewall'],
      ]}
      previewColumns={[
        { key: 'titulo', label: t('p3Import.incidentes.colTitulo') },
        { key: 'tipo_incidente', label: t('p3Import.incidentes.colTipo'), render: (v) => formatStatus(v) },
        { key: 'criticidade', label: t('p3Import.incidentes.colCriticidade'), render: (v) => formatStatus(v) },
        { key: 'status', label: t('p3Import.incidentes.colStatus'), render: (v) => formatStatus(v) },
      ]}
      buildPayload={(row) => ({
        titulo: row.titulo,
        tipo_incidente: row.tipo_incidente,
        categoria: row.categoria || null,
        criticidade: row.criticidade || 'media',
        status: row.status || 'aberto',
        data_deteccao: row.data_deteccao,
        data_ocorrencia: row.data_ocorrencia || null,
        descricao: row.descricao || null,
      })}
    />
  );
};

export default ImportIncidentesDialog;
