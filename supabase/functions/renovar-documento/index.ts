import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RenovarDocumentoRequest {
  documento_id: string;
  observacoes?: string;
  nova_data_vencimento?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Autorização necessária');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Usuário não autenticado');
    }

    const { documento_id, observacoes, nova_data_vencimento }: RenovarDocumentoRequest = await req.json();

    if (!documento_id) {
      throw new Error('ID do documento é obrigatório');
    }

    console.log('Iniciando renovação do documento:', documento_id);

    // 1. Buscar documento atual
    const { data: documentoAtual, error: docError } = await supabase
      .from('documentos')
      .select('*')
      .eq('id', documento_id)
      .single();

    if (docError || !documentoAtual) {
      throw new Error('Documento não encontrado');
    }

    // Tenant boundary: caller must belong to the document's empresa
    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('empresa_id, role')
      .eq('user_id', user.id)
      .maybeSingle();

    const isSuperAdmin = callerProfile?.role === 'super_admin';
    if (!isSuperAdmin && callerProfile?.empresa_id !== documentoAtual.empresa_id) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: documento de outra empresa' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Documento atual encontrado - Versão:', documentoAtual.versao);


    // 2. Arquivar versão atual no histórico
    const { error: historicoError } = await supabase
      .from('documentos_historico')
      .insert({
        documento_id: documento_id,
        versao: documentoAtual.versao,
        arquivo_url: documentoAtual.arquivo_url,
        arquivo_nome: documentoAtual.arquivo_nome,
        arquivo_tipo: documentoAtual.arquivo_tipo,
        arquivo_tamanho: documentoAtual.arquivo_tamanho,
        data_aprovacao: documentoAtual.data_aprovacao,
        aprovado_por: documentoAtual.aprovado_por,
        status: documentoAtual.status,
        data_vencimento: documentoAtual.data_vencimento,
        observacoes: observacoes || null,
        created_by: user.id,
      });

    if (historicoError) {
      console.error('Erro ao criar histórico:', historicoError);
      throw new Error('Erro ao arquivar versão anterior');
    }

    console.log('Versão anterior arquivada no histórico');

    // 3. Limpar aprovações antigas se necessário
    if (documentoAtual.requer_aprovacao) {
      const { error: deleteApprovalsError } = await supabase
        .from('documentos_aprovacoes')
        .delete()
        .eq('documento_id', documento_id);

      if (deleteApprovalsError) {
        console.error('Erro ao limpar aprovações:', deleteApprovalsError);
      } else {
        console.log('Aprovações antigas limpas');
      }
    }

    // 4. Atualizar documento com nova versão
    const novaVersao = documentoAtual.versao + 1;
    const novoStatus = documentoAtual.requer_aprovacao ? 'pendente_aprovacao' : 'ativo';

    const updateData: any = {
      versao: novaVersao,
      status: novoStatus,
      data_aprovacao: null,
      aprovado_por: null,
      updated_at: new Date().toISOString(),
    };

    if (nova_data_vencimento) {
      updateData.data_vencimento = nova_data_vencimento;
    }

    const { error: updateError } = await supabase
      .from('documentos')
      .update(updateData)
      .eq('id', documento_id);

    if (updateError) {
      console.error('Erro ao atualizar documento:', updateError);
      throw new Error('Erro ao renovar documento');
    }

    console.log('Documento renovado para versão:', novaVersao);

    // 5. Criar notificações para aprovadores (se necessário)
    if (documentoAtual.requer_aprovacao) {
      // Buscar perfis de administradores da empresa
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, nome')
        .eq('empresa_id', documentoAtual.empresa_id)
        .in('role', ['admin', 'super_admin']);

      if (profiles && profiles.length > 0) {
        const notificacoes = profiles.map(profile => ({
          user_id: profile.user_id,
          title: 'Documento Renovado - Aprovação Necessária',
          message: `O documento "${documentoAtual.nome}" foi renovado para v${novaVersao} e aguarda sua aprovação.`,
          type: 'info',
          link_to: '/documentos',
          metadata: {
            documento_id: documento_id,
            tipo: 'renovacao_documento',
            versao: novaVersao
          }
        }));

        await supabase.from('notifications').insert(notificacoes);
        console.log('Notificações enviadas para', profiles.length, 'aprovadores');
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        nova_versao: novaVersao,
        status: novoStatus,
        message: `Documento renovado para versão ${novaVersao}`,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Erro na renovação do documento:', error);
    return new Response(
      JSON.stringify({
        error: (error instanceof Error ? error.message : String(error)) || 'Erro ao renovar documento',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
