import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const MAX_BODY_BYTES = 256 * 1024;

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join('');
}

// Tabelas permitidas por módulo
const MODULE_TABLES: Record<string, string> = {
  riscos: 'riscos',
  controles: 'controles',
  incidentes: 'incidentes',
  auditorias: 'auditorias',
  documentos: 'documentos',
  ativos: 'ativos',
};

/*
  Campos permitidos para INSERT via API pública (allowlist por módulo).

  Quatro destes nomes não existiam no schema — `controles.frequencia_teste` e
  `controles.responsavel` (são `frequencia` e `responsavel_id`),
  `incidentes.tipo` e `incidentes.gravidade` (são `tipo_incidente` e
  `criticidade`). Quem os enviasse recebia um erro do PostgREST sobre uma
  coluna desconhecida, numa API que documentava esses nomes como aceites.

  `riscos.matriz_id` saiu: a matriz é a vigente da empresa e o trigger
  `trg_risco_calcular` sobrescreve o que vier de fora. Aceitar o campo era
  prometer um controlo que não existe.
*/
const WRITABLE_FIELDS: Record<string, string[]> = {
  riscos: ['nome', 'descricao', 'responsavel', 'probabilidade_inicial', 'impacto_inicial', 'categoria_id'],
  controles: ['nome', 'descricao', 'tipo', 'criticidade', 'frequencia', 'responsavel_id', 'categoria_id'],
  incidentes: ['titulo', 'descricao', 'tipo_incidente', 'criticidade', 'data_ocorrencia', 'data_deteccao'],
  auditorias: ['nome', 'tipo', 'prioridade', 'data_inicio', 'data_fim_prevista'],
  documentos: ['nome', 'descricao', 'tipo', 'classificacao', 'tags', 'data_vencimento'],
  ativos: ['nome', 'tipo', 'descricao', 'criticidade', 'proprietario', 'localizacao', 'fornecedor', 'versao'],
};

// Campos seguros para leitura (evita expor dados sensíveis)
const SAFE_FIELDS: Record<string, string> = {
  riscos: 'id, codigo, nome, descricao, status, nivel_risco_inicial, nivel_risco_residual, score_efetivo, severidade_efetiva, responsavel, created_at, updated_at',
  controles: 'id, nome, descricao, tipo, status, criticidade, frequencia, responsavel_id, created_at, updated_at',
  incidentes: 'id, titulo, descricao, tipo_incidente, criticidade, status, data_ocorrencia, data_deteccao, created_at, updated_at',
  auditorias: 'id, nome, tipo, status, prioridade, data_inicio, data_fim_prevista, created_at, updated_at',
  documentos: 'id, nome, descricao, tipo, status, classificacao, data_vencimento, created_at, updated_at',
  ativos: 'id, nome, tipo, descricao, status, criticidade, proprietario, localizacao, created_at, updated_at',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método não suportado. Use GET ou POST.' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const apiKey = req.headers.get('x-api-key');
    if (!apiKey || !/^gai_[A-Za-z0-9]{20,128}$/.test(apiKey)) {
      return new Response(
        JSON.stringify({ error: 'Header X-API-Key é obrigatório' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validar API Key
    const { data: keyData, error: keyError } = await supabase
      .from('api_keys')
      .select('id, empresa_id, permissoes, rate_limit_por_minuto, ativo, ip_whitelist, expires_at')
      .eq('api_key_hash', await sha256Hex(apiKey))
      .single();

    if (keyError || !keyData) {
      return new Response(
        JSON.stringify({ error: 'API Key inválida' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!keyData.ativo) {
      return new Response(
        JSON.stringify({ error: 'API Key desativada' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar expiração
    if (keyData.expires_at && new Date(keyData.expires_at).getTime() < Date.now()) {
      return new Response(
        JSON.stringify({ error: 'API Key expirada' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar IP whitelist (se configurada)
    const ipWhitelist = Array.isArray(keyData.ip_whitelist) ? keyData.ip_whitelist : [];
    if (ipWhitelist.length > 0) {
      const forwarded = req.headers.get('x-forwarded-for') || '';
      const callerIp = req.headers.get('cf-connecting-ip') ||
        (forwarded.split(',')[0] || '').trim() ||
        req.headers.get('x-real-ip') || '';
      const allowed = ipWhitelist.some((entry: string) => {
        const e = String(entry || '').trim();
        return e && (e === callerIp || (e.endsWith('*') && callerIp.startsWith(e.slice(0, -1))));
      });
      if (!allowed) {
        return new Response(
          JSON.stringify({ error: 'IP não autorizado para esta API Key' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Janela atómica no banco: pedidos paralelos não conseguem ultrapassar o
    // limite fazendo todos o COUNT antes de qualquer um gravar o log.
    const { data: withinLimit, error: limitError } = await supabase.rpc('consume_security_rate_limit', {
      p_scope: 'api-public',
      p_fingerprint_hash: await sha256Hex(keyData.id),
      p_max_requests: Math.max(1, Math.min(Number(keyData.rate_limit_por_minuto) || 60, 300)),
      p_window_seconds: 60,
    });
    if (limitError) {
      console.error('API Public rate limiter unavailable:', limitError);
      return new Response(JSON.stringify({ error: 'Serviço temporariamente indisponível.' }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (withinLimit !== true) {
      return new Response(
        JSON.stringify({ error: 'Rate limit excedido. Tente novamente em instantes.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parsear URL path: /api-public/{modulo}
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    // O path será algo como /api-public/riscos ou simplesmente riscos no body
    const modulo = pathParts[pathParts.length - 1] || '';

    let requestBody: any = {};
    if (req.method !== 'GET') {
      const declaredLength = Number(req.headers.get('content-length') || 0);
      if (declaredLength > MAX_BODY_BYTES) {
        return new Response(JSON.stringify({ error: 'Payload excede 256 KB.' }), {
          status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const rawBody = await req.text();
      if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
        return new Response(JSON.stringify({ error: 'Payload excede 256 KB.' }), {
          status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      try { requestBody = JSON.parse(rawBody); } catch {
        return new Response(JSON.stringify({ error: 'JSON inválido.' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (!requestBody || typeof requestBody !== 'object' || Array.isArray(requestBody)) {
        return new Response(JSON.stringify({ error: 'O payload deve ser um objeto JSON.' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Se não veio no path, tentar do body
    const targetModule = MODULE_TABLES[modulo] ? modulo : requestBody.modulo;
    const table = MODULE_TABLES[targetModule];

    if (!table) {
      // Se nenhum módulo especificado, retornar lista de endpoints disponíveis
      const permissoes = keyData.permissoes || [];
      const endpoints = Object.keys(MODULE_TABLES)
        .filter(m => permissoes.some((p: string) => p.startsWith(`${m}:`)))
        .map(m => ({
          modulo: m,
          read: permissoes.includes(`${m}:read`),
          write: permissoes.includes(`${m}:write`),
        }));

      // Registrar request
      await logRequest(supabase, keyData, req, 200);

      return new Response(
        JSON.stringify({
          message: 'API Pública Akuris',
          version: '1.0',
          empresa_id: keyData.empresa_id,
          endpoints_disponiveis: endpoints,
          uso: 'GET /api-public/{modulo} para listar registros. POST /api-public/{modulo} para criar.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const permissoes: string[] = keyData.permissoes || [];
    const canRead = permissoes.includes(`${targetModule}:read`);
    const canWrite = permissoes.includes(`${targetModule}:write`);

    if (req.method === 'GET' && !canRead) {
      await logRequest(supabase, keyData, req, 403);
      return new Response(
        JSON.stringify({ error: `Sem permissão de leitura para ${targetModule}` }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (req.method === 'POST' && !canWrite) {
      await logRequest(supabase, keyData, req, 403);
      return new Response(
        JSON.stringify({ error: `Sem permissão de escrita para ${targetModule}` }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let responseData: any;
    let statusCode = 200;

    if (req.method === 'GET') {
      // Listar registros do módulo (com paginação)
      const rawPage = Number.parseInt(url.searchParams.get('page') || '1', 10);
      const rawLimit = Number.parseInt(url.searchParams.get('limit') || '50', 10);
      const page = Number.isFinite(rawPage) ? Math.max(1, rawPage) : 1;
      const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(rawLimit, 100)) : 50;
      const offset = (page - 1) * limit;

      const fields = SAFE_FIELDS[targetModule] || '*';

      const { data, error, count } = await supabase
        .from(table)
        .select(fields, { count: 'exact' })
        .eq('empresa_id', keyData.empresa_id)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      responseData = {
        data: data || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          total_pages: Math.ceil((count || 0) / limit),
        },
      };
    } else if (req.method === 'POST') {
      // Criar registro — apenas campos do allowlist, sempre vinculado à empresa
      const allowed = WRITABLE_FIELDS[targetModule] || [];
      const safeInsert: Record<string, any> = { empresa_id: keyData.empresa_id };
      const rejected: string[] = [];
      for (const [k, v] of Object.entries(requestBody || {})) {
        if (k === 'modulo') continue;
        if (allowed.includes(k)) {
          safeInsert[k] = v;
        } else {
          rejected.push(k);
        }
      }

      if (rejected.length > 0) {
        await logRequest(supabase, keyData, req, 400);
        return new Response(
          JSON.stringify({
            error: 'Campos não permitidos no payload',
            campos_rejeitados: rejected,
            campos_permitidos: allowed,
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data, error } = await supabase
        .from(table)
        .insert(safeInsert)
        .select(SAFE_FIELDS[targetModule])
        .single();

      if (error) throw error;
      responseData = { data, message: 'Registro criado com sucesso' };
      statusCode = 201;
    } else {
      await logRequest(supabase, keyData, req, 405);
      return new Response(
        JSON.stringify({ error: 'Método não suportado. Use GET ou POST.' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Registrar request e atualizar contadores
    await logRequest(supabase, keyData, req, statusCode);

    return new Response(
      JSON.stringify(responseData),
      { status: statusCode, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('API Public error:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno. Por favor, tente novamente.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function logRequest(supabase: any, keyData: any, req: Request, statusCode: number) {
  try {
    const startTime = Date.now();

    await supabase.from('api_request_logs').insert({
      api_key_id: keyData.id,
      empresa_id: keyData.empresa_id,
      endpoint: new URL(req.url).pathname,
      metodo: req.method,
      status_code: statusCode,
      response_time_ms: Date.now() - startTime,
      user_agent: req.headers.get('user-agent'),
    });

    await supabase.rpc('touch_api_key_usage', { p_key_id: keyData.id });
  } catch (e) {
    console.error('Error logging request:', e);
  }
}
