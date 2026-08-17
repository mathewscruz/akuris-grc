import React, { useEffect, useState, useMemo } from 'react';
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
  REVIEW_FREQUENCY_OPTIONS,
  CLASSIFICATION_OPTIONS,
} from '@/lib/docgen-templates';

import { useFrameworkRequirementCount } from '@/hooks/useFrameworkRequirementCount';
import type { CompanyContext } from './DocGenContextPanel';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

interface DocGenBriefingProps {
  initialValue: BriefingDefaults;
  templateLabel?: string;
  companyContext?: CompanyContext | null;
  onBack: () => void;
  onConfirm: (briefing: BriefingDefaults) => void;
  /** Persistência incremental do rascunho (recuperação após fecho acidental). */
  onDraftChange?: (briefing: BriefingDefaults, step: number) => void;
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
  onDraftChange,
}) => {
  const { t } = useLanguage();
  const [step, setStep] = useState<Step>(1);
  const [briefing, setBriefing] = useState<BriefingDefaults>({
    directGenerate: true,
    ...initialValue,
  });
  const [frameworkInput, setFrameworkInput] = useState('');
  const [roleInput, setRoleInput] = useState('');


  // Guarda o rascunho a cada alteração, para que nada se perca se o modal fechar.
  useEffect(() => {
    onDraftChange?.(briefing, step);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [briefing, step]);

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

  const addRole = (role: string) => {
    const trimmed = role.trim();
    if (!trimmed) return;
    const current = briefing.roles || [];
    if (current.includes(trimmed)) return;
    update('roles', [...current, trimmed]);
    setRoleInput('');
  };

  const removeRole = (role: string) =>
    update('roles', (briefing.roles || []).filter((r) => r !== role));


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
          {t('docgen.briefing.stepLabel', { step, total: TOTAL_STEPS })}
          {templateLabel ? ` · ${templateLabel}` : ''}
        </p>
        <h3 className="text-lg font-semibold mt-1 font-sans">
          {step === 1 && t('docgen.briefing.stepTitleAbout')}
          {step === 2 && t('docgen.briefing.stepTitleStyle')}
        </h3>
        <p className="text-sm text-muted-foreground mt-0.5">
          {step === 1
            ? t('docgen.briefing.stepDescAbout')
            : t('docgen.briefing.stepDescStyle')}
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
              <Label className="text-sm font-medium mb-2 block">{t('docgen.briefing.docTypeLabel')}</Label>
              <PillGroup
                options={DOC_TYPE_OPTIONS}
                value={briefing.docType}
                onChange={(v) => update('docType', v)}
              />
            </div>

            {/* Frameworks */}
            <div>
              <Label className="text-sm font-medium mb-1 block">
                {t('docgen.briefing.frameworksLabel')}
              </Label>
              <p className="text-xs text-muted-foreground mb-2">
                {t('docgen.briefing.frameworksHelp')}
              </p>
              <div className="flex flex-wrap gap-1.5 mb-2 min-h-[26px]">
                {briefing.frameworks.length === 0 && (
                  <span className="text-xs text-muted-foreground italic">
                    {t('docgen.briefing.noFrameworkSelected')}
                  </span>
                )}
                {briefing.frameworks.map((fw) => (
                  <Badge key={fw} variant="secondary" className="gap-1 pr-1 text-xs">
                    {fw}
                    <button
                      type="button"
                      onClick={() => removeFramework(fw)}
                      className="ml-1 hover:bg-muted-foreground/10 rounded p-0.5"
                      aria-label={t('docgen.briefing.removeFramework', { fw })}
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
                  placeholder={t('docgen.briefing.frameworkPlaceholder')}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addFramework(frameworkInput)}
                  disabled={!frameworkInput.trim()}
                >
                  {t('docgen.briefing.add')}
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

              {/* Conformidade pelos referenciais escolhidos */}
              {briefing.frameworks.length > 0 && (
                <div className="mt-3 rounded-lg border border-border bg-card/50 p-3 flex items-start gap-3">
                  <ShieldCheck className="h-4 w-4 text-primary mt-0.5" strokeWidth={1.5} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">
                      {t('docgen.briefing.complianceNote', { list: briefing.frameworks.join(' · ') })}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {t('docgen.briefing.complianceNoteHelp')}
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Escopo */}
            <div>
              <Label htmlFor="scope" className="text-sm font-medium mb-2 block">
                {t('docgen.briefing.scopeLabel')}
              </Label>
              <Textarea
                id="scope"
                value={briefing.scope}
                onChange={(e) => update('scope', e.target.value)}
                placeholder={t('docgen.briefing.scopePlaceholder')}
                className="min-h-[72px] resize-none"
              />
            </div>

            {/* Público */}
            <div>
              <Label htmlFor="audience" className="text-sm font-medium mb-2 block">
                {t('docgen.briefing.audienceLabel')}
              </Label>
              <Input
                id="audience"
                value={briefing.audience}
                onChange={(e) => update('audience', e.target.value)}
                placeholder={t('docgen.briefing.audiencePlaceholder')}
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div>
              <Label className="text-sm font-medium mb-2 block">{t('docgen.briefing.toneLabel')}</Label>
              <PillGroup
                options={DOC_TONE_OPTIONS}
                value={briefing.tone}
                onChange={(v) => update('tone', v)}
              />
            </div>
            <div>
              <Label className="text-sm font-medium mb-2 block">{t('docgen.briefing.languageLabel')}</Label>
              <PillGroup
                options={DOC_LANGUAGE_OPTIONS}
                value={briefing.language}
                onChange={(v) => update('language', v)}
              />
            </div>
            <div>
              <Label className="text-sm font-medium mb-2 block">{t('docgen.briefing.lengthLabel')}</Label>
              <PillGroup
                options={DOC_LENGTH_OPTIONS}
                value={briefing.length}
                onChange={(v) => update('length', v)}
              />
            </div>

            {/* Controlo documental (ISO 27001, 7.5) — sem isto a IA inventa
                cargos e o documento não sobrevive a uma auditoria. */}
            <div className="rounded-lg border border-border p-3 space-y-3">
              <div>
                <div className="text-sm font-medium">{t('docgen.briefing.docControlTitle')}</div>
                <p className="text-xs text-muted-foreground mt-0.5">{t('docgen.briefing.docControlHelp')}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label className="text-xs font-medium mb-1.5 block">{t('docgen.briefing.ownerLabel')}</Label>
                  <Input
                    value={briefing.owner || ''}
                    onChange={(e) => update('owner', e.target.value)}
                    placeholder={t('docgen.briefing.ownerPlaceholder')}
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium mb-1.5 block">{t('docgen.briefing.approverLabel')}</Label>
                  <Input
                    value={briefing.approver || ''}
                    onChange={(e) => update('approver', e.target.value)}
                    placeholder={t('docgen.briefing.approverPlaceholder')}
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs font-medium mb-1.5 block">{t('docgen.briefing.reviewFrequencyLabel')}</Label>
                <PillGroup
                  options={REVIEW_FREQUENCY_OPTIONS.map((o) => ({ value: o.value, label: t(`docgen.briefing.freq.${o.value}`) }))}
                  value={briefing.reviewFrequency || 'anual'}
                  onChange={(v) => update('reviewFrequency', v)}
                />
              </div>

              <div>
                <Label className="text-xs font-medium mb-1.5 block">{t('docgen.briefing.classificationLabel')}</Label>
                <PillGroup
                  options={CLASSIFICATION_OPTIONS.map((o) => ({ value: o.value, label: t(`docgen.briefing.classif.${o.value}`) }))}
                  value={briefing.classification || 'interna'}
                  onChange={(v) => update('classification', v)}
                />
              </div>

              <div>
                <Label className="text-xs font-medium mb-1.5 block">{t('docgen.briefing.rolesLabel')}</Label>
                <p className="text-xs text-muted-foreground mb-2">{t('docgen.briefing.rolesHelp')}</p>
                {(briefing.roles || []).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {(briefing.roles || []).map((role) => (
                      <Badge key={role} variant="secondary" className="gap-1 pr-1 text-xs">
                        {role}
                        <button
                          type="button"
                          onClick={() => removeRole(role)}
                          className="ml-1 hover:bg-muted-foreground/10 rounded p-0.5"
                          aria-label={t('docgen.briefing.removeRole', { role })}
                        >
                          <X className="h-3 w-3" strokeWidth={1.5} />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <Input
                    value={roleInput}
                    onChange={(e) => setRoleInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addRole(roleInput);
                      }
                    }}
                    placeholder={t('docgen.briefing.rolesPlaceholder')}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addRole(roleInput)}
                    disabled={!roleInput.trim()}
                  >
                    {t('docgen.briefing.add')}
                  </Button>
                </div>
              </div>

            </div>



            {/* Toggle gerar direto */}
            <div className="rounded-lg border border-border bg-card/50 p-3 flex items-start gap-3">
              <Sparkles className="h-4 w-4 text-primary mt-0.5" strokeWidth={1.5} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="direct-gen" className="text-sm font-medium cursor-pointer">
                    {t('docgen.briefing.generateDirect')}
                  </Label>
                  <Switch
                    id="direct-gen"
                    checked={briefing.directGenerate !== false}
                    onCheckedChange={(v) => update('directGenerate', v)}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('docgen.briefing.generateDirectHelp')}
                </p>
              </div>
            </div>

            {/* Resumo */}
            <div className="rounded-lg border border-dashed border-border p-3 space-y-1 text-xs">
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-semibold mb-1">
                {t('docgen.briefing.summary')}
              </div>
              <div><span className="text-muted-foreground">{t('docgen.briefing.summaryType')}</span> {currentDocTypeLabel}</div>
              <div>
                <span className="text-muted-foreground">{t('docgen.briefing.summaryFrameworks')}</span>{' '}
                {briefing.frameworks.length ? briefing.frameworks.join(', ') : '—'}
              </div>
              {briefing.scope && (
                <div className="line-clamp-2">
                  <span className="text-muted-foreground">{t('docgen.briefing.summaryScope')}</span> {briefing.scope}
                </div>
              )}
              <div><span className="text-muted-foreground">{t('docgen.briefing.summaryAudience')}</span> {briefing.audience || '—'}</div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 border-t pt-3">
        <Button variant="ghost" onClick={handleBack} className="gap-1">
          <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
          {step === 1 ? t('docgen.briefing.changeTemplate') : t('docgen.briefing.back')}
        </Button>
        <Button onClick={handleNext} disabled={!canAdvance} className="gap-1">
          {step === TOTAL_STEPS ? (
            <>
              <Sparkles className="h-4 w-4" strokeWidth={1.5} />
              {briefing.directGenerate !== false ? t('docgen.briefing.generateDocument') : t('docgen.briefing.startConversation')}
            </>
          ) : (
            <>
              {t('docgen.briefing.advance')}
              <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default DocGenBriefing;
