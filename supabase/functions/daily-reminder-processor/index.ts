import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseKey)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Auth: require SERVICE_ROLE_KEY as bearer (cron / internal trigger only)
    const authHeader = req.headers.get('Authorization');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!authHeader?.startsWith('Bearer ') || authHeader.replace('Bearer ', '') !== serviceKey) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    console.log('Iniciando processamento diário de lembretes de convite')
    
    // Buscar todas as empresas com lembretes habilitados
    const { data: empresasAtivas, error: empresasError } = await supabase
      .from('empresa_reminder_settings')
      .select('empresa_id, due_diligence_expiracao_ativo, due_diligence_expiracao_dias')
      .eq('reminders_enabled', true)

    if (empresasError) {
      console.error('Erro ao buscar empresas ativas:', empresasError)
      throw empresasError
    }

    if (!empresasAtivas || empresasAtivas.length === 0) {
      console.log('Nenhuma empresa com lembretes habilitados encontrada')
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Nenhuma empresa com lembretes habilitados',
        empresas_processadas: 0
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      })
    }

    let empresasProcessadas = 0
    let totalEnviados = 0
    let totalErros = 0

    // Processar lembretes para cada empresa
    for (const empresa of empresasAtivas) {
      try {
        console.log(`Processando lembretes para empresa ${empresa.empresa_id}`)
        
        // Chamar a função de processamento de lembretes para esta empresa
        const { data, error } = await supabase.functions.invoke('process-invitation-reminders', {
          body: { empresa_id: empresa.empresa_id }
        })

        if (error) {
          console.error(`Erro ao processar empresa ${empresa.empresa_id}:`, error)
          totalErros++
          continue
        }

        /*
          Lembrete de expiração de due diligence.

          A função `process-due-diligence-reminders` já existia e funcionava --
          faltava-lhe quem a chamasse. Enquanto isso, o painel de automações
          mostrava um interruptor LIGADO a prometer este aviso, e nada o
          enviava. Agora corre quando a empresa o pediu, e só então.
        */
        if (empresa.due_diligence_expiracao_ativo) {
          const { error: erroDd } = await supabase.functions.invoke('process-due-diligence-reminders', {
            body: {
              empresa_id: empresa.empresa_id,
              days_before_expiration: empresa.due_diligence_expiracao_dias ?? 7,
            },
          })
          if (erroDd) {
            console.error(`Erro no lembrete de due diligence da empresa ${empresa.empresa_id}:`, erroDd)
            totalErros++
          }
        }

        console.log(`Empresa ${empresa.empresa_id} processada:`, data)
        empresasProcessadas++
        totalEnviados += data.sent || 0
        totalErros += data.errors || 0

      } catch (error) {
        console.error(`Erro ao processar empresa ${empresa.empresa_id}:`, error)
        totalErros++
      }
    }

    // === GAP ANALYSIS: Notificações de prazo de implementação ===
    console.log('Verificando prazos de gap analysis...')
    let gapNotificacoes = 0
    try {
      const hoje = new Date()
      const em7dias = new Date(hoje)
      em7dias.setDate(em7dias.getDate() + 7)

      // Buscar evaluations com prazo próximo ou vencido
      const { data: evalsPrazo, error: evalsPrazoError } = await supabase
        .from('gap_analysis_evaluations')
        .select('id, framework_id, requirement_id, empresa_id, prazo_implementacao, conformity_status, responsavel_avaliacao')
        .not('prazo_implementacao', 'is', null)
        .not('conformity_status', 'eq', 'conforme')
        .not('conformity_status', 'eq', 'nao_aplicavel')
        .lte('prazo_implementacao', em7dias.toISOString().split('T')[0])

      if (evalsPrazoError) {
        console.error('Erro ao buscar prazos gap analysis:', evalsPrazoError)
      } else if (evalsPrazo && evalsPrazo.length > 0) {
        // Load requirement titles
        const reqIds = [...new Set(evalsPrazo.map(e => e.requirement_id))]
        const { data: reqs } = await supabase
          .from('gap_analysis_requirements')
          .select('id, codigo, titulo')
          .in('id', reqIds)

        const reqMap = new Map((reqs || []).map(r => [r.id, r]))

        // Load framework names
        const fwIds = [...new Set(evalsPrazo.map(e => e.framework_id))]
        const { data: fws } = await supabase
          .from('gap_analysis_frameworks')
          .select('id, nome')
          .in('id', fwIds)

        const fwMap = new Map((fws || []).map(f => [f.id, f.nome]))

        // Get admin users per empresa to notify
        for (const eval_ of evalsPrazo) {
          const req = reqMap.get(eval_.requirement_id)
          const fwNome = fwMap.get(eval_.framework_id) || 'Framework'
          const prazoDate = new Date(eval_.prazo_implementacao!)
          const vencido = prazoDate < hoje
          const titulo = vencido
            ? `Prazo vencido: ${req?.codigo || ''} - ${req?.titulo || 'Requisito'}`
            : `Prazo próximo: ${req?.codigo || ''} - ${req?.titulo || 'Requisito'}`
          const mensagem = vencido
            ? `O prazo de implementação do requisito ${req?.codigo} (${fwNome}) venceu em ${prazoDate.toLocaleDateString('pt-BR')}.`
            : `O prazo de implementação do requisito ${req?.codigo} (${fwNome}) vence em ${prazoDate.toLocaleDateString('pt-BR')}.`

          /*
            O aviso vai a quem é dono do requisito.

            Isto ia buscar os CINCO PRIMEIROS perfis da empresa, sem ordem e
            sem filtro de papel — o comentário dizia "(admins)" mas nada na
            consulta o garantia. Resultado: cinco pessoas ao calhas recebiam o
            aviso de um prazo que não é delas, e o responsável, que está
            gravado em `responsavel_avaliacao`, podia não estar entre elas.

            Um aviso que chega a quem não pode agir treina toda a gente a
            ignorá-lo.

            Sem responsável definido, cai para os administradores da empresa —
            que são quem tem de o atribuir a alguém.
          */
          let users: Array<{ user_id: string }> = []
          if (eval_.responsavel_avaliacao) {
            users = [{ user_id: eval_.responsavel_avaliacao }]
          } else {
            const { data: admins } = await supabase
              .from('profiles')
              .select('user_id')
              .eq('empresa_id', eval_.empresa_id)
              .in('role', ['admin', 'super_admin'])
            users = admins || []
          }

          for (const user of (users || [])) {
            // Check if notification already sent today
            const { data: existing } = await supabase
              .from('notifications')
              .select('id')
              .eq('user_id', user.user_id)
              .eq('type', vencido ? 'warning' : 'info')
              .gte('created_at', hoje.toISOString().split('T')[0])
              .ilike('title', `%${req?.codigo || ''}%`)
              .maybeSingle()

            if (!existing) {
              await supabase.from('notifications').insert({
                user_id: user.user_id,
                title: titulo,
                message: mensagem,
                type: vencido ? 'warning' : 'info',
                link_to: `/gap-analysis/framework/${eval_.framework_id}`,
                metadata: {
                  tipo: 'gap_analysis_prazo',
                  evaluation_id: eval_.id,
                  framework_id: eval_.framework_id,
                  requirement_id: eval_.requirement_id,
                }
              })
              gapNotificacoes++
            }
          }
        }
      }
    } catch (gapError) {
      console.error('Erro ao processar prazos gap analysis:', gapError)
    }

    const resultado = {
      success: true,
      message: 'Processamento diário concluído',
      empresas_com_lembretes: empresasAtivas.length,
      empresas_processadas: empresasProcessadas,
      total_lembretes_enviados: totalEnviados,
      total_gap_analysis_notificacoes: gapNotificacoes,
      total_erros: totalErros,
      timestamp: new Date().toISOString()
    }

    console.log('Resultado do processamento diário:', resultado)

    return new Response(JSON.stringify(resultado), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    })

  } catch (error: any) {
    console.error('Erro na função daily-reminder-processor:', error)
    return new Response(
      JSON.stringify({
        error: (error instanceof Error ? error.message : String(error)),
        details: 'Falha no processamento diário de lembretes'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    )
  }
})