import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import ImportCsvDialog, { ImportCsvColumn, ImportCsvDialogTexts } from '@/components/common/ImportCsvDialog';
import { formatStatus } from '@/lib/text-utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const tipos = ['servicos', 'licenciamento', 'manutencao', 'consultoria', 'produto'];
const statusOptions = ['rascunho', 'negociacao', 'aprovacao', 'ativo', 'suspenso', 'encerrado', 'cancelado'];
const moedas = ['brl', 'usd', 'eur'];

const ImportContratosDialog: React.FC<Props> = ({ open, onOpenChange, onSuccess }) => {
  const { t } = useLanguage();
  const { profile } = useAuth();

  const columns: ImportCsvColumn[] = [
    { key: 'numero_contrato', label: t('p3Import.contratos.colNumero'), required: true },
    { key: 'nome', label: t('p3Import.contratos.colNome'), required: true },
    { key: 'fornecedor', label: t('p3Import.contratos.colFornecedor'), required: true },
    { key: 'tipo', label: t('p3Import.contratos.colTipo'), required: true, enumValues: tipos },
    { key: 'status', label: t('p3Import.contratos.colStatus'), enumValues: statusOptions, defaultValue: 'rascunho' },
    { key: 'valor', label: t('p3Import.contratos.colValor'), type: 'number' },
    { key: 'moeda', label: t('p3Import.contratos.colMoeda'), enumValues: moedas, defaultValue: 'brl' },
    { key: 'data_inicio', label: t('p3Import.contratos.colDataInicio'), type: 'date' },
    { key: 'data_fim', label: t('p3Import.contratos.colDataFim'), type: 'date' },
    { key: 'gestor_contrato', label: t('p3Import.contratos.colGestor') },
    { key: 'objeto', label: t('p3Import.contratos.colObjeto') },
  ];

  const texts: ImportCsvDialogTexts = {
    title: t('p3Import.contratos.title'),
    description: t('p3Import.contratos.description'),
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
      tableName="contratos"
      templateFileName={t('p3Import.contratos.templateFile')}
      templateSample={[
        ['CT-2024-001', 'Contrato de Licenciamento Microsoft', 'Microsoft', 'licenciamento', 'ativo', '150000', 'brl', '2024-01-01', '2025-01-01', 'João Silva', 'Licenciamento de software corporativo'],
      ]}
      previewColumns={[
        { key: 'numero_contrato', label: t('p3Import.contratos.colNumero') },
        { key: 'nome', label: t('p3Import.contratos.colNome') },
        { key: 'fornecedor', label: t('p3Import.contratos.colFornecedor') },
        { key: 'tipo', label: t('p3Import.contratos.colTipo'), render: (v) => formatStatus(v) },
        { key: 'status', label: t('p3Import.contratos.colStatus'), render: (v) => formatStatus(v) },
      ]}
      buildPayload={async (row) => {
        if (!profile?.empresa_id) {
          throw new Error(t('p3Import.errorNoEmpresa'));
        }

        const { data: fornecedor, error } = await supabase
          .from('fornecedores')
          .select('id')
          .eq('empresa_id', profile.empresa_id)
          .ilike('nome', row.fornecedor)
          .maybeSingle();

        if (error || !fornecedor) {
          throw new Error(t('p3Import.contratos.errorFornecedorNotFound', { nome: row.fornecedor }));
        }

        return {
          numero_contrato: row.numero_contrato,
          nome: row.nome,
          fornecedor_id: fornecedor.id,
          tipo: row.tipo,
          status: row.status || 'rascunho',
          valor: row.valor || null,
          moeda: (row.moeda || 'brl').toUpperCase(),
          data_inicio: row.data_inicio || null,
          data_fim: row.data_fim || null,
          gestor_contrato: row.gestor_contrato || null,
          objeto: row.objeto || null,
        };
      }}
    />
  );
};

export default ImportContratosDialog;
