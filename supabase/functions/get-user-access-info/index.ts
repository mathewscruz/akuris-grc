
import { createClient } from 'npm:@supabase/supabase-js@2'
import { requireUserContext, requireValidMfa } from '../_shared/auth.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', {
      status: 405,
      headers: corsHeaders
    })
  }

  try {
    // ✳️ Auth + MFA obrigatórios
    const ctx = await requireUserContext(req)
    await requireValidMfa(ctx)

    console.log('Recebendo requisição para obter informações de acesso dos usuários')

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const user = { id: ctx.userId }
    const currentUserProfile = { role: ctx.role, empresa_id: ctx.empresaId }


    // Validar permissões - apenas admins e super_admins podem acessar
    const isSuperAdmin = currentUserProfile.role === 'super_admin'
    const isAdmin = currentUserProfile.role === 'admin' || isSuperAdmin
    
    if (!isAdmin) {
      throw new Error('Usuário não tem permissão para acessar informações de usuários')
    }

    // Obter lista de user_ids para buscar informações
    const { user_ids } = await req.json()
    
    if (!Array.isArray(user_ids) || user_ids.length === 0) {
      throw new Error('Lista de IDs de usuários inválida')
    }

    // Tenant boundary: non-super_admins can only look up users in their own empresa
    let allowedUserIds: string[] = user_ids
    if (!isSuperAdmin) {
      const { data: sameTenantProfiles } = await supabaseAdmin
        .from('profiles')
        .select('user_id')
        .eq('empresa_id', currentUserProfile.empresa_id)
        .in('user_id', user_ids)
      allowedUserIds = (sameTenantProfiles || []).map((p: any) => p.user_id)
    }

    if (allowedUserIds.length === 0) {
      return new Response(JSON.stringify({ success: true, users: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }


    // Buscar informações de acesso dos usuários
    const { data: authUsers, error: usersError } = await supabaseAdmin.auth.admin
      .listUsers()

    if (usersError) {
      throw new Error('Erro ao buscar informações de usuários')
    }

    // Filtrar apenas os usuários solicitados (respeitando o escopo de tenant)
    const filteredUsers = authUsers.users.filter(authUser =>
      allowedUserIds.includes(authUser.id)
    ).map(authUser => ({
      id: authUser.id,
      last_sign_in_at: authUser.last_sign_in_at,
      created_at: authUser.created_at
    }))

    // Buscar informações de senhas temporárias
    const { data: tempPasswords, error: tempPasswordsError } = await supabaseAdmin
      .from('temporary_passwords')
      .select('user_id, is_temporary, created_at, expires_at')
      .in('user_id', allowedUserIds)
      .eq('is_temporary', true)


    if (tempPasswordsError) {
      console.error('Erro ao buscar senhas temporárias:', tempPasswordsError)
      // Não falhar a requisição por causa deste erro
    }

    // Combinar as informações
    const usersAccessInfo = filteredUsers.map(user => {
      const tempPassword = tempPasswords?.find(tp => tp.user_id === user.id)
      return {
        user_id: user.id,
        last_sign_in_at: user.last_sign_in_at,
        created_at: user.created_at,
        has_temp_password: !!tempPassword,
        temp_password_created_at: tempPassword?.created_at,
        temp_password_expires_at: tempPassword?.expires_at,
        first_access_pending: !user.last_sign_in_at && !!tempPassword
      }
    })

    return new Response(JSON.stringify({ 
      success: true, 
      users: usersAccessInfo
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    })

  } catch (error: any) {
    console.error('Erro na função get-user-access-info:', error)
    return new Response(
      JSON.stringify({
        error: 'Erro ao obter informações de acesso. Tente novamente.'
      }),
      {
        status: 500,
        headers: { 
          'Content-Type': 'application/json', 
          ...corsHeaders 
        },
      }
    )
  }
})
