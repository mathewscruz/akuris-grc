import { useMemo, useRef, useState } from 'react';
import { IconCheck } from '@/components/icons';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';
import { useLanguage } from '@/contexts/LanguageContext';
import { emitDemoEvent, type DemoInterest } from '@/lib/public-demo';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  interest?: DemoInterest;
  plan?: string;
  source?: string;
  onCloseAutoFocus?: () => void;
}
const initial = { name: '', role: '', email: '', company: '', companySize: '', message: '' };
type FieldName = keyof typeof initial;

export function DemoRequestDialog({ open, onOpenChange, interest = 'general', plan, source = '/', onCloseAutoFocus }: Props) {
  const { t, locale } = useLanguage();
  const d = (key: string) => t('publico.demo.' + key);
  const [phase, setPhase] = useState<'idle' | 'submitting' | 'success'>('idle');
  const [data, setData] = useState(initial);
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [sendError, setSendError] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const busy = useRef(false);
  const requestId = useRef<string>(crypto.randomUUID());
  const submittedPayload = useRef<string | null>(null);
  const [honeypot, setHoneypot] = useState('');
  const schema = useMemo(() => z.object({
    name: z.string().trim().min(2, t('publico.demo.errNome')).max(120),
    email: z.string().trim().email(t('publico.demo.errEmail')).max(200),
    company: z.string().trim().min(2, t('publico.demo.errEmpresa')).max(160),
    companySize: z.enum(['1-50', '51-250', '251-1000', '1000+'], { errorMap: () => ({ message: t('publico.demo.errTamanho') }) }),
    role: z.string().trim().max(120),
    message: z.string().trim().max(1000),
  }), [t]);
  const change = (key: FieldName, value: string) => {
    setData(previous => ({ ...previous, [key]: value }));
    setErrors(previous => ({ ...previous, [key]: undefined }));
  };
  const invalid = (key: FieldName) => ({ 'aria-invalid': !!errors[key], 'aria-describedby': errors[key] ? 'demo-error-' + key : undefined });
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy.current || honeypot) return;
    const result = schema.safeParse(data);
    if (!result.success) {
      const next: Partial<Record<FieldName, string>> = {};
      result.error.errors.forEach(error => { next[error.path[0] as FieldName] = error.message; });
      setErrors(next);
      requestAnimationFrame(() => form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    const fingerprint = JSON.stringify([result.data, locale, interest, plan, source]);
    if (submittedPayload.current && submittedPayload.current !== fingerprint) requestId.current = crypto.randomUUID();
    submittedPayload.current = fingerprint;
    busy.current = true;
    setPhase('submitting');
    setSendError(false);
    try {
      const { data: response, error } = await supabase.functions.invoke('send-contact-email', {
        body: { ...result.data, phone: '', locale, interest, plan, source, requestId: requestId.current },
      });
      if (error || response?.success !== true) throw new Error('contact_not_registered');
      setPhase('success');
      emitDemoEvent('demo_submit_success', interest);
    } catch {
      setSendError(true);
      setPhase('idle');
      emitDemoEvent('demo_submit_error', interest);
    } finally { busy.current = false; }
  };
  const close = (value: boolean) => {
    if (!value && phase === 'success') {
      setPhase('idle'); setData(initial); setErrors({}); setHoneypot(''); requestId.current = crypto.randomUUID();
    }
    onOpenChange(value);
  };
  const field = (key: FieldName, label: string, input: React.ReactNode) => <div className="lp-modal-field">
    <label htmlFor={'demo-' + key} className="lp-modal-label">{label}</label>
    {input}
    {errors[key] && <span id={'demo-error-' + key} className="lp-modal-error">{errors[key]}</span>}
  </div>;
  return <Dialog open={open} onOpenChange={close}>
    <DialogContent className="lp-demo-dialog sm:max-w-[640px] sm:max-h-[92dvh]" onCloseAutoFocus={e => { if (onCloseAutoFocus) { e.preventDefault(); onCloseAutoFocus(); } }}>
      <DialogTitle className="lp-demo-title">{phase === 'success' ? t('site.saved') : d('titulo')}</DialogTitle>
      <DialogDescription className="lp-demo-sub">{phase === 'success' ? t('site.savedBody') : t('site.formIntro')}</DialogDescription>
      {phase === 'success' ? <div className="lp-demo-success" role="status"><div className="lp-demo-check"><IconCheck size={28} /></div><button className="lp-btn-pill lp-btn-pill-block" onClick={() => close(false)}>{t('common.close')}</button></div> :
        <form ref={form} onSubmit={submit} className="lp-demo-form" autoComplete="on" noValidate aria-busy={phase === 'submitting'}>
          <p className="site-form-note">{t('site.requiredNote')}</p>
          {interest !== 'general' && <p className="site-form-note">{t('site.contextLabel')}: {t('site.' + interest)}{plan ? ' · ' + plan : ''}</p>}
          <input hidden type="text" tabIndex={-1} autoComplete="off" aria-hidden value={honeypot} onChange={e => setHoneypot(e.target.value)} />
          {Object.values(errors).some(Boolean) && <p role="alert" className="site-form-error">{t('site.errorSummary')}</p>}
          {sendError && <p role="alert" className="site-form-error">{t('site.sendError')}</p>}
          <fieldset disabled={phase === 'submitting'} className="space-y-4">
            <div className="lp-demo-row">
              {field('name', d('nome'), <input {...invalid('name')} id="demo-name" name="name" autoComplete="name" required maxLength={120} className="lp-modal-input" value={data.name} onChange={e => change('name', e.target.value)} />)}
              {field('role', d('cargo') + ' ' + t('site.optional'), <input {...invalid('role')} id="demo-role" name="organization-title" autoComplete="organization-title" maxLength={120} className="lp-modal-input" value={data.role} onChange={e => change('role', e.target.value)} />)}
            </div>
            {field('email', d('emailCorporativo'), <input {...invalid('email')} id="demo-email" name="email" type="email" autoComplete="email" required maxLength={200} className="lp-modal-input" placeholder={d('emailPlaceholder')} value={data.email} onChange={e => change('email', e.target.value)} />)}
            <div className="lp-demo-row">
              {field('company', d('empresa'), <input {...invalid('company')} id="demo-company" name="organization" autoComplete="organization" required maxLength={160} className="lp-modal-input" value={data.company} onChange={e => change('company', e.target.value)} />)}
              {field('companySize', d('tamanho'), <select {...invalid('companySize')} id="demo-companySize" name="company-size" required className="lp-modal-input lp-modal-select" value={data.companySize} onChange={e => change('companySize', e.target.value)}>
                <option value="">{d('selecione')}</option><option value="1-50">{d('tam1')}</option><option value="51-250">51–250</option><option value="251-1000">251–1.000</option><option value="1000+">{d('tam4')}</option>
              </select>)}
            </div>
            {field('message', d('desafio'), <textarea {...invalid('message')} id="demo-message" name="message" rows={3} maxLength={1000} className="lp-modal-input lp-modal-textarea" placeholder={d('desafioPlaceholder')} value={data.message} onChange={e => change('message', e.target.value)} />)}
            <button type="submit" className="lp-btn-pill lp-btn-pill-block" disabled={phase === 'submitting'}>{phase === 'submitting' ? <><AkurisPulse size={18} /> {d('enviando')}</> : d('enviar')}</button>
          </fieldset>
          <p className="lp-demo-fineprint">{t('site.privacyPre')} <a href="/politica-privacidade" target="_blank" rel="noreferrer">{d('fineprintLink')}</a>{t('site.privacyPost')}</p>
        </form>}
    </DialogContent>
  </Dialog>;
}
