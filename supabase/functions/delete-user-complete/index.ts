import { createClient } from 'npm:@supabase/supabase-js@2'
import { requireUserContext, requireValidMfa, AuthError, authErrorResponse } from '../_shared/auth.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DeleteUserRequest {
  user_id: string
  profile_id: string
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

    console.log('Iniciando exclusão completa de usuário')

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const user = { id: ctx.userId }
    const currentUserProfile = { role: ctx.role, empresa_id: ctx.empresaId }

    const { user_id, profile_id }: DeleteUserRequest = await req.json()

    // Bloqueia autoexclusão
    if (user_id === user.id) {
      throw new Error('Você não pode excluir o próprio usuário')
    }

    console.log(`Excluindo usuário: ${user_id}`)

    const { data: targetProfile, error: targetError } = await supabaseAdmin
      .from('profiles')
      .select('id, role, empresa_id, nome, email')
      .eq('user_id', user_id)
      .single()

    if (targetError || !targetProfile || targetProfile.id !== profile_id) {
      // Missing tenant provenance is not permission to delete an Auth identity.
      throw new AuthError('USER_NOT_FOUND', 404)
    }

    const isSuperAdmin = currentUserProfile.role === 'super_admin'
    const isAdmin = currentUserProfile.role === 'admin'

    if (!isSuperAdmin && !isAdmin) {
      throw new AuthError('FORBIDDEN', 403)
    }

    if (!isSuperAdmin && targetProfile) {
      if (targetProfile.empresa_id !== currentUserProfile.empresa_id) {
        throw new AuthError('FORBIDDEN', 403)
      }
      if (['admin', 'super_admin'].includes(targetProfile.role)) {
        throw new AuthError('FORBIDDEN', 403)
      }
    }

    let deletedProfile = false
    let deletedAuth = false

    // 1. Tentar excluir o profile primeiro
    if (targetProfile) {
      console.log('Excluindo profile...')
      let deletion = supabaseAdmin
        .from('profiles')
        .delete()
        .eq('user_id', user_id)
        .eq('id', profile_id)
        .eq('role', targetProfile.role)
      deletion = targetProfile.empresa_id
        ? deletion.eq('empresa_id', targetProfile.empresa_id)
        : deletion.is('empresa_id', null)
      const { data: removed, error: profileDeleteError } = await deletion.select('id')

      if (profileDeleteError || removed?.length !== 1) {
        console.error('Erro ao excluir profile:', profileDeleteError)
        throw new Error('Erro ao excluir perfil do usuário')
      }
      deletedProfile = true
      console.log('Profile excluído com sucesso')
    }

    // Only clean permissions once profile removal has succeeded. If a foreign
    // key blocks removal, the still-active user's permissions remain intact.
    const cleanup = await Promise.all([
      supabaseAdmin.from('user_roles').delete().eq('user_id', user_id),
      supabaseAdmin.from('user_module_permissions').delete().eq('user_id', user_id),
      supabaseAdmin.from('mfa_sessions').delete().eq('user_id', user_id),
      supabaseAdmin.from('mfa_codes').delete().eq('user_id', user_id),
      supabaseAdmin.from('temporary_passwords').delete().eq('user_id', user_id),
    ])
    if (cleanup.some(result => result.error)) console.warn('Partial permission/session cleanup')

    // 2. Tentar excluir do Auth
    console.log('Excluindo usuário do Auth...')
    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(user_id)

    if (authDeleteError) {
      console.error('Erro ao excluir usuário do Auth:', authDeleteError)
      // Se profile foi excluído mas Auth falhou, ainda é um sucesso parcial
      if (deletedProfile) {
        console.log('Profile excluído, mas falha na exclusão do Auth')
      } else {
        throw new Error('Erro ao excluir usuário do sistema de autenticação')
      }
    } else {
      deletedAuth = true
      console.log('Usuário excluído do Auth com sucesso')
    }

    const resultMessage = deletedProfile && deletedAuth 
      ? 'Usuário excluído completamente do sistema'
      : deletedProfile 
        ? 'Profile excluído, mas usuário pode ainda existir no Auth'
        : 'Usuário removido do Auth'

    return new Response(JSON.stringify({ 
      success: true,
      message: resultMessage,
      details: {
        profile_deleted: deletedProfile,
        auth_deleted: deletedAuth,
        user_id: user_id
      }
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    })

  } catch (error: any) {
    if (error instanceof AuthError) return authErrorResponse(error, corsHeaders)
    console.error('Erro na função delete-user-complete:', error)
    return new Response(
      JSON.stringify({
        error: (error instanceof Error ? error.message : String(error)),
        details: 'Falha na exclusão completa do usuário'
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
