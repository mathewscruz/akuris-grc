import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';

const normalizarSlug = (v: string) =>
  v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

export function TrustCenterTab() {
  const { t, locale } = useLanguage(); const language = locale.startsWith('en') ? 'en' : 'pt';
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;
  const qc = useQueryClient();
  const [form, setForm] = useState({ slug: '', ativo: false, titulo: '', descricao: '', contato_email: '', framework_ids: [] as string[] });
  const [saving, setSaving] = useState(false);

  const { data: config } = useQuery({
    queryKey: ['trust-center', empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data } = await supabase.from('trust_center' as any).select('*').eq('empresa_id', empresaId!).maybeSingle();
      return data as any;
    },
  });

  const { data: frameworks = [] } = useQuery({
    queryKey: ['trust-center-frameworks', empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data } = await supabase.from('gap_analysis_evaluations').select('framework_id').eq('empresa_id', empresaId!).not('framework_id', 'is', null).limit(1000);
      const ids = [...new Set((data ?? []).map((r) => r.framework_id as string))];
      if (!ids.length) return [];
      const { data: fws } = await supabase.from('gap_analysis_frameworks').select('id, nome, nome_en').in('id', ids).order('nome');
      return fws ?? [];
    },
  });

  useEffect(() => {
    if (config) setForm({ slug: config.slug ?? '', ativo: !!config.ativo, titulo: config.titulo ?? '', descricao: config.descricao ?? '', contato_email: config.contato_email ?? '', framework_ids: config.framework_ids ?? [] });
  }, [config]);

  const salvar = async () => {
    if (!empresaId || !form.slug) return;
    setSaving(true);
    const { error } = await supabase.from('trust_center' as any).upsert({ ...form, empresa_id: empresaId, updated_at: new Date().toISOString() });
    setSaving(false);
    if (error) return toast.error(t('trustCenter.saveError'));
    toast.success(t('trustCenter.saved'));
    qc.invalidateQueries({ queryKey: ['trust-center', empresaId] });
  };

  const url = `${window.location.origin}/trust/${form.slug}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('trustCenter.title')}</CardTitle>
        <p className="text-sm text-muted-foreground">{t('trustCenter.description')}</p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center gap-3">
          <Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} id="tc-ativo" />
          <Label htmlFor="tc-ativo">{t('trustCenter.ativo')}</Label>
        </div>
        <div className="space-y-2">
          <Label>{t('trustCenter.slug')}</Label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground whitespace-nowrap">/trust/</span>
            <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: normalizarSlug(e.target.value) })} />
          </div>
        </div>
        <div className="space-y-2"><Label>{t('trustCenter.titulo')}</Label><Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} /></div>
        <div className="space-y-2"><Label>{t('trustCenter.descricao')}</Label><Textarea rows={3} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></div>
        <div className="space-y-2"><Label>{t('trustCenter.contato')}</Label><Input type="email" value={form.contato_email} onChange={(e) => setForm({ ...form, contato_email: e.target.value })} /></div>
        <div className="space-y-2">
          <Label>{t('trustCenter.frameworks')}</Label>
          <div className="grid gap-2 sm:grid-cols-2">
            {frameworks.map((f: any) => (
              <label key={f.id} className="flex items-center gap-2 rounded-md border border-border p-2 text-sm">
                <Checkbox
                  checked={form.framework_ids.includes(f.id)}
                  onCheckedChange={(c) => setForm({ ...form, framework_ids: c ? [...form.framework_ids, f.id] : form.framework_ids.filter((x) => x !== f.id) })}
                />
                {language === 'en' && f.nome_en ? f.nome_en : f.nome}
              </label>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={salvar} disabled={saving || !form.slug}>{t('trustCenter.save')}</Button>
          {config?.ativo && config?.slug && <Button variant="outline" asChild><a href={url} target="_blank" rel="noreferrer">{t('trustCenter.open')}</a></Button>}
        </div>
      </CardContent>
    </Card>
  );
}
