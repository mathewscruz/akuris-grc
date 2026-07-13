import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    const token = authHeader.replace('Bearer ', '')

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, empresa_id')
      .eq('user_id', user.id)
      .single()

    if (profileError || !profile || !['admin', 'super_admin'].includes(profile.role)) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const isSuperAdmin = profile.role === 'super_admin'

    // Regular company admins can only reset permissions for users of their own empresa.
    // Only super_admins may operate across every tenant.
    let usersQuery = supabase
      .from('profiles')
      .select('user_id, nome, email, role, empresa_id')
      .eq('ativo', true)

    if (!isSuperAdmin) {
      if (!profile.empresa_id) {
        return new Response(
          JSON.stringify({ error: 'Admin sem empresa associada' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      usersQuery = usersQuery.eq('empresa_id', profile.empresa_id)
    }

    const { data: users, error: usersError } = await usersQuery

    if (usersError) {
      console.error('Error fetching users:', usersError)
      throw usersError
    }

    const results = []
    for (const userProfile of users || []) {
      try {
        const { error: permissionError } = await supabase
          .rpc('apply_default_permissions_for_user', {
            user_id_param: userProfile.user_id
          })

        if (permissionError) {
          results.push({
            user_id: userProfile.user_id,
            email: userProfile.email,
            success: false,
            error: permissionError.message
          })
        } else {
          results.push({
            user_id: userProfile.user_id,
            email: userProfile.email,
            success: true
          })
        }
      } catch (error) {
        results.push({
          user_id: userProfile.user_id,
          email: userProfile.email,
          success: false,
          error: 'Erro ao aplicar permissões para este usuário'
        })
      }
    }

    const successCount = results.filter(r => r.success).length
    const failureCount = results.filter(r => !r.success).length

    return new Response(
      JSON.stringify({
        message: 'Default permissions application completed',
        scope: isSuperAdmin ? 'all_tenants' : 'own_empresa',
        total_users: users?.length || 0,
        successful: successCount,
        failed: failureCount,
        results: results
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in apply-default-permissions-all-users:', error)
    return new Response(
      JSON.stringify({ error: 'Erro interno. Por favor, tente novamente.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
