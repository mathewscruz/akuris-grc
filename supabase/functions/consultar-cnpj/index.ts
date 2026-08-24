/**
 * consultar-cnpj — o cadastro do fornecedor deixa de ser digitado de cor.
 *
 * Em Due Diligence, `fornecedores.cnpj` era texto livre. Ninguém validava o
 * dígito, ninguém conferia se a empresa existia, e a razão social vinha do que
 * a pessoa escreveu. Uma diligência que começa por dados não verificados não é
 * diligência nenhuma.
 *
 * ## Porque existe uma função de borda, e não uma chamada directa do navegador
 *
 * A BrasilAPI é pública e o navegador podia falar com ela sozinho. O Portal da
 * Transparência não: exige uma chave nominal, e chave em código de front-end é
 * chave publicada. Esta função existe por causa da segunda — e, já agora, para
 * poupar ao navegador dois CORS de terceiros.
 *
 * Toda a interpretação do que volta (normalizar, ler situação cadastral,
 * levantar alertas) vive em `src/lib/cnpj.ts`, onde os testes correm. Aqui
 * ficam só a autenticação, o saneamento do parâmetro e as duas chamadas.
 *
 * ## As duas fontes têm estatutos diferentes
 *
 *  · **Receita Federal, via BrasilAPI** — pública, sem chave. Sempre consultada.
 *  · **Portal da Transparência** (CEIS, CNEP, acordos de leniência) — exige
 *    chave própria, gratuita mas nominal. Quando a empresa não a configurou,
 *    devolvemos `verificado: false` com o motivo. Nunca «nada encontrado»:
 *    dizer que não há sanções sem ter procurado é a pior resposta possível.
 */
import { requireUserContext, AuthError } from '../_shared/auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });

interface Sancoes {
  verificado: boolean;
  motivo?: 'sem_chave' | 'falha_consulta';
  ceis?: unknown[];
  cnep?: unknown[];
  leniencia?: unknown[];
}

async function consultarSancoes(cnpj: string, chave: string | null): Promise<Sancoes> {
  if (!chave) return { verificado: false, motivo: 'sem_chave' };

  const base = 'https://api.portaldatransparencia.gov.br/api-de-dados';
  const buscar = async (caminho: string) => {
    const r = await fetch(`${base}/${caminho}`, { headers: { 'chave-api-dados': chave } });
    if (!r.ok) throw new Error(`${caminho}: HTTP ${r.status}`);
    const corpo = await r.json();
    return Array.isArray(corpo) ? corpo : [];
  };

  try {
    const [ceis, cnep, leniencia] = await Promise.all([
      buscar(`ceis?codigoSancionado=${cnpj}&pagina=1`),
      buscar(`cnep?codigoSancionado=${cnpj}&pagina=1`),
      buscar(`acordos-leniencia?cnpjSancionada=${cnpj}&pagina=1`),
    ]);
    return { verificado: true, ceis, cnep, leniencia };
  } catch (e) {
    console.error('sancoes: falha na consulta', e);
    /*
      Falhar em silêncio aqui seria dizer «sem sanções» a quem só vê que a caixa
      ficou verde. Se não deu para procurar, diz-se que não deu.
    */
    return { verificado: false, motivo: 'falha_consulta' };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  let ctx;
  try {
    ctx = await requireUserContext(req);
  } catch (e) {
    const status = e instanceof AuthError ? e.status : 401;
    return json({ erro: 'nao_autorizado' }, status);
  }
  if (!ctx.empresaId) return json({ erro: 'sem_empresa' }, 403);

  let bruto = '';
  try {
    const corpo = await req.json();
    bruto = String(corpo?.cnpj ?? '');
  } catch {
    return json({ erro: 'corpo_invalido' }, 400);
  }

  /*
    Só dígitos, e exactamente catorze.

    O valor vai para dentro de um caminho de URL — deixar passar qualquer outro
    caracere transformava isto num proxy para o que a pessoa quisesse pedir. Os
    dígitos verificadores são conferidos no ecrã, antes de chegar aqui; o que se
    faz nesta linha é fechar a porta, não validar o documento.
  */
  const cnpj = bruto.replace(/\D/g, '');
  if (cnpj.length !== 14) return json({ erro: 'cnpj_invalido' }, 400);

  try {
    const resposta = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
    if (resposta.status === 404) return json({ erro: 'cnpj_nao_encontrado' }, 404);
    if (!resposta.ok) {
      console.error('BrasilAPI devolveu', resposta.status);
      return json({ erro: 'fonte_indisponivel' }, 502);
    }
    const receita = await resposta.json();

    /*
      A chave do Portal da Transparência é de cada empresa, e é opcional.

      Fica em `credenciais_encrypted`, onde já mora o token do Jira — não porque
      a coluna esteja mais protegida (não está: quem passa o RLS lê ambas), mas
      porque é a que o resto do produto trata como segredo. Uma chave guardada
      em `configuracoes` acabaria por aparecer no ecrã de configuração, que é
      exactamente onde não deve estar.
    */
    const { data: cfg } = await ctx.supabase
      .from('integracoes_config')
      .select('credenciais_encrypted, status')
      .eq('empresa_id', ctx.empresaId)
      .eq('tipo_integracao', 'transparencia')
      .maybeSingle();

    let chave: string | null = null;
    if (cfg?.status === 'conectado' && cfg.credenciais_encrypted) {
      try {
        chave = JSON.parse(cfg.credenciais_encrypted)?.chave_api ?? null;
      } catch {
        console.error('transparencia: credenciais ilegíveis');
      }
    }

    return json({
      cnpj,
      consultado_em: new Date().toISOString(),
      fonte: 'Receita Federal via BrasilAPI',
      receita,
      sancoes: await consultarSancoes(cnpj, chave),
    });
  } catch (e) {
    console.error('consultar-cnpj:', e);
    return json({ erro: 'fonte_indisponivel' }, 502);
  }
});
