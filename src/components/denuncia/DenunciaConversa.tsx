/**
 * DenunciaConversa — a via de resposta a quem denunciou.
 *
 * Era o buraco mais caro do módulo. A consulta por protocolo mostrava o estado
 * e uma linha do tempo, e mais nada: quem denunciou não conseguia acrescentar
 * informação, responder a uma dúvida do investigador nem enviar o ficheiro que
 * faltou. Não havia sequer tabela de mensagens.
 *
 * Não é um recurso de conveniência. A Diretiva (UE) 2019/1937 exige acusar o
 * recebimento e dar retorno ao informante, e sem via de resposta o cliente não
 * consegue evidenciar que o fez — que é exactamente o que ele compra.
 *
 * O anonimato é imposto pelo esquema, não por esta tela: uma mensagem do
 * denunciante não pode ter `autor_id` (CHECK em `denuncias_mensagens`).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatDateTime } from '@/lib/date-utils';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/toast';
import { avisarDenunciante } from '@/lib/avisar-denunciante';

interface Mensagem {
  id: string;
  autor_tipo: 'denunciante' | 'comite';
  mensagem: string;
  created_at: string;
  lida_em: string | null;
}

interface Props {
  denunciaId: string;
  empresaId: string;
}

export function DenunciaConversa({ denunciaId, empresaId }: Props) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const fim = useRef<HTMLDivElement>(null);

  const { data: mensagens = [], isLoading } = useQuery({
    queryKey: ['denuncia-mensagens', denunciaId],
    enabled: !!denunciaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('denuncias_mensagens')
        .select('id, autor_tipo, mensagem, created_at, lida_em')
        .eq('denuncia_id', denunciaId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as Mensagem[];
    },
  });

  /* Marca como lidas as que vieram de fora — é o que permite ao painel contar
     quantas denúncias estão à espera de resposta. */
  const porLer = useMemo(
    () => mensagens.filter((m) => m.autor_tipo === 'denunciante' && !m.lida_em).map((m) => m.id),
    [mensagens],
  );
  useEffect(() => {
    if (porLer.length === 0) return;
    supabase
      .from('denuncias_mensagens')
      .update({ lida_em: new Date().toISOString() })
      .in('id', porLer)
      .then(() => queryClient.invalidateQueries({ queryKey: ['denuncia-mensagens', denunciaId] }));
  }, [porLer, denunciaId, queryClient]);

  useEffect(() => {
    fim.current?.scrollIntoView({ block: 'nearest' });
  }, [mensagens.length]);

  const enviar = async () => {
    const conteudo = texto.trim();
    if (!conteudo) return;
    setEnviando(true);
    try {
      const { error } = await supabase.from('denuncias_mensagens').insert({
        denuncia_id: denunciaId,
        empresa_id: empresaId,
        autor_tipo: 'comite',
        autor_id: user?.id ?? null,
        mensagem: conteudo,
      });
      if (error) throw error;
      setTexto('');
      queryClient.invalidateQueries({ queryKey: ['denuncia-mensagens', denunciaId] });
      /* A conversa era a unica via de retorno e nao avisava do outro lado: a
         resposta ficava aqui a espera de que a pessoa se lembrasse de voltar. */
      void avisarDenunciante(denunciaId, 'mensagem');
      toast.success(t('denunciasAdmin.conversa.enviada'));
    } catch (e) {
      toast.error(t('denunciasAdmin.conversa.erroEnviar'));
    } finally {
      setEnviando(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <AkurisPulse size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{t('denunciasAdmin.conversa.explicacao')}</p>

      <div className="max-h-[300px] space-y-2 overflow-y-auto rounded-lg border border-border bg-muted/20 p-3">
        {mensagens.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            {t('denunciasAdmin.conversa.vazio')}
          </p>
        ) : (
          mensagens.map((m) => {
            const meu = m.autor_tipo === 'comite';
            return (
              <div key={m.id} className={cn('flex', meu ? 'justify-end' : 'justify-start')}>
                <div
                  className={cn(
                    'max-w-[80%] rounded-lg px-3 py-2',
                    meu ? 'bg-primary/10' : 'bg-card border border-border',
                  )}
                >
                  <p className="text-micro font-medium text-muted-foreground">
                    {meu
                      ? t('denunciasAdmin.conversa.autorComite')
                      : t('denunciasAdmin.conversa.autorDenunciante')}
                  </p>
                  <p className="mt-0.5 whitespace-pre-wrap text-xs text-foreground">{m.mensagem}</p>
                  <p className="mt-1 text-micro tabular-nums text-muted-foreground">
                    {formatDateTime(m.created_at)}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={fim} />
      </div>

      <Textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={3}
        maxLength={5000}
        placeholder={t('denunciasAdmin.conversa.placeholder')}
      />
      <div className="flex justify-end">
        <Button size="sm" onClick={enviar} disabled={enviando || !texto.trim()}>
          {t('denunciasAdmin.conversa.enviar')}
        </Button>
      </div>
    </div>
  );
}
