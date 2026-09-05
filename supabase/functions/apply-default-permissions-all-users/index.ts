import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import {
  authErrorResponse,
  AuthError,
  requireUserContext,
  requireValidMfa,
} from '../_shared/auth.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') throw new AuthError('Método não permitido', 405)
    const ctx = await requireUserContext(req)
    await requireValidMfa(ctx)
    if (!['admin', 'super_admin'].includes(ctx.role || '')) {
      throw new AuthError('Acesso de administrador necessário', 403)
    }
    const supabase = ctx.supabase

    const isSuperAdmin = ctx.role === 'super_admin'

    // Regular company admins can only reset permissions for users of their own empresa.
    // Only super_admins may operate across every tenant.
    let usersQuery = supabase
      .from('profiles')
      .select('user_id, nome, email, role, empresa_id')
      .eq('ativo', true)

    if (!isSuperAdmin) {
      if (!ctx.empresaId) {
        return new Response(
          JSON.stringify({ error: 'Admin sem empresa associada' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      usersQuery = usersQuery.eq('empresa_id', ctx.empresaId)
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

  } catch (error: unknown) {
    console.error('Error in apply-default-permissions-all-users:', error)
    if (error instanceof AuthError) return authErrorResponse(error, corsHeaders)
    return new Response(
      JSON.stringify({ error: 'Erro interno. Por favor, tente novamente.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
