import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Send, Save, ImageIcon, Upload, X, Eye, MailCheck } from 'lucide-react';
import { AkurisAIIcon } from '@/components/icons';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { EmailPreview } from './EmailPreview';
import { useLanguage } from '@/contexts/LanguageContext';

import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { AiCostHint } from '@/components/ui/ai-cost-hint';
export interface CampanhaRow {
  id: string;
  assunto: string;
  conteudo_html: string;
  imagem_url: string | null;
  status: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campanha?: CampanhaRow | null;
  onSaved: () => void;
}

const stripTestePrefix = (value: string) => value.replace(/\[\s*teste\s*\]\s*/gi, '').trim();

export function EmailCampanhaEditor({ open, onOpenChange, campanha, onSaved }: Props) {
  const { t } = useLanguage();
  const { profile } = useAuth();
  const [id, setId] = useState<string | null>(null);
  const [assunto, setAssunto] = useState('');
  const [conteudoHtml, setConteudoHtml] = useState('');
  const [imagemUrl, setImagemUrl] = useState<string | null>(null);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiIncludeImage, setAiIncludeImage] = useState(true);
  const [aiIncludeSubject, setAiIncludeSubject] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmSend, setConfirmSend] = useState(false);
  const [activeUserCount, setActiveUserCount] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);

  useEffect(() => {
    if (open) {
      setId(campanha?.id ?? null);
      setAssunto(stripTestePrefix(campanha?.assunto ?? ''));
      setConteudoHtml(campanha?.conteudo_html ?? '');
      setImagemUrl(campanha?.imagem_url ?? null);
      setAiPrompt('');
      setAiIncludeImage(true);
      setAiIncludeSubject(true);
    }
  }, [open, campanha]);

  const handleGenerate = async () => {
    if (!aiPrompt.trim()) {
      toast.error(t('configGeral.emailCampanhaEditor.toastPromptRequired'));
      return;
    }
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-email-content', {
        body: { prompt: aiPrompt, includeImage: aiIncludeImage, includeSubject: aiIncludeSubject },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setConteudoHtml((data as any).html || '');
      if ((data as any).imageUrl) setImagemUrl((data as any).imageUrl);
      if (aiIncludeSubject && (data as any).subject) setAssunto(stripTestePrefix((data as any).subject));
      toast.success(t('configGeral.emailCampanhaEditor.toastGenerated'));
    } catch (err: any) {
      logger.error('Erro ao gerar conteúdo', err);
      const msg = err?.message?.includes('402') || err?.context?.status === 402
        ? t('configGeral.emailCampanhaEditor.toastCreditsExhausted')
        : err?.message || t('configGeral.emailCampanhaEditor.toastGenerateError');
      toast.error(msg);
    } finally {
      setGenerating(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error(t('configGeral.emailCampanhaEditor.toastSelectImage'));
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'png';
      const path = `manual/${Date.now()}-${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from('email-assets').upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (error) throw error;
      const { data } = supabase.storage.from('email-assets').getPublicUrl(path);
      setImagemUrl(data.publicUrl);
      toast.success(t('configGeral.emailCampanhaEditor.toastImageUploaded'));
    } catch (err: any) {
      logger.error('Erro ao subir imagem', err);
      toast.error(t('configGeral.emailCampanhaEditor.toastImageUploadError'));
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const validate = () => {
    if (!assunto.trim()) {
      toast.error(t('configGeral.emailCampanhaEditor.toastSubjectRequired'));
      return false;
    }
    if (!conteudoHtml.trim()) {
      toast.error(t('configGeral.emailCampanhaEditor.toastContentRequired'));
      return false;
    }
    return true;
  };

  const persist = async (status: 'rascunho') => {
    if (!profile?.user_id) return null;
    if (!validate()) return null;
    setSaving(true);
    try {
      const payload = {
        assunto: stripTestePrefix(assunto),
        conteudo_html: conteudoHtml,
        imagem_url: imagemUrl,
        status,
        criado_por: profile.user_id,
      };
      if (id) {
        const { error } = await supabase.from('email_campanhas').update(payload).eq('id', id);
        if (error) throw error;
        return id;
      }
      const { data, error } = await supabase
        .from('email_campanhas')
        .insert(payload)
        .select('id')
        .single();
      if (error) throw error;
      setId(data.id);
      return data.id as string;
    } catch (err: any) {
      logger.error('Erro ao salvar campanha', err);
      toast.error(t('configGeral.emailCampanhaEditor.toastDraftSaveError'));
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDraft = async () => {
    const savedId = await persist('rascunho');
    if (savedId) {
      toast.success(t('configGeral.emailCampanhaEditor.toastDraftSaved'));
      onSaved();
    }
  };

  const openConfirmSend = async () => {
    if (!validate()) return;
    // Salvar antes de abrir confirmação
    const savedId = await persist('rascunho');
    if (!savedId) return;
    // Buscar destinatários ativos
    const { count, error } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('ativo', true)
      .not('email', 'is', null);
    if (error) {
      logger.error('Erro contar destinatários', error);
      toast.error(t('configGeral.emailCampanhaEditor.toastCountRecipientsError'));
      return;
    }
    setActiveUserCount(count ?? 0);
    setConfirmSend(true);
  };

  const handleConfirmSend = async () => {
    if (!id) return;
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-email-campaign', {
        body: { campanha_id: id },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const { sent, failed } = (data as any) || {};
      toast.success(t('configGeral.emailCampanhaEditor.toastSendSuccess').replace('{sent}', String(sent ?? 0)).replace('{failed}', String(failed ?? 0)));
      setConfirmSend(false);
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      logger.error('Erro ao enviar campanha', err);
      toast.error(err?.message || t('configGeral.emailCampanhaEditor.toastSendError'));
    } finally {
      setSending(false);
    }
  };

  const handleSendTest = async () => {
    if (!validate()) return;
    const savedId = await persist('rascunho');
    if (!savedId) return;
    setSendingTest(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-email-campaign', {
        body: { campanha_id: savedId, mode: 'test' },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const { sent, failed } = (data as any) || {};
      if (sent > 0) {
        toast.success(profile?.email ? t('configGeral.emailCampanhaEditor.toastTestSentSuccess').replace('{email}', profile.email) : t('configGeral.emailCampanhaEditor.toastTestSentDefault'));
      } else {
        toast.error(t('configGeral.emailCampanhaEditor.toastTestSentFailure').replace('{detail}', failed ? ` (${failed} erro)` : ''));
      }
      onSaved();
    } catch (err: any) {
      logger.error('Erro ao enviar teste', err);
      toast.error(err?.message || t('configGeral.emailCampanhaEditor.toastTestSentErrorGeneric'));
    } finally {
      setSendingTest(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-6xl">
          <DialogHeader>
            <DialogTitle>{id ? t('configGeral.emailCampanhaEditor.titleEdit') : t('configGeral.emailCampanhaEditor.titleNew')}</DialogTitle>
            <DialogDescription>
              {t('configGeral.emailCampanhaEditor.description')}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Coluna esquerda — formulário */}
            <div className="space-y-5">
              <div className="rounded-lg border border-border bg-card/50 p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <AkurisAIIcon className="h-4 w-4 text-primary" />
                  {t('configGeral.emailCampanhaEditor.aiGenerateTitle')}
                  <AiCostHint className="ml-auto" action={t('configGeral.emailCampanhaEditor.aiGenerateActionLabel')} />
                </div>
                <Textarea
                  placeholder={t('configGeral.emailCampanhaEditor.aiPromptPlaceholder')}
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  rows={3}
                />
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox checked={aiIncludeImage} onCheckedChange={(v) => setAiIncludeImage(Boolean(v))} />
                    {t('configGeral.emailCampanhaEditor.checkboxGenerateImage')}
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox checked={aiIncludeSubject} onCheckedChange={(v) => setAiIncludeSubject(Boolean(v))} />
                    {t('configGeral.emailCampanhaEditor.checkboxSuggestSubject')}
                  </label>
                  <Button onClick={handleGenerate} disabled={generating} size="sm" className="ml-auto">
                    {generating ? <AkurisPulse size={16} /> : <AkurisAIIcon className="h-4 w-4" />}
                    {t('configGeral.emailCampanhaEditor.generateButton')}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="assunto">{t('configGeral.emailCampanhaEditor.subjectLabel')}</Label>
                <Input
                  id="assunto"
                  value={assunto}
                  onChange={(e) => setAssunto(e.target.value)}
                  placeholder={t('configGeral.emailCampanhaEditor.subjectPlaceholder')}
                  maxLength={150}
                />
              </div>

              <div className="space-y-2">
                <Label>{t('configGeral.emailCampanhaEditor.imageLabel')}</Label>
                {imagemUrl ? (
                  <div className="relative inline-block">
                    <img src={imagemUrl} alt={t('configGeral.emailCampanhaEditor.imageAlt')} className="max-h-40 rounded-md border border-border" />
                    <Button
                      type="button"
                      size="icon"
                      variant="destructive"
                      className="absolute -top-2 -right-2 h-7 w-7"
                      onClick={() => setImagemUrl(null)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Label
                      htmlFor="upload-img"
                      className="inline-flex items-center gap-2 cursor-pointer rounded-md border border-dashed border-border px-3 py-2 text-sm hover:bg-muted/50"
                    >
                      {uploading ? <AkurisPulse size={16} /> : <Upload className="h-4 w-4" />}
                      {t('configGeral.emailCampanhaEditor.uploadManualLabel')}
                    </Label>
                    <Input id="upload-img" type="file" accept="image/*" onChange={handleUpload} className="hidden" disabled={uploading} />
                    <span className="text-xs text-muted-foreground">{t('configGeral.emailCampanhaEditor.uploadOrAiHint')}</span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="conteudo">{t('configGeral.emailCampanhaEditor.contentLabel')}</Label>
                <Textarea
                  id="conteudo"
                  value={conteudoHtml}
                  onChange={(e) => setConteudoHtml(e.target.value)}
                  placeholder={t('configGeral.emailCampanhaEditor.contentPlaceholder')}
                  rows={14}
                  className="font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground">
                  {t('configGeral.emailCampanhaEditor.contentHint')}
                </p>
              </div>
            </div>

            {/* Coluna direita — preview */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Eye className="h-4 w-4 text-primary" />
                {t('configGeral.emailCampanhaEditor.previewLabel')}
              </div>
              <EmailPreview assunto={assunto} conteudoHtml={conteudoHtml} imagemUrl={imagemUrl} />
            </div>
          </div>

          <DialogFooter className="flex-wrap gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>{t('configGeral.emailCampanhaEditor.cancelButton')}</Button>
            <Button variant="outline" onClick={handleSaveDraft} disabled={saving || sending || sendingTest}>
              {saving ? <AkurisPulse size={16} /> : <Save className="h-4 w-4" />}
              {t('configGeral.emailCampanhaEditor.saveDraftButton')}
            </Button>
            <Button
              variant="secondary"
              onClick={handleSendTest}
              disabled={saving || sending || sendingTest}
              title={profile?.email ? t('configGeral.emailCampanhaEditor.sendTestTitleWithEmail').replace('{email}', profile.email) : t('configGeral.emailCampanhaEditor.sendTestTitleDefault')}
            >
              {sendingTest ? <AkurisPulse size={16} /> : <MailCheck className="h-4 w-4" />}
              {t('configGeral.emailCampanhaEditor.sendTestButton')}
            </Button>
            <Button onClick={openConfirmSend} disabled={saving || sending || sendingTest}>
              <Send className="h-4 w-4" />
              {t('configGeral.emailCampanhaEditor.sendAllButton')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmSend} onOpenChange={setConfirmSend}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('configGeral.emailCampanhaEditor.confirmSendTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {activeUserCount === null
                ? t('configGeral.emailCampanhaEditor.confirmSendCalculating')
                : t('configGeral.emailCampanhaEditor.confirmSendDescription').replace('{count}', String(activeUserCount))}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={sending}>{t('configGeral.emailCampanhaEditor.confirmSendCancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmSend} disabled={sending || !activeUserCount}>
              {sending ? <AkurisPulse size={16} /> : <Send className="h-4 w-4" />}
              {t('configGeral.emailCampanhaEditor.confirmSendAction')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
