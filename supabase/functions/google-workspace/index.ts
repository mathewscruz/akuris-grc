/**
 * google-workspace — o diretório de quem não corre Microsoft.
 *
 * O Entra ID cobre metade do mercado. A outra metade — e no Brasil médio é bem
 * mais de metade — vive no Google Workspace, e para essas empresas a Revisão de
 * Acessos continuava a ser uma lista digitada à mão.
 *
 * ## Porque a autenticação é diferente do Azure
 *
 * O Azure aceita client credentials: manda-se id e segredo, recebe-se token. O
 * Google exige uma conta de serviço com **delegação a nível de domínio**, e o
 * fluxo é assinar um JWT com a chave privada da conta e trocá-lo por um token.
 * A assinatura é RS256 e faz-se aqui com Web Crypto — sem biblioteca.
 *
 * A parte que costuma falhar na configuração não é a chave: é o `sub`. A conta
 * de serviço não tem acesso ao directório por si; actua **em nome** de um
 * administrador, e é esse e-mail que vai no `sub`. Sem ele, o Google devolve
 * `unauthorized_client` e a mensagem não ajuda nada — daí o teste de conexão
 * dizer explicitamente o que verificar.
 *
 * ## O que traz de melhor que o Entra
 *
 * `isEnrolledIn2Sv` vem no mesmo pedido dos utilizadores, sem permissão extra.
 * No Entra o registo de MFA está noutro endpoint, atrás de uma permissão que
 * muitas empresas não concedem — e por isso lá a coluna às vezes fica vazia.
 * Aqui não fica.
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

/* Só leitura. Um conector de inventário não tem porque poder escrever no
   directório de ninguém. */
const ESCOPOS = [
  'https://www.googleapis.com/auth/admin.directory.user.readonly',
  'https://www.googleapis.com/auth/admin.directory.group.readonly',
  'https://www.googleapis.com/auth/admin.directory.rolemanagement.readonly',
].join(' ');

function base64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlTexto(texto: string): string {
  return base64url(new TextEncoder().encode(texto));
}

/**
 * A chave privada, do PEM para o Web Crypto.
 *
 * O JSON que o Google entrega traz o PEM com `\n` escapado. Quem cola o
 * ficheiro inteiro obtém quebras a sério ao passar por JSON.parse; quem cola só
 * a chave costuma trazer o `\n` literal. As duas formas chegam aqui, e as duas
 * têm de funcionar — falhar por causa disto seria falhar por um detalhe de
 * copiar e colar.
 */
async function importarChavePrivada(pem: string): Promise<CryptoKey> {
  const limpo = pem
    .replace(/\\n/g, '\n')
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');
  const der = Uint8Array.from(atob(limpo), (c) => c.charCodeAt(0));
  return await crypto.subtle.importKey(
    'pkcs8',
    der,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
}

async function obterToken(
  clientEmail: string,
  privateKey: string,
  adminEmail: string,
): Promise<string> {
  const agora = Math.floor(Date.now() / 1000);
  const cabecalho = base64urlTexto(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const corpo = base64urlTexto(
    JSON.stringify({
      iss: clientEmail,
      /* Delegação a nível de domínio: a conta de serviço actua em nome deste
         administrador. É a linha que falta em quase toda a configuração que
         falha. */
      sub: adminEmail,
      scope: ESCOPOS,
      aud: 'https://oauth2.googleapis.com/token',
      exp: agora + 3600,
      iat: agora,
    }),
  );

  const chave = await importarChavePrivada(privateKey);
  const assinatura = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    chave,
    new TextEncoder().encode(`${cabecalho}.${corpo}`),
  );
  const jwt = `${cabecalho}.${corpo}.${base64url(new Uint8Array(assinatura))}`;

  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }).toString(),
  });

  const dados = await r.json();
  if (!r.ok) {
    /*
      `unauthorized_client` quase sempre significa que a delegação a nível de
      domínio não foi concedida para estes escopos — não que a chave esteja
      errada. Dizê-lo poupa uma tarde a quem configura.
    */
    const detalhe =
      dados.error === 'unauthorized_client'
        ? 'Delegação a nível de domínio não concedida para estes escopos, ou o e-mail de administrador está errado.'
        : dados.error_description || dados.error || `HTTP ${r.status}`;
    throw new Error(detalhe);
  }
  return dados.access_token;
}

interface GoogleUser {
  id: string;
  primaryEmail: string;
  name?: { fullName?: string };
  suspended?: boolean;
  archived?: boolean;
  isAdmin?: boolean;
  isDelegatedAdmin?: boolean;
  isEnrolledIn2Sv?: boolean;
  orgUnitPath?: string;
  creationTime?: string;
  organizations?: Array<{ title?: string; department?: string }>;
}

async function listarUtilizadores(token: string, cliente: string): Promise<GoogleUser[]> {
  const todos: GoogleUser[] = [];
  let pagina: string | undefined;

  do {
    const url = new URL('https://admin.googleapis.com/admin/directory/v1/users');
    url.searchParams.set('customer', cliente);
    url.searchParams.set('maxResults', '500');
    url.searchParams.set('projection', 'full');
    if (pagina) url.searchParams.set('pageToken', pagina);

    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) {
      const corpo = await r.text();
      throw new Error(`Directory API: ${r.status} ${corpo.slice(0, 200)}`);
    }
    const dados = await r.json();
    todos.push(...(dados.users || []));
    pagina = dados.nextPageToken;
  } while (pagina && todos.length < 5000);

  return todos;
}

export function mapGoogleUserToAcesso(u: GoogleUser, empresaId: string, sistemaId: string) {
  const admin = !!(u.isAdmin || u.isDelegatedAdmin);
  const org = u.organizations?.[0];

  const notas: string[] = [];
  if (u.isAdmin) notas.push('Super administrador');
  else if (u.isDelegatedAdmin) notas.push('Administrador delegado');
  notas.push(u.isEnrolledIn2Sv ? 'Segundo fator registrado' : 'SEM segundo fator registrado');
  if (u.orgUnitPath && u.orgUnitPath !== '/') notas.push(`Unidade: ${u.orgUnitPath}`);
  /* Conta arquivada não é o mesmo que suspensa, e nenhuma das duas é activa. */
  if (u.archived) notas.push('Conta arquivada');

  return {
    empresa_id: empresaId,
    sistema_id: sistemaId,
    nome_usuario: u.name?.fullName || u.primaryEmail,
    email_usuario: u.primaryEmail,
    departamento: org?.department || null,
    cargo: org?.title || null,
    tipo_acesso: admin ? 'administracao' : 'leitura',
    nivel_privilegio: admin ? 'administrador' : 'usuario',
    data_concessao: u.creationTime ? u.creationTime.slice(0, 10) : null,
    observacoes: notas.join(' · ') || null,
    ativo: !u.suspended && !u.archived,
    origem: 'google_workspace',
    origem_id: u.id,
    sincronizado_em: new Date().toISOString(),
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  let ctx;
  try {
    ctx = await requireUserContext(req);
  } catch (e) {
    return json({ success: false, error: 'nao_autorizado' }, e instanceof AuthError ? e.status : 401);
  }
  if (!ctx.empresaId) return json({ success: false, error: 'sem_empresa' }, 403);

  let corpo: Record<string, unknown>;
  try {
    corpo = await req.json();
  } catch {
    return json({ success: false, error: 'corpo_invalido' }, 400);
  }
  const acao = String(corpo.action ?? '');

  /* Teste de conexão: as credenciais vêm no pedido, porque ainda não foram
     gravadas — é o mesmo padrão do Jira e do Azure. */
  if (acao === 'test') {
    const { client_email, private_key, admin_email, customer } = corpo as Record<string, string>;
    if (!client_email || !private_key || !admin_email) {
      return json({ success: false, error: 'Credenciais incompletas' });
    }
    try {
      const token = await obterToken(client_email, private_key, admin_email);
      const url = new URL('https://admin.googleapis.com/admin/directory/v1/users');
      url.searchParams.set('customer', customer || 'my_customer');
      url.searchParams.set('maxResults', '1');
      const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) {
        return json({ success: false, error: `Directory API respondeu ${r.status}` });
      }
      return json({ success: true });
    } catch (e) {
      return json({ success: false, error: e instanceof Error ? e.message : String(e) });
    }
  }

  if (acao !== 'sync_usuarios') {
    return json({ success: false, error: `acao desconhecida: ${acao}` }, 400);
  }

  const { data: cfg } = await ctx.supabase
    .from('integracoes_config')
    .select('*')
    .eq('empresa_id', ctx.empresaId)
    .eq('tipo_integracao', 'google_workspace')
    .maybeSingle();

  if (!cfg) return json({ success: false, error: 'Configuração do Google Workspace não encontrada' });

  let credenciais: { client_email?: string; private_key?: string } = {};
  try {
    credenciais =
      typeof cfg.credenciais_encrypted === 'string'
        ? JSON.parse(cfg.credenciais_encrypted)
        : (cfg.credenciais_encrypted ?? {});
  } catch {
    credenciais = {};
  }

  const adminEmail = (cfg.configuracoes as Record<string, string>)?.admin_email;
  const cliente = (cfg.configuracoes as Record<string, string>)?.customer || 'my_customer';

  if (!credenciais.client_email || !credenciais.private_key || !adminEmail) {
    return json({
      success: false,
      error: 'Credenciais incompletas. Reconfigure a integração com o JSON da conta de serviço.',
    });
  }

  try {
    const token = await obterToken(credenciais.client_email, credenciais.private_key, adminEmail);
    const utilizadores = await listarUtilizadores(token, cliente);
    console.log(`Google Workspace: ${utilizadores.length} utilizadores`);

    const { data: sistemaId, error: erroSistema } = await ctx.supabase.rpc('sistema_do_diretorio', {
      p_empresa_id: ctx.empresaId,
      p_nome: 'Google Workspace',
      p_categoria: 'identidade',
    });
    if (erroSistema) throw erroSistema;

    const agora = new Date().toISOString();
    const vistos: string[] = [];
    let criados = 0;
    let atualizados = 0;

    for (const u of utilizadores) {
      const linha = mapGoogleUserToAcesso(u, ctx.empresaId, sistemaId as string);
      vistos.push(u.id);

      const { data: existente } = await ctx.supabase
        .from('sistemas_usuarios')
        .select('id')
        .eq('sistema_id', sistemaId)
        .eq('origem', 'google_workspace')
        .eq('origem_id', u.id)
        .maybeSingle();

      if (existente) {
        const { error } = await ctx.supabase
          .from('sistemas_usuarios')
          .update({ ...linha, updated_at: agora })
          .eq('id', existente.id);
        if (error) throw error;
        atualizados++;
      } else {
        const { error } = await ctx.supabase.from('sistemas_usuarios').insert(linha);
        if (error) throw error;
        criados++;
      }
    }

    /* Quem saiu do directório fica, desactivado — apagar seria apagar a prova
       de que aquela pessoa teve acesso. */
    let desativados = 0;
    if (vistos.length > 0) {
      const { data: sumidos, error: erroSumidos } = await ctx.supabase
        .from('sistemas_usuarios')
        .update({ ativo: false, sincronizado_em: agora, updated_at: agora })
        .eq('sistema_id', sistemaId)
        .eq('origem', 'google_workspace')
        .eq('ativo', true)
        .not('origem_id', 'in', `(${vistos.map((v) => `"${v}"`).join(',')})`)
        .select('id');
      if (erroSumidos) throw erroSumidos;
      desativados = sumidos?.length ?? 0;
    }

    await ctx.supabase
      .from('integracoes_config')
      .update({ ultima_sincronizacao: agora })
      .eq('id', cfg.id);

    await ctx.supabase.from('integracoes_webhook_logs').insert({
      integracao_id: cfg.id,
      evento: 'sync_usuarios',
      payload: { criados, atualizados, desativados },
      status_code: 200,
      sucesso: true,
      empresa_id: ctx.empresaId,
    });

    return json({
      success: true,
      criados,
      atualizados,
      desativados,
      total: utilizadores.length,
      /* O Google traz o segundo fator no mesmo pedido: aqui nunca fica por
         verificar, ao contrário do Entra. */
      mfa_verificado: true,
    });
  } catch (e) {
    console.error('Google Workspace sync:', e);
    await ctx.supabase.from('integracoes_webhook_logs').insert({
      integracao_id: cfg.id,
      evento: 'sync_usuarios',
      payload: { error: e instanceof Error ? e.message : String(e) },
      status_code: 500,
      sucesso: false,
      empresa_id: ctx.empresaId,
    });
    return json({ success: false, error: e instanceof Error ? e.message : String(e) });
  }
});
