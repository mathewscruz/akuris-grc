import React, { useState } from 'react';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
;
import { useLanguage } from '@/contexts/LanguageContext';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  sectionName: string;
  currentContent: string;
  loading?: boolean;
  onSubmit: (instruction: string) => void;
}

export const DocGenSectionRefiner: React.FC<Props> = ({
  open, onOpenChange, sectionName, currentContent, loading, onSubmit,
}) => {
  const { t } = useLanguage();
  const [instruction, setInstruction] = useState('');
  const QUICK_PROMPTS = [
    t('docgen.sectionRefiner.quickPrompts.objective'),
    t('docgen.sectionRefiner.quickPrompts.examples'),
    t('docgen.sectionRefiner.quickPrompts.responsibilities'),
    t('docgen.sectionRefiner.quickPrompts.compliance'),
    t('docgen.sectionRefiner.quickPrompts.detail'),
  ];

  const handleSubmit = () => {
    if (!instruction.trim() || loading) return;
    onSubmit(instruction.trim());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {t('docgen.sectionRefiner.title', { sectionName })}
          </DialogTitle>
          <DialogDescription>
            {t('docgen.sectionRefiner.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-md border border-border bg-card p-3 max-h-32 overflow-y-auto text-xs text-muted-foreground whitespace-pre-wrap">
            {currentContent.slice(0, 600)}{currentContent.length > 600 ? '…' : ''}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {QUICK_PROMPTS.map(p => (
              <Badge
                key={p}
                variant="outline"
                className="cursor-pointer hover:bg-accent text-micro"
                onClick={() => setInstruction(prev => prev ? `${prev}\n${p}` : p)}
              >
                + {p}
              </Badge>
            ))}
          </div>

          <Textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder={t('docgen.sectionRefiner.instructionPlaceholder')}
            rows={4}
            disabled={loading}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>{t('docgen.sectionRefiner.cancel')}</Button>
          <Button onClick={handleSubmit} disabled={!instruction.trim() || loading} className="gap-2">
            {loading ? <><AkurisPulse size={16} /> {t('docgen.sectionRefiner.refining')}</> : <>{t('docgen.sectionRefiner.refineWithAI')}</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
