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
import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { format } from 'date-fns';
import { initials } from '@/components/riscos/risk-utils';
import { filterUuids } from '@/lib/uuid';
import { useLanguage } from '@/contexts/LanguageContext';
import { IconSend, IconWarning, IconDelete, IconMessage, IconUndo } from '@/components/icons';
import { dateFnsLocale } from '@/lib/date-utils';
import { notificarVarios } from '@/lib/notificar';

interface Comentario {
  id: string;
  comentario: string;
  created_at: string;
  user_id: string;
  autor?: { nome: string | null; foto_url: string | null } | null;
}

interface UsuarioMencionavel {
  user_id: string;
  nome: string;
  email: string | null;
  foto_url: string | null;
}

function escaparRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Mantém a identificação de menções previsível, inclusive para nomes compostos. */
export function extrairIdsMencionados(texto: string, usuarios: UsuarioMencionavel[]): string[] {
  const encontrados = usuarios
    .filter((usuario) => new RegExp(`@${escaparRegex(usuario.nome)}(?=\\s|[.,!?;:]|$)`, 'iu').test(texto))
    .map((usuario) => usuario.user_id);
  return [...new Set(encontrados)];
}

/** Mensagem acionável para o erro de backend, sem jargão de PostgREST solto. */
export function mensagemErroComentarios(error: unknown, t: (k: string) => string): string {
  const raw = [
    (error as any)?.message,
    (error as any)?.details,
    (error as any)?.hint,
    (error as any)?.code,
  ]
    .filter(Boolean)
    .join(' ');

  if (/PGRST205|schema cache|does not exist|relation .* does not exist/i.test(raw)) {
    return t('fin.riscos.comentarios.tabelaAusente');
  }
  if (/PGRST301|JWT|permission denied|row-level security/i.test(raw)) {
    return t('fin.riscos.comentarios.semPermissao');
  }
  return (error as any)?.message || t('fin.riscos.comentarios.erroCarregarDesc');
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
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const { data: comentarios = [], isLoading, isError, error, isFetching, refetch } = useRiscoComentarios(riscoId);
  const [texto, setTexto] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [mentionSearch, setMentionSearch] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: usuarios = [] } = useQuery({
    queryKey: ['risco-usuarios-mencionaveis', currentUserId],
    enabled: !!currentUserId,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<UsuarioMencionavel[]> => {
      const { data, error: usuariosError } = await supabase
        .from('profiles')
        .select('user_id, nome, email, foto_url')
        .eq('ativo', true)
        .order('nome');
      if (usuariosError) throw usuariosError;
      return (data || [])
        .filter((usuario) => usuario.user_id !== currentUserId && !!usuario.nome?.trim())
        .map((usuario) => ({ ...usuario, nome: usuario.nome!.trim() }));
    },
  });

  const usuariosFiltrados = useMemo(() => {
    const busca = mentionSearch.trim().toLocaleLowerCase();
    return usuarios
      .filter((usuario) => !busca || usuario.nome.toLocaleLowerCase().includes(busca) || usuario.email?.toLocaleLowerCase().includes(busca))
      .slice(0, 5);
  }, [mentionSearch, usuarios]);

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (active) setCurrentUserId(data.user?.id ?? null);
    });
    return () => { active = false; };
  }, []);

  const add = useMutation({
    mutationFn: async ({ comentario, mencoes }: { comentario: string; mencoes: string[] }) => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id;
      if (!uid) throw new Error(t('fin.comum.sessaoInvalida'));
      const { data: comentarioCriado, error } = await (supabase as any)
        .from('riscos_comentarios')
        .insert({ risco_id: riscoId, user_id: uid, comentario, mencoes: mencoes.length ? mencoes : null })
        .select('id')
        .single();
      if (error) throw error;

      if (mencoes.length) {
        await notificarVarios(mencoes, {
          titulo: t('fin.riscos.comentarios.mentionNotifyTitle'),
          mensagem: t('fin.riscos.comentarios.mentionNotifyMessage'),
          linkPara: `/riscos?view=table&risco=${riscoId}`,
          metadados: { tipo: 'risco', risco_id: riscoId, comentario_id: comentarioCriado.id },
        });

        const emails = await Promise.all(mencoes.map((userId) =>
          supabase.functions.invoke('send-risco-mention-notification', {
            body: { user_id: userId, risco_id: riscoId, comentario_id: comentarioCriado.id },
          })
        ));
        return { emailFailures: emails.filter(({ error: emailError }) => !!emailError).length };
      }
      return { emailFailures: 0 };
    },
    onSuccess: ({ emailFailures }) => {
      setTexto('');
      setShowMentions(false);
      queryClient.invalidateQueries({ queryKey: ['risco-comentarios', riscoId] });
      if (emailFailures > 0) {
        toast({ title: t('fin.riscos.comentarios.mentionEmailFailed') });
      }
    },
    onError: (e: any) => {
      toast({ title: t('fin.comum.erro'), description: mensagemErroComentarios(e, t), variant: 'destructive' });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('riscos_comentarios').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['risco-comentarios', riscoId] }),
    onError: (e: any) => toast({
      title: t('fin.riscos.comentarios.erroExcluir'),
      description: mensagemErroComentarios(e, t),
      variant: 'destructive',
    }),
  });

  const submit = () => {
    const value = texto.trim();
    if (value) add.mutate({ comentario: value, mencoes: extrairIdsMencionados(value, usuarios) });
  };

  const handleCommentChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = event.target.value;
    const position = event.target.selectionStart ?? value.length;
    const beforeCursor = value.slice(0, position);
    const match = beforeCursor.match(/(?:^|\s)@([^@\n]*)$/u);
    setTexto(value);
    setCursorPosition(position);
    setMentionSearch(match?.[1] ?? '');
    setShowMentions(!!match);
  };

  const insertMention = (usuario: UsuarioMencionavel) => {
    const beforeCursor = texto.slice(0, cursorPosition);
    const atIndex = beforeCursor.lastIndexOf('@');
    if (atIndex < 0) return;
    const next = `${texto.slice(0, atIndex)}@${usuario.nome} ${texto.slice(cursorPosition)}`;
    const nextPosition = atIndex + usuario.nome.length + 2;
    setTexto(next);
    setShowMentions(false);
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(nextPosition, nextPosition);
    });
  };

  return (
    <div className="space-y-4">
      {/* Composer */}
      <div className="relative rounded-lg border border-border bg-card p-2.5 shadow-sm transition-[border-color,box-shadow] focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10">
        <Textarea
          ref={textareaRef}
          value={texto}
          onChange={handleCommentChange}
          placeholder={t('fin.riscos.comentarios.placeholder')}
          className="min-h-[64px] resize-none border-0 bg-transparent p-1.5 focus-visible:ring-0"
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submit();
          }}
        />
        {showMentions && (
          <div className="absolute inset-x-2 top-[68px] z-50 overflow-hidden rounded-lg border border-border bg-popover shadow-lg" role="listbox" aria-label={t('fin.riscos.comentarios.mentionHint')}>
            {usuariosFiltrados.length ? usuariosFiltrados.map((usuario) => (
              <button
                key={usuario.user_id}
                type="button"
                role="option"
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-primary/5 focus:bg-primary/5 focus:outline-none"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => insertMention(usuario)}
              >
                <Avatar className="h-7 w-7 border border-primary/10">
                  {usuario.foto_url && <AvatarImage src={usuario.foto_url} alt="" />}
                  <AvatarFallback className="bg-primary/10 text-micro text-primary">{initials(usuario.nome)}</AvatarFallback>
                </Avatar>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{usuario.nome}</span>
                  {usuario.email && <span className="block truncate text-micro text-muted-foreground">{usuario.email}</span>}
                </span>
              </button>
            )) : (
              <p className="px-3 py-2.5 text-sm text-muted-foreground">{t('fin.riscos.comentarios.noMentionResults')}</p>
            )}
          </div>
        )}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2 text-micro text-muted-foreground">
            <button
              type="button"
              className="rounded-md px-1.5 py-1 font-semibold text-primary transition-colors hover:bg-primary/10"
              onClick={() => {
                const position = textareaRef.current?.selectionStart ?? texto.length;
                const next = `${texto.slice(0, position)}@${texto.slice(position)}`;
                const nextPosition = position + 1;
                setTexto(next);
                setCursorPosition(nextPosition);
                setMentionSearch('');
                setShowMentions(true);
                requestAnimationFrame(() => {
                  textareaRef.current?.focus();
                  textareaRef.current?.setSelectionRange(nextPosition, nextPosition);
                });
              }}
              aria-label={t('fin.riscos.comentarios.mentionButton')}
            >
              @
            </button>
            <span>{t('fin.riscos.comentarios.mentionHint')}</span>
            <span aria-hidden="true">·</span>
            <span>{t('residuos.risco.ctrlEnter')}</span>
          </div>
          <Button size="sm" className="h-7 px-3 text-xs" onClick={submit} disabled={!texto.trim() || add.isPending || isError}>
            <IconSend className="h-3.5 w-3.5 mr-1" strokeWidth={1.5} />
            {add.isPending ? t('sweepRiscos.riscos.comentarios.enviando') : t('sweepRiscos.riscos.comentarios.comentar')}
          </Button>
        </div>
      </div>

      {/* Lista — três estados distintos (AKURIS QA-061) */}
      {isLoading ? (
        <div className="flex justify-center py-8" role="status" aria-label={t('fin.riscos.comentarios.carregando')}>
          <AkurisPulse size={28} />
        </div>
      ) : isError ? (
        <div
          role="alert"
          data-testid="comentarios-erro"
          className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm"
        >
          <div className="flex items-start gap-2.5">
            <IconWarning className="h-4 w-4 mt-0.5 shrink-0 text-destructive" strokeWidth={1.5} />
            <div className="min-w-0 space-y-2">
              <p className="font-medium text-destructive">{t('fin.riscos.comentarios.erroCarregar')}</p>
              <p className="text-muted-foreground">{mensagemErroComentarios(error, t)}</p>
              <Button size="sm" variant="outline" className="h-7 px-3 text-xs" onClick={() => refetch()} disabled={isFetching}>
                <IconUndo className="h-3.5 w-3.5 mr-1" strokeWidth={1.5} />
                {isFetching ? t('sweepRiscos.riscos.comentarios.tentando') : t('sweepRiscos.riscos.comentarios.tentarNovamente')}
              </Button>
            </div>
          </div>
        </div>
      ) : comentarios.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground" data-testid="comentarios-vazio">
          <IconMessage className="h-8 w-8 mx-auto mb-2 opacity-40" strokeWidth={1.5} />
          {t('sweepRiscos.riscos.comentarios.vazio')}
        </div>
      ) : (
        <ul className="space-y-3">
          {comentarios.map((c) => (
            <li key={c.id} className="flex gap-2.5">
              <Avatar className="h-7 w-7 shrink-0 mt-0.5">
                {c.autor?.foto_url && <AvatarImage src={c.autor.foto_url} alt={c.autor?.nome || ''} />}
                <AvatarFallback className="text-micro bg-primary/10 text-primary">{initials(c.autor?.nome)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{c.autor?.nome || t('fin.comum.usuario')}</span>
                  <span className="text-micro text-muted-foreground shrink-0">
                    {format(new Date(c.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: dateFnsLocale() })}
                  </span>
                  {currentUserId === c.user_id && (
                    <button
                      type="button"
                      onClick={() => remove.mutate(c.id)}
                      disabled={remove.isPending && remove.variables === c.id}
                      className="ml-auto text-muted-foreground hover:text-destructive transition-colors disabled:cursor-wait disabled:opacity-40"
                      aria-label={remove.isPending && remove.variables === c.id ? t('fin.riscos.comentarios.excluindo') : t('fin.riscos.comentarios.excluir')}
                    >
                      <IconDelete className="h-3.5 w-3.5" strokeWidth={1.5} />
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
