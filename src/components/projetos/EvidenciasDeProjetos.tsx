import React from 'react';
import { Link } from 'react-router-dom';
import { IconLink, IconFileText } from '@/components/icons';
import { useLanguage } from '@/contexts/LanguageContext';
import { useEvidenciasDeProjetos, abrirEvidencia, type AlvoEvidencia } from '@/hooks/useProjetoExtras';
import { intlLocale } from '@/lib/date-utils';

/** Evidências anexadas em tarefas de projeto e marcadas para este requisito/controlo. */
export function EvidenciasDeProjetos({ alvo }: { alvo: AlvoEvidencia }) {
  const { t } = useLanguage();
  const { data = [] } = useEvidenciasDeProjetos(alvo);
  if (data.length === 0) return null;
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('evidSemana.vindasDeProjetos')}</p>
      <ul className="divide-y divide-border rounded-lg border border-border">
        {data.map((e) => (
          <li key={e.ligacaoId} className="flex items-center gap-3 px-3 py-2">
            {e.anexo.tipo_origem === 'link' ? <IconLink className="h-4 w-4 shrink-0 text-muted-foreground" /> : <IconFileText className="h-4 w-4 shrink-0 text-muted-foreground" />}
            <div className="min-w-0 flex-1">
              <button type="button" onClick={() => void abrirEvidencia(e.anexo)} className="block max-w-full truncate text-left text-sm font-medium text-foreground hover:text-primary">{e.anexo.nome}</button>
              <span className="block truncate text-xs text-muted-foreground">
                <Link to={`/projetos/${e.projetoId}?focus=${e.anexo.tarefa_id}`} className="hover:text-primary hover:underline">{e.projetoNome} · {e.tarefaTitulo}</Link>
                {' · '}{new Date(e.anexo.created_at).toLocaleDateString(intlLocale())}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
