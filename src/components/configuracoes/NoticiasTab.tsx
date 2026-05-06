import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Mail, Pencil, Plus, Send, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { EmailCampanhaEditor, type CampanhaRow } from './EmailCampanhaEditor';

interface Campanha {
  id: string;
  assunto: string;
  conteudo_html: string;
  imagem_url: string | null;
  status: string;
  enviado_em: string | null;
  total_destinatarios: number;
  total_enviados: number;
  total_falhados: number;
  created_at: string;
}

const STATUS_BADGE: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  rascunho: { label: 'Rascunho', variant: 'outline' },
  enviando: { label: 'Enviando…', variant: 'secondary' },
  enviado: { label: 'Enviado', variant: 'default' },
  falhou: { label: 'Falhou', variant: 'destructive' },
};

export default function NoticiasTab() {
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<CampanhaRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('email_campanhas')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setCampanhas((data || []) as Campanha[]);
    } catch (err) {
      logger.error('Erro ao carregar campanhas', err as Error);
      toast.error('Não foi possível carregar as campanhas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleNew = () => {
    setEditing(null);
    setEditorOpen(true);
  };

  const handleEdit = (c: Campanha) => {
    setEditing({ id: c.id, assunto: c.assunto, conteudo_html: c.conteudo_html, imagem_url: c.imagem_url, status: c.status });
    setEditorOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      const { error } = await supabase.from('email_campanhas').delete().eq('id', deletingId);
      if (error) throw error;
      toast.success('Campanha removida');
      setDeletingId(null);
      load();
    } catch (err) {
      logger.error('Erro ao deletar', err as Error);
      toast.error('Não foi possível remover');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="space-y-1">
          <h3 className="text-base font-semibold flex items-center gap-2">
            <Mail className="h-4 w-4 text-primary" /> Campanhas de e-mail
          </h3>
          <p className="text-sm text-muted-foreground">
            Crie e dispare comunicados para todos os usuários ativos da plataforma. A IA pode redigir o conteúdo e gerar uma imagem ilustrativa para você.
          </p>
        </div>
        <Button onClick={handleNew}>
          <Plus className="h-4 w-4" /> Nova campanha
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : campanhas.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground space-y-3">
            <Mail className="h-10 w-10 mx-auto text-muted-foreground/40" />
            <p>Nenhuma campanha criada ainda.</p>
            <Button onClick={handleNew} variant="outline">
              <Plus className="h-4 w-4" /> Criar primeira campanha
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {campanhas.map((c) => {
            const badge = STATUS_BADGE[c.status] ?? STATUS_BADGE.rascunho;
            const isDraft = c.status === 'rascunho';
            return (
              <Card key={c.id}>
                <CardContent className="p-4 flex items-start gap-4 flex-wrap">
                  <div className="flex-1 min-w-[240px] space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-semibold text-sm">{c.assunto || '(sem assunto)'}</h4>
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Criada em {new Date(c.created_at).toLocaleString('pt-BR')}
                      {c.enviado_em && ` · Enviada em ${new Date(c.enviado_em).toLocaleString('pt-BR')}`}
                    </p>
                    {c.status === 'enviado' && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {c.total_enviados}/{c.total_destinatarios} entregues
                        {c.total_falhados > 0 && ` · ${c.total_falhados} falhas`}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleEdit(c)}>
                      {isDraft ? <Pencil className="h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />}
                      {isDraft ? 'Editar' : 'Ver'}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeletingId(c.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <EmailCampanhaEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        campanha={editing}
        onSaved={load}
      />

      <AlertDialog open={!!deletingId} onOpenChange={(o) => !o && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover campanha?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
