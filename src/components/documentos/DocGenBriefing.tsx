import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, ArrowRight, Sparkles, X } from 'lucide-react';
import {
  type BriefingDefaults,
  type DocType,
  type DocTone,
  type DocLength,
  type DocLanguage,
  DOC_TYPE_OPTIONS,
  DOC_TONE_OPTIONS,
  DOC_LENGTH_OPTIONS,
  DOC_LANGUAGE_OPTIONS,
} from '@/lib/docgen-templates';
import { cn } from '@/lib/utils';

interface DocGenBriefingProps {
  initialValue: BriefingDefaults;
  templateLabel?: string;
  onBack: () => void;
  onConfirm: (briefing: BriefingDefaults) => void;
}

type Step = 1 | 2 | 3;

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
  onBack,
  onConfirm,
}) => {
  const [step, setStep] = useState<Step>(1);
  const [briefing, setBriefing] = useState<BriefingDefaults>(initialValue);
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

  const canAdvance =
    step === 1
      ? !!briefing.docType
      : step === 2
        ? true // escopo é opcional, mas recomendado
        : true;

  const handleNext = () => {
    if (step < 3) {
      setStep((s) => (s + 1) as Step);
    } else {
      onConfirm(briefing);
    }
  };

  const handleBack = () => {
    if (step > 1) setStep((s) => (s - 1) as Step);
    else onBack();
  };

  return (
    <div className="flex flex-col h-full min-h-0 gap-4">
      {/* Header */}
      <div>
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
          Passo {step + 1} de 3 · Briefing
          {templateLabel ? ` · ${templateLabel}` : ''}
        </p>
        <h3 className="text-lg font-semibold mt-1">
          {step === 1 && 'Que tipo de documento é?'}
          {step === 2 && 'Qual o escopo e o público?'}
          {step === 3 && 'Tom, idioma e extensão'}
        </h3>
        <p className="text-sm text-muted-foreground mt-0.5">
          Quanto mais preciso o briefing, mais alinhado o documento gerado.
        </p>

        {/* Progress */}
        <div className="flex gap-1.5 mt-3">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className={cn(
                'h-1 flex-1 rounded-full transition-colors',
                n <= step ? 'bg-primary' : 'bg-muted',
              )}
            />
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-1 -mr-1 space-y-6">
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium mb-2 block">Tipo de documento</Label>
              <PillGroup<DocType>
                options={DOC_TYPE_OPTIONS}
                value={briefing.docType}
                onChange={(v) => update('docType', v)}
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div>
              <Label className="text-sm font-medium mb-2 block">
                Frameworks aplicáveis (opcional)
              </Label>
              <p className="text-xs text-muted-foreground mb-2">
                A IA vai alinhar o conteúdo aos requisitos destes frameworks.
              </p>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {briefing.frameworks.map((fw) => (
                  <Badge
                    key={fw}
                    variant="secondary"
                    className="gap-1 pr-1 text-xs"
                  >
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
              <div className="flex flex-wrap gap-1 mt-2">
                {DEFAULT_FRAMEWORK_SUGGESTIONS.filter(
                  (s) => !briefing.frameworks.includes(s),
                ).map((s) => (
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
            </div>

            <div>
              <Label htmlFor="scope" className="text-sm font-medium mb-2 block">
                Escopo do documento
              </Label>
              <Textarea
                id="scope"
                value={briefing.scope}
                onChange={(e) => update('scope', e.target.value)}
                placeholder="Ex.: regras para criação, complexidade e troca de senhas em todos os sistemas corporativos"
                className="min-h-[80px] resize-none"
              />
            </div>

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

        {step === 3 && (
          <div className="space-y-5">
            <div>
              <Label className="text-sm font-medium mb-2 block">Tom de voz</Label>
              <PillGroup<DocTone>
                options={DOC_TONE_OPTIONS}
                value={briefing.tone}
                onChange={(v) => update('tone', v)}
              />
            </div>
            <div>
              <Label className="text-sm font-medium mb-2 block">Idioma</Label>
              <PillGroup<DocLanguage>
                options={DOC_LANGUAGE_OPTIONS}
                value={briefing.language}
                onChange={(v) => update('language', v)}
              />
            </div>
            <div>
              <Label className="text-sm font-medium mb-2 block">Extensão alvo</Label>
              <PillGroup<DocLength>
                options={DOC_LENGTH_OPTIONS}
                value={briefing.length}
                onChange={(v) => update('length', v)}
              />
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
          {step === 3 ? (
            <>
              <Sparkles className="h-4 w-4" strokeWidth={1.5} />
              Iniciar geração
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
