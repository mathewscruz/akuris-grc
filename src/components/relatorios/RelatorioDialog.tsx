import { useState, useEffect } from 'react';
import { DialogShell } from '@/components/ui/dialog-shell';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLanguage } from '@/contexts/LanguageContext';
import { IconChart } from '@/components/icons';

interface RelatorioDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: any) => void;
  relatorio?: any;
  loading?: boolean;
}

export function RelatorioDialog({ open, onOpenChange, onSave, relatorio, loading }: RelatorioDialogProps) {
  const { t } = useLanguage();
  const [nome, setNome] = useState(relatorio?.nome || '');
  const [descricao, setDescricao] = useState(relatorio?.descricao || '');
  const [templateBase, setTemplateBase] = useState(relatorio?.template_base || '');

  useEffect(() => {
    if (open) {
      setNome(relatorio?.nome || '');
      setDescricao(relatorio?.descricao || '');
      setTemplateBase(relatorio?.template_base || '');
    }
  }, [open, relatorio]);

  const handleSave = () => {
    if (!nome.trim()) return;
    onSave({
      nome: nome.trim(),
      descricao: descricao.trim() || null,
      template_base: templateBase || null,
      tipo: templateBase ? 'template' : 'customizado',
      configuracao: relatorio?.configuracao || { widgets: [] },
    });
  };

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={IconChart}
      title={relatorio ? t('relatoriosComp.dialog.titleEdit') : t('relatoriosComp.dialog.titleNew')}
      size="sm"
      onSubmit={handleSave}
      submitLabel={relatorio ? t('relatoriosComp.dialog.submitUpdate') : t('relatoriosComp.dialog.submitCreate')}
      isSubmitting={loading}
      submitDisabled={!nome.trim()}
    >
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label>{t('relatoriosComp.dialog.fieldNome')}</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder={t('relatoriosComp.dialog.fieldNomePlaceholder')} />
          </div>
          <div className="space-y-2">
            <Label>{t('relatoriosComp.dialog.fieldDescricao')}</Label>
            <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder={t('relatoriosComp.dialog.fieldDescricaoPlaceholder')} rows={2} />
          </div>
          <div className="space-y-2">
            <Label>{t('relatoriosComp.dialog.fieldTemplate')}</Label>
            <Select value={templateBase} onValueChange={setTemplateBase}>
              <SelectTrigger><SelectValue placeholder={t('relatoriosComp.dialog.fieldTemplatePlaceholder')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="nenhum">{t('relatoriosComp.dialog.templateNenhum')}</SelectItem>
                <SelectItem value="lgpd_anpd">{t('relatoriosComp.dialog.templateLgpdAnpd')}</SelectItem>
                <SelectItem value="iso27001_auditoria">{t('relatoriosComp.dialog.templateIso27001')}</SelectItem>
                <SelectItem value="executivo_trimestral">{t('relatoriosComp.dialog.templateExecutivo')}</SelectItem>
                <SelectItem value="riscos_geral">{t('relatoriosComp.dialog.templateRiscos')}</SelectItem>
                <SelectItem value="incidentes_periodo">{t('relatoriosComp.dialog.templateIncidentes')}</SelectItem>
                <SelectItem value="compliance_geral">{t('relatoriosComp.dialog.templateCompliance')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
    </DialogShell>
  );
}
