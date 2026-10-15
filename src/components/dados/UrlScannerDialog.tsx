import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { logger } from "@/lib/logger";
import { StatStrip } from "@/components/ui/stat-strip";
import { EmptyState } from "@/components/ui/empty-state";
import { useJurisdicao } from "@/hooks/useJurisdicao";
import { ordenarPorSensibilidade, normalizarUrlScan, nomeAmigavelFormulario } from "@/lib/url-scanner-utils";
import { IconAdd, IconSearch, IconExternal, IconWarning, IconFile, IconGlobe, IconShield, IconSettings } from '@/components/icons';
import { DialogShell } from "@/components/ui/dialog-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/status-badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { useLanguage } from "@/contexts/LanguageContext";
interface FormField {
  name: string;
  type: string;
  id: string;
  placeholder: string;
  label: string;
  required: boolean;
  dataType: string;
  lgpdCategory: string;
  sensitivity: string;
}

interface DetectedForm {
  formId: string;
  formName: string;
  action: string;
  method: string;
  fields: FormField[];
}

interface PageResult {
  url: string;
  title: string;
  forms: DetectedForm[];
  totalFields: number;
}

interface ScanResult {
  url: string;
  title: string;
  forms: DetectedForm[];
  totalFields: number;
  sensitiveFieldsCount: number;
  criticalFieldsCount: number;
  // For domain mode
  mode?: 'single' | 'domain';
  pagesScanned?: number;
  pagesWithForms?: number;
  pages?: PageResult[];
}

interface UrlScannerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (fields: FormField[], scanResult?: ScanResult) => void;
}

const getSensitivityBadge = (sensitivity: string, t: (key: string) => string) => {
  switch (sensitivity) {
    case 'critico':
      return <StatusBadge tone="destructive" intensity="high">{t('dadosDialogs.urlScanner.sensitivityCritico')}</StatusBadge>;
    case 'sensivel':
      return <StatusBadge tone="warning">{t('dadosDialogs.urlScanner.sensitivitySensivel')}</StatusBadge>;
    default:
      return <StatusBadge tone="neutral">{t('dadosDialogs.urlScanner.sensitivityComum')}</StatusBadge>;
  }
};

const getCategoryLabel = (category: string, t: (key: string) => string) => {
  const labels: Record<string, string> = {
    identificacao: t('dadosDialogs.urlScanner.categoriaIdentificacao'),
    contato: t('dadosDialogs.urlScanner.categoriaContato'),
    localizacao: t('dadosDialogs.urlScanner.categoriaLocalizacao'),
    financeiro: t('dadosDialogs.urlScanner.categoriaFinanceiro'),
    credenciais: t('dadosDialogs.urlScanner.categoriaCredenciais'),
    saude: t('dadosDialogs.urlScanner.categoriaSaude'),
    documentos: t('dadosDialogs.urlScanner.categoriaDocumentos'),
    texto_livre: t('dadosDialogs.urlScanner.categoriaTextoLivre'),
    outros: t('dadosDialogs.urlScanner.categoriaOutros')
  };
  return labels[category] || category;
};

const getDataTypeLabel = (dataType: string, t: (key: string) => string) => {
  const labels: Record<string, string> = {
    email: t('dadosDialogs.urlScanner.tipoEmail'),
    nome: t('dadosDialogs.urlScanner.tipoNome'),
    cpf: t('dadosDialogs.urlScanner.tipoCpf'),
    rg: t('dadosDialogs.urlScanner.tipoRg'),
    cnpj: t('dadosDialogs.urlScanner.tipoCnpj'),
    telefone: t('dadosDialogs.urlScanner.tipoTelefone'),
    endereco: t('dadosDialogs.urlScanner.tipoEndereco'),
    data_nascimento: t('dadosDialogs.urlScanner.tipoDataNascimento'),
    senha: t('dadosDialogs.urlScanner.tipoSenha'),
    cartao_credito: t('dadosDialogs.urlScanner.tipoCartaoCredito'),
    conta_bancaria: t('dadosDialogs.urlScanner.tipoContaBancaria'),
    saude: t('dadosDialogs.urlScanner.tipoSaude'),
    genero: t('dadosDialogs.urlScanner.tipoGenero'),
    arquivo: t('dadosDialogs.urlScanner.tipoArquivo'),
    comentario: t('dadosDialogs.urlScanner.tipoComentario'),
    desconhecido: t('dadosDialogs.urlScanner.tipoDesconhecido')
  };
  return labels[dataType] || dataType;
};
type Filtro = 'todos' | 'sensiveis' | 'criticos';

const passaFiltro = (s: string, f: Filtro) =>
  f === 'todos' ? true : f === 'criticos' ? s === 'critico' : s === 'critico' || s === 'sensivel';

/** Etapas animadas do scan: avançam por tempo estimado; a última só conclui com o resultado real. */
const ScanProgressSteps = ({ url, mode, t }: { url: string; mode: 'single' | 'domain'; t: (k: string) => string }) => {
  const steps = [
    t('dadosDialogs.urlScanner.stepConectando'),
    mode === 'domain' ? t('dadosDialogs.urlScanner.stepDescobrindo') : t('dadosDialogs.urlScanner.stepLendoPagina'),
    t('dadosDialogs.urlScanner.stepFormularios'),
    t('dadosDialogs.urlScanner.stepClassificando'),
  ];
  const [atual, setAtual] = useState(0);
  const [pct, setPct] = useState(4);
  useEffect(() => {
    const passo = mode === 'domain' ? 6000 : 1800;
    const id = setInterval(() => setAtual((a) => Math.min(a + 1, steps.length - 1)), passo);
    const p = setInterval(() => setPct((v) => Math.min(v + (92 - v) * 0.06, 92)), 400);
    return () => { clearInterval(id); clearInterval(p); };
  }, [mode, steps.length]);

  return (
    <div className="rounded-lg border bg-card p-4 space-y-4 animate-fade-in" role="status" aria-live="polite">
      <div className="flex items-center gap-3 min-w-0">
        <AkurisPulse size={22} />
        <p className="text-sm text-muted-foreground truncate">
          {t('dadosDialogs.urlScanner.analisando').replace('{url}', url)}
        </p>
      </div>
      <Progress value={pct} className="h-1.5" />
      <ol className="space-y-2.5">
        {steps.map((label, i) => {
          const done = i < atual;
          const active = i === atual;
          return (
            <li key={label} className={cn('flex items-center gap-3 text-sm transition-opacity duration-300', !done && !active && 'opacity-40')}>
              <span
                className={cn(
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold',
                  done && 'border-primary bg-primary text-primary-foreground',
                  active && 'border-primary text-primary motion-safe:animate-pulse',
                )}
              >
                {done ? '✓' : i + 1}
              </span>
              <span className={cn(active && 'font-medium')}>{label}</span>
            </li>
          );
        })}
      </ol>
      <div className="space-y-2 pt-1" aria-hidden>
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-10 rounded-md bg-muted/60 motion-safe:animate-pulse" style={{ animationDelay: `${i * 150}ms` }} />
        ))}
      </div>
    </div>
  );
};

export const UrlScannerDialog = ({ isOpen, onClose, onImport }: UrlScannerDialogProps) => {
  const { t } = useLanguage();
  const { lei } = useJurisdicao();
  const { toast } = useToast();
  const [url, setUrl] = useState('');
  const [scanMode, setScanMode] = useState<'single' | 'domain'>('single');
  const [pageLimit, setPageLimit] = useState(50);
  const [includeSubdomains, setIncludeSubdomains] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanUrl, setScanUrl] = useState('');
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scannedAt, setScannedAt] = useState<Date | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set());

  /** Páginas normalizadas: modo único vira uma página só. */
  const paginas: PageResult[] = useMemo(() => {
    if (!scanResult) return [];
    if (scanResult.pages && scanResult.pages.length > 0) return scanResult.pages;
    return [{ url: scanResult.url, title: scanResult.title, forms: scanResult.forms, totalFields: scanResult.totalFields }];
  }, [scanResult]);

  const isDomain = !!(scanResult?.pages && scanResult.pages.length > 0);
  const paginasComForms = paginas.filter((p) => p.forms.length > 0);
  const paginasSemForms = paginas.length - paginasComForms.length;
  const totalForms = paginas.reduce((s, p) => s + p.forms.length, 0);
  const totalFields = paginas.reduce((s, p) => s + p.forms.reduce((a, f) => a + f.fields.length, 0), 0);

  const allKeys = useMemo(() => {
    const keys = new Set<string>();
    paginas.forEach((p, pi) => p.forms.forEach((f, fi) => f.fields.forEach((_, ci) => keys.add(`${pi}-${fi}-${ci}`))));
    return keys;
  }, [paginas]);

  const handleScan = async () => {
    const normalizada = normalizarUrlScan(url);
    if (!normalizada) {
      setUrlError(t('dadosDialogs.urlScanner.urlInvalida'));
      return;
    }
    setUrlError(null);
    setScanError(null);
    setScanUrl(normalizada);
    setIsScanning(true);
    setScanResult(null);
    setSelectedFields(new Set());
    setFiltro('todos');

    try {
      const { data, error } = await supabase.functions.invoke('scan-url-forms', {
        body: { url: normalizada, mode: scanMode, limit: pageLimit, includeSubdomains },
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error || t('dadosDialogs.urlScanner.errorEscanearUrl'));

      setScanResult(data.data);
      setScannedAt(new Date());
      if (scanMode === 'domain') {
        const withForms = data.data.pagesWithForms || 0;
        if (withForms > 0) {
          toast({
            title: t('dadosDialogs.urlScanner.toastScanConcluidoTitle'),
            description: t('dadosDialogs.urlScanner.toastScanConcluidoDomainDescription').replace('{withForms}', String(withForms)).replace('{scanned}', String(data.data.pagesScanned || 0)),
          });
        }
      } else if (data.data.forms.length > 0) {
        toast({
          title: t('dadosDialogs.urlScanner.toastScanConcluidoTitle'),
          description: t('dadosDialogs.urlScanner.toastScanConcluidoSingleDescription').replace('{forms}', String(data.data.forms.length)).replace('{fields}', String(data.data.totalFields)),
        });
      }
    } catch (error) {
      logger.error('Scan error', { error });
      setScanError(error instanceof Error ? error.message : t('dadosDialogs.urlScanner.toastErrorDefaultDescription'));
    } finally {
      setIsScanning(false);
    }
  };

  const toggleKeys = (keys: string[], on: boolean) => {
    setSelectedFields((prev) => {
      const next = new Set(prev);
      keys.forEach((k) => (on ? next.add(k) : next.delete(k)));
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelectedFields(selectedFields.size === allKeys.size ? new Set() : new Set(allKeys));
  };

  const handleImport = () => {
    if (!scanResult || selectedFields.size === 0) return;
    const fieldsToImport: FormField[] = [];
    paginas.forEach((p, pi) => p.forms.forEach((f, fi) => f.fields.forEach((field, ci) => {
      if (selectedFields.has(`${pi}-${fi}-${ci}`)) fieldsToImport.push(field);
    })));
    onImport(fieldsToImport, scanResult);
    handleClose();
  };

  const handleClose = () => {
    setUrl('');
    setScanMode('single');
    setPageLimit(50);
    setIncludeSubdomains(false);
    setShowAdvanced(false);
    setScanResult(null);
    setScanError(null);
    setUrlError(null);
    setSelectedFields(new Set());
    onClose();
  };

  const renderForm = (form: DetectedForm, pi: number, fi: number) => {
    const ordenados = ordenarPorSensibilidade(form.fields).filter(({ campo }) => passaFiltro(campo.sensitivity, filtro));
    const keys = form.fields.map((_, ci) => `${pi}-${fi}-${ci}`);
    const todosMarcados = keys.length > 0 && keys.every((k) => selectedFields.has(k));
    const sensiveis = form.fields.filter((f) => f.sensitivity === 'critico' || f.sensitivity === 'sensivel').length;
    return (
      <AccordionItem key={`${pi}-${fi}`} value={`${pi}-${fi}`} className="rounded-lg border bg-card px-3 mb-2 last:mb-0">
        <div className="flex items-center gap-3">
          <Checkbox
            checked={todosMarcados}
            onCheckedChange={(c) => toggleKeys(keys, !!c)}
            aria-label={t('dadosDialogs.urlScanner.buttonSelecionarTodos')}
          />
          <AccordionTrigger className="flex-1 hover:no-underline py-3">
            <div className="flex items-center gap-2 flex-wrap text-left">
              <IconFile className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{nomeAmigavelFormulario(form.formName, fi, t('dadosDialogs.urlScanner.formularioRotulo'))}</span>
              <StatusBadge tone="neutral">{t('dadosDialogs.urlScanner.camposCount').replace('{count}', String(form.fields.length))}</StatusBadge>
              {sensiveis > 0 && <StatusBadge tone="warning">{t('dadosDialogs.urlScanner.sensiveisCount').replace('{count}', String(sensiveis))}</StatusBadge>}
              {form.method && <StatusBadge tone="neutral" variant="outline">{form.method.toUpperCase()}</StatusBadge>}
            </div>
          </AccordionTrigger>
        </div>
        <AccordionContent>
          {ordenados.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">{t('dadosDialogs.urlScanner.nenhumNoFiltro')}</p>
          ) : (
            <ul className="space-y-2 pb-1">
              {ordenados.map(({ campo, indice }) => {
                const key = `${pi}-${fi}-${indice}`;
                const marcado = selectedFields.has(key);
                return (
                  <li key={key}>
                    <label
                      className={cn(
                        'flex items-start gap-3 rounded-md border p-3 cursor-pointer transition-colors',
                        marcado ? 'border-primary/50 bg-primary/5' : 'hover:bg-muted/40',
                      )}
                    >
                      <Checkbox checked={marcado} onCheckedChange={(c) => toggleKeys([key], !!c)} className="mt-0.5" />
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{campo.label || campo.name || campo.id || t('dadosDialogs.urlScanner.semNome')}</span>
                          <code className="text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{campo.type}</code>
                        </div>
                        {campo.placeholder && <p className="text-xs text-muted-foreground truncate">"{campo.placeholder}"</p>}
                        <p className="text-xs text-muted-foreground">
                          {getDataTypeLabel(campo.dataType, t)} · {getCategoryLabel(campo.lgpdCategory, t)}
                        </p>
                      </div>
                      <div className="shrink-0">{getSensitivityBadge(campo.sensitivity, t)}</div>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </AccordionContent>
      </AccordionItem>
    );
  };

  const criticos = scanResult?.criticalFieldsCount ?? 0;
  const sensiveisTotal = scanResult?.sensitiveFieldsCount ?? 0;
  const primeiroAberto = paginasComForms.length > 0
    ? (() => { const pi = paginas.indexOf(paginasComForms[0]); return [`${pi}-0`, `page-${pi}`]; })()
    : [];

  return (
    <DialogShell
      open={isOpen}
      onOpenChange={handleClose}
      icon={IconGlobe}
      title={t('dadosDialogs.urlScanner.dialogTitle')}
      size="lg"
      footer={
        <div className="flex items-center justify-between gap-2 w-full">
          <span className="text-xs text-muted-foreground">
            {scanResult && totalFields > 0
              ? t('dadosDialogs.urlScanner.selecionadosDe').replace('{selected}', String(selectedFields.size)).replace('{total}', String(totalFields))
              : ''}
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={handleClose}>{t('dadosDialogs.urlScanner.buttonFechar')}</Button>
            {scanResult && totalFields > 0 && (
              <Button size="sm" onClick={handleImport} disabled={selectedFields.size === 0}>
                <IconAdd className="h-4 w-4 mr-2" />
                {t('dadosDialogs.urlScanner.buttonImportar').replace('{count}', String(selectedFields.size))}
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        {/* URL */}
        <div className="space-y-2">
          <Label htmlFor="url">{t('dadosDialogs.urlScanner.labelUrl')}</Label>
          <div className="flex gap-2">
            <Input
              id="url"
              inputMode="url"
              autoComplete="url"
              placeholder={t('dadosDialogs.urlScanner.placeholderUrl')}
              value={url}
              onChange={(e) => { setUrl(e.target.value); setUrlError(null); }}
              onKeyDown={(e) => e.key === 'Enter' && !isScanning && handleScan()}
              disabled={isScanning}
              aria-invalid={!!urlError}
            />
            <Button onClick={handleScan} disabled={isScanning} className="shrink-0">
              {isScanning ? <AkurisPulse size={16} className="mr-2" /> : <IconSearch className="h-4 w-4 mr-2" />}
              {isScanning ? t('dadosDialogs.urlScanner.buttonEscaneando') : t('dadosDialogs.urlScanner.buttonEscanear')}
            </Button>
          </div>
          {urlError && <p className="text-xs text-destructive">{urlError}</p>}
        </div>

        {/* Modo */}
        <div className="space-y-2">
          <Label>{t('dadosDialogs.urlScanner.labelModoEscaneamento')}</Label>
          <RadioGroup
            value={scanMode}
            onValueChange={(v) => setScanMode(v as 'single' | 'domain')}
            className="flex flex-wrap gap-x-6 gap-y-2"
            disabled={isScanning}
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="single" id="single" />
              <Label htmlFor="single" className="cursor-pointer font-normal">{t('dadosDialogs.urlScanner.modoPaginaUnica')}</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="domain" id="domain" />
              <Label htmlFor="domain" className="cursor-pointer font-normal">{t('dadosDialogs.urlScanner.modoDominio')}</Label>
            </div>
          </RadioGroup>
          <p className="text-xs text-muted-foreground">
            {scanMode === 'single' ? t('dadosDialogs.urlScanner.modoPaginaUnicaHint') : t('dadosDialogs.urlScanner.modoDominioHint')}
          </p>
        </div>

        {scanMode === 'domain' && (
          <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2 -ml-2">
                <IconSettings className="h-4 w-4" />
                {t('dadosDialogs.urlScanner.buttonOpcoesAvancadas')}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3 p-3 border rounded-lg bg-card">
              <div className="flex flex-col sm:flex-row sm:items-end gap-4">
                <div className="flex-1">
                  <Label htmlFor="pageLimit">{t('dadosDialogs.urlScanner.labelLimitePaginas')}</Label>
                  <Input id="pageLimit" type="number" min={10} max={200} value={pageLimit}
                    onChange={(e) => setPageLimit(parseInt(e.target.value) || 50)} disabled={isScanning} className="mt-1" />
                </div>
                <div className="flex items-center gap-2 pb-2">
                  <Checkbox id="subdomains" checked={includeSubdomains} onCheckedChange={(c) => setIncludeSubdomains(!!c)} disabled={isScanning} />
                  <Label htmlFor="subdomains" className="cursor-pointer font-normal">{t('dadosDialogs.urlScanner.labelIncluirSubdominios')}</Label>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {isScanning && <ScanProgressSteps url={scanUrl} mode={scanMode} t={t} />}

        {!isScanning && scanError && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 flex items-start gap-3 animate-fade-in" role="alert">
            <IconWarning className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0 space-y-1">
              <p className="text-sm font-medium">{t('dadosDialogs.urlScanner.erroTitle')}</p>
              <p className="text-xs text-muted-foreground break-words">{scanError}</p>
            </div>
            <Button size="sm" variant="outline" onClick={handleScan}>{t('dadosDialogs.urlScanner.buttonTentarNovamente')}</Button>
          </div>
        )}

        {scanResult && !isScanning && (
          <div className="space-y-4">
            {/* Cabeçalho do resultado */}
            <div className="flex items-start justify-between gap-3 rounded-lg border bg-card p-4 animate-fade-in">
              <div className="flex items-start gap-3 min-w-0">
                <img
                  src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(new URL(scanResult.url || scanUrl).hostname)}&sz=64`}
                  alt=""
                  className="h-8 w-8 rounded-md border bg-background p-1 shrink-0"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                />
                <div className="min-w-0">
                  <p className="font-medium truncate">{scanResult.title || scanResult.url}</p>
                  <a href={scanResult.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline inline-flex items-center gap-1 max-w-full">
                    <span className="truncate">{scanResult.url}</span>
                    <IconExternal className="h-3 w-3 shrink-0" />
                  </a>
                  {scannedAt && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {t('dadosDialogs.urlScanner.escaneadoEm').replace('{date}', scannedAt.toLocaleString())}
                      {isDomain && scanResult.pagesScanned ? ` · ${t('dadosDialogs.urlScanner.domainInfo').replace('{scanned}', String(scanResult.pagesScanned)).replace('{withForms}', String(scanResult.pagesWithForms ?? 0))}` : ''}
                    </p>
                  )}
                </div>
              </div>
              <Button size="sm" variant="ghost" onClick={handleScan} className="shrink-0">{t('dadosDialogs.urlScanner.buttonEscanearNovamente')}</Button>
            </div>

            <div className="animate-fade-in" style={{ animationDelay: '80ms', animationFillMode: 'both' }}>
              <StatStrip
                items={[
                  { key: 'forms', label: t('dadosDialogs.urlScanner.cardFormularios'), value: totalForms },
                  { key: 'fields', label: t('dadosDialogs.urlScanner.cardCampos'), value: totalFields },
                  { key: 'sens', label: t('dadosDialogs.urlScanner.cardSensiveis'), value: sensiveisTotal, tone: 'warning' },
                  { key: 'crit', label: t('dadosDialogs.urlScanner.cardCriticos'), value: criticos, tone: 'destructive' },
                ]}
              />
            </div>

            {(criticos > 0 || sensiveisTotal > 0) && (
              <div className="rounded-lg border border-warning/40 bg-warning/5 p-3 flex items-start gap-3 animate-fade-in" style={{ animationDelay: '160ms', animationFillMode: 'both' }}>
                <IconShield className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">{t('dadosDialogs.urlScanner.alertaSensiveisTitle')}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('dadosDialogs.urlScanner.alertaSensiveisDesc').replace('{critical}', String(criticos)).replace('{sensitive}', String(sensiveisTotal)).replace('{lei}', lei)}
                  </p>
                </div>
              </div>
            )}

            {totalFields === 0 ? (
              <EmptyState
                variant="illustrated"
                icon={<IconSearch className="h-6 w-6" />}
                title={t('dadosDialogs.urlScanner.vazioTitle')}
                description={isDomain ? t('dadosDialogs.urlScanner.vazioDomainDesc') : t('dadosDialogs.urlScanner.vazioSingleDesc')}
                action={!isDomain ? { label: t('dadosDialogs.urlScanner.modoDominio'), variant: 'outline', onClick: () => setScanMode('domain') } : undefined}
              />
            ) : (
              <div className="space-y-3 animate-fade-in" style={{ animationDelay: '240ms', animationFillMode: 'both' }}>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <Label>{t('dadosDialogs.urlScanner.labelCamposDetectados')}</Label>
                  <div className="flex items-center gap-2">
                    <div className="inline-flex rounded-md border p-0.5" role="tablist">
                      {(['todos', 'sensiveis', 'criticos'] as Filtro[]).map((f) => (
                        <button
                          key={f}
                          type="button"
                          role="tab"
                          aria-selected={filtro === f}
                          onClick={() => setFiltro(f)}
                          className={cn('px-2.5 py-1 text-xs rounded transition-colors', filtro === f ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
                        >
                          {t(`dadosDialogs.urlScanner.filtro${f === 'todos' ? 'Todos' : f === 'sensiveis' ? 'Sensiveis' : 'Criticos'}`)}
                        </button>
                      ))}
                    </div>
                    <Button variant="outline" size="sm" onClick={handleSelectAll}>
                      {selectedFields.size === allKeys.size ? t('dadosDialogs.urlScanner.buttonDesmarcarTodos') : t('dadosDialogs.urlScanner.buttonSelecionarTodos')}
                    </Button>
                  </div>
                </div>

                {isDomain ? (
                  <Accordion type="multiple" defaultValue={primeiroAberto} className="w-full space-y-2">
                    {paginas.map((page, pi) => page.forms.length === 0 ? null : (
                      <AccordionItem key={pi} value={`page-${pi}`} className="rounded-lg border px-3">
                        <AccordionTrigger className="hover:no-underline py-3">
                          <div className="flex items-center gap-2 flex-wrap text-left min-w-0">
                            <IconGlobe className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium truncate max-w-[280px]">{page.title || page.url}</span>
                            <StatusBadge tone="neutral">{t('dadosDialogs.urlScanner.formsCount').replace('{count}', String(page.forms.length))}</StatusBadge>
                            <StatusBadge tone="neutral" variant="outline">{t('dadosDialogs.urlScanner.camposCount').replace('{count}', String(page.totalFields))}</StatusBadge>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="space-y-2">
                          <a href={page.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline block truncate">{page.url}</a>
                          <Accordion type="multiple" defaultValue={pi === paginas.indexOf(paginasComForms[0]) ? [`${pi}-0`] : []}>
                            {page.forms.map((form, fi) => renderForm(form, pi, fi))}
                          </Accordion>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                    {paginasSemForms > 0 && (
                      <p className="text-xs text-muted-foreground px-1">
                        {t('dadosDialogs.urlScanner.paginasSemFormularios').replace('{count}', String(paginasSemForms))}
                      </p>
                    )}
                  </Accordion>
                ) : (
                  <Accordion type="multiple" defaultValue={['0-0']} className="w-full">
                    {paginas[0].forms.map((form, fi) => renderForm(form, 0, fi))}
                  </Accordion>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </DialogShell>
  );
};
