/**
 * RiscoComentarios — thread de comentários/atividade de um risco.
 * Grava em riscos_comentarios (ver migração 20260720130000). RESILIENTE: se a
 * tabela ainda não existir (migração não aplicada), a leitura retorna vazio e
 * o envio avisa sem quebrar o drawer.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { Send, MessageSquare, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { initials } from '@/components/riscos/risk-utils';

interface Comentario {
  id: string;
  comentario: string;
  created_at: string;
  user_id: string;
  autor?: { nome: string | null; foto_url: string | null } | null;
}

function useRiscoComentarios(riscoId: string) {
  return useQuery({
    queryKey: ['risco-comentarios', riscoId],
    enabled: !!riscoId,
    staleTime: 30_000,
    queryFn: async (): Promise<Comentario[]> => {
      // `as any`: a tabela pode não existir nos types até a migração; tolerante a erro.
      const { data, error } = await (supabase as any)
        .from('riscos_comentarios')
        .select('id, comentario, created_at, user_id')
        .eq('risco_id', riscoId)
        .order('created_at', { ascending: false });
      if (error || !data) return [];
      const ids = [...new Set((data as any[]).map((c) => c.user_id).filter(Boolean))];
      let map = new Map<string, { nome: string | null; foto_url: string | null }>();
      if (ids.length > 0) {
        const { data: profs } = await supabase.from('profiles').select('user_id, nome, foto_url').in('user_id', ids as string[]);
        map = new Map((profs || []).map((p) => [p.user_id, { nome: p.nome, foto_url: p.foto_url }]));
      }
      return (data as any[]).map((c) => ({ ...c, autor: map.get(c.user_id) || null }));
    },
  });
}

export function RiscoComentarios({ riscoId }: { riscoId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: comentarios = [], isLoading } = useRiscoComentarios(riscoId);
  const [texto, setTexto] = useState('');

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
      const msg = /relation|does not exist|schema cache/i.test(e?.message || '')
        ? 'Comentários indisponíveis: aplique a migração riscos_comentarios no Supabase.'
        : e?.message || 'Não foi possível enviar o comentário.';
      toast({ title: 'Erro', description: msg, variant: 'destructive' });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('riscos_comentarios').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['risco-comentarios', riscoId] }),
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
          <Button size="sm" className="h-7 px-3 text-xs" onClick={submit} disabled={!texto.trim() || add.isPending}>
            <Send className="h-3.5 w-3.5 mr-1" strokeWidth={1.5} />
            {add.isPending ? 'Enviando…' : 'Comentar'}
          </Button>
        </div>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex justify-center py-8"><AkurisPulse size={28} /></div>
      ) : comentarios.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
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
                  <button
                    type="button"
                    onClick={() => remove.mutate(c.id)}
                    className="ml-auto text-muted-foreground/60 hover:text-destructive transition-colors"
                    aria-label="Excluir comentário"
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                  </button>
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
