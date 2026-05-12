import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { Sparkles } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  sectionName: string;
  currentContent: string;
  loading?: boolean;
  onSubmit: (instruction: string) => void;
}

const QUICK_PROMPTS = [
  'Tornar mais objetivo e direto',
  'Adicionar exemplos práticos',
  'Incluir responsabilidades específicas',
  'Reforçar conformidade com o framework',
  'Aumentar o nível de detalhe técnico',
];

export const DocGenSectionRefiner: React.FC<Props> = ({
  open, onOpenChange, sectionName, currentContent, loading, onSubmit,
}) => {
  const [instruction, setInstruction] = useState('');

  const handleSubmit = () => {
    if (!instruction.trim() || loading) return;
    onSubmit(instruction.trim());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" strokeWidth={1.5} />
            Refinar seção: {sectionName}
          </DialogTitle>
          <DialogDescription>
            Descreva o ajuste desejado. A IA reescreverá apenas esta seção, mantendo a coerência com o restante do documento. (1 crédito)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-md border border-border bg-muted/30 p-3 max-h-32 overflow-y-auto text-xs text-muted-foreground whitespace-pre-wrap">
            {currentContent.slice(0, 600)}{currentContent.length > 600 ? '…' : ''}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {QUICK_PROMPTS.map(p => (
              <Badge
                key={p}
                variant="outline"
                className="cursor-pointer hover:bg-accent text-[11px]"
                onClick={() => setInstruction(prev => prev ? `${prev}\n${p}` : p)}
              >
                + {p}
              </Badge>
            ))}
          </div>

          <Textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="Ex.: Adicione um parágrafo sobre responsabilidades do DPO e cite explicitamente o art. 41 da LGPD."
            rows={4}
            disabled={loading}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!instruction.trim() || loading} className="gap-2">
            {loading ? <><AkurisPulse size={16} /> Refinando…</> : <><Sparkles className="h-3.5 w-3.5" strokeWidth={1.5} /> Refinar com IA</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
