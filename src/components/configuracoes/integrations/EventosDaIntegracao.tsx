/**
 * Que eventos esta integração recebe.
 *
 * Estava copiado em quatro diálogos, com defeitos diferentes em cada cópia:
 * Slack e Teams começavam com tudo marcado, Webhooks com nada, o Jira nem
 * sequer tinha a lista — e o despachante trata as três situações da mesma
 * maneira.
 *
 * ## A regra que ninguém via
 *
 * No `integration-webhook-dispatcher`:
 *
 *     if (eventosConfigurados.length > 0 && !eventosConfigurados.includes(evento))
 *
 * Lista VAZIA passa tudo. Faz sentido do lado do servidor — é o que permite a
 * uma integração antiga, gravada antes de existir escolha, continuar a
 * funcionar. Do lado do ecrã era uma armadilha: desmarcar as vinte e duas
 * caixas à espera de silêncio entregava as vinte e duas.
 *
 * Não mudei a regra — mudá-la calaria integrações que hoje funcionam, incluindo
 * todas as do Jira, que nunca tiveram onde escolher. Mudei o ecrã, que passa a
 * dizê-la: com zero marcados, aparece que recebe todos.
 */
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { IconInfo } from '@/components/icons';
import { getEventosDisponiveis } from '@/lib/integration-events';
import { useLanguage } from '@/contexts/LanguageContext';

const EVENTOS = getEventosDisponiveis();

/** Todos os identificadores, para quem quiser começar com tudo marcado. */
export const TODOS_OS_EVENTOS = EVENTOS.map((e) => e.id);

interface Props {
  /** Prefixo dos ids do DOM: dois seletores no mesmo ecrã não podem colidir. */
  prefixo: string;
  valor: string[];
  onChange: (eventos: string[]) => void;
}

export function EventosDaIntegracao({ prefixo, valor, onChange }: Props) {
  const { t } = useLanguage();
  const nenhum = valor.length === 0;
  const todos = valor.length === EVENTOS.length;

  const alternar = (id: string) =>
    onChange(valor.includes(id) ? valor.filter((e) => e !== id) : [...valor, id]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Label>{t('configIntegrations.eventos.titulo')}</Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={() => onChange(todos ? [] : TODOS_OS_EVENTOS)}
        >
          {todos
            ? t('configIntegrations.eventos.desmarcarTodos')
            : t('configIntegrations.eventos.marcarTodos')}
        </Button>
      </div>

      <div className="grid max-h-48 grid-cols-1 gap-2 overflow-y-auto">
        {EVENTOS.map((evento) => (
          <div
            key={evento.id}
            className="flex items-center gap-3 rounded-md p-2 hover:bg-accent"
          >
            <Checkbox
              id={`${prefixo}-${evento.id}`}
              checked={valor.includes(evento.id)}
              onCheckedChange={() => alternar(evento.id)}
            />
            <label
              htmlFor={`${prefixo}-${evento.id}`}
              className="flex-1 cursor-pointer text-sm"
            >
              {t(`configIntegrations.events.${evento.id}.label`)}
            </label>
            <Badge variant="outline" className="text-xs">
              {t(`configIntegrations.events.${evento.id}.modulo`)}
            </Badge>
          </div>
        ))}
      </div>

      {nenhum && (
        /*
          Sem isto, zero marcados lê-se como «não recebe nada» — e é o
          contrário. O aviso não corrige a regra; corrige quem a estava a ler
          ao contrário.
        */
        <p className="flex items-start gap-2 rounded-md border bg-muted/40 p-2.5 text-xs text-muted-foreground">
          <IconInfo className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {t('configIntegrations.eventos.nenhumRecebeTodos')}
        </p>
      )}
    </div>
  );
}
