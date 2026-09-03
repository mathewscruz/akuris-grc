import { useCallback, useEffect, useState } from 'react';
import { intlLocale } from '@/lib/date-utils';
import { IconAdd, IconEdit, IconDelete, IconSend, IconMail, IconUsers } from '@/components/icons';
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
import { toast } from '@/lib/toast';
import { logger } from '@/lib/logger';
import { EmailCampanhaEditor, type CampanhaRow } from './EmailCampanhaEditor';
import { useLanguage } from '@/contexts/LanguageContext';

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

export default function NoticiasTab() {
  const { t } = useLanguage();
  const STATUS_BADGE: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
    rascunho: { label: t('configPlanos.noticiasTab.statusRascunho'), variant: 'outline' },
    enviando: { label: t('configPlanos.noticiasTab.statusEnviando'), variant: 'secondary' },
    enviado: { label: t('configPlanos.noticiasTab.statusEnviado'), variant: 'default' },
    falhou: { label: t('configPlanos.noticiasTab.statusFalhou'), variant: 'destructive' },
  };
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
      toast.error(t('configPlanos.noticiasTab.loadError'));
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
      toast.success(t('configPlanos.noticiasTab.deletedSuccess'));
      setDeletingId(null);
      load();
    } catch (err) {
      logger.error('Erro ao deletar', err as Error);
      toast.error(t('configPlanos.noticiasTab.deleteError'));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="space-y-1">
          <h3 className="text-base font-semibold flex items-center gap-2">
            <IconMail className="h-4 w-4 text-primary" /> {t('configPlanos.noticiasTab.headerTitle')}
          </h3>
          <p className="text-sm text-muted-foreground">
            {t('configPlanos.noticiasTab.headerSubtitle')}
          </p>
        </div>
        <Button onClick={handleNew}>
          <IconAdd className="h-4 w-4" /> {t('configPlanos.noticiasTab.newCampanha')}
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <AkurisPulse size={32} />
        </div>
      ) : campanhas.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground space-y-3">
            <IconMail className="h-10 w-10 mx-auto text-muted-foreground" />
            <p>{t('configPlanos.noticiasTab.emptyState')}</p>
            <Button onClick={handleNew} variant="outline">
              <IconAdd className="h-4 w-4" /> {t('configPlanos.noticiasTab.firstCampanha')}
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
                      <h4 className="font-semibold text-sm">{c.assunto || t('configPlanos.noticiasTab.semAssunto')}</h4>
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t('configPlanos.noticiasTab.criadaEm', { data: new Date(c.created_at).toLocaleString(intlLocale()) })}
                      {c.enviado_em && t('configPlanos.noticiasTab.enviadaEm', { data: new Date(c.enviado_em).toLocaleString(intlLocale()) })}
                    </p>
                    {c.status === 'enviado' && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <IconUsers className="h-3 w-3" />
                        {t('configPlanos.noticiasTab.entregues', { enviados: c.total_enviados, total: c.total_destinatarios })}
                        {c.total_falhados > 0 && t('configPlanos.noticiasTab.falhas', { count: c.total_falhados })}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleEdit(c)}>
                      {isDraft ? <IconEdit className="h-3.5 w-3.5" /> : <IconSend className="h-3.5 w-3.5" />}
                      {isDraft ? t('configPlanos.noticiasTab.editar') : t('configPlanos.noticiasTab.ver')}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeletingId(c.id)}>
                      <IconDelete className="h-4 w-4 text-destructive" />
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
            <AlertDialogTitle>{t('configPlanos.noticiasTab.deleteDialogTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('configPlanos.noticiasTab.deleteDialogDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('configPlanos.noticiasTab.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>{t('configPlanos.noticiasTab.confirmRemove')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
