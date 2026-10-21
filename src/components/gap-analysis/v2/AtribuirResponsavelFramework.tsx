import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { OwnerCell } from '@/components/ui/owner-cell';
import { UserSelect } from '@/components/riscos/UserSelect';
import { supabase } from '@/integrations/supabase/client';
import { invokeEdgeFunction } from '@/lib/edge-function-utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { logger } from '@/lib/logger';

interface Props {
  frameworkId: string;
  responsavel?: { nome: string; foto?: string | null; userId?: string | null } | null;
}

/** Célula "Responsável" da lista de frameworks: clicar abre a atribuição. */
export function AtribuirResponsavelFramework({ frameworkId, responsavel }: Props) {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState<string>(responsavel?.userId ?? '');
  const [aplicar, setAplicar] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const salvar = async () => {
    if (!userId) return;
    setSalvando(true);
    const { data, error } = await supabase.rpc('atribuir_responsavel_framework' as any, {
      p_framework_id: frameworkId, p_user_id: userId, p_aplicar_requisitos: aplicar,
    });
    setSalvando(false);
    if (error) {
      logger.error('atribuir responsável framework', error);
      toast.error(error.code === '42501' ? t('gapAnalysis.frameworks.owner.semPermissao') : t('gapAnalysis.frameworks.owner.erro'));
      return;
    }
    toast.success(t('gapAnalysis.frameworks.owner.sucesso', { count: Number(data ?? 0) }));
    setOpen(false);
    qc.invalidateQueries({ queryKey: ['gap-fw-extras'] });
    invokeEdgeFunction('send-gap-owner-notification', { body: { framework_id: frameworkId }, showToast: false }).catch((e) => logger.warn('e-mail do responsável', e));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" onClick={(e) => e.stopPropagation()}
          className="rounded-md px-1 py-0.5 text-left hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={t('gapAnalysis.frameworks.owner.atribuir')}>
          <OwnerCell name={responsavel?.nome} photo={responsavel?.foto} emptyLabel={t('gapAnalysis.frameworks.tabela.naoAtribuido')} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 space-y-3" align="start" onClick={(e) => e.stopPropagation()}>
        <div>
          <p className="text-sm font-semibold">{t('gapAnalysis.frameworks.owner.titulo')}</p>
          <p className="text-xs text-muted-foreground">{t('gapAnalysis.frameworks.owner.descricao')}</p>
        </div>
        <UserSelect value={userId} onValueChange={setUserId} />
        <label className="flex items-start gap-2 text-xs text-foreground/90 cursor-pointer">
          <Checkbox checked={aplicar} onCheckedChange={(v) => setAplicar(v === true)} className="mt-0.5" />
          <span>{t('gapAnalysis.frameworks.owner.aplicarRequisitos')}</span>
        </label>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>{t('common.cancel')}</Button>
          <Button size="sm" onClick={salvar} disabled={!userId || salvando}>{t('gapAnalysis.frameworks.owner.salvar')}</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
