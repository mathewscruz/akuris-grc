import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import ImportCsvDialog, { ImportCsvColumn, ImportCsvDialogTexts } from '@/components/common/ImportCsvDialog';
import { formatStatus } from '@/lib/text-utils';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const tiposLicenca = ['software', 'servico', 'certificacao', 'outro'];
const criticidades = ['critica', 'alta', 'media', 'baixa'];
const statusOptions = ['ativa', 'vencida', 'a_vencer', 'em_renovacao', 'cancelada'];

const ImportLicencasDialog: React.FC<Props> = ({ open, onOpenChange, onSuccess }) => {
  const { t } = useLanguage();

  const columns: ImportCsvColumn[] = [
    { key: 'nome', label: t('p3Import.licencas.colNome'), required: true },
    { key: 'tipo_licenca', label: t('p3Import.licencas.colTipo'), required: true, enumValues: tiposLicenca },
    { key: 'fornecedor', label: t('p3Import.licencas.colFornecedor'), required: true },
    { key: 'quantidade_licencas', label: t('p3Import.licencas.colQtd'), type: 'number', defaultValue: '1' },
    { key: 'data_inicio', label: t('p3Import.licencas.colDataInicio'), required: true, type: 'date' },
    { key: 'data_vencimento', label: t('p3Import.licencas.colDataVencimento'), required: true, type: 'date' },
    { key: 'criticidade', label: t('p3Import.licencas.colCriticidade'), enumValues: criticidades, defaultValue: 'media' },
    { key: 'status', label: t('p3Import.licencas.colStatus'), enumValues: statusOptions, defaultValue: 'ativa' },
    { key: 'valor_renovacao', label: t('p3Import.licencas.colValorRenovacao'), type: 'number' },
    { key: 'numero_licenca', label: t('p3Import.licencas.colNumeroLicenca') },
    { key: 'observacoes', label: t('p3Import.licencas.colObservacoes') },
  ];

  const texts: ImportCsvDialogTexts = {
    title: t('p3Import.licencas.title'),
    description: t('p3Import.licencas.description'),
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
      tableName="ativos_licencas"
      templateFileName={t('p3Import.licencas.templateFile')}
      templateSample={[
        ['Microsoft 365 E3', 'software', 'Microsoft', '50', '2024-01-01', '2025-01-01', 'alta', 'ativa', '15000', 'LIC-001', ''],
      ]}
      previewColumns={[
        { key: 'nome', label: t('p3Import.licencas.colNome') },
        { key: 'tipo_licenca', label: t('p3Import.licencas.colTipo'), render: (v) => formatStatus(v) },
        { key: 'criticidade', label: t('p3Import.licencas.colCriticidade'), render: (v) => formatStatus(v) },
      ]}
      buildPayload={(row) => ({
        nome: row.nome,
        tipo_licenca: row.tipo_licenca,
        fornecedor: row.fornecedor,
        quantidade_licencas: row.quantidade_licencas || 1,
        data_inicio: row.data_inicio,
        data_vencimento: row.data_vencimento,
        criticidade: row.criticidade || 'media',
        status: row.status || 'ativa',
        valor_renovacao: row.valor_renovacao || null,
        numero_licenca: row.numero_licenca || null,
        observacoes: row.observacoes || null,
      })}
    />
  );
};

export default ImportLicencasDialog;
