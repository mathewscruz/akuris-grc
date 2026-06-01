import React from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SmilePlus } from 'lucide-react';
import { useReacoes, useToggleReacao } from '@/hooks/useProjetoExtras';
import { useAuth } from '@/components/AuthProvider';

const EMOJIS = ['👍', '✅', '🚀', '🎉', '🙏', '👀', '❓', '🛑'];

export function ReacoesBar({ comentarioIds }: { comentarioIds: string[] }) {
  // umbrella loader — caller renderiza vários, mas hook único economiza calls
  useReacoes(comentarioIds);
  return null;
}

export function ReacoesPorComentario({ comentarioId, reacoes }: { comentarioId: string; reacoes: ReturnType<typeof useReacoes>['data'] }) {
  const { user } = useAuth();
  const toggle = useToggleReacao();
  const minhas = (reacoes ?? []).filter((r) => r.comentario_id === comentarioId);

  // grupos por emoji
  const grupos = React.useMemo(() => {
    const m = new Map<string, { count: number; minha?: typeof minhas[number] }>();
    minhas.forEach((r) => {
      const g = m.get(r.emoji) ?? { count: 0 };
      g.count++;
      if (r.user_id === user?.id) g.minha = r;
      m.set(r.emoji, g);
    });
    return [...m.entries()];
  }, [minhas, user]);

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {grupos.map(([emoji, g]) => (
        <button
          key={emoji}
          onClick={() => toggle.mutate({ comentarioId, emoji, atual: g.minha })}
          className={`inline-flex items-center gap-1 rounded-full border px-2 h-6 text-xs leading-none transition-colors ${
            g.minha ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border bg-card hover:bg-muted'
          }`}
          title={g.minha ? 'Remover reação' : 'Reagir'}
        >
          <span>{emoji}</span>
          <span className="tabular-nums">{g.count}</span>
        </button>
      ))}
      <Popover>
        <PopoverTrigger asChild>
          <button className="inline-flex items-center justify-center h-6 w-6 rounded-full border border-border bg-card hover:bg-muted text-muted-foreground">
            <SmilePlus className="h-3 w-3" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-2">
          <div className="flex gap-1">
            {EMOJIS.map((e) => {
              const minha = minhas.find((r) => r.emoji === e && r.user_id === user?.id);
              return (
                <button
                  key={e}
                  onClick={() => toggle.mutate({ comentarioId, emoji: e, atual: minha })}
                  className={`h-7 w-7 rounded hover:bg-muted text-lg leading-none ${minha ? 'bg-primary/10' : ''}`}
                >
                  {e}
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
