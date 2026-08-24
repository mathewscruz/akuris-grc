import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ManagedDevice {
  id: string;
  deviceName: string;
  managedDeviceOwnerType: string;
  enrolledDateTime: string;
  lastSyncDateTime: string;
  operatingSystem: string;
  osVersion: string;
  model: string;
  manufacturer: string;
  serialNumber: string;
  userPrincipalName: string;
  userDisplayName: string;
  complianceState: string;
  managementState: string;
  deviceRegistrationState: string;
}

async function getAzureAccessToken(tenantId: string, clientId: string, clientSecret: string): Promise<string> {
  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials'
  });

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error_description || 'Falha ao obter token');
  }

  const data = await response.json();
  return data.access_token;
}

async function getIntuneDevices(accessToken: string): Promise<ManagedDevice[]> {
  const devices: ManagedDevice[] = [];
  let nextLink: string | null = 'https://graph.microsoft.com/v1.0/deviceManagement/managedDevices?$top=100';

  while (nextLink) {
    const response: Response = await fetch(nextLink, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Falha ao buscar dispositivos');
    }

    const data: any = await response.json();
    devices.push(...(data.value || []));
    nextLink = data['@odata.nextLink'] || null;
  }

  return devices;
}

function mapIntuneDeviceToAtivo(device: ManagedDevice, empresaId: string) {
  const statusMap: Record<string, string> = {
    'compliant': 'ativo',
    'noncompliant': 'em_manutencao',
    'conflict': 'em_manutencao',
    'error': 'inativo',
    'inGracePeriod': 'ativo',
    'configManager': 'ativo',
    'unknown': 'ativo',
  };

  return {
    empresa_id: empresaId,
    nome: device.deviceName || 'Dispositivo sem nome',
    tipo: 'tecnologia',
    descricao: `${device.manufacturer || ''} ${device.model || ''} - ${device.operatingSystem} ${device.osVersion || ''}`.trim(),
    proprietario: device.userDisplayName || device.userPrincipalName || null,
    status: statusMap[device.complianceState] || 'ativo',
    tags: [
      device.serialNumber ? `SN:${device.serialNumber}` : null,
      `Intune:${device.id}`,
      device.managementState
    ].filter(Boolean),
    data_aquisicao: device.enrolledDateTime ? device.enrolledDateTime.split('T')[0] : null,
    criticidade: device.complianceState === 'noncompliant' ? 'alto' : 'medio',
    fornecedor: device.manufacturer || null,
    versao: device.osVersion || null,
  };
}

/* ─────────────────────── Entra ID: pessoas, grupos, papéis ─────────────────────── */

interface EntraUser {
  id: string;
  displayName: string | null;
  userPrincipalName: string | null;
  mail: string | null;
  jobTitle: string | null;
  department: string | null;
  accountEnabled: boolean | null;
  createdDateTime: string | null;
}

/** Paginação do Graph: `@odata.nextLink` até acabar. */
async function graphTodos<T>(accessToken: string, url: string, limite = 5000): Promise<T[]> {
  const itens: T[] = [];
  let proximo: string | null = url;
  while (proximo && itens.length < limite) {
    const r: Response = await fetch(proximo, {
      headers: { Authorization: `Bearer ${accessToken}`, ConsistencyLevel: 'eventual' },
    });
    if (!r.ok) {
      const corpo = await r.text();
      throw new Error(`Graph ${new URL(proximo).pathname}: ${r.status} ${corpo.slice(0, 200)}`);
    }
    const dados: any = await r.json();
    itens.push(...(dados.value || []));
    proximo = dados['@odata.nextLink'] || null;
  }
  return itens;
}

async function getEntraUsers(accessToken: string): Promise<EntraUser[]> {
  return await graphTodos<EntraUser>(
    accessToken,
    'https://graph.microsoft.com/v1.0/users?$top=999&$select=' +
      'id,displayName,userPrincipalName,mail,jobTitle,department,accountEnabled,createdDateTime',
  );
}

/**
 * Quem tem papel de directório, e qual.
 *
 * É esta a pergunta que a revisão de acessos faz primeiro — não «quem existe»,
 * mas «quem é administrador». O Graph só devolve papéis ACTIVADOS no tenant, que
 * é o que interessa: um papel que ninguém tem não aparece.
 */
async function getPapeisPorUtilizador(accessToken: string): Promise<Map<string, string[]>> {
  const porUtilizador = new Map<string, string[]>();
  const papeis = await graphTodos<{ id: string; displayName: string }>(
    accessToken,
    'https://graph.microsoft.com/v1.0/directoryRoles',
  );

  for (const papel of papeis) {
    const membros = await graphTodos<{ id: string; '@odata.type'?: string }>(
      accessToken,
      `https://graph.microsoft.com/v1.0/directoryRoles/${papel.id}/members?$select=id`,
    );
    for (const m of membros) {
      const atuais = porUtilizador.get(m.id) || [];
      atuais.push(papel.displayName);
      porUtilizador.set(m.id, atuais);
    }
  }
  return porUtilizador;
}

/**
 * Quem NÃO tem segundo factor.
 *
 * Exige `AuditLog.Read.All` ou `Reports.Read.All`, que muitas empresas não
 * concedem a um app de integração. Falhar aqui não pode derrubar a sincronização
 * inteira: devolve vazio e a sincronização segue sem esta coluna. Metade dos
 * dados é melhor do que nenhum — desde que se saiba qual metade.
 */
async function getRegistoMfa(accessToken: string): Promise<Map<string, boolean> | null> {
  try {
    const registos = await graphTodos<{ id: string; isMfaRegistered: boolean }>(
      accessToken,
      'https://graph.microsoft.com/v1.0/reports/authenticationMethods/userRegistrationDetails?$top=999',
    );
    const mapa = new Map<string, boolean>();
    for (const r of registos) mapa.set(r.id, !!r.isMfaRegistered);
    return mapa;
  } catch (e) {
    console.warn('Entra: relatório de MFA indisponível (permissão em falta?)', e);
    return null;
  }
}

/** Qualquer papel de directório faz da conta uma conta privilegiada. */
export function mapEntraUserToAcesso(
  u: EntraUser,
  empresaId: string,
  sistemaId: string,
  papeis: string[],
  mfa: boolean | null,
) {
  const notas: string[] = [];
  if (papeis.length) notas.push(`Papéis no diretório: ${papeis.join(', ')}`);
  if (mfa === false) notas.push('SEM segundo fator registrado');
  if (mfa === true) notas.push('Segundo fator registrado');

  return {
    empresa_id: empresaId,
    sistema_id: sistemaId,
    nome_usuario: u.displayName || u.userPrincipalName || '(sem nome)',
    email_usuario: u.mail || u.userPrincipalName || null,
    departamento: u.department || null,
    cargo: u.jobTitle || null,
    tipo_acesso: papeis.length ? 'administracao' : 'leitura',
    nivel_privilegio: papeis.length ? 'administrador' : 'usuario',
    /* `createdDateTime` é quando a conta nasceu no directório, que é o mais
       próximo que o Entra tem de «desde quando tem acesso». */
    data_concessao: u.createdDateTime ? u.createdDateTime.slice(0, 10) : null,
    observacoes: notas.join(' · ') || null,
    ativo: u.accountEnabled !== false,
    origem: 'entra_id',
    origem_id: u.id,
    sincronizado_em: new Date().toISOString(),
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // === AUTH: require valid Supabase JWT ===
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || supabaseServiceKey;
    const verifier = createClient(supabaseUrl, supabaseAnonKey);
    const { data: userData, error: userErr } = await verifier.auth.getUser(authHeader.replace('Bearer ', ''));
    if (userErr || !userData?.user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Resolve caller's empresa/role to enforce tenant boundary.
    const { data: profile } = await supabase
      .from('profiles')
      .select('empresa_id, role')
      .eq('user_id', userData.user.id)
      .maybeSingle();

    if (!profile?.empresa_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Forbidden' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action, tenant_id, client_id, client_secret, empresa_id: bodyEmpresaId } = await req.json();
    const isSuperAdmin = profile.role === 'super_admin';
    // Ignore any empresa_id sent from the client for non-super-admins.
    const empresa_id = isSuperAdmin && bodyEmpresaId ? bodyEmpresaId : profile.empresa_id;

    console.log(`Azure integration action: ${action}`);


    switch (action) {
      case 'test': {
        if (!tenant_id || !client_id || !client_secret) {
          return new Response(
            JSON.stringify({ success: false, error: 'Credenciais incompletas' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        try {
          const accessToken = await getAzureAccessToken(tenant_id, client_id, client_secret);
          
          const response = await fetch('https://graph.microsoft.com/v1.0/organization', {
            headers: { 'Authorization': `Bearer ${accessToken}` }
          });

          if (!response.ok) {
            throw new Error('Falha ao acessar Microsoft Graph');
          }

          const orgData = await response.json();
          const tenantName = orgData.value?.[0]?.displayName || tenant_id;

          return new Response(
            JSON.stringify({ success: true, tenant_name: tenantName }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } catch (error) {
          console.error('Azure test error:', error);
          return new Response(
            JSON.stringify({ success: false, error: (error instanceof Error ? error.message : String(error)) }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      case 'sync_usuarios': {
        /*
          Utilizadores, grupos e papéis do Entra ID para Revisão de Acessos.

          As caixas «Usuários do Azure AD» e «Grupos do Azure AD» já existiam no
          ecrã de configuração há muito — e a sincronização só trazia
          dispositivos do Intune. Ticar a caixa não fazia nada.
        */
        if (!empresa_id) {
          return new Response(
            JSON.stringify({ success: false, error: 'empresa_id obrigatório' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data: cfgU } = await supabase
          .from('integracoes_config')
          .select('*')
          .eq('empresa_id', empresa_id)
          .eq('tipo_integracao', 'azure')
          .maybeSingle();

        if (!cfgU) {
          return new Response(
            JSON.stringify({ success: false, error: 'Configuração Azure não encontrada' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        let segredoU: string | undefined;
        try {
          segredoU = typeof cfgU.credenciais_encrypted === 'string'
            ? JSON.parse(cfgU.credenciais_encrypted)?.client_secret
            : (cfgU.credenciais_encrypted as any)?.client_secret;
        } catch {
          segredoU = undefined;
        }

        if (!cfgU.configuracoes?.tenant_id || !cfgU.configuracoes?.client_id || !segredoU) {
          return new Response(
            JSON.stringify({
              success: false,
              error: 'Credenciais Azure incompletas. Reconfigure a integração informando o Client Secret.'
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        try {
          const token = await getAzureAccessToken(
            cfgU.configuracoes.tenant_id,
            cfgU.configuracoes.client_id,
            segredoU,
          );

          const utilizadores = await getEntraUsers(token);
          const papeis = await getPapeisPorUtilizador(token);
          const mfa = await getRegistoMfa(token);
          console.log(`Entra: ${utilizadores.length} utilizadores, ${papeis.size} com papel de diretorio`);

          const { data: sistemaId, error: erroSistema } = await supabase.rpc('sistema_do_diretorio', {
            p_empresa_id: empresa_id,
            p_nome: 'Microsoft Entra ID',
            p_categoria: 'identidade',
          });
          if (erroSistema) throw erroSistema;

          const agora = new Date().toISOString();
          const vistos: string[] = [];
          let criados = 0;
          let atualizados = 0;

          for (const u of utilizadores) {
            const linha = mapEntraUserToAcesso(
              u, empresa_id, sistemaId as string,
              papeis.get(u.id) || [],
              mfa ? (mfa.get(u.id) ?? false) : null,
            );
            vistos.push(u.id);

            const { data: existente } = await supabase
              .from('sistemas_usuarios')
              .select('id')
              .eq('sistema_id', sistemaId)
              .eq('origem', 'entra_id')
              .eq('origem_id', u.id)
              .maybeSingle();

            if (existente) {
              const { error } = await supabase
                .from('sistemas_usuarios')
                .update({ ...linha, updated_at: agora })
                .eq('id', existente.id);
              if (error) throw error;
              atualizados++;
            } else {
              const { error } = await supabase.from('sistemas_usuarios').insert(linha);
              if (error) throw error;
              criados++;
            }
          }

          /*
            Quem saiu do diretório fica, desactivado.

            Apagar seria apagar a prova de que aquela pessoa TEVE acesso — que é
            precisamente o que uma revisão de acessos existe para conseguir
            mostrar depois. Some da lista de activos e continua no histórico.
          */
          let desativados = 0;
          if (vistos.length > 0) {
            const { data: sumidos, error: erroSumidos } = await supabase
              .from('sistemas_usuarios')
              .update({ ativo: false, sincronizado_em: agora, updated_at: agora })
              .eq('sistema_id', sistemaId)
              .eq('origem', 'entra_id')
              .eq('ativo', true)
              .not('origem_id', 'in', `(${vistos.map((v) => `"${v}"`).join(',')})`)
              .select('id');
            if (erroSumidos) throw erroSumidos;
            desativados = sumidos?.length ?? 0;
          }

          await supabase
            .from('integracoes_config')
            .update({ ultima_sincronizacao: agora })
            .eq('id', cfgU.id);

          await supabase.from('integracoes_webhook_logs').insert({
            integracao_id: cfgU.id,
            evento: 'sync_usuarios',
            payload: {
              criados, atualizados, desativados,
              com_papel: papeis.size,
              mfa_verificado: mfa !== null,
            },
            status_code: 200,
            sucesso: true,
            empresa_id
          });

          return new Response(
            JSON.stringify({
              success: true,
              criados, atualizados, desativados,
              total: utilizadores.length,
              com_papel_de_diretorio: papeis.size,
              /* Quem lê a resposta tem de saber se a coluna de MFA está vazia
                 porque ninguém falha, ou porque não houve permissão para olhar. */
              mfa_verificado: mfa !== null,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } catch (erroSync) {
          console.error('Entra sync error:', erroSync);
          await supabase.from('integracoes_webhook_logs').insert({
            integracao_id: cfgU.id,
            evento: 'sync_usuarios',
            payload: { error: erroSync instanceof Error ? erroSync.message : String(erroSync) },
            status_code: 500,
            sucesso: false,
            empresa_id
          });
          return new Response(
            JSON.stringify({ success: false, error: erroSync instanceof Error ? erroSync.message : String(erroSync) }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      case 'sync': {
        if (!empresa_id) {
          return new Response(
            JSON.stringify({ success: false, error: 'empresa_id obrigatório' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Buscar configuração da empresa
        const { data: config, error: configError } = await supabase
          .from('integracoes_config')
          .select('*')
          .eq('empresa_id', empresa_id)
          .eq('tipo_integracao', 'azure')
          .single();

        if (configError || !config) {
          return new Response(
            JSON.stringify({ success: false, error: 'Configuração Azure não encontrada' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        /*
          `credenciais_encrypted` é uma coluna TEXT com JSON lá dentro.

          Estava a ser lida como se fosse objecto — `config.credenciais_encrypted
          ?.client_secret` sobre uma string devolve undefined, sempre. Somado a
          que o ecrã de configuração nunca chegava a gravar a coluna, a
          integração Azure dizia-se ligada, passava no teste de conexão e nunca
          podia sincronizar nada. As duas metades do defeito estão corrigidas:
          esta linha, e o `handleSave` do AzureConfigDialog.
        */
        const storedTenantId = config.configuracoes?.tenant_id;
        const storedClientId = config.configuracoes?.client_id;
        let storedClientSecret: string | undefined;
        try {
          storedClientSecret = typeof config.credenciais_encrypted === 'string'
            ? JSON.parse(config.credenciais_encrypted)?.client_secret
            : (config.credenciais_encrypted as any)?.client_secret;
        } catch {
          storedClientSecret = undefined;
        }

        if (!storedTenantId || !storedClientId || !storedClientSecret) {
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: 'Credenciais Azure incompletas. Reconfigure a integração informando o Client Secret.' 
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        try {
          // Obter token de acesso real
          const accessToken = await getAzureAccessToken(storedTenantId, storedClientId, storedClientSecret);
          
          // Buscar dispositivos reais do Intune
          const intuneDevices = await getIntuneDevices(accessToken);
          console.log(`Fetched ${intuneDevices.length} devices from Intune`);

          // Sincronizar cada dispositivo
          let syncedCount = 0;
          for (const device of intuneDevices) {
            const ativo = mapIntuneDeviceToAtivo(device, empresa_id);
            
            // Verificar se já existe pelo tag Intune:ID
            const { data: existing } = await supabase
              .from('ativos')
              .select('id')
              .eq('empresa_id', empresa_id)
              .contains('tags', [`Intune:${device.id}`])
              .maybeSingle();

            if (existing) {
              await supabase
                .from('ativos')
                .update({ ...ativo, updated_at: new Date().toISOString() })
                .eq('id', existing.id);
            } else {
              await supabase.from('ativos').insert(ativo);
            }
            syncedCount++;
          }

          // Atualizar última sincronização
          await supabase
            .from('integracoes_config')
            .update({ ultima_sincronizacao: new Date().toISOString() })
            .eq('id', config.id);

          // Registrar log
          await supabase.from('integracoes_webhook_logs').insert({
            integracao_id: config.id,
            evento: 'sync_devices',
            payload: { devices_count: syncedCount },
            status_code: 200,
            sucesso: true,
            empresa_id
          });

          return new Response(
            JSON.stringify({ 
              success: true, 
              devices_synced: syncedCount,
              message: `${syncedCount} dispositivos sincronizados do Intune`
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } catch (syncError) {
          console.error('Azure sync error:', syncError);
          
          // Registrar erro no log
          await supabase.from('integracoes_webhook_logs').insert({
            integracao_id: config.id,
            evento: 'sync_devices',
            payload: { error: (syncError instanceof Error ? syncError.message : String(syncError)) },
            status_code: 500,
            sucesso: false,
            empresa_id
          });

          return new Response(
            JSON.stringify({ success: false, error: (syncError instanceof Error ? syncError.message : String(syncError)) }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      default:
        return new Response(
          JSON.stringify({ success: false, error: 'Ação não reconhecida' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
    }

  } catch (error) {
    console.error('Azure integration error:', error);
    
    return new Response(
      JSON.stringify({ success: false, error: (error instanceof Error ? error.message : String(error)) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
