/**
 * expurgar-denuncias — cumpre o prazo de conservação que o canal promete.
 *
 * O canal diz a quem denuncia, em letra visível, «os registos são conservados
 * por N meses». Até aqui isso era só texto: nada apagava nada, e sob RGPD/LGPD
 * declarar um prazo e não o cumprir é pior do que não declarar — passa a ser
 * prova documentada de que a promessa foi quebrada.
 *
 * Duas metades, porque nenhuma chega sozinha:
 *
 *  1. `expurgar_denuncias_vencidas()` apaga as denúncias concluídas há mais do
 *     que o prazo da empresa. Corre por pg_cron, e o gatilho de
 *     `denuncias_anexos` põe o caminho de cada ficheiro numa fila.
 *  2. Esta função drena a fila pela API de armazenamento. Tem de ser aqui: o
 *     Supabase proíbe apagar de `storage.objects` em SQL, e faz bem — a linha
 *     sairia e o ficheiro ficaria no S3, invisível e por pagar.
 *
 * A fila é de propósito: se esta função parar, ela cresce e alguém vê. Uma
 * chamada HTTP disparada por gatilho falharia em silêncio, que é o modo de
 * falhar que este módulo já teve vezes de mais.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  /* Só a chave de serviço ou o segredo do agendador. Isto apaga dados. */
  const auth = req.headers.get('Authorization') ?? '';
  const token = auth.replace('Bearer ', '');
  const chaveServico = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const segredo = Deno.env.get('DENUNCIA_INTERNAL_SECRET') ?? '';
  if (!token || (token !== chaveServico && (!segredo || token !== segredo))) {
    return json({ error: 'nao_autorizado' }, 401);
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, chaveServico);

  try {
    /* 1. As denúncias que passaram do prazo. */
    const { data: expurgadas, error: erroExpurgo } = await supabase.rpc(
      'expurgar_denuncias_vencidas',
    );
    if (erroExpurgo) return json({ error: erroExpurgo.message }, 500);

    /* 2. Os ficheiros — os das denúncias que acabaram de sair e os que já
          estavam na fila de execuções anteriores. */
    const { data: fila, error: erroFila } = await supabase.rpc('ficheiros_por_apagar', {
      p_limite: 200,
    });
    if (erroFila) return json({ error: erroFila.message }, 500);

    const pendentes = (fila ?? []) as { id: string; caminho: string }[];
    let apagados = 0;

    if (pendentes.length > 0) {
      const { error: erroRemover } = await supabase.storage
        .from('denuncias-anexos')
        .remove(pendentes.map((f) => f.caminho));

      if (erroRemover) {
        /* Marca a tentativa em vez de perder a fila: cinco falhas e a linha
           deixa de ser tentada, para um caminho impossível não bloquear os
           que vêm atrás. */
        await supabase.rpc('confirmar_ficheiros_apagados', {
          p_ids: pendentes.map((f) => f.id),
          p_erro: erroRemover.message,
        });
      } else {
        await supabase.rpc('confirmar_ficheiros_apagados', {
          p_ids: pendentes.map((f) => f.id),
          p_erro: null,
        });
        apagados = pendentes.length;
      }
    }

    return json({
      denuncias_expurgadas: (expurgadas ?? []) as unknown[],
      ficheiros_apagados: apagados,
      ficheiros_na_fila: pendentes.length - apagados,
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'erro_inesperado' }, 500);
  }
});
