import { useEffect, useState } from 'react';
import { DialogShell } from '@/components/ui/dialog-shell';
import { Checkbox } from '@/components/ui/checkbox';
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

const BLOCOS = [
  'riscos_geral', 'incidentes_periodo', 'lgpd_anpd', 'iso27001_auditoria',
  'continuidade_bcp', 'contratos_geral', 'ativos_inventario',
  'due_diligence_fornecedores', 'documentos_governanca', 'denuncias_canal_etica',
] as const;

export function RelatorioDialog({ open, onOpenChange, onSave, relatorio, loading }: RelatorioDialogProps) {
  const { t } = useLanguage();
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [templateBase, setTemplateBase] = useState('nenhum');
  const [blocos, setBlocos] = useState<string[]>([]);
  const [periodo, setPeriodo] = useState('90');
  const [publico, setPublico] = useState('diretoria');
  const [incluirDetalhes, setIncluirDetalhes] = useState(true);
  const [status, setStatus] = useState('rascunho');
  const [frequencia, setFrequencia] = useState('manual');
  const [diaEnvio, setDiaEnvio] = useState('1');
  const [destinatarios, setDestinatarios] = useState('');

  useEffect(() => {
    if (!open) return;
    const config = relatorio?.configuracao || {};
    const agenda = Array.isArray(relatorio?.relatorio_agendamentos) ? relatorio.relatorio_agendamentos[0] : undefined;
    setNome(relatorio?.nome || '');
    setDescricao(relatorio?.descricao || '');
    setTemplateBase(relatorio?.template_base || 'nenhum');
    setBlocos(Array.isArray(config.widgets) ? config.widgets : relatorio?.template_base ? [relatorio.template_base] : []);
    setPeriodo(String(config.periodo_dias || '90'));
    setPublico(config.publico || 'diretoria');
    setIncluirDetalhes(config.incluir_detalhes !== false);
    setStatus(relatorio?.status || 'rascunho');
    setFrequencia(agenda?.frequencia || 'manual');
    setDiaEnvio(String(agenda?.dia_envio || 1));
    setDestinatarios(Array.isArray(agenda?.destinatarios) ? agenda.destinatarios.join(', ') : '');
  }, [open, relatorio]);

  const alternarBloco = (bloco: string, checked: boolean) =>
    setBlocos((atuais) => checked ? [...new Set([...atuais, bloco])] : atuais.filter((item) => item !== bloco));

  const handleSave = () => {
    if (!nome.trim() || blocos.length === 0) return;
    const template = templateBase === 'nenhum' ? null : templateBase;
    onSave({
      nome: nome.trim(),
      descricao: descricao.trim() || null,
      template_base: template,
      tipo: template ? 'template' : 'customizado',
      status,
      configuracao: {
        widgets: blocos,
        periodo_dias: periodo === 'todos' ? null : Number(periodo),
        publico,
        incluir_detalhes: incluirDetalhes,
      },
      agendamento: frequencia === 'manual' ? null : {
        frequencia,
        dia_envio: Math.min(28, Math.max(1, Number(diaEnvio) || 1)),
        destinatarios: destinatarios.split(',').map((email) => email.trim()).filter(Boolean),
        ativo: true,
      },
    });
  };

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={IconChart}
      title={relatorio ? t('relatoriosComp.dialog.titleEdit') : t('relatoriosComp.dialog.titleNew')}
      description={t('relatoriosComp.dialog.builderDescription')}
      size="lg"
      onSubmit={handleSave}
      submitLabel={relatorio ? t('relatoriosComp.dialog.submitUpdate') : t('relatoriosComp.dialog.submitCreate')}
      isSubmitting={loading}
      submitDisabled={!nome.trim() || blocos.length === 0}
      submitBlockedReason={!nome.trim() ? t('relatoriosComp.dialog.nameRequired') : blocos.length === 0 ? t('relatoriosComp.dialog.blockRequired') : undefined}
    >
      <div className="grid gap-6 py-2">
        <section className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2"><Label htmlFor="nome">{t('relatoriosComp.dialog.fieldNome')}</Label><Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder={t('relatoriosComp.dialog.fieldNomePlaceholder')} /></div>
          <div className="space-y-2"><Label>{t('relatoriosComp.dialog.fieldStatus')}</Label><Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="rascunho">{t('relatoriosComp.dialog.statusDraft')}</SelectItem><SelectItem value="publicado">{t('relatoriosComp.dialog.statusPublished')}</SelectItem><SelectItem value="arquivado">{t('relatoriosComp.dialog.statusArchived')}</SelectItem></SelectContent></Select></div>
          <div className="space-y-2 md:col-span-2"><Label htmlFor="descricao">{t('relatoriosComp.dialog.fieldDescricao')}</Label><Textarea id="descricao" value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder={t('relatoriosComp.dialog.fieldDescricaoPlaceholder')} rows={2} /></div>
          <div className="space-y-2"><Label>{t('relatoriosComp.dialog.fieldTemplate')}</Label><Select value={templateBase} onValueChange={(value) => { setTemplateBase(value); if (value !== 'nenhum') alternarBloco(value, true); }}><SelectTrigger><SelectValue placeholder={t('relatoriosComp.dialog.fieldTemplatePlaceholder')} /></SelectTrigger><SelectContent><SelectItem value="nenhum">{t('relatoriosComp.dialog.templateNenhum')}</SelectItem><SelectItem value="lgpd_anpd">{t('relatoriosComp.dialog.templateLgpdAnpd')}</SelectItem><SelectItem value="iso27001_auditoria">{t('relatoriosComp.dialog.templateIso27001')}</SelectItem><SelectItem value="executivo_trimestral">{t('relatoriosComp.dialog.templateExecutivo')}</SelectItem><SelectItem value="riscos_geral">{t('relatoriosComp.dialog.templateRiscos')}</SelectItem><SelectItem value="incidentes_periodo">{t('relatoriosComp.dialog.templateIncidentes')}</SelectItem><SelectItem value="compliance_geral">{t('relatoriosComp.dialog.templateCompliance')}</SelectItem></SelectContent></Select></div>
          <div className="space-y-2"><Label>{t('relatoriosComp.dialog.fieldPeriod')}</Label><Select value={periodo} onValueChange={setPeriodo}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="30">{t('relatoriosComp.dialog.period30')}</SelectItem><SelectItem value="90">{t('relatoriosComp.dialog.period90')}</SelectItem><SelectItem value="365">{t('relatoriosComp.dialog.period365')}</SelectItem><SelectItem value="todos">{t('relatoriosComp.dialog.periodAll')}</SelectItem></SelectContent></Select></div>
        </section>

        <section className="space-y-3">
          <div><h3 className="font-semibold">{t('relatoriosComp.dialog.blocksTitle')}</h3><p className="text-sm text-muted-foreground">{t('relatoriosComp.dialog.blocksHint')}</p></div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {BLOCOS.map((bloco) => (
              <label key={bloco} className="flex cursor-pointer items-center gap-2 rounded-md border p-3 text-sm hover:bg-accent">
                <Checkbox checked={blocos.includes(bloco)} onCheckedChange={(checked) => alternarBloco(bloco, checked === true)} />
                <span>{t(`relatoriosComp.dialog.blocks.${bloco}`)}</span>
              </label>
            ))}
          </div>
        </section>

        <section className="grid gap-4 border-t pt-5 md:grid-cols-2">
          <div className="space-y-2"><Label>{t('relatoriosComp.dialog.audience')}</Label><Select value={publico} onValueChange={setPublico}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="diretoria">{t('relatoriosComp.dialog.audienceBoard')}</SelectItem><SelectItem value="auditoria">{t('relatoriosComp.dialog.audienceAudit')}</SelectItem><SelectItem value="operacional">{t('relatoriosComp.dialog.audienceOperations')}</SelectItem><SelectItem value="regulador">{t('relatoriosComp.dialog.audienceRegulator')}</SelectItem></SelectContent></Select></div>
          <label className="flex items-center gap-2 self-end rounded-md border px-3 py-2.5 text-sm"><Checkbox checked={incluirDetalhes} onCheckedChange={(checked) => setIncluirDetalhes(checked === true)} />{t('relatoriosComp.dialog.includeDetails')}</label>
          <div className="space-y-2"><Label>{t('relatoriosComp.dialog.frequency')}</Label><Select value={frequencia} onValueChange={setFrequencia}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="manual">{t('relatoriosComp.dialog.frequencyManual')}</SelectItem><SelectItem value="semanal">{t('relatoriosComp.dialog.frequencyWeekly')}</SelectItem><SelectItem value="mensal">{t('relatoriosComp.dialog.frequencyMonthly')}</SelectItem><SelectItem value="trimestral">{t('relatoriosComp.dialog.frequencyQuarterly')}</SelectItem></SelectContent></Select></div>
          {frequencia !== 'manual' && <div className="space-y-2"><Label htmlFor="diaEnvio">{t('relatoriosComp.dialog.sendDay')}</Label><Input id="diaEnvio" type="number" min="1" max="28" value={diaEnvio} onChange={(e) => setDiaEnvio(e.target.value)} /></div>}
          {frequencia !== 'manual' && <div className="space-y-2 md:col-span-2"><Label htmlFor="destinatarios">{t('relatoriosComp.dialog.recipients')}</Label><Input id="destinatarios" value={destinatarios} onChange={(e) => setDestinatarios(e.target.value)} placeholder={t('relatoriosComp.dialog.recipientsPlaceholder')} /></div>}
        </section>
      </div>
    </DialogShell>
  );
}
