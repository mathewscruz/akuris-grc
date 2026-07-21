import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ConversationContext {
  user_name?: string;
  empresa_nome?: string;
  tipo_documento_identificado?: string;
  informacoes_coletadas?: Record<string, any>;
  template_sugerido?: any;
  etapa_atual?: string;
}

// Funções auxiliares para extração inteligente
function extractDocumentType(messageText: string): string | null {
  if (messageText.includes('política') || messageText.includes('politica')) return 'politica';
  if (messageText.includes('procedimento')) return 'procedimento';
  if (messageText.includes('norma')) return 'norma';
  if (messageText.includes('manual')) return 'manual';
  if (messageText.includes('código') || messageText.includes('codigo')) return 'codigo';
  return null;
}

function extractDocumentName(messageText: string): string | null {
  const patterns = [
    /política de ([^\n\.,]+)/i,
    /procedimento de ([^\n\.,]+)/i,
    /norma de ([^\n\.,]+)/i,
    /manual de ([^\n\.,]+)/i,
    /código de ([^\n\.,]+)/i
  ];
  
  for (const pattern of patterns) {
    const match = messageText.match(pattern);
    if (match) {
      return match[0].trim();
    }
  }
  return null;
}

function extractFrameworks(messageText: string): string[] {
  const frameworks = [];
  if (messageText.includes('iso 27001') || messageText.includes('iso27001')) frameworks.push('ISO 27001');
  if (messageText.includes('lgpd')) frameworks.push('LGPD');
  if (messageText.includes('coso')) frameworks.push('COSO');
  if (messageText.includes('itil')) frameworks.push('ITIL');
  if (messageText.includes('sox')) frameworks.push('SOX');
  return frameworks;
}

// Chama a IA via gateway do Lovable (OpenAI-compatível), igual às demais
// funções do projeto. Antes usava a API da Anthropic direto com um modelo
// que retornava 404 nesta conta.
async function callClaude(messages: { role: string; content: string }[], systemPrompt: string, apiKey: string, maxTokens = 2000, temperature = 0.8) {
  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-3-flash-preview',
      max_tokens: maxTokens,
      temperature,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.filter(m => m.role !== 'system').map(m => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content,
        })),
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('AI gateway error:', response.status, errorText);
    if (response.status === 429) throw new Error('Limite de requisições excedido. Tente novamente em alguns minutos.');
    if (response.status === 402) throw new Error('Créditos de IA insuficientes.');
    throw new Error(`Erro na IA (${response.status})`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

// Fetch non-compliant gaps for the framework
async function fetchFrameworkGaps(supabase: any, frameworkId: string, empresaId: string): Promise<string> {
  try {
    const { data: evals } = await supabase
      .from('gap_analysis_evaluations')
      .select('requirement_id, conformity_status')
      .eq('framework_id', frameworkId)
      .eq('empresa_id', empresaId)
      .in('conformity_status', ['nao_conforme', 'parcialmente_conforme']);

    if (!evals || evals.length === 0) return '';

    const reqIds = evals.map((e: any) => e.requirement_id);
    const { data: reqs } = await supabase
      .from('gap_analysis_requirements')
      .select('codigo, titulo, categoria')
      .in('id', reqIds);

    if (!reqs || reqs.length === 0) return '';

    const gapLines = reqs.map((r: any) => {
      const ev = evals.find((e: any) => e.requirement_id === r.id);
      const status = ev?.conformity_status === 'nao_conforme' ? 'Não Conforme' : 'Parcialmente Conforme';
      return `- [${r.codigo || 'S/C'}] ${r.titulo} (${r.categoria || 'Geral'}) — ${status}`;
    });

    return `\n\nGAPS IDENTIFICADOS NO FRAMEWORK (${gapLines.length} itens não conformes/parciais):\n${gapLines.join('\n')}`;
  } catch (error) {
    console.error('Error fetching framework gaps:', error);
    return '';
  }
}

// Busca TODOS os requisitos catalogados do(s) framework(s), com o que cada um
// exige (descrição/orientação) e o status de conformidade da empresa. Assim a IA
// pode identificar os requisitos relevantes ao tema do documento e garantir que
// o documento cumpra o que o framework pede. Genérico para qualquer framework.
async function fetchFrameworkRequirements(supabase: any, frameworkIds: string[], empresaId: string): Promise<string> {
  try {
    const ids = (frameworkIds || []).filter(Boolean);
    if (!ids.length) return '';

    const { data: reqs } = await supabase
      .from('gap_analysis_requirements')
      .select('id, codigo, titulo, descricao, orientacao_implementacao, categoria')
      .in('framework_id', ids)
      .order('ordem', { ascending: true })
      .limit(600);
    if (!reqs || reqs.length === 0) return '';

    // Status de conformidade da empresa, para marcar os gaps (prioridade).
    const { data: evals } = await supabase
      .from('gap_analysis_evaluations')
      .select('requirement_id, conformity_status')
      .in('framework_id', ids)
      .eq('empresa_id', empresaId)
      .limit(5000);
    const statusById = new Map<string, string>();
    (evals || []).forEach((e: any) => statusById.set(e.requirement_id, e.conformity_status));

    const trunc = (s: string | null, n: number) => (s && s.length > n ? `${s.slice(0, n)}…` : (s || ''));
    const lines = reqs.map((r: any) => {
      const st = statusById.get(r.id);
      const gapTag = st === 'nao_conforme' ? ' [GAP: NÃO CONFORME]'
        : st === 'parcialmente_conforme' ? ' [GAP: PARCIAL]' : '';
      const exige = [
        r.descricao && `O que exige: ${trunc(r.descricao, 320)}`,
        r.orientacao_implementacao && `Como cumprir: ${trunc(r.orientacao_implementacao, 320)}`,
      ].filter(Boolean).join(' | ');
      return `- [${r.codigo || 'S/C'}] ${r.titulo}${r.categoria ? ` (${r.categoria})` : ''}${gapTag}${exige ? `\n    ${exige}` : ''}`;
    });

    return lines.join('\n');
  } catch (error) {
    console.error('Error fetching framework requirements:', error);
    return '';
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!LOVABLE_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing required environment variables');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let { 
      message, 
      conversation_id, 
      user_id, 
      empresa_id,
      action = 'chat',
      doc_type_hint,
      framework_context,
      company_context: company_context_input,
      // Onda 3
      document,            // documento gerado completo (para refine_section / quick_adherence)
      section_index,       // índice da seção a refinar
      instruction,         // instrução do usuário para refinar a seção
    } = await req.json();

    console.log('DocGen Chat request:', { message, conversation_id, action, user_id, empresa_id, framework_context });

    // ============ ACTION: load_company_context (sem custo de IA) ============
    if (action === 'load_company_context') {
      // === AUTH: validate JWT and derive empresa_id from caller's profile ===
      const authHeader = req.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const verifier = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY') || SUPABASE_SERVICE_ROLE_KEY);
      const { data: userData, error: userErr } = await verifier.auth.getUser(authHeader.replace('Bearer ', ''));
      if (userErr || !userData?.user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const { data: callerProfile } = await supabase
        .from('profiles').select('empresa_id, role').eq('user_id', userData.user.id).maybeSingle();
      // Override body empresa_id with the authenticated user's empresa (super_admin can pass any).
      const effectiveEmpresaId = callerProfile?.role === 'super_admin'
        ? (empresa_id ?? callerProfile?.empresa_id)
        : callerProfile?.empresa_id;
      if (!effectiveEmpresaId) {
        return new Response(JSON.stringify({ error: 'empresa_id required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      // Reassign for downstream queries below
      // eslint-disable-next-line no-var
      var empresa_id_resolved = effectiveEmpresaId;

      const [empresaRes, ativosRes, riscosRes, frameworksRes] = await Promise.all([
        supabase
          .from('empresas')
          .select('nome, cnpj, setor_atuacao, porte_empresa, objetivo_compliance, data_alvo_certificacao')
          .eq('id', empresa_id_resolved)
          .maybeSingle(),
        supabase
          .from('ativos')
          .select('nome, tipo, criticidade, proprietario')
          .eq('empresa_id', empresa_id_resolved)
          .in('criticidade', ['critica', 'alta', 'crítica'])
          .limit(8),
        supabase
          .from('riscos')
          .select('nome, nivel_risco_residual, status, categoria_id')
          .eq('empresa_id', empresa_id_resolved)
          .in('nivel_risco_residual', ['critico', 'alto', 'crítico'])
          .limit(8),
        supabase
          .from('gap_analysis_assessments')
          .select('framework_id, percentual_conclusao, status, gap_analysis_frameworks(nome, versao)')
          .eq('empresa_id', empresa_id_resolved)
          .order('updated_at', { ascending: false })
          .limit(10),
      ]);

      const company_context = {
        empresa: empresaRes.data || null,
        ativos_criticos: (ativosRes.data || []).map((a: any) => ({
          nome: a.nome, tipo: a.tipo, criticidade: a.criticidade, proprietario: a.proprietario,
        })),
        riscos_altos: (riscosRes.data || []).map((r: any) => ({
          nome: r.nome, nivel: r.nivel_risco_residual, status: r.status,
        })),
        frameworks: (frameworksRes.data || []).map((f: any) => ({
          framework_id: f.framework_id,
          nome: f.gap_analysis_frameworks?.nome,
          versao: f.gap_analysis_frameworks?.versao,
          score: f.percentual_conclusao,
          status: f.status,
        })).filter((f: any) => f.nome),
      };

      return new Response(JSON.stringify({ company_context }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ============ AUTH guard for all other actions ============
    // Trust only the JWT — never the empresa_id/user_id from the request body.
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const verifier = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY') || SUPABASE_SERVICE_ROLE_KEY);
    const { data: authUserData, error: authUserErr } = await verifier.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authUserErr || !authUserData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const authedUserId = authUserData.user.id;
    const { data: callerProfile } = await supabase
      .from('profiles').select('empresa_id, role').eq('user_id', authedUserId).maybeSingle();
    const authedEmpresaId = callerProfile?.role === 'super_admin'
      ? (empresa_id ?? callerProfile?.empresa_id)
      : callerProfile?.empresa_id;
    if (!authedEmpresaId) {
      return new Response(JSON.stringify({ error: 'Forbidden: empresa not found' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    // Override body-supplied values with authenticated values (nunca confiar no body)
    user_id = authedUserId;
    empresa_id = authedEmpresaId;

    // Consume AI credit before processing
    {
      const { data: creditResult } = await supabase.rpc('consume_ai_credit', {
        p_empresa_id: authedEmpresaId,
        p_user_id: authedUserId,
        p_funcionalidade: `docgen-chat:${action}`,
        p_descricao: `DocGen - ${action === 'generate_document' ? 'Geração de documento' : 'Chat conversacional'}`
      });

      if (creditResult === false) {
        return new Response(JSON.stringify({ error: 'CREDITS_EXHAUSTED' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Buscar informações do usuário e empresa
    const { data: profile } = await supabase
      .from('profiles')
      .select('nome')
      .eq('user_id', user_id)
      .single();

    const { data: empresa } = await supabase
      .from('empresas')
      .select('nome')
      .eq('id', empresa_id)
      .single();

    // Fetch framework gaps if context provided
    let frameworkGapsText = '';
    if (framework_context?.framework_id && empresa_id) {
      frameworkGapsText = await fetchFrameworkGaps(supabase, framework_context.framework_id, empresa_id);
    }

    // Buscar ou criar conversa — SEMPRE filtrar por empresa_id + user_id (cross-tenant guard)
    let conversation;
    if (conversation_id) {
      const { data } = await supabase
        .from('docgen_conversations')
        .select('*')
        .eq('id', conversation_id)
        .eq('empresa_id', authedEmpresaId)
        .eq('user_id', authedUserId)
        .maybeSingle();
      if (!data) {
        return new Response(JSON.stringify({ error: 'Conversation not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      conversation = data;
    }

    if (!conversation) {
      const { data: newConversation } = await supabase
        .from('docgen_conversations')
        .insert({
          empresa_id,
          user_id,
          titulo: framework_context?.framework_name 
            ? `DocGen — ${framework_context.framework_name}` 
            : 'Nova Conversa DocGen',
          mensagens: [],
          contexto: {
            user_name: profile?.nome || 'Usuário',
            empresa_nome: empresa?.nome || 'Empresa',
            etapa_atual: 'inicio',
            ...(framework_context && { framework_context })
          }
        })
        .select()
        .single();
      conversation = newConversation;
    }

    const context: ConversationContext = conversation?.contexto || {};
    const messages: ChatMessage[] = conversation?.mensagens || [];

    if (action === 'chat') {
      messages.push({ role: 'user', content: message });

      const { data: templates } = await supabase
        .from('docgen_templates')
        .select('*')
        .or(`empresa_id.eq.${empresa_id},is_system.eq.true`);

      let learningPatterns = [];
      try {
        const { data: patterns } = await supabase
          .from('docgen_learning_patterns')
          .select('*')
          .eq('empresa_id', empresa_id)
          .eq('tipo_documento', context.tipo_documento_identificado || 'geral')
          .order('taxa_sucesso', { ascending: false })
          .limit(5);
        learningPatterns = patterns || [];
      } catch (error) {
        console.log('Learning patterns not available:', error);
      }

      const frameworkSection = framework_context?.framework_name
        ? `\nCONTEXTO DO FRAMEWORK: O usuário está trabalhando com o framework "${framework_context.framework_name}". O documento gerado deve estar alinhado a este framework e endereçar os gaps identificados.${frameworkGapsText}`
        : '';

      // ========== Contexto automático da empresa (Onda 2) ==========
      const cc: any = company_context_input || (context as any).company_context || null;
      let companyContextSection = '';
      if (cc) {
        const emp = cc.empresa || {};
        const fmt = (arr: any[], render: (x: any) => string, max = 5) =>
          (arr || []).slice(0, max).map(render).join('\n');
        companyContextSection = `

CONTEXTO REAL DA EMPRESA (use estes dados para personalizar o documento — NÃO peça ao usuário informações já presentes aqui):
- Razão social: ${emp.nome || 'N/A'}
- CNPJ: ${emp.cnpj || 'N/A'}
- Setor: ${emp.setor_atuacao || 'N/A'}
- Porte: ${emp.porte_empresa || 'N/A'}
- Objetivo de compliance: ${emp.objetivo_compliance || 'N/A'}
${cc.frameworks?.length ? `\nFrameworks ativos da empresa:\n${fmt(cc.frameworks, (f: any) => `- ${f.nome}${f.versao ? ' ' + f.versao : ''} (score ${Number(f.score || 0)}%, ${f.status || 'em andamento'})`)}` : ''}
${cc.ativos_criticos?.length ? `\nAtivos críticos (top ${Math.min(cc.ativos_criticos.length, 5)}):\n${fmt(cc.ativos_criticos, (a: any) => `- ${a.nome} (${a.tipo || 'ativo'}, criticidade ${a.criticidade})`)}` : ''}
${cc.riscos_altos?.length ? `\nRiscos altos/críticos (top ${Math.min(cc.riscos_altos.length, 5)}):\n${fmt(cc.riscos_altos, (r: any) => `- ${r.nome} (nível ${r.nivel}, ${r.status || ''})`)}` : ''}`;
      }

      const systemPrompt = `Você é DocGen, um especialista em documentação corporativa altamente qualificado, com amplo conhecimento em frameworks de compliance, regulamentações e melhores práticas empresariais.

CONTEXTO DA CONVERSA:
- Empresa: ${context.empresa_nome}
- Usuário: ${context.user_name}
- Documento solicitado: ${doc_type_hint || 'documento corporativo'}
${frameworkSection}${companyContextSection}

SEU OBJETIVO:
Ajudar o usuário a criar documentos corporativos de alta qualidade, fazendo perguntas inteligentes e específicas para coletar informações precisas.${framework_context?.framework_name ? ` O documento deve endereçar os gaps de conformidade do framework ${framework_context.framework_name}.` : ''}

INSTRUÇÕES DE COMUNICAÇÃO:
1. **Seja conversacional e profissional** - Use um tom amigável mas competente
2. **Faça perguntas específicas** - NO MÁXIMO 4-6 perguntas por vez, mas seja muito específico
3. **Formate sua resposta claramente** - Use listas numeradas, negrito, e estrutura organizada
4. **Demonstre conhecimento** - Mencione frameworks relevantes (ISO 27001, LGPD, COSO, etc.)
5. **Seja prático** - Foque em informações que realmente impactam o documento final

TIPOS DE DOCUMENTOS ESPECIALIZADOS:
**Políticas Corporativas:** Segurança da Informação, Senhas, Mesa Limpa, LGPD, Código de Ética
**Procedimentos Operacionais:** Backup, Gestão de Incidentes, Controle de Acesso, Gestão de Mudanças
**Documentos de Compliance:** Plano de Continuidade, Análise de Impacto (BIA), ROPA, Matriz de Riscos

REGRAS PARA IDENTIFICAR QUANDO GERAR DOCUMENTO:
- O usuário respondeu pelo menos 3-4 rodadas de perguntas específicas
- Você coletou informações sobre: objetivo, escopo, responsabilidades, e procedimentos básicos
- O usuário demonstra que tem as informações necessárias

QUANDO ESTIVER PRONTO PARA GERAR O DOCUMENTO:
Você SÓ deve sinalizar prontidão quando tiver coletado, no MÍNIMO:
- Tipo e nome exato do documento
- Objetivo claro
- Escopo (a quem se aplica)
- Responsabilidades principais
- Pelo menos 2 diretrizes/procedimentos específicos do contexto da empresa

Quando — e SOMENTE quando — todas essas condições estiverem satisfeitas, finalize sua mensagem com uma frase de confirmação ("Tenho todas as informações necessárias para gerar a [NOME DO DOCUMENTO]...") e termine a mensagem com o marcador EXATO em uma linha separada:

[DOCGEN_READY]

Esse marcador é OBRIGATÓRIO para liberar a geração. Nunca o emita antes de coletar todos os itens acima. Nunca o use em respostas que ainda contenham perguntas pendentes.

IMPORTANTE: Sempre responda em português brasileiro. Responda SOMENTE com uma mensagem limpa e formatada. NÃO inclua JSON visível ou metadados técnicos (exceto o marcador [DOCGEN_READY] quando aplicável).`;

      // Call Claude for chat
      const aiMessage = await callClaude(
        messages.slice(-15),
        systemPrompt,
        LOVABLE_API_KEY,
        2000,
        0.8
      );

      console.log('AI Response length:', aiMessage.length);

      // Detecta marcador explícito [DOCGEN_READY] emitido pelo modelo quando coletou tudo.
      // Mantém heurística antiga apenas como fallback de robustez (mensagem deve conter
      // múltiplos sinais simultaneamente para evitar falso-positivo).
      const hasExplicitReady = /\[DOCGEN_READY\]/i.test(aiMessage);

      // Remove o marcador e blocos json antes de devolver ao frontend
      const cleanMessage = aiMessage
        .replace(/\[DOCGEN_READY\]/gi, '')
        .replace(/```json[\s\S]*?```/g, '')
        .replace(/```[\s\S]*?```/g, (block) => block)
        .trim() || aiMessage.trim();

      const messageText = cleanMessage.toLowerCase();
      // Fallback exige 2 sinais distintos para reduzir falso-positivo
      const fallbackSignals = [
        messageText.includes('tenho todas as informações'),
        messageText.includes('posso gerar') && messageText.includes('clique'),
        messageText.includes('documento está pronto'),
      ].filter(Boolean).length;
      const isDocumentReady = hasExplicitReady || fallbackSignals >= 1;

      const parsedResponse: any = {
        message: cleanMessage,
        tipo_documento_identificado:
          extractDocumentType(messageText) || context.tipo_documento_identificado,
        documento_nome_identificado:
          extractDocumentName(messageText) || (context as any).documento_nome_identificado,
        frameworks_relacionados:
          extractFrameworks(messageText) || (context as any).frameworks_relacionados,
        etapa_atual: isDocumentReady ? 'pronto' : (context.etapa_atual || 'coleta'),
        documento_pronto: isDocumentReady,
        termos_com_tooltip: [],
        informacoes_necessarias: [],
      };

      messages.push({ role: 'assistant', content: parsedResponse.message });

      const updatedContext = {
        ...context,
        tipo_documento_identificado: parsedResponse.tipo_documento_identificado || 
                                    extractDocumentType(messageText) || 
                                    context.tipo_documento_identificado,
        documento_nome_identificado: parsedResponse.documento_nome_identificado || 
                                    extractDocumentName(messageText) || 
                                    (context as any).documento_nome_identificado,
        frameworks_relacionados: parsedResponse.frameworks_relacionados || 
                                extractFrameworks(messageText) || 
                                (context as any).frameworks_relacionados,
        etapa_atual: isDocumentReady ? 'pronto' : (parsedResponse.etapa_atual || 'coleta'),
        informacoes_coletadas: {
          ...context.informacoes_coletadas,
          ...(parsedResponse.informacoes_coletadas || {})
        },
        company_context: cc || (context as any).company_context || null,
      };

      try {
        if (parsedResponse.tipo_documento_identificado && parsedResponse.message) {
          await supabase
            .from('docgen_learning_patterns')
            .upsert({
              empresa_id,
              tipo_documento: parsedResponse.tipo_documento_identificado,
              pergunta_padrao: parsedResponse.message.substring(0, 200),
              contexto_aplicacao: {
                etapa: parsedResponse.etapa_atual,
                frameworks_mencionados: parsedResponse.frameworks_relacionados || [],
                user_input_context: message.substring(0, 100)
              },
              numero_usos: 1
            }, {
              onConflict: 'empresa_id,tipo_documento,pergunta_padrao',
              ignoreDuplicates: false
            });
        }
      } catch (learningError) {
        console.log('Learning data collection failed:', learningError);
      }

      await supabase
        .from('docgen_conversations')
        .update({
          mensagens: messages,
          contexto: updatedContext,
          tipo_documento_identificado: parsedResponse.tipo_documento_identificado,
          updated_at: new Date().toISOString()
        })
        .eq('id', conversation.id);

      return new Response(JSON.stringify({
        conversation_id: conversation.id,
        message: parsedResponse.message,
        tipo_documento_identificado: updatedContext.tipo_documento_identificado,
        documento_nome_identificado: updatedContext.documento_nome_identificado || null,
        termos_com_tooltip: parsedResponse.termos_com_tooltip || [],
        etapa_atual: updatedContext.etapa_atual,
        documento_pronto: isDocumentReady,
        informacoes_necessarias: parsedResponse.informacoes_necessarias || []
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else if (action === 'generate_document') {
      const { data: templates } = await supabase
        .from('docgen_templates')
        .select('*')
        .or(`empresa_id.eq.${empresa_id},is_system.eq.true`);

      const hintName = (doc_type_hint || (context as any).documento_nome_identificado || '').toLowerCase();
      let template = templates?.find(t => (t.nome || '').toLowerCase() === hintName)
        || templates?.find(t => hintName && (t.nome || '').toLowerCase().includes(hintName))
        || templates?.find(t => t.tipo_documento === context.tipo_documento_identificado);
      
      if (!template) {
        const docType = context.tipo_documento_identificado || 'politica';
        if (docType === 'politica' || hintName.includes('política') || hintName.includes('politica')) {
          template = templates?.find(t => t.tipo_documento === 'politica') || templates?.[0];
        } else if (docType === 'procedimento' || hintName.includes('procedimento')) {
          template = templates?.find(t => t.tipo_documento === 'procedimento') || templates?.[0];
        } else {
          template = templates?.[0];
        }
      }
      
      if (!template) {
        throw new Error('Nenhum template disponível no sistema');
      }

      let templateEstrutura: any = template.estrutura;
      try {
        if (typeof templateEstrutura === 'string') {
          templateEstrutura = JSON.parse(templateEstrutura);
        }
      } catch (_e) {}

      const frameworkGapsSection = frameworkGapsText
        ? `\n\nIMPORTANTE — O documento deve endereçar os seguintes gaps de conformidade identificados no framework "${framework_context?.framework_name}":\n${frameworkGapsText}\n\nInclua seções, controles ou procedimentos específicos que resolvam cada gap listado.`
        : '';

      // Busca TODOS os requisitos do(s) framework(s) para o documento cobrir o que
      // o framework pede sobre o tema (não só os gaps).
      const docFwIds: string[] = (framework_context?.framework_ids?.length
        ? framework_context.framework_ids
        : (framework_context?.framework_id ? [framework_context.framework_id] : [])) as string[];
      const docNome = (context as any).documento_nome_identificado || doc_type_hint || context.tipo_documento_identificado;
      let frameworkRequirementsText = '';
      if (docFwIds.length && empresa_id) {
        frameworkRequirementsText = await fetchFrameworkRequirements(supabase, docFwIds, empresa_id);
      }
      const frameworkRequirementsSection = frameworkRequirementsText
        ? `\n\n=== REQUISITOS DO(S) FRAMEWORK(S) — COBERTURA OBRIGATÓRIA ===
Abaixo estão os requisitos catalogados do(s) framework(s). Antes de escrever o documento:
1) Identifique quais requisitos tratam do TEMA deste documento ("${docNome}").
2) Garanta que o documento CUMPRA EXPLICITAMENTE cada requisito relevante — incorpore o que ele exige (descrição/orientação) nas seções apropriadas, com regras concretas e acionáveis.
3) Cite o código do requisito entre colchetes onde ele é endereçado (ex.: "[A.8.13]").
4) Priorize os requisitos marcados como GAP.
5) Não invente requisitos fora desta lista.

${frameworkRequirementsText}`
        : '';

      const documentPrompt = `Gere um documento COMPLETO e ESPECÍFICO do tipo solicitado.

DOCUMENTO_EXATO: ${docNome}
FRAMEWORKS_REQUERIDOS: ${JSON.stringify((context as any).frameworks_relacionados || (framework_context ? [framework_context.framework_name] : []))}
EMPRESA: ${context.empresa_nome}
${frameworkRequirementsSection || frameworkGapsSection}

Use a estrutura do template abaixo e cubra explicitamente os requisitos do(s) framework(s) citado(s) quando aplicável.

TEMPLATE: ${JSON.stringify(templateEstrutura || template.estrutura)}
INFORMAÇÕES COLETADAS: ${JSON.stringify(context.informacoes_coletadas)}

Requisitos obrigatórios de formatação:
- Capa com título igual a DOCUMENTO_EXATO, versão 1.0, data atual e nome da empresa
- Sumário
- Todas as seções definidas no template
- Conteúdo detalhado e profissional alinhado aos frameworks
- Rodapé com informações da empresa

Responda APENAS com um JSON na seguinte estrutura:
{
  "titulo": "título do documento (igual a DOCUMENTO_EXATO)",
  "versao": "1.0",
  "data_criacao": "YYYY-MM-DD",
  "secoes": [
    { "nome": "Objetivo", "conteudo": "..." }
  ],
  "metadados": {
    "classificacao": "Interno",
    "responsavel_elaboracao": "${context.user_name}",
    "responsavel_aprovacao": "",
    "frequencia_revisao": "Anual"
  }
}`;

      const docContent = await callClaude(
        [{ role: 'user', content: 'Gere o documento agora.' }],
        documentPrompt,
        LOVABLE_API_KEY,
        16000,
        0.4
      );

      let documentContent;
      try {
        const cleaned = docContent.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
        documentContent = JSON.parse(cleaned);
      } catch (_e) {
        documentContent = {
          titulo: `Documento ${context.tipo_documento_identificado || ''}`.trim(),
          versao: '1.0',
          data_criacao: new Date().toISOString().slice(0, 10),
          secoes: [
            { nome: 'Conteúdo', conteudo: String(docContent || '') }
          ],
          metadados: {
            classificacao: 'Interno',
            responsavel_elaboracao: context.user_name,
            responsavel_aprovacao: '',
            frequencia_revisao: 'Anual'
          }
        };
      }

      // A IA não conhece a data atual (chuta valores errados). Sempre sobrescrever
      // com a data do servidor para a capa/versão do documento ficar correta.
      if (documentContent && typeof documentContent === 'object') {
        documentContent.data_criacao = new Date().toISOString().slice(0, 10);
      }

      try {
        await supabase
          .from('docgen_feedback_implicit')
          .insert({
            empresa_id,
            conversation_id: conversation.id,
            documento_salvo: true,
            qualidade_estimada: 8,
            padroes_identificados: {
              tipo_documento: context.tipo_documento_identificado,
              secoes_geradas: documentContent.secoes?.length || 0,
              frameworks_utilizados: context.informacoes_coletadas?.frameworks || []
            }
          });
      } catch (feedbackError) {
        console.log('Feedback collection failed:', feedbackError);
      }

      const { data: generatedDoc } = await supabase
        .from('docgen_generated_docs')
        .insert({
          empresa_id,
          conversation_id: conversation.id,
          template_id: template.id,
          nome: documentContent.titulo,
          tipo_documento: context.tipo_documento_identificado,
          conteudo: documentContent,
          created_by: user_id
        })
        .select()
        .single();

      return new Response(JSON.stringify({
        document_id: generatedDoc.id,
        document: documentContent
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ============ ACTION: refine_section (Onda 3 - 1 crédito já consumido acima) ============
    if (action === 'refine_section') {
      if (!document || typeof section_index !== 'number' || !instruction) {
        return new Response(JSON.stringify({ error: 'document, section_index e instruction são obrigatórios' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const secoes = document.secoes || [];
      const target = secoes[section_index];
      if (!target) {
        return new Response(JSON.stringify({ error: 'Seção não encontrada' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const sysPrompt = `Você é um editor sênior de documentos corporativos. Refine APENAS a seção indicada, mantendo o tom, a estrutura geral do documento e a coerência com as demais seções. Responda SOMENTE com o novo conteúdo da seção em texto corrido, sem títulos, sem markdown de cabeçalho, sem JSON.`;
      const userPrompt = `DOCUMENTO: ${document.titulo}
EMPRESA: ${context.empresa_nome}
${framework_context?.framework_name ? `FRAMEWORK: ${framework_context.framework_name}\n` : ''}
SEÇÃO ATUAL ("${target.nome}"):
${target.conteudo}

OUTRAS SEÇÕES (apenas títulos para contexto):
${secoes.map((s: any, i: number) => `${i + 1}. ${s.nome}`).join('\n')}

INSTRUÇÃO DO USUÁRIO:
${instruction}

Reescreva o conteúdo da seção atendendo à instrução.`;

      const newContent = await callClaude(
        [{ role: 'user', content: userPrompt }],
        sysPrompt,
        LOVABLE_API_KEY,
        2500,
        0.5
      );

      const updatedSecoes = secoes.map((s: any, i: number) =>
        i === section_index ? { ...s, conteudo: newContent.trim() } : s
      );

      return new Response(JSON.stringify({
        section_index,
        new_content: newContent.trim(),
        document: { ...document, secoes: updatedSecoes },
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ============ ACTION: quick_adherence (Onda 3) ============
    if (action === 'quick_adherence') {
      if (!document || !framework_context?.framework_id) {
        return new Response(JSON.stringify({ error: 'document e framework_context.framework_id são obrigatórios' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: reqs } = await supabase
        .from('gap_analysis_requirements')
        .select('codigo, titulo, categoria')
        .eq('framework_id', framework_context.framework_id)
        .limit(80);

      if (!reqs || reqs.length === 0) {
        return new Response(JSON.stringify({ error: 'Framework sem requisitos cadastrados' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const secoes = document.secoes || [];
      const docDigest = secoes.map((s: any, i: number) =>
        `### Seção ${i + 1}: ${s.nome}\n${(s.conteudo || '').slice(0, 1500)}`
      ).join('\n\n');

      const reqList = reqs.map((r: any) => `- [${r.codigo || 'S/C'}] ${r.titulo}`).join('\n');

      const sysPrompt = `Você é um auditor de compliance. Avalie a aderência de um documento corporativo aos requisitos de um framework. Seja rigoroso e factual. Responda APENAS com JSON válido, sem markdown.`;
      const userPrompt = `FRAMEWORK: ${framework_context.framework_name}
REQUISITOS (${reqs.length}):
${reqList}

DOCUMENTO "${document.titulo}":
${docDigest}

Avalie e responda EXATAMENTE neste JSON:
{
  "score": 0-100,
  "resumo": "1-2 frases sobre aderência geral",
  "secoes": [
    { "section_index": 0, "section_name": "...", "status": "forte|parcial|fraco|ausente", "requisitos_cobertos": ["código", ...], "gaps": ["o que está faltando"] }
  ],
  "requisitos_nao_cobertos": ["códigos dos requisitos não endereçados em nenhuma seção"]
}`;

      const raw = await callClaude(
        [{ role: 'user', content: userPrompt }],
        sysPrompt,
        LOVABLE_API_KEY,
        3500,
        0.3
      );

      let parsed: any;
      try {
        parsed = JSON.parse(raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim());
      } catch {
        parsed = { score: 0, resumo: 'Não foi possível avaliar.', secoes: [], requisitos_nao_cobertos: [] };
      }

      return new Response(JSON.stringify({ adherence: parsed }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Action not supported' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in docgen-chat function:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? (error instanceof Error ? error.message : String(error)) : 'Internal server error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
