import { useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Lead = { id: string; name: string; email: string; company: string; created_at: string; status: string; message: string | null; interest?: string; plan_code?: string; locale?: string; source_path?: string };
/** Platform-owned records, not tenant-owned. Existing super_admin RLS is the authority. */
export function ContactRequests() {
  const { t, locale } = useLanguage();
  const { profile } = useAuth();
  const [rows, setRows] = useState<Lead[]>([]);
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState('all');
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  useEffect(() => {
    if (profile?.role !== 'super_admin') return;
    let active = true;
    setState('loading');
    let query = supabase.from('contact_form_submissions').select('*').order('created_at', { ascending: false }).order('id').range(page * 20, page * 20 + 20);
    if (status !== 'all') query = query.eq('status', status);
    Promise.resolve(query).then(({ data, error }) => {
      if (!active) return;
      if (error) { setRows([]); setState('error'); return; }
      setRows((data || []) as Lead[]); setState('ready');
    }).catch(() => { if (active) { setRows([]); setState('error'); } });
    return () => { active = false; };
  }, [profile?.role, page, status, retry]);
  if (profile?.role !== 'super_admin') return null;
  const statuses = { pending: 'leadPending', processed: 'leadAccepted', failed: 'leadFailed' };
  return <Card><CardHeader><CardTitle>{t('site.leads')}</CardTitle><p className="text-sm text-muted-foreground">{t('site.leadsBody')}</p></CardHeader><CardContent>
    <div className="flex gap-3 items-center mb-4"><label htmlFor="lead-status" className="text-sm">{t('site.status')}</label><select id="lead-status" value={status} className="h-10 border rounded-md bg-background px-3" onChange={e => { setStatus(e.target.value); setPage(0); }}><option value="all">{t('site.all')}</option>{Object.entries(statuses).map(([key, label]) => <option key={key} value={key}>{t('site.' + label)}</option>)}</select><Button variant="outline" onClick={() => setRetry(n => n + 1)}>{t('common.refresh')}</Button></div>
    {state === 'loading' ? <p role="status">{t('common.loading')}</p> : state === 'error' ? <p role="alert">{t('site.loadError')}</p> : <><Table><TableHeader><TableRow><TableHead>{t('site.contact')}</TableHead><TableHead>{t('site.contextLabel')}</TableHead><TableHead>{t('site.status')}</TableHead><TableHead>{t('site.submitted')}</TableHead></TableRow></TableHeader><TableBody>{rows.slice(0, 20).map(row => <TableRow key={row.id}><TableCell><strong>{row.name}</strong><p>{row.company}</p><a className="text-primary" href={'mailto:' + encodeURIComponent(row.email)}>{row.email}</a><details className="mt-2"><summary className="cursor-pointer">{t('site.detailsLabel')}</summary><p className="whitespace-pre-wrap max-w-lg">{row.message || '—'}</p></details></TableCell><TableCell>{row.interest && row.interest !== 'general' ? t('site.' + row.interest) : '—'}<p className="text-xs text-muted-foreground">{row.plan_code} {row.locale} {row.source_path}</p></TableCell><TableCell>{t('site.' + (statuses[row.status as keyof typeof statuses] || 'leadPending'))}</TableCell><TableCell>{new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : locale === 'pt' ? 'pt-PT' : 'pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(row.created_at))}</TableCell></TableRow>)}</TableBody></Table>{rows.length === 0 && <p className="py-8 text-center text-muted-foreground">{t('site.noLeads')}</p>}</>}
    <div className="flex justify-end gap-3 mt-4"><Button variant="outline" disabled={page === 0 || state === 'loading'} onClick={() => setPage(n => n - 1)}>{t('common.previous')}</Button><Button variant="outline" disabled={rows.length <= 20 || state !== 'ready'} onClick={() => setPage(n => n + 1)}>{t('common.next')}</Button></div>
  </CardContent></Card>;
}
