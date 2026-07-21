import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, ArrowRight, Sparkles, X, ShieldCheck, Layers } from 'lucide-react';
import {
  type BriefingDefaults,
  DOC_TYPE_OPTIONS,
  DOC_TONE_OPTIONS,
  DOC_LENGTH_OPTIONS,
  DOC_LANGUAGE_OPTIONS,
} from '@/lib/docgen-templates';
import { useFrameworkRequirementCount } from '@/hooks/useFrameworkRequirementCount';
import type { CompanyContext } from './DocGenContextPanel';
import { cn } from '@/lib/utils';

interface DocGenBriefingProps {
  initialValue: BriefingDefaults;
  templateLabel?: string;
  companyContext?: CompanyContext | null;
  onBack: () => void;
  onConfirm: (briefing: BriefingDefaults) => void;
}

type Step = 1 | 2;
const TOTAL_STEPS = 2;

const DEFAULT_FRAMEWORK_SUGGESTIONS = [
  'ISO 27001',
  'ISO 27701',
  'ISO 22301',
  'ISO 37001',
  'LGPD',
  'NIST CSF',
  'PCI DSS',
  'SOC 2',
];

interface PillGroupProps<T extends string> {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
}

function PillGroup<T extends string>({ options, value, onChange }: PillGroupProps<T>) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          type="button"
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            'px-3 py-1.5 rounded-md text-sm font-medium transition-colors border',
            value === opt.value
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-transparent text-muted-foreground border-border hover:text-foreground hover:border-primary/30',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export const DocGenBriefing: React.FC<DocGenBriefingProps> = ({
  initialValue,
  templateLabel,
  companyContext,
  onBack,
  onConfirm,
}) => {
  const [step, setStep] = useState<Step>(1);
  const [briefing, setBriefing] = useState<BriefingDefaults>({
    directGenerate: true,
    ...initialValue,
  });
  const [frameworkInput, setFrameworkInput] = useState('');

  const update = <K extends keyof BriefingDefaults>(
    key: K,
    value: BriefingDefaults[K],
  ) => setBriefing((prev) => ({ ...prev, [key]: value }));

  const addFramework = (fw: string) => {
    const trimmed = fw.trim();
    if (!trimmed) return;
    if (briefing.frameworks.includes(trimmed)) return;
    update('frameworks', [...briefing.frameworks, trimmed]);
    setFrameworkInput('');
  };

  const removeFramework = (fw: string) => {
    update(
      'frameworks',
      briefing.frameworks.filter((f) => f !== fw),
    );
  };

  // Sugestões enriquecidas: frameworks da empresa primeiro, depois defaults.
  const enrichedSuggestions = useMemo(() => {
    const fromCompany = (companyContext?.frameworks || [])
      .map((f) => f.nome)
      .filter((n): n is string => !!n);
    const seen = new Set<string>();
    const ordered: string[] = [];
    [...fromCompany, ...DEFAULT_FRAMEWORK_SUGGESTIONS].forEach((n) => {
      const key = n.toLowerCase();
      if (!seen.has(key) && !briefing.frameworks.includes(n)) {
        seen.add(key);
        ordered.push(n);
      }
    });
    return ordered.slice(0, 10);
  }, [companyContext, briefing.frameworks]);

  const reqCountQuery = useFrameworkRequirementCount(briefing.frameworks);

  const canAdvance = step === 1 ? !!briefing.docType : true;

  const handleNext = () => {
    if (step < TOTAL_STEPS) {
      setStep((s) => (s + 1) as Step);
    } else {
      onConfirm(briefing);
    }
  };

  const handleBack = () => {
    if (step > 1) setStep((s) => (s - 1) as Step);
    else onBack();
  };

  const currentDocTypeLabel = DOC_TYPE_OPTIONS.find((o) => o.value === briefing.docType)?.label;

  return (
    <div className="flex flex-col h-full min-h-0 gap-4">
      {/* Header */}
      <div>
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
          Passo {step} de {TOTAL_STEPS} · Briefing
          {templateLabel ? ` · ${templateLabel}` : ''}
        </p>
        <h3 className="text-lg font-semibold mt-1 font-sans">
          {step === 1 && 'Sobre o documento'}
          {step === 2 && 'Estilo e geração'}
        </h3>
        <p className="text-sm text-muted-foreground mt-0.5">
          {step === 1
            ? 'Tipo, frameworks aplicáveis, escopo e público. A IA usará isso para alinhar o conteúdo.'
            : 'Defina tom, idioma e extensão. Você pode gerar direto ou revisar a estrutura em conversa.'}
        </p>

        {/* Progress */}
        <div className="flex gap-1.5 mt-3">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              className={cn(
                'h-1 flex-1 rounded-full transition-colors',
                i + 1 <= step ? 'bg-primary' : 'bg-muted',
              )}
            />
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-1 -mr-1 space-y-6">
        {step === 1 && (
          <div className="space-y-6">
            {/* Tipo */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Tipo de documento</Label>
              <PillGroup
                options={DOC_TYPE_OPTIONS}
                value={briefing.docType}
                onChange={(v) => update('docType', v)}
              />
            </div>

            {/* Frameworks */}
            <div>
              <Label className="text-sm font-medium mb-1 block">
                Frameworks aplicáveis
              </Label>
              <p className="text-xs text-muted-foreground mb-2">
                A IA alinhará o conteúdo aos requisitos destes frameworks.
              </p>
              <div className="flex flex-wrap gap-1.5 mb-2 min-h-[26px]">
                {briefing.frameworks.length === 0 && (
                  <span className="text-xs text-muted-foreground italic">
                    Nenhum framework selecionado.
                  </span>
                )}
                {briefing.frameworks.map((fw) => (
                  <Badge key={fw} variant="secondary" className="gap-1 pr-1 text-xs">
                    {fw}
                    <button
                      type="button"
                      onClick={() => removeFramework(fw)}
                      className="ml-1 hover:bg-muted-foreground/10 rounded p-0.5"
                      aria-label={`Remover ${fw}`}
                    >
                      <X className="h-3 w-3" strokeWidth={1.5} />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={frameworkInput}
                  onChange={(e) => setFrameworkInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addFramework(frameworkInput);
                    }
                  }}
                  placeholder="Digite um framework e pressione Enter"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addFramework(frameworkInput)}
                  disabled={!frameworkInput.trim()}
                >
                  Adicionar
                </Button>
              </div>
              {enrichedSuggestions.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {enrichedSuggestions.map((s) => (
                    <button
                      type="button"
                      key={s}
                      onClick={() => addFramework(s)}
                      className="px-2 py-0.5 rounded-full text-[11px] text-muted-foreground border border-dashed border-border hover:text-foreground hover:border-primary/40 transition-colors"
                    >
                      + {s}
                    </button>
                  ))}
                </div>
              )}

              {/* Card de cobertura */}
              {briefing.frameworks.length > 0 && (
                <div className="mt-3 rounded-lg border border-border bg-card/50 p-3 flex items-start gap-3">
                  <ShieldCheck className="h-4 w-4 text-primary mt-0.5" strokeWidth={1.5} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">
                      {reqCountQuery.isLoading
                        ? 'Calculando cobertura…'
                        : reqCountQuery.data?.count
                        ? `${reqCountQuery.data.count} requisitos mapeados — o documento será alinhado ao framework (a IA prioriza os gaps)`
                        : 'Nenhum requisito catalogado para esses frameworks'}
                    </div>
                    {reqCountQuery.data?.matched && reqCountQuery.data.matched.length > 0 && (
                      <div className="text-xs text-muted-foreground mt-0.5 truncate">
                        Casados: {reqCountQuery.data.matched.join(' · ')}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Escopo */}
            <div>
              <Label htmlFor="scope" className="text-sm font-medium mb-2 block">
                Escopo do documento
              </Label>
              <Textarea
                id="scope"
                value={briefing.scope}
                onChange={(e) => update('scope', e.target.value)}
                placeholder="Ex.: regras para criação, complexidade e troca de senhas em todos os sistemas corporativos"
                className="min-h-[72px] resize-none"
              />
            </div>

            {/* Público */}
            <div>
              <Label htmlFor="audience" className="text-sm font-medium mb-2 block">
                Público-alvo
              </Label>
              <Input
                id="audience"
                value={briefing.audience}
                onChange={(e) => update('audience', e.target.value)}
                placeholder="Ex.: todos os colaboradores e prestadores"
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div>
              <Label className="text-sm font-medium mb-2 block">Tom de voz</Label>
              <PillGroup
                options={DOC_TONE_OPTIONS}
                value={briefing.tone}
                onChange={(v) => update('tone', v)}
              />
            </div>
            <div>
              <Label className="text-sm font-medium mb-2 block">Idioma</Label>
              <PillGroup
                options={DOC_LANGUAGE_OPTIONS}
                value={briefing.language}
                onChange={(v) => update('language', v)}
              />
            </div>
            <div>
              <Label className="text-sm font-medium mb-2 block">Extensão alvo</Label>
              <PillGroup
                options={DOC_LENGTH_OPTIONS}
                value={briefing.length}
                onChange={(v) => update('length', v)}
              />
            </div>

            {/* Toggle gerar direto */}
            <div className="rounded-lg border border-border bg-card/50 p-3 flex items-start gap-3">
              <Sparkles className="h-4 w-4 text-primary mt-0.5" strokeWidth={1.5} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="direct-gen" className="text-sm font-medium cursor-pointer">
                    Gerar documento direto
                  </Label>
                  <Switch
                    id="direct-gen"
                    checked={briefing.directGenerate !== false}
                    onCheckedChange={(v) => update('directGenerate', v)}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Gera o documento completo agora — você refina seção por seção depois.
                  Desligue para revisar a estrutura por chat antes de gerar.
                </p>
              </div>
            </div>

            {/* Resumo */}
            <div className="rounded-lg border border-dashed border-border p-3 space-y-1 text-xs">
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-semibold mb-1">
                Resumo
              </div>
              <div><span className="text-muted-foreground">Tipo:</span> {currentDocTypeLabel}</div>
              <div>
                <span className="text-muted-foreground">Frameworks:</span>{' '}
                {briefing.frameworks.length ? briefing.frameworks.join(', ') : '—'}
              </div>
              {briefing.scope && (
                <div className="line-clamp-2">
                  <span className="text-muted-foreground">Escopo:</span> {briefing.scope}
                </div>
              )}
              <div><span className="text-muted-foreground">Público:</span> {briefing.audience || '—'}</div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 border-t pt-3">
        <Button variant="ghost" onClick={handleBack} className="gap-1">
          <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
          {step === 1 ? 'Trocar modelo' : 'Voltar'}
        </Button>
        <Button onClick={handleNext} disabled={!canAdvance} className="gap-1">
          {step === TOTAL_STEPS ? (
            <>
              <Sparkles className="h-4 w-4" strokeWidth={1.5} />
              {briefing.directGenerate !== false ? 'Gerar documento' : 'Iniciar conversa'}
            </>
          ) : (
            <>
              Avançar
              <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default DocGenBriefing;
