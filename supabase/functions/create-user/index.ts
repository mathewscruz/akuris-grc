
import { createClient } from 'npm:@supabase/supabase-js@2'
import { requireUserContext, requireValidMfa, authErrorResponse } from '../_shared/auth.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CreateUserRequest {
  nome: string
  email: string
  role: 'super_admin' | 'admin' | 'user' | 'readonly'
  empresa_id?: string
  permission_profile_id?: string
}

function generateRandomPassword(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%'
  let result = ''
  for (let i = 0; i < 24; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
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

    console.log('Recebendo requisição para criar usuário')

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const user = { id: ctx.userId }
    const currentUserProfile = { role: ctx.role, empresa_id: ctx.empresaId }

    const { nome, email, role, empresa_id, permission_profile_id }: CreateUserRequest = await req.json()

    // Validação de enum (item Onda 2 #13 antecipado)
    const allowedRoles = ['super_admin', 'admin', 'user', 'readonly']
    if (!allowedRoles.includes(role)) {
      throw new Error('Role inválido')
    }

    const isSuperAdmin = currentUserProfile.role === 'super_admin'
    const isAdmin = currentUserProfile.role === 'admin'

    if (!isSuperAdmin && !isAdmin) {
      throw new Error('Usuário não tem permissão para criar outros usuários')
    }

    if (!isSuperAdmin && role === 'super_admin') {
      throw new Error('Apenas super admins podem criar outros super admins')
    }

    let finalEmpresaId = empresa_id
    if (!isSuperAdmin) {
      finalEmpresaId = currentUserProfile.empresa_id
    } else if (!empresa_id) {
      finalEmpresaId = currentUserProfile.empresa_id
    }

    // Enforcement de limite de usuários do plano da empresa
    if (finalEmpresaId) {
      const { data: empresaPlan } = await supabaseAdmin
        .from('empresas')
        .select('plano:planos(limite_usuarios, nome)')
        .eq('id', finalEmpresaId)
        .maybeSingle()

      const limite = (empresaPlan?.plano as any)?.limite_usuarios as number | null | undefined
      const planName = (empresaPlan?.plano as any)?.nome || 'atual'

      if (limite && limite > 0) {
        const { count: currentCount } = await supabaseAdmin
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('empresa_id', finalEmpresaId)

        if ((currentCount || 0) >= limite) {
          return new Response(JSON.stringify({
            error: 'USER_LIMIT_REACHED',
            message: `Limite de ${limite} usuários do plano ${planName} atingido. Faça upgrade do plano para criar mais usuários.`,
          }), {
            status: 403,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          })
        }
      }
    }

    console.log(`Criando usuário: ${email}`)

    // Verificar se já existe
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('user_id, id, nome, created_at')
      .eq('email', email)
      .maybeSingle()

    if (existingProfile) {
      return new Response(JSON.stringify({
        error: 'DUPLICATE_USER',
        message: 'Usuário já existe no sistema',
        details: {
          user_id: existingProfile.user_id,
          profile_id: existingProfile.id,
          email: email,
          nome: existingProfile.nome,
          created_at: existingProfile.created_at
        },
        suggestions: [
          'Verifique se o email está correto',
          'Use a opção "Reenviar Email de Boas-vindas" se necessário',
          'Edite o usuário existente se precisar fazer alterações'
        ]
      }), {
        status: 409,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    // Gerar senha aleatória interna (NÃO será enviada ao usuário)
    const internalPassword = generateRandomPassword()

    let authData: any
    let existingAuthUser = null
    try {
      const allUsers = await supabaseAdmin.auth.admin.listUsers()
      existingAuthUser = allUsers.data?.users?.find(u => u.email === email) || null
    } catch (e) {
      console.warn('Erro ao buscar usuário no Auth:', e)
    }

    if (existingAuthUser) {
      console.log('Usuário órfão detectado - recriando profile para:', email)
      authData = { user: existingAuthUser }
      await supabaseAdmin.auth.admin.updateUserById(existingAuthUser.id, {
        password: internalPassword
      })
    } else {
      const { data: newAuthData, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
        email: email,
        password: internalPassword,
        email_confirm: true,
        user_metadata: {
          nome: nome,
          admin_created: 'true'
        }
      })

      if (createUserError || !newAuthData.user) {
        console.error('Erro ao criar usuário no Auth:', createUserError)
        throw new Error(createUserError?.message || 'Erro ao criar usuário')
      }

      authData = newAuthData
    }

    console.log('Processando usuário no Auth:', authData.user.id)

    await new Promise(resolve => setTimeout(resolve, 100))

    const profileInsertData: any = {
      user_id: authData.user.id,
      nome: nome,
      email: email,
      role: role,
      empresa_id: finalEmpresaId,
    }
    if (permission_profile_id) {
      profileInsertData.permission_profile_id = permission_profile_id
    }

    const { error: profileInsertError } = await supabaseAdmin
      .from('profiles')
      .insert(profileInsertData)

    if (profileInsertError) {
      console.error('Erro ao criar perfil:', profileInsertError)
      if (!existingAuthUser) {
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      }
      throw new Error('Erro ao criar perfil do usuário')
    }

    console.log('Perfil criado com sucesso')

    // Aplicar permissões
    try {
      if (permission_profile_id) {
        const { error: rpcErr } = await supabaseAdmin.rpc('apply_permission_profile', {
          _user_id: authData.user.id,
          _profile_id: permission_profile_id,
        })
        if (rpcErr) console.error('Erro ao aplicar perfil de permissão:', rpcErr)
      } else {
        const { error: rpcErr } = await supabaseAdmin.rpc('apply_default_permissions_for_user', {
          user_id_param: authData.user.id,
        })
        if (rpcErr) console.error('Erro ao aplicar permissões padrão:', rpcErr)
      }
    } catch (permError) {
      console.error('Exceção ao aplicar permissões:', permError)
    }

    // Inserir/atualizar role em user_roles (fonte de verdade RBAC)
    try {
      // app_role enum aceita: user, admin, super_admin (não tem readonly)
      const appRole: 'super_admin' | 'admin' | 'user' =
        role === 'super_admin' ? 'super_admin'
        : role === 'admin' ? 'admin'
        : 'user'
      const { error: roleErr } = await supabaseAdmin
        .from('user_roles')
        .upsert({ user_id: authData.user.id, role: appRole }, { onConflict: 'user_id,role' })
      if (roleErr) console.error('Erro ao inserir user_roles:', roleErr)
    } catch (e) {
      console.error('Exceção ao inserir user_roles:', e)
    }

    // Gerar link de invite para o usuário definir sua senha
    const siteUrl = 'https://akuris.com.br'
    let setupPasswordUrl = `${siteUrl}/auth`
    
    try {
      const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'invite',
        email: email,
        options: {
          redirectTo: `${siteUrl}/definir-senha`,
        }
      })

      if (linkError || !linkData) {
        console.error('Erro ao gerar invite link:', linkError)
        // Fallback: usar recovery link
        const { data: recoveryData, error: recoveryError } = await supabaseAdmin.auth.admin.generateLink({
          type: 'recovery',
          email: email,
          options: {
            redirectTo: `${siteUrl}/definir-senha`,
          }
        })
        
        if (!recoveryError && recoveryData) {
          setupPasswordUrl = `${siteUrl}/definir-senha?token_hash=${recoveryData.properties.hashed_token}&type=recovery`
        }
      } else {
        setupPasswordUrl = `${siteUrl}/definir-senha?token_hash=${linkData.properties.hashed_token}&type=invite`
      }
    } catch (linkGenError) {
      console.error('Exceção ao gerar link:', linkGenError)
    }

    // Buscar dados da empresa para o e-mail
    let companyName = 'Akuris'
    let companyLogoUrl = ''
    
    try {
      const { data: empresaData } = await supabaseAdmin
        .from('empresas')
        .select('nome, logo_url')
        .eq('id', finalEmpresaId)
        .single()
      
      if (empresaData) {
        companyName = empresaData.nome || companyName
        companyLogoUrl = empresaData.logo_url || companyLogoUrl
      }
    } catch (empresaError) {
      console.log('Não foi possível buscar dados da empresa:', empresaError)
    }

    // Enviar e-mail de boas-vindas com link
    let emailSent = false
    try {
      console.log('Enviando e-mail de boas-vindas com link para definir senha...')
      const { error: emailError } = await supabaseAdmin.functions.invoke('send-welcome-email', {
        headers: {
          Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: {
          userName: nome,
          userEmail: email,
          setupPasswordUrl,
          companyName,
          companyLogoUrl
        }
      })

      if (emailError) {
        console.error('Erro ao enviar e-mail:', emailError)
      } else {
        console.log('E-mail de boas-vindas enviado com sucesso')
        emailSent = true
      }
    } catch (emailError) {
      console.error('Exceção ao enviar e-mail:', emailError)
    }

    // Persistir metadata do convite (link manual + data de envio)
    try {
      await supabaseAdmin
        .from('profiles')
        .update({
          invitation_sent_at: new Date().toISOString(),
          invitation_link: setupPasswordUrl,
        })
        .eq('user_id', authData.user.id)
    } catch (e) {
      console.error('Falha ao gravar metadata do convite:', e)
    }

    return new Response(JSON.stringify({ 
      success: true, 
      user: {
        id: authData.user.id,
        email: email,
        nome: nome
      },
      emailSent,
      setupPasswordUrl,
      message: emailSent ? 'Usuário criado com sucesso! E-mail com link para definir senha enviado.' : 'Usuário criado com sucesso! Falha no envio do e-mail — copie o link manual.'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })

  } catch (error: any) {
    console.error('Erro na função create-user:', error)
    return new Response(
      JSON.stringify({
        error: (error instanceof Error ? error.message : String(error)),
        details: 'Falha ao criar usuário'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    )
  }
})
