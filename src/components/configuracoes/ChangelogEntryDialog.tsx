import { useEffect, useState } from 'react';
import { DialogShell } from '@/components/ui/dialog-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';
import { AkurisAIIcon } from '@/components/icons';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { useLanguage } from '@/contexts/LanguageContext';

export type ChangelogItemType = 'feature' | 'improvement' | 'fix';

interface ChangelogItem {
  type: ChangelogItemType;
  text: string;
}

export interface ChangelogEntryRow {
  id?: string;
  version: string;
  release_date: string; // YYYY-MM-DD
  items: ChangelogItem[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: ChangelogEntryRow | null;
  onSaved: () => void;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function ChangelogEntryDialog({ open, onOpenChange, entry, onSaved }: Props) {
  const { t } = useLanguage();
  const TYPE_OPTIONS: { value: ChangelogItemType; label: string }[] = [
    { value: 'feature', label: t('configPlanos.changelogDialog.typeFeature') },
    { value: 'improvement', label: t('configPlanos.changelogDialog.typeImprovement') },
    { value: 'fix', label: t('configPlanos.changelogDialog.typeFix') },
  ];
  const [version, setVersion] = useState('');
  const [releaseDate, setReleaseDate] = useState(todayIso());
  const [items, setItems] = useState<ChangelogItem[]>([{ type: 'feature', text: '' }]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setVersion(entry?.version ?? '');
      setReleaseDate(entry?.release_date ?? todayIso());
      setItems(entry?.items?.length ? entry.items : [{ type: 'feature', text: '' }]);
    }
  }, [open, entry]);

  const addItem = () => setItems((prev) => [...prev, { type: 'improvement', text: '' }]);
  const removeItem = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));
  const updateItem = (idx: number, patch: Partial<ChangelogItem>) =>
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  const handleSave = async () => {
    const cleanVersion = version.trim();
    if (!cleanVersion) {
      toast.error(t('configPlanos.changelogDialog.toastVersionRequired'));
      return;
    }
    if (!releaseDate) {
      toast.error(t('configPlanos.changelogDialog.toastDateRequired'));
      return;
    }
    const cleanItems = items
      .map((i) => ({ type: i.type, text: i.text.trim() }))
      .filter((i) => i.text.length > 0);
    if (cleanItems.length === 0) {
      toast.error(t('configPlanos.changelogDialog.toastItemRequired'));
      return;
    }

    setSaving(true);
    try {
      const payload = {
        version: cleanVersion,
        release_date: releaseDate,
        items: cleanItems as unknown as any,
      };

      const query = entry?.id
        ? supabase.from('changelog_entries').update(payload).eq('id', entry.id)
        : supabase.from('changelog_entries').insert(payload);

      const { error } = await query;
      if (error) throw error;

      toast.success(entry?.id ? t('configPlanos.changelogDialog.toastUpdated') : t('configPlanos.changelogDialog.toastCreated'));
      onSaved();
      onOpenChange(false);
    } catch (err) {
      logger.error('Erro ao salvar changelog', err as Error);
      toast.error(t('configPlanos.changelogDialog.toastSaveError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={AkurisAIIcon as any}
      title={entry?.id ? t('configPlanos.changelogDialog.titleEdit') : t('configPlanos.changelogDialog.titleNew')}
      size="md"
      onSubmit={handleSave}
      submitLabel={t('configPlanos.changelogDialog.submitLabel')}
      isSubmitting={saving}
    >
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="version">{t('configPlanos.changelogDialog.fieldVersion')}</Label>
              <Input
                id="version"
                placeholder="v3.0"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="release_date">{t('configPlanos.changelogDialog.fieldReleaseDate')}</Label>
              <Input
                id="release_date"
                type="date"
                value={releaseDate}
                onChange={(e) => setReleaseDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>{t('configPlanos.changelogDialog.itemsLabel')}</Label>
              <Button type="button" size="sm" variant="outline" onClick={addItem}>
                <Plus className="h-4 w-4 mr-1" /> {t('configPlanos.changelogDialog.addItem')}
              </Button>
            </div>

            {items.map((item, idx) => (
              <div
                key={idx}
                className="grid grid-cols-[140px_1fr_auto] gap-2 items-start border border-border/50 rounded-lg p-3 bg-card/40"
              >
                <Select
                  value={item.type}
                  onValueChange={(v) => updateItem(idx, { type: v as ChangelogItemType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Textarea
                  placeholder={t('configPlanos.changelogDialog.itemPlaceholder')}
                  value={item.text}
                  onChange={(e) => updateItem(idx, { text: e.target.value })}
                  rows={2}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeItem(idx)}
                  disabled={items.length === 1}
                  aria-label={t('configPlanos.changelogDialog.removeItemAria')}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </div>
    </DialogShell>
  );
}
