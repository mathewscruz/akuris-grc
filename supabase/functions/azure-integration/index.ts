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

        // Buscar credenciais armazenadas
        const storedTenantId = config.configuracoes?.tenant_id;
        const storedClientId = config.configuracoes?.client_id;
        const storedClientSecret = config.credenciais_encrypted?.client_secret;

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
