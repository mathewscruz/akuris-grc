import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Pencil, Plus, Trash2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { logger } from '@/lib/logger';

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
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Post>>(empty);
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('blog_posts')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) { logger.error('blog load', error); toast.error('Erro ao carregar posts'); }
    setPosts((data as Post[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing({ ...empty }); setTagInput(''); setOpen(true); };
  const openEdit = (p: Post) => { setEditing(p); setTagInput((p.tags || []).join(', ')); setOpen(true); };

  const save = async () => {
    if (!editing.titulo || !editing.resumo || !editing.conteudo_md) {
      toast.error('Título, resumo e conteúdo são obrigatórios');
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
    if (error) { toast.error('Erro ao salvar: ' + error.message); return; }
    toast.success('Post salvo');
    setOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm('Excluir este post?')) return;
    const { error } = await supabase.from('blog_posts').delete().eq('id', id);
    if (error) { toast.error('Erro ao excluir'); return; }
    toast.success('Post excluído');
    load();
  };

  if (loading) return <div className="flex justify-center p-8"><AkurisPulse size={40} /></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{posts.length} post(s)</p>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" /> Novo post</Button>
      </div>

      <div className="space-y-2">
        {posts.map(p => (
          <Card key={p.id}>
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded ${p.published ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                    {p.published ? 'Publicado' : 'Rascunho'}
                  </span>
                  <span className="font-medium truncate">{p.titulo}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 truncate">/blog/{p.slug}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                {p.published && (
                  <Button size="sm" variant="ghost" asChild>
                    <a href={`/blog/${p.slug}`} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /></a>
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                <Button size="sm" variant="ghost" onClick={() => remove(p.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {posts.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Nenhum post ainda.</p>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing.id ? 'Editar post' : 'Novo post'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Título</Label>
              <Input value={editing.titulo || ''} onChange={e => setEditing({ ...editing, titulo: e.target.value, slug: editing.slug || slugify(e.target.value) })} />
            </div>
            <div>
              <Label>Slug (URL)</Label>
              <Input value={editing.slug || ''} onChange={e => setEditing({ ...editing, slug: slugify(e.target.value) })} />
            </div>
            <div>
              <Label>Resumo</Label>
              <Textarea rows={2} value={editing.resumo || ''} onChange={e => setEditing({ ...editing, resumo: e.target.value })} />
            </div>
            <div>
              <Label>Conteúdo (Markdown)</Label>
              <Textarea rows={14} className="font-mono text-sm" value={editing.conteudo_md || ''} onChange={e => setEditing({ ...editing, conteudo_md: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Autor</Label>
                <Input value={editing.autor || ''} onChange={e => setEditing({ ...editing, autor: e.target.value })} />
              </div>
              <div>
                <Label>Framework slug (opcional)</Label>
                <Input placeholder="iso-27001, lgpd..." value={editing.framework_slug || ''} onChange={e => setEditing({ ...editing, framework_slug: e.target.value || null })} />
              </div>
            </div>
            <div>
              <Label>Tags (separadas por vírgula)</Label>
              <Input value={tagInput} onChange={e => setTagInput(e.target.value)} />
            </div>
            <div>
              <Label>Capa URL (opcional)</Label>
              <Input value={editing.capa_url || ''} onChange={e => setEditing({ ...editing, capa_url: e.target.value || null })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>SEO Title</Label>
                <Input value={editing.seo_title || ''} onChange={e => setEditing({ ...editing, seo_title: e.target.value || null })} />
              </div>
              <div>
                <Label>SEO Description</Label>
                <Input value={editing.seo_description || ''} onChange={e => setEditing({ ...editing, seo_description: e.target.value || null })} />
              </div>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <Switch checked={!!editing.published} onCheckedChange={v => setEditing({ ...editing, published: v })} />
              <Label>Publicado</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
