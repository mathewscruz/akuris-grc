import { useEffect, useState } from 'react';
import { IconAdd, IconEdit, IconDelete, IconExternal } from '@/components/icons';
import ConfirmDialog from '@/components/ConfirmDialog';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
;
import { toast } from 'sonner';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { logger } from '@/lib/logger';
import { useLanguage } from '@/contexts/LanguageContext';

type Post = {
  id: string;
  slug: string;
  titulo: string;
  resumo: string;
  conteudo_md: string;
  autor: string;
  tags: string[];
  framework_slug: string | null;
  capa_url: string | null;
  seo_title: string | null;
  seo_description: string | null;
  published: boolean;
  published_at: string | null;
  created_at: string;
};

const empty: Partial<Post> = {
  slug: '',
  titulo: '',
  resumo: '',
  conteudo_md: '',
  autor: 'Equipe Akuris',
  tags: [],
  framework_slug: null,
  capa_url: null,
  seo_title: null,
  seo_description: null,
  published: false,
};

const slugify = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export default function BlogManager() {
  const { t } = useLanguage();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Post>>(empty);
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [removendo, setRemovendo] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('blog_posts')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) { logger.error('blog load', error); toast.error(t('configPlanos.blog.loadError')); }
    setPosts((data as Post[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing({ ...empty }); setTagInput(''); setOpen(true); };
  const openEdit = (p: Post) => { setEditing(p); setTagInput((p.tags || []).join(', ')); setOpen(true); };

  const save = async () => {
    if (!editing.titulo || !editing.resumo || !editing.conteudo_md) {
      toast.error(t('configPlanos.blog.requiredFields'));
      return;
    }
    setSaving(true);
    const slug = editing.slug || slugify(editing.titulo!);
    const tags = tagInput.split(',').map(t => t.trim()).filter(Boolean);
    const payload: any = {
      slug,
      titulo: editing.titulo,
      resumo: editing.resumo,
      conteudo_md: editing.conteudo_md,
      autor: editing.autor || 'Equipe Akuris',
      tags,
      framework_slug: editing.framework_slug || null,
      capa_url: editing.capa_url || null,
      seo_title: editing.seo_title || null,
      seo_description: editing.seo_description || null,
      published: !!editing.published,
      published_at: editing.published ? (editing.published_at || new Date().toISOString()) : null,
    };
    let error;
    if (editing.id) {
      ({ error } = await supabase.from('blog_posts').update(payload).eq('id', editing.id));
    } else {
      ({ error } = await supabase.from('blog_posts').insert(payload));
    }
    setSaving(false);
    if (error) { toast.error(t('configPlanos.blog.saveError', { message: error.message })); return; }
    toast.success(t('configPlanos.blog.savedSuccess'));
    setOpen(false);
    load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from('blog_posts').delete().eq('id', id);
    if (error) { toast.error(t('configPlanos.blog.deleteError')); return; }
    toast.success(t('configPlanos.blog.deletedSuccess'));
    setRemovendo(null);
    load();
  };

  if (loading) return <div className="flex justify-center p-8"><AkurisPulse size={40} /></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{t('configPlanos.blog.postCount', { count: posts.length })}</p>
        <Button onClick={openNew}><IconAdd className="h-4 w-4 mr-2" /> {t('configPlanos.blog.newPost')}</Button>
      </div>

      <div className="space-y-2">
        {posts.map(p => (
          <Card key={p.id}>
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded ${p.published ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                    {p.published ? t('configPlanos.blog.published') : t('configPlanos.blog.draft')}
                  </span>
                  <span className="font-medium truncate">{p.titulo}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 truncate">/blog/{p.slug}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                {p.published && (
                  <Button size="sm" variant="ghost" asChild>
                    <a href={`/blog/${p.slug}`} target="_blank" rel="noreferrer"><IconExternal className="h-4 w-4" /></a>
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => openEdit(p)}><IconEdit className="h-4 w-4" /></Button>
                <Button size="sm" variant="ghost" onClick={() => setRemovendo(p.id)}><IconDelete className="h-4 w-4" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {posts.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">{t('configPlanos.blog.emptyState')}</p>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing.id ? t('configPlanos.blog.dialogEditTitle') : t('configPlanos.blog.dialogNewTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="titulo">{t('configPlanos.blog.fieldTitulo')}</Label>
              <Input id="titulo" value={editing.titulo || ''} onChange={e => setEditing({ ...editing, titulo: e.target.value, slug: editing.slug || slugify(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">{t('configPlanos.blog.fieldSlug')}</Label>
              <Input id="slug" value={editing.slug || ''} onChange={e => setEditing({ ...editing, slug: slugify(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="resumo">{t('configPlanos.blog.fieldResumo')}</Label>
              <Textarea id="resumo" rows={2} value={editing.resumo || ''} onChange={e => setEditing({ ...editing, resumo: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="conteudo_md">{t('configPlanos.blog.fieldConteudo')}</Label>
              <Textarea id="conteudo_md" rows={14} className="font-mono text-sm" value={editing.conteudo_md || ''} onChange={e => setEditing({ ...editing, conteudo_md: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="autor">{t('configPlanos.blog.fieldAutor')}</Label>
                <Input id="autor" value={editing.autor || ''} onChange={e => setEditing({ ...editing, autor: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>{t('configPlanos.blog.fieldFrameworkSlug')}</Label>
                <Input placeholder={t('configPlanos.blog.fieldFrameworkPlaceholder')} value={editing.framework_slug || ''} onChange={e => setEditing({ ...editing, framework_slug: e.target.value || null })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tagInput">{t('configPlanos.blog.fieldTags')}</Label>
              <Input id="tagInput" value={tagInput} onChange={e => setTagInput(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="capa_url">{t('configPlanos.blog.fieldCapaUrl')}</Label>
              <Input id="capa_url" value={editing.capa_url || ''} onChange={e => setEditing({ ...editing, capa_url: e.target.value || null })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="seo_title">{t('configPlanos.blog.fieldSeoTitle')}</Label>
                <Input id="seo_title" value={editing.seo_title || ''} onChange={e => setEditing({ ...editing, seo_title: e.target.value || null })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="seo_description">{t('configPlanos.blog.fieldSeoDescription')}</Label>
                <Input id="seo_description" value={editing.seo_description || ''} onChange={e => setEditing({ ...editing, seo_description: e.target.value || null })} />
              </div>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <Switch checked={!!editing.published} onCheckedChange={v => setEditing({ ...editing, published: v })} />
              <Label>{t('configPlanos.blog.fieldPublicado')}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>{t('configPlanos.blog.cancel')}</Button>
            <Button onClick={save} disabled={saving}>{saving ? t('configPlanos.blog.saving') : t('configPlanos.blog.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!removendo}
        onOpenChange={(o) => !o && setRemovendo(null)}
        title={t('configPlanos.blog.deleteTitle')}
        description={t('configPlanos.blog.deleteConfirm')}
        variant="destructive"
        confirmText={t('configPlanos.blog.deleteConfirmText')}
        onConfirm={() => removendo && remove(removendo)}
      />
    </div>
  );
}
