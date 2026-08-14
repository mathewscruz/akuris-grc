import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import ImportCsvDialog, { ImportCsvColumn, ImportCsvDialogTexts } from '@/components/common/ImportCsvDialog';
import { formatStatus } from '@/lib/text-utils';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const tiposChave = ['api_key', 'certificado_ssl', 'ssh_key', 'token_acesso', 'secret_key', 'outro'];
const ambientes = ['producao', 'homologacao', 'desenvolvimento', 'qa'];
const criticidades = ['critica', 'alta', 'media', 'baixa'];
const statusOptions = ['ativa', 'expirada', 'revogada', 'em_rotacao'];

const ImportChavesDialog: React.FC<Props> = ({ open, onOpenChange, onSuccess }) => {
  const { t } = useLanguage();

  const columns: ImportCsvColumn[] = [
    { key: 'nome', label: t('p3Import.chaves.colNome'), required: true },
    { key: 'tipo_chave', label: t('p3Import.chaves.colTipo'), required: true, enumValues: tiposChave },
    { key: 'ambiente', label: t('p3Import.chaves.colAmbiente'), required: true, enumValues: ambientes },
    { key: 'localizacao', label: t('p3Import.chaves.colLocalizacao'), required: true },
    { key: 'data_criacao', label: t('p3Import.chaves.colDataCriacao'), required: true, type: 'date' },
    { key: 'data_proxima_rotacao', label: t('p3Import.chaves.colDataProximaRotacao'), required: true, type: 'date' },
    { key: 'criticidade', label: t('p3Import.chaves.colCriticidade'), enumValues: criticidades, defaultValue: 'media' },
    { key: 'status', label: t('p3Import.chaves.colStatus'), enumValues: statusOptions, defaultValue: 'ativa' },
    { key: 'algoritmo', label: t('p3Import.chaves.colAlgoritmo') },
    { key: 'sistema_aplicacao', label: t('p3Import.chaves.colSistemaAplicacao') },
    { key: 'observacoes', label: t('p3Import.chaves.colObservacoes') },
  ];

  const texts: ImportCsvDialogTexts = {
    title: t('p3Import.chaves.title'),
    description: t('p3Import.chaves.description'),
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
      tableName="ativos_chaves_criptograficas"
      templateFileName={t('p3Import.chaves.templateFile')}
      templateSample={[
        ['API Gateway Key', 'api_key', 'producao', 'AWS Secrets Manager', '2024-01-01', '2025-01-01', 'alta', 'ativa', 'AES-256', 'API Gateway', ''],
      ]}
      previewColumns={[
        { key: 'nome', label: t('p3Import.chaves.colNome') },
        { key: 'tipo_chave', label: t('p3Import.chaves.colTipo'), render: (v) => formatStatus(v) },
        { key: 'ambiente', label: t('p3Import.chaves.colAmbiente'), render: (v) => formatStatus(v) },
        { key: 'criticidade', label: t('p3Import.chaves.colCriticidade'), render: (v) => formatStatus(v) },
      ]}
      buildPayload={(row) => ({
        nome: row.nome,
        tipo_chave: row.tipo_chave,
        ambiente: row.ambiente,
        localizacao: row.localizacao,
        data_criacao: row.data_criacao,
        data_proxima_rotacao: row.data_proxima_rotacao,
        criticidade: row.criticidade || 'media',
        status: row.status || 'ativa',
        algoritmo: row.algoritmo || null,
        sistema_aplicacao: row.sistema_aplicacao || null,
        observacoes: row.observacoes || null,
      })}
    />
  );
};

export default ImportChavesDialog;
