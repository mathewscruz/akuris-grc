/**
 * MinhasPendencias — o painel passa a falar de mim.
 *
 * O painel contava riscos, controlos, documentos e frameworks da empresa e
 * nunca dizia o que a pessoa que o está a olhar tem para fazer. Quem quisesse
 * saber tinha de ir a /minhas-tarefas — uma página que já unia as duas fontes
 * de trabalho atribuído e que nada no painel mandava abrir.
 *
 * Três linhas e o total. O detalhe fica onde já estava; aqui a pergunta é só
 * "há alguma coisa à minha espera?", e a resposta tem de caber num relance.
 */
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PanelAction } from '@/components/ui/panel-action';
import { Skeleton } from '@/components/ui/skeleton';
import { IconChevron } from '@/components/icons';
import { cn } from '@/lib/utils';
import { useMinhasPendencias } from '@/hooks/useMinhasPendencias';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatDateOnly } from '@/lib/date-utils';

/** Quantas cabem sem a lista virar uma segunda tabela. */
const VISIVEIS = 3;

export function MinhasPendencias() {
  const { itens, total, atrasadas, isLoading } = useMinhasPendencias();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const Cabecalho = (
    <CardHeader className="pb-2">
      <div className="flex items-center gap-2">
        <CardTitle className="text-micro font-semibold uppercase tracking-wide text-muted-foreground">
          {t('dashWidgets.pendencias.title')}
        </CardTitle>
        {!isLoading && total > 0 && (
          <span className="ml-auto text-sm font-semibold tabular-nums text-foreground">{total}</span>
        )}
      </div>
      {!isLoading && atrasadas > 0 && (
        <p className="text-micro text-severity-critical">
          {t('dashWidgets.pendencias.atrasadas', { count: atrasadas })}
        </p>
      )}
    </CardHeader>
  );

  if (isLoading) {
    return (
      <Card className="w-full">
        {Cabecalho}
        <CardContent className="space-y-2 pb-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-4 w-3/5" />
        </CardContent>
      </Card>
    );
  }

  if (total === 0) {
    return (
      <Card className="w-full">
        {Cabecalho}
        <CardContent className="pb-4">
          <p className="text-xs text-muted-foreground">{t('dashWidgets.pendencias.empty')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="flex w-full flex-col">
      {Cabecalho}
      <CardContent className="flex-1 pb-3 pt-1">
        <ul>
          {itens.slice(0, VISIVEIS).map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => navigate(p.href)}
                className="realce-linha group flex min-h-10 w-full items-center gap-2 border-b border-border/60 py-2 text-left transition-ui last:border-0"
              >
                {/*
                  O ponto diz só uma coisa: passou do prazo, ou não. A
                  prioridade do formulário não entra — uma "média" vencida
                  ontem exige decisão antes de uma "crítica" para o mês que vem.
                */}
                <span
                  className={cn(
                    'h-1.5 w-1.5 shrink-0 rounded-full',
                    p.atrasada ? 'bg-severity-critical' : 'bg-muted-foreground/35',
                  )}
                />
                <span className="min-w-0 flex-1 truncate text-xs text-foreground group-hover:text-accent-foreground">
                  {p.titulo}
                </span>
                <span className="shrink-0 text-micro tabular-nums text-muted-foreground">
                  {p.prazo ? formatDateOnly(p.prazo) : t('dashWidgets.pendencias.semPrazo')}
                </span>
                <IconChevron
                  className="h-3 w-3 shrink-0 text-muted-foreground/0 transition-colors group-hover:text-muted-foreground"
                  strokeWidth={1.5}
                />
              </button>
            </li>
          ))}
        </ul>
      </CardContent>
      <PanelAction onClick={() => navigate('/projetos/minhas-tarefas')}>
        {t('dashWidgets.pendencias.verTodas', { count: total })}
      </PanelAction>
    </Card>
  );
}
