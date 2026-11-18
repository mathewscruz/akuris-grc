import React from 'npm:react@18.3.1'
import { sendIdempotentEmail } from '../_shared/idempotent-email.ts'
import { readScheduledRows } from '../_shared/scheduled-job.ts'
import { htmlToText } from '../_shared/email.ts'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { InvitationReminderEmail } from './_templates/invitation-reminder-email.tsx'
import { exigeInternaOuUtilizador, respostaAcessoNegado, AcessoNegado } from '../_shared/interna.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseKey)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ReminderRequest {
  user_id?: string
  empresa_id?: string
  dry_run?: boolean
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
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
    console.log('Iniciando processamento de lembretes de convite')

    /*
      Dois chamadores legítimos, e mais nenhum: o `daily-reminder-processor`
      (por dentro, com a chave de serviço) e o ecrã de definições de lembretes
      (um utilizador com sessão). Estava aberta a qualquer pessoa na internet.
    */
    const chamador = await exigeInternaOuUtilizador(req)
    if (!chamador.interna && !['admin', 'super_admin'].includes(chamador.role ?? '')) {
      throw new AcessoNegado('Apenas administradores podem processar convites', 403)
    }
    if (!chamador.interna && !chamador.mfaValida) {
      throw new AcessoNegado('Confirmação MFA necessária', 403)
    }

    const { user_id, empresa_id: empresaPedida, dry_run }: ReminderRequest = await req.json().catch(() => ({}))
    const dryRun = dry_run === true

    /*
      Um utilizador só processa lembretes da SUA empresa -- o `empresa_id` do
      corpo do pedido deixa de o escolher. Vindo de dentro, o processador diário
      já sabe de que empresa trata e continua a poder indicá-la.
    */
    const empresa_id = chamador.interna ? empresaPedida : chamador.empresaId
    if (!chamador.interna && !empresa_id) {
      return new Response(JSON.stringify({ error: 'Sem empresa associada' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // The internal RPC joins by user_id; there is no profiles/temporary_passwords FK.
    const eligibleUsers = await readScheduledRows<any>((from, to) => supabase
      .rpc('convites_elegiveis_lembrete', { p_empresa_id: empresa_id ?? null, p_user_id: user_id ?? null })
      .range(from, to))

    console.log(`Encontrados ${eligibleUsers?.length || 0} usuários elegíveis`)

    if (!eligibleUsers || eligibleUsers.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Nenhum usuário elegível para lembretes encontrado',
        processed: 0,
        sent: 0,
        errors: 0
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      })
    }

    let processed = 0
    let sent = 0
    let errors = 0
    let eligible = 0

    for (const user of eligibleUsers) {
      processed++
      
      try {
        // Buscar configurações de lembrete da empresa
        const { data: settings, error: settingsError } = await supabase
          .from('empresa_reminder_settings')
          .select('*')
          .eq('empresa_id', user.empresa_id)
          .single()
        if (settingsError) throw settingsError

        // Se lembretes estão desabilitados para esta empresa, pular
        if (!settings?.reminders_enabled) {
          console.log(`Lembretes desabilitados para empresa ${user.empresa_id}`)
          continue
        }

        const maxReminders = settings?.max_reminders ?? 3
        const intervals = settings?.reminder_intervals || [3, 7, 14]

        // Buscar histórico de lembretes do usuário
        const { data: reminderHistory, error: historyError } = await supabase
          .from('user_invitation_reminders')
          .select('*')
          .eq('user_id', user.user_id)
          .eq('empresa_id', user.empresa_id)
          .maybeSingle()
        if (historyError) throw historyError

        const currentReminderCount = reminderHistory?.reminder_count || 0

        // Se já atingiu o limite máximo, pular
        if (currentReminderCount >= maxReminders) {
          console.log(`Usuário ${user.user_id ?? user.id} já atingiu limite máximo de lembretes`)
          continue
        }

        // Verificar se é hora de enviar o próximo lembrete
        const now = new Date()
        let shouldSendReminder = false

        if (!reminderHistory) {
          // Primeiro lembrete - enviar após 3 dias do convite inicial
          const inviteDate = new Date(user.created_at)
          const daysSinceInvite = Math.floor((now.getTime() - inviteDate.getTime()) / (1000 * 60 * 60 * 24))
          shouldSendReminder = daysSinceInvite >= (intervals[0] || 3)
        } else if (reminderHistory.next_reminder_due && new Date(reminderHistory.next_reminder_due) <= now) {
          shouldSendReminder = true
        }

        if (!shouldSendReminder) {
          console.log(`Ainda não é hora de enviar lembrete para ${user.user_id ?? user.id}`)
          continue
        }

        eligible++
        if (dryRun) continue

        // Enviar e-mail de lembrete
        const loginUrl = 'https://akuris.pt'
        
        const html = await renderAsync(
          React.createElement(InvitationReminderEmail, {
            userName: user.nome,
            userEmail: user.email,
            companyName: user.empresa_nome,
            loginUrl,
            reminderNumber: currentReminderCount + 1,
            maxReminders,
          })
        )

        await sendIdempotentEmail({
          from: 'Akuris <noreply@akuris.com.br>',
          to: [user.email],
          subject: `Lembrete: Seu acesso ao Akuris está aguardando - ${user.empresa_nome}`,
          html,
          text: htmlToText(html),
        }, `invitation-reminder/${user.user_id}/${currentReminderCount + 1}`, Deno.env.get('RESEND_API_KEY') || '')

        console.log(`E-mail de lembrete enviado para ${user.user_id ?? user.id}`)

        // Atualizar ou criar registro de lembrete
        const nextReminderCount = currentReminderCount + 1
        const nextInterval = intervals[nextReminderCount] || intervals[intervals.length - 1]
        const nextReminderDue = new Date(now.getTime() + (nextInterval * 24 * 60 * 60 * 1000))

        const reminderData = {
          user_id: user.user_id,
          empresa_id: user.empresa_id,
          reminder_count: nextReminderCount,
          last_reminder_sent: now.toISOString(),
          next_reminder_due: nextReminderCount < maxReminders ? nextReminderDue.toISOString() : null,
          status: nextReminderCount >= maxReminders ? 'completed' : 'active',
          updated_at: now.toISOString()
        }

        const { error: saveError } = !reminderHistory
          ? await supabase.from('user_invitation_reminders').insert(reminderData)
          : await supabase.from('user_invitation_reminders').update(reminderData).eq('id', reminderHistory.id)
        if (saveError) throw saveError

        sent++

      } catch (error) {
        console.error(`Erro ao processar usuário ${user.user_id ?? user.id}:`, error)
        errors++
      }
    }

    console.log(`Processamento concluído: ${processed} processados, ${sent} enviados, ${errors} erros`)

    return new Response(JSON.stringify({
      success: errors === 0,
      message: 'Processamento de lembretes concluído',
      processed,
      sent,
      errors,
      eligible,
      dry_run: dryRun,
      details: {
        total_eligible: eligibleUsers.length,
        success_rate: processed > 0 ? Math.round((sent / processed) * 100) : 0
      }
    }), {
      status: errors === 0 ? 200 : 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    })

  } catch (error: any) {
    if (error instanceof AcessoNegado) return respostaAcessoNegado(error, corsHeaders)
    console.error('Erro na função process-invitation-reminders:', error)
    return new Response(
      JSON.stringify({
        error: (error instanceof Error ? error.message : String(error)),
        details: 'Falha ao processar lembretes de convite'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    )
  }
})
