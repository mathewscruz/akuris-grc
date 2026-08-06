/**
 * RiscoComentarios — thread de comentários/atividade de um risco.
 * Grava em riscos_comentarios (migração 20260806131000_riscos_comentarios_align).
 *
 * AKURIS QA-061: a versão anterior transformava QUALQUER erro em lista vazia
 * (`if (error || !data) return []`), então o PGRST205 ("tabela não está no
 * schema cache") aparecia como "Nenhum comentário ainda" — informação falsa.
 * Agora os três estados são distintos: carregando, vazio válido e erro de
 * backend com ação de tentar novamente.
 */
import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { Send, MessageSquare, Trash2, AlertTriangle, RotateCcw } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { initials } from '@/components/riscos/risk-utils';
import { filterUuids } from '@/lib/uuid';

interface Comentario {
  id: string;
  comentario: string;
  created_at: string;
  user_id: string;
  autor?: { nome: string | null; foto_url: string | null } | null;
}

/** Mensagem acionável para o erro de backend, sem jargão de PostgREST solto. */
export function mensagemErroComentarios(error: unknown): string {
  const raw = [
    (error as any)?.message,
    (error as any)?.details,
    (error as any)?.hint,
    (error as any)?.code,
  ]
    .filter(Boolean)
    .join(' ');

  if (/PGRST205|schema cache|does not exist|relation .* does not exist/i.test(raw)) {
    return 'A tabela de comentários ainda não está publicada no banco. Aplique a migração riscos_comentarios no Supabase e recarregue o schema.';
  }
  if (/PGRST301|JWT|permission denied|row-level security/i.test(raw)) {
    return 'Sem permissão para ler os comentários deste risco. Verifique sua sessão e o acesso ao módulo de Riscos.';
  }
  return (error as any)?.message || 'Não foi possível carregar os comentários.';
}

function useRiscoComentarios(riscoId: string) {
  return useQuery({
    queryKey: ['risco-comentarios', riscoId],
    enabled: !!riscoId,
    staleTime: 30_000,
    retry: 1,
    queryFn: async (): Promise<Comentario[]> => {
      // `as any`: a tabela pode não estar nos types gerados. O erro NÃO é
      // silenciado — sem isso o PGRST205 vira falso estado vazio (QA-061).
      const { data, error } = await (supabase as any)
        .from('riscos_comentarios')
        .select('id, comentario, created_at, user_id')
        .eq('risco_id', riscoId)
        .order('created_at', { ascending: false });
      if (error) throw error;

      const rows = (data as any[]) ?? [];
      // AKURIS QA-064: só UUID válido vai ao filtro `profiles.user_id`.
      const ids = filterUuids(rows.map((c) => c.user_id));
      let map = new Map<string, { nome: string | null; foto_url: string | null }>();
      if (ids.length > 0) {
        const { data: profs } = await supabase.from('profiles').select('user_id, nome, foto_url').in('user_id', ids);
        map = new Map((profs || []).map((p) => [p.user_id, { nome: p.nome, foto_url: p.foto_url }]));
      }
      return rows.map((c) => ({ ...c, autor: map.get(c.user_id) || null }));
    },
  });
}

export function RiscoComentarios({ riscoId }: { riscoId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: comentarios = [], isLoading, isError, error, isFetching, refetch } = useRiscoComentarios(riscoId);
  const [texto, setTexto] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (active) setCurrentUserId(data.user?.id ?? null);
    });
    return () => { active = false; };
  }, []);

  const add = useMutation({
    mutationFn: async (comentario: string) => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id;
      if (!uid) throw new Error('Sessão inválida');
      const { error } = await (supabase as any)
        .from('riscos_comentarios')
        .insert({ risco_id: riscoId, user_id: uid, comentario });
      if (error) throw error;
    },
    onSuccess: () => {
      setTexto('');
      queryClient.invalidateQueries({ queryKey: ['risco-comentarios', riscoId] });
    },
    onError: (e: any) => {
      toast({ title: 'Erro', description: mensagemErroComentarios(e), variant: 'destructive' });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('riscos_comentarios').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['risco-comentarios', riscoId] }),
    onError: (e: any) => toast({
      title: 'Não foi possível excluir o comentário',
      description: mensagemErroComentarios(e),
      variant: 'destructive',
    }),
  });

  const submit = () => {
    const t = texto.trim();
    if (t) add.mutate(t);
  };

  return (
    <div className="space-y-4">
      {/* Composer */}
      <div className="rounded-lg border border-border bg-card p-2.5">
        <Textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Escreva um comentário…"
          className="min-h-[64px] resize-none border-0 bg-transparent p-1.5 focus-visible:ring-0"
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submit();
          }}
        />
        <div className="flex items-center justify-between pt-1">
          <span className="text-[10.5px] text-muted-foreground">Ctrl+Enter para enviar</span>
          <Button size="sm" className="h-7 px-3 text-xs" onClick={submit} disabled={!texto.trim() || add.isPending || isError}>
            <Send className="h-3.5 w-3.5 mr-1" strokeWidth={1.5} />
            {add.isPending ? 'Enviando…' : 'Comentar'}
          </Button>
        </div>
      </div>

      {/* Lista — três estados distintos (AKURIS QA-061) */}
      {isLoading ? (
        <div className="flex justify-center py-8" role="status" aria-label="Carregando comentários">
          <AkurisPulse size={28} />
        </div>
      ) : isError ? (
        <div
          role="alert"
          data-testid="comentarios-erro"
          className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm"
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-destructive" strokeWidth={1.5} />
            <div className="min-w-0 space-y-2">
              <p className="font-medium text-destructive">Não foi possível carregar os comentários</p>
              <p className="text-muted-foreground">{mensagemErroComentarios(error)}</p>
              <Button size="sm" variant="outline" className="h-7 px-3 text-xs" onClick={() => refetch()} disabled={isFetching}>
                <RotateCcw className="h-3.5 w-3.5 mr-1" strokeWidth={1.5} />
                {isFetching ? 'Tentando…' : 'Tentar novamente'}
              </Button>
            </div>
          </div>
        </div>
      ) : comentarios.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground" data-testid="comentarios-vazio">
          <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-40" strokeWidth={1.5} />
          Nenhum comentário ainda. Seja o primeiro a comentar.
        </div>
      ) : (
        <ul className="space-y-3">
          {comentarios.map((c) => (
            <li key={c.id} className="flex gap-2.5">
              <Avatar className="h-7 w-7 shrink-0 mt-0.5">
                {c.autor?.foto_url && <AvatarImage src={c.autor.foto_url} alt={c.autor?.nome || ''} />}
                <AvatarFallback className="text-[10px] bg-primary/10 text-primary">{initials(c.autor?.nome)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{c.autor?.nome || 'Usuário'}</span>
                  <span className="text-[11px] text-muted-foreground shrink-0">
                    {format(new Date(c.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </span>
                  {currentUserId === c.user_id && (
                    <button
                      type="button"
                      onClick={() => remove.mutate(c.id)}
                      disabled={remove.isPending && remove.variables === c.id}
                      className="ml-auto text-muted-foreground/60 hover:text-destructive transition-colors disabled:cursor-wait disabled:opacity-40"
                      aria-label={remove.isPending && remove.variables === c.id ? 'Excluindo comentário' : 'Excluir comentário'}
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                    </button>
                  )}
                </div>
                <p className="text-sm text-foreground/85 whitespace-pre-line mt-0.5">{c.comentario}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
