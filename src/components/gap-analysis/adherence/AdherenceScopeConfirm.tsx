import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Chip } from '@/components/ui/chip';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { useLanguage } from '@/contexts/LanguageContext';

export interface EscopoProposto {
  catalogo: Array<{ id: string; codigo: string | null; titulo: string }>;
  sugeridos: string[];
  tema: string;
  justificativa: string;
}

const semAcento = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/**
 * Passo de confirmação: a IA leu a política e propôs quais requisitos da norma
 * ela deve cobrir. O usuário ajusta e confirma antes de gastar a avaliação.
 */
export function AdherenceScopeConfirm({ proposta, frameworkNome, confirmando, onConfirm }: {
  proposta: EscopoProposto;
  frameworkNome?: string;
  confirmando: boolean;
  onConfirm: (ids: string[]) => void;
}) {
  const { t } = useLanguage();
  const [selecionados, setSelecionados] = useState<Set<string>>(() => new Set(proposta.sugeridos));
  const [busca, setBusca] = useState('');
  const [verTodos, setVerTodos] = useState(false);

  const sugeridosSet = useMemo(() => new Set(proposta.sugeridos), [proposta.sugeridos]);
  const lista = useMemo(() => {
    const q = semAcento(busca.trim());
    const base = verTodos || q ? proposta.catalogo : proposta.catalogo.filter((r) => sugeridosSet.has(r.id) || selecionados.has(r.id));
    return q ? base.filter((r) => semAcento(`${r.codigo || ''} ${r.titulo}`).includes(q)) : base;
  }, [busca, verTodos, proposta.catalogo, sugeridosSet, selecionados]);

  const alternar = (id: string) => setSelecionados((prev) => {
    const n = new Set(prev);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-muted/30 p-4 space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('gapAnalysis.adherenceUi.scope.eyebrow')}</p>
        <p className="text-sm font-semibold text-foreground">
          {t('gapAnalysis.adherenceUi.scope.question', { norma: frameworkNome || '' })}
        </p>
        {proposta.tema && (
          <p className="text-sm text-muted-foreground">{t('gapAnalysis.adherenceUi.scope.identified', { tema: proposta.tema })}</p>
        )}
        {proposta.justificativa && <p className="text-xs text-muted-foreground">{proposta.justificativa}</p>}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-foreground">
          {t('gapAnalysis.adherenceUi.scope.selectedCount', { n: selecionados.size, total: proposta.catalogo.length })}
        </p>
        <Button variant="ghost" size="sm" onClick={() => setVerTodos((v) => !v)}>
          {verTodos ? t('gapAnalysis.adherenceUi.scope.showSuggested') : t('gapAnalysis.adherenceUi.scope.showAll')}
        </Button>
      </div>

      <Input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder={t('gapAnalysis.adherenceUi.scope.searchPlaceholder')}
        className="text-base md:text-sm"
      />

      <div className="max-h-[300px] overflow-y-auto rounded-lg border divide-y">
        {lista.length === 0 && (
          <p className="p-4 text-sm text-muted-foreground">{t('gapAnalysis.adherenceUi.scope.empty')}</p>
        )}
        {lista.map((r) => (
          <label key={r.id} className="flex min-h-[44px] cursor-pointer items-start gap-3 px-3 py-2.5 hover:bg-muted/40">
            <Checkbox checked={selecionados.has(r.id)} onCheckedChange={() => alternar(r.id)} className="mt-0.5" />
            <span className="flex-1 text-sm text-foreground">
              {r.codigo && <span className="mr-2 font-mono text-xs text-muted-foreground">{r.codigo}</span>}
              {r.titulo}
            </span>
            {sugeridosSet.has(r.id) && <Chip family="category">{t('gapAnalysis.adherenceUi.scope.suggested')}</Chip>}
          </label>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">{t('gapAnalysis.adherenceUi.scope.hint')}</p>

      <div className="flex justify-end">
        <Button onClick={() => onConfirm(Array.from(selecionados))} disabled={confirmando || selecionados.size === 0}>
          {confirmando && <AkurisPulse size={16} className="mr-2" />}
          {t('gapAnalysis.adherenceUi.scope.confirm', { n: selecionados.size })}
        </Button>
      </div>
    </div>
  );
}
