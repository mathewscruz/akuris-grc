import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
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
import { Pencil, Plus, ShieldAlert, Trash2 } from 'lucide-react';
import { AkurisAIIcon } from '@/components/icons';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { formatDate } from '@/lib/i18n-format';
import { useLanguage } from '@/contexts/LanguageContext';
import { ChangelogEntryDialog, type ChangelogEntryRow } from './ChangelogEntryDialog';

const TYPE_LABEL: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  feature: { label: 'Novo', variant: 'default' },
  improvement: { label: 'Melhoria', variant: 'secondary' },
  fix: { label: 'Correção', variant: 'outline' },
};

export default function GerenciamentoChangelog() {
  const { profile } = useAuth();
  const { locale } = useLanguage();
  const isSuperAdmin = profile?.role === 'super_admin';

  const [entries, setEntries] = useState<ChangelogEntryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ChangelogEntryRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('changelog_entries')
        .select('*')
        .order('release_date', { ascending: false });
      if (error) throw error;
      setEntries(
        (data || []).map((d: any) => ({
          id: d.id,
          version: d.version,
          release_date: d.release_date,
          items: Array.isArray(d.items) ? d.items : [],
        }))
      );
    } catch (err) {
      logger.error('Erro ao carregar changelog', err as Error);
      toast.error('Não foi possível carregar as versões');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isSuperAdmin) load();
  }, [isSuperAdmin, load]);

  if (!isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <ShieldAlert className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold">Acesso restrito</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Somente super-administradores podem gerenciar as Novidades.
        </p>
      </div>
    );
  }

  const handleNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const handleEdit = (entry: ChangelogEntryRow) => {
    setEditing(entry);
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      const { error } = await supabase.from('changelog_entries').delete().eq('id', deletingId);
      if (error) throw error;
      toast.success('Versão excluída');
      setDeletingId(null);
      load();
    } catch (err) {
      logger.error('Erro ao excluir versão', err as Error);
      toast.error('Não foi possível excluir');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold flex items-center gap-2">
            <AkurisAIIcon className="h-4 w-4 text-primary" />
            Novidades da Plataforma
          </h3>
          <p className="text-sm text-muted-foreground">
            Gerencie as versões exibidas no popover do header para todos os usuários.
          </p>
        </div>
        <Button onClick={handleNew}>
          <Plus className="h-4 w-4 mr-1" /> Nova versão
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <AkurisPulse size={32} />
        </div>
      ) : entries.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nenhuma versão publicada ainda. Clique em "Nova versão" para começar.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <Card key={entry.id} className="border-border/50">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-3">
                      <Badge variant="outline" className="font-mono text-xs">
                        {entry.version}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(entry.release_date + 'T00:00:00', locale)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        · {entry.items.length} {entry.items.length === 1 ? 'item' : 'itens'}
                      </span>
                    </div>
                    <ul className="space-y-1.5">
                      {entry.items.map((item, i) => {
                        const cfg = TYPE_LABEL[item.type] || TYPE_LABEL.improvement;
                        return (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <Badge variant={cfg.variant} className="text-[10px] px-1.5 py-0 shrink-0 mt-0.5">
                              {cfg.label}
                            </Badge>
                            <span className="text-muted-foreground">{item.text}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(entry)} aria-label="Editar">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeletingId(entry.id!)}
                      aria-label="Excluir"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ChangelogEntryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        entry={editing}
        onSaved={load}
      />

      <AlertDialog open={!!deletingId} onOpenChange={(o) => !o && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir versão?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A versão deixará de aparecer no popover de Novidades.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
