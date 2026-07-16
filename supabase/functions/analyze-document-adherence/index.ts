import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let requestBody: any = null;
  
  try {
    requestBody = await req.json();
    const { assessmentId, frameworkId, storageFileName } = requestBody;

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY')!;

    if (!anthropicApiKey) {
      throw new Error('ANTHROPIC_API_KEY não configurada');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // === AUTH: validate JWT and derive empresa_id from caller's profile ===
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const verifier = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') || supabaseKey);
    const { data: userData, error: userErr } = await verifier.auth.getUser(authHeader.replace('Bearer ', ''));
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const userId = userData.user.id;
    const { data: profile } = await supabase
      .from('profiles').select('empresa_id').eq('user_id', userId).maybeSingle();
    const empresaId = profile?.empresa_id;
    if (!empresaId) {
      return new Response(JSON.stringify({ error: 'User profile missing empresa_id' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // === TENANT GUARD: assessment precisa pertencer à empresa do JWT ===
    if (!assessmentId) {
      return new Response(JSON.stringify({ error: 'assessmentId obrigatório' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const { data: assessmentRow, error: assessmentErr } = await supabase
      .from('gap_analysis_adherence_assessments')
      .select('id, empresa_id, framework_id, arquivo_storage_path, arquivo_nome')
      .eq('id', assessmentId)
      .maybeSingle();
    if (assessmentErr || !assessmentRow) {
      return new Response(JSON.stringify({ error: 'Assessment não encontrado' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    if (assessmentRow.empresa_id !== empresaId) {
      console.warn('Cross-tenant attempt on analyze-document-adherence', { userId, empresaId, targetEmpresa: assessmentRow.empresa_id, assessmentId });
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    // Coerce framework/path para os valores persistidos no assessment (nunca confiar no body)
    const safeFrameworkId = assessmentRow.framework_id;
    const safeStorageFileName = assessmentRow.arquivo_storage_path || storageFileName;
    if (safeFrameworkId !== frameworkId || safeStorageFileName !== storageFileName) {
      console.warn('Body IDs did not match assessment row — using stored values', { assessmentId });
    }

    // Consumir crédito de IA (empresa derivada do JWT, não do body)
    {
      const { data: creditResult, error: creditError } = await supabase
        .rpc('consume_ai_credit', {
          p_empresa_id: empresaId,
          p_user_id: userId,
          p_funcionalidade: 'analyze_document_adherence',
          p_descricao: `Análise de aderência do documento para framework`
        });

      if (creditError || creditResult === false) {
        await supabase
          .from('gap_analysis_adherence_assessments')
          .update({
            status: 'erro',
            metadados_analise: { erro: 'Créditos de IA esgotados' }
          })
          .eq('id', assessmentId);

        return new Response(JSON.stringify({ 
          error: 'Créditos de IA esgotados.',
          creditsExhausted: true
        }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    console.log('Starting adherence analysis:', { assessmentId, frameworkId, storageFileName });

    // 1. Buscar framework e requisitos
    const { data: framework, error: frameworkError } = await supabase
      .from('gap_analysis_frameworks')
      .select('*')
      .eq('id', frameworkId)
      .single();

    if (frameworkError || !framework) {
      throw new Error(`Framework não encontrado: ${frameworkError?.message}`);
    }

    const { data: requirements, error: reqError } = await supabase
      .from('gap_analysis_requirements')
      .select('*')
      .eq('framework_id', frameworkId)
      .order('ordem');

    if (reqError) throw new Error(`Erro ao buscar requisitos: ${reqError.message}`);
    if (!requirements || requirements.length === 0) throw new Error('Framework não possui requisitos cadastrados');

    console.log(`Framework: ${framework.nome}, Requirements: ${requirements.length}`);

    // 2. Baixar arquivo do storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('adherence-documents')
      .download(storageFileName);

    if (downloadError || !fileData) {
      throw new Error(`Erro ao baixar documento: ${downloadError?.message}`);
    }

    console.log('Document downloaded, size:', fileData.size);

    // 3. Extrair texto
    let documentText = '';
    const fileExtension = storageFileName.toLowerCase().split('.').pop();

    if (fileExtension === 'txt') {
      documentText = await fileData.text();
    } else {
      throw new Error(`Tipo de arquivo não suportado: ${fileExtension}. Apenas TXT pré-processados são aceitos.`);
    }

    if (!documentText || documentText.trim().length < 100) {
      throw new Error('Documento não contém texto suficiente para análise (mínimo 100 caracteres)');
    }

    // 4. Montar prompt
    const docTextForAnalysis = documentText.substring(0, 30000);
    const reqsForAnalysis = requirements.slice(0, 60);

    const reqsText = reqsForAnalysis.map((r: any, i: number) => {
      let entry = `${i+1}. ID:${r.id} | ${r.codigo || 'N/A'}: ${r.titulo}`;
      if (r.descricao) entry += `\n   Descrição: ${r.descricao.substring(0, 300)}`;
      if (r.orientacao_implementacao) entry += `\n   O que a norma exige: ${r.orientacao_implementacao.substring(0, 200)}`;
      if (r.exemplos_evidencias) entry += `\n   Evidências esperadas: ${r.exemplos_evidencias.substring(0, 150)}`;
      return entry;
    }).join('\n\n');

    const prompt = `Você é um AUDITOR SÊNIOR de conformidade regulatória com 15+ anos de experiência em frameworks como ISO 27001, LGPD, NIST CSF, SOC 2, GDPR, PCI DSS e outros.

TAREFA PRINCIPAL: Analise o documento corporativo abaixo e compare ITEM A ITEM com os requisitos do framework ${framework.nome} (${framework.versao || ''}). Você deve agir exatamente como um auditor que recebe um documento (ex: Política de Mesa e Tela Limpa) e precisa verificar se ele atende a todos os pontos exigidos pela norma.

MÉTODO DE ANÁLISE (siga rigorosamente):
1. IDENTIFIQUE o tipo e escopo do documento (política, procedimento, manual, etc.)
2. Para CADA requisito do framework, verifique se o documento contém cláusulas, parágrafos ou seções que atendem ao que é exigido
3. CITE trechos específicos do documento como evidência de conformidade (entre aspas)
4. Quando o documento NÃO abordar um requisito, indique claramente o GAP e o que deveria conter
5. Marque como "nao_aplicavel" APENAS requisitos que genuinamente não se relacionam com o escopo do documento
6. Seja CRITERIOSO: "conforme" = cobre adequadamente; "parcial" = menciona mas incompleto; "nao_conforme" = ausente ou inadequado

DOCUMENTO ANALISADO:
---
${docTextForAnalysis}${documentText.length > 30000 ? '\n\n[... documento continua - ' + (documentText.length - 30000) + ' caracteres adicionais ...]' : ''}
---

REQUISITOS DO FRAMEWORK ${framework.nome} (${reqsForAnalysis.length} de ${requirements.length}):
${reqsText}

FORMATO JSON OBRIGATÓRIO (retorne APENAS JSON válido, sem markdown):
{
  "documento_tipo_identificado": "string (política, procedimento, contrato, manual, etc)",
  "documento_escopo_identificado": "string curta descrevendo escopo do documento",
  "total_requisitos_relevantes": número,
  "resultado_geral": "conforme"|"nao_conforme"|"parcial",
  "percentual_conformidade": 0-100,
  "pontos_fortes": [
    {"titulo": "max 60 chars", "descricao": "max 150 chars com detalhes específicos"}
  ],
  "pontos_melhoria": [
    {"titulo": "max 60 chars", "descricao": "max 150 chars com ação recomendada", "prioridade": "alta|media|baixa"}
  ],
  "requisitos_analisados": [
    {
      "requirement_id": "UUID exato do requisito",
      "requisito_codigo": "código do requisito",
      "status_aderencia": "conforme"|"nao_conforme"|"parcial"|"nao_aplicavel",
      "evidencias_encontradas": "citação ou referência específica do documento (max 120 chars)",
      "gaps_especificos": "o que falta para conformidade total (max 100 chars)",
      "score_conformidade": 0-10,
      "observacoes_ia": "análise detalhada do auditor (max 150 chars)",
      "justificativa_relevancia": "por que este requisito é relevante ao documento (max 80 chars)"
    }
  ],
  "requisitos_nao_aplicaveis": ["array de UUIDs de requisitos não aplicáveis ao escopo do documento"],
  "recomendacoes": ["recomendações acionáveis e específicas, max 150 chars cada, mínimo 3"],
  "analise_detalhada": "resumo executivo da análise (max 500 palavras) incluindo: visão geral da conformidade, áreas de maior risco, prioridades de remediação"
}`;

    // 5. Chamar Anthropic Claude API
    console.log('Calling Anthropic Claude API...');
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 16000,
        system: 'Você é um auditor sênior de conformidade regulatória. Analise documentos com rigor e precisão. Retorne APENAS JSON válido seguindo exatamente o schema fornecido. Seja específico nas evidências e gaps.',
        messages: [
          { role: 'user', content: prompt }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Anthropic API error:', response.status, errorText);
      if (response.status === 429) throw new Error('Limite de requisições excedido. Aguarde e tente novamente.');
      if (response.status === 401) throw new Error('Chave da API Anthropic inválida.');
      throw new Error(`Erro na API Anthropic (${response.status}): ${errorText}`);
    }

    const aiResponse = await response.json();
    console.log('Anthropic response received:', JSON.stringify({
      hasContent: !!aiResponse.content,
      contentLength: aiResponse.content?.[0]?.text?.length,
      stopReason: aiResponse.stop_reason
    }));
    
    if (aiResponse.stop_reason === 'max_tokens') {
      console.error('Response truncated');
      throw new Error('Análise truncada. Tente com um framework com menos requisitos.');
    }
    
    if (!aiResponse.content?.[0]?.text) {
      throw new Error('Resposta da IA inválida');
    }

    let analysisResult;
    try {
      let content = aiResponse.content[0].text;
      console.log('AI response length:', content.length);
      
      // Remove markdown code blocks if present
      content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      
      analysisResult = JSON.parse(content);
      
      if (!analysisResult.resultado_geral || !analysisResult.requisitos_analisados) {
        throw new Error('JSON sem campos obrigatórios');
      }
      
      // Truncar campos
      if (analysisResult.requisitos_analisados) {
        analysisResult.requisitos_analisados = analysisResult.requisitos_analisados.map((req: any) => ({
          ...req,
          evidencias_encontradas: (req.evidencias_encontradas || '').substring(0, 120),
          gaps_especificos: (req.gaps_especificos || '').substring(0, 100),
          observacoes_ia: (req.observacoes_ia || '').substring(0, 150),
          justificativa_relevancia: (req.justificativa_relevancia || '').substring(0, 80)
        }));
      }
      
      console.log('Parsed:', {
        resultado: analysisResult.resultado_geral,
        percentual: analysisResult.percentual_conformidade,
        requisitos: analysisResult.requisitos_analisados?.length || 0
      });
    } catch (e) {
      console.error('Parse error:', e);
      throw new Error('JSON inválido retornado pela IA');
    }

    // 6. Salvar resultado
    console.log('Saving assessment results...');
    const { error: updateError } = await supabase
      .from('gap_analysis_adherence_assessments')
      .update({
        status: 'concluido',
        resultado_geral: analysisResult.resultado_geral,
        percentual_conformidade: analysisResult.percentual_conformidade,
        pontos_fortes: analysisResult.pontos_fortes || [],
        pontos_melhoria: analysisResult.pontos_melhoria || [],
        recomendacoes: analysisResult.recomendacoes || [],
        analise_detalhada: analysisResult.analise_detalhada,
        metadados_analise: {
          modelo_usado: 'claude-sonnet-4-20250514',
          provider: 'anthropic',
          tempo_processamento: Date.now(),
          total_requisitos: requirements?.length || 0,
          total_requisitos_relevantes: analysisResult.total_requisitos_relevantes || 0,
          documento_tamanho: documentText.length,
          documento_tipo: analysisResult.documento_tipo_identificado || null,
          documento_escopo: analysisResult.documento_escopo_identificado || null,
          requisitos_nao_aplicaveis: analysisResult.requisitos_nao_aplicaveis || []
        },
        updated_at: new Date().toISOString()
      })
      .eq('id', assessmentId);

    if (updateError) {
      console.error('Error updating assessment:', updateError);
      throw updateError;
    }

    // 7. Salvar detalhes por requisito
    if (analysisResult.requisitos_analisados && analysisResult.requisitos_analisados.length > 0) {
      console.log('Saving requirement details...');
      const detailsToInsert = analysisResult.requisitos_analisados.map((req: any) => {
        const requirement = requirements?.find(r => r.id === req.requirement_id);
        return {
          assessment_id: assessmentId,
          requirement_id: req.requirement_id,
          requisito_codigo: requirement?.codigo || req.requisito_codigo || '',
          requisito_titulo: requirement?.titulo || '',
          status_aderencia: req.status_aderencia,
          evidencias_encontradas: req.evidencias_encontradas,
          gaps_especificos: req.gaps_especificos,
          score_conformidade: req.score_conformidade,
          observacoes_ia: req.observacoes_ia,
          justificativa_relevancia: req.justificativa_relevancia || null
        };
      });

      const { error: detailsError } = await supabase
        .from('gap_analysis_adherence_details')
        .insert(detailsToInsert);

      if (detailsError) {
        console.error('Error inserting details:', detailsError);
      } else {
        console.log(`Saved ${detailsToInsert.length} requirement details`);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: {
          assessmentId,
          resultado_geral: analysisResult.resultado_geral,
          percentual_conformidade: analysisResult.percentual_conformidade
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in analyze-document-adherence:', error);
    
    try {
      if (requestBody?.assessmentId) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);
        
        await supabase
          .from('gap_analysis_adherence_assessments')
          .update({
            status: 'erro',
            metadados_analise: { 
              erro: (error instanceof Error ? error.message : String(error)),
              timestamp_erro: new Date().toISOString()
            }
          })
          .eq('id', requestBody.assessmentId);
      }
    } catch (updateErr) {
      console.error('Failed to update assessment with error:', updateErr);
    }

    return new Response(
      JSON.stringify({ error: (error instanceof Error ? error.message : String(error)) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
