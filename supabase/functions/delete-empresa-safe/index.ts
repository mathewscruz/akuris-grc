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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método não permitido' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }

  try {
    const contentLength = Number(req.headers.get('content-length') || '0')
    if (contentLength > 4096) throw new AuthError('Corpo da requisição muito grande', 413)

    const ctx = await requireUserContext(req)
    await requireValidMfa(ctx)
    if (ctx.role !== 'super_admin') throw new AuthError('Acesso negado', 403)
    const supabaseAdmin = ctx.supabase

    const { empresa_id, confirm_name } = await req.json()
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(empresa_id || ''))) {
      throw new AuthError('Empresa inválida', 400)
    }
    if (typeof confirm_name !== 'string' || !confirm_name.trim() || confirm_name.length > 200) {
      throw new AuthError('Digite o nome da empresa para confirmar', 400)
    }

    const { data: empresa, error: empresaErr } = await supabaseAdmin
      .from('empresas')
      .select('id, nome, logo_url')
      .eq('id', empresa_id)
      .maybeSingle()

    if (empresaErr || !empresa) throw new Error('Empresa não encontrada')

    if (confirm_name.trim() !== empresa.nome.trim()) {
      return new Response(JSON.stringify({ error: 'Nome de confirmação não confere' }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    // Buscar usuários da empresa
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('user_id')
      .eq('empresa_id', empresa_id)

    const userIds = (profiles || []).map(p => p.user_id).filter(Boolean) as string[]

    // Remover logo do storage
    if (empresa.logo_url) {
      try {
        const fileName = empresa.logo_url.split('/').pop()
        if (fileName) await supabaseAdmin.storage.from('empresa-logos').remove([fileName])
      } catch (e) {
        console.warn('Falha ao remover logo:', e)
      }
    }

    // Deletar empresa (CASCADE deve cuidar de FKs com ON DELETE CASCADE)
    const { error: delErr } = await supabaseAdmin
      .from('empresas')
      .delete()
      .eq('id', empresa_id)

    if (delErr) {
      return new Response(JSON.stringify({
        error: 'DELETE_FAILED',
        message: 'Não foi possível excluir a empresa porque ainda há dados vinculados.',
      }), { status: 409, headers: { 'Content-Type': 'application/json', ...corsHeaders } })
    }

    // Remover usuários do auth (após delete da empresa)
    let deletedUsers = 0
    for (const uid of userIds) {
      try {
        const { error } = await supabaseAdmin.auth.admin.deleteUser(uid)
        if (!error) deletedUsers++
      } catch (e) {
        console.warn('Falha ao deletar auth user', uid, e)
      }
    }

    return new Response(JSON.stringify({
      success: true,
      empresa_id,
      deleted_users: deletedUsers,
    }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } })
  } catch (error: unknown) {
    console.error('[delete-empresa-safe]', error)
    if (error instanceof AuthError) return authErrorResponse(error, corsHeaders)
    return new Response(JSON.stringify({ error: 'Não foi possível concluir a exclusão.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }
})
