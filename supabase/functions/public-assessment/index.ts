import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3.23.8';

const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };
const tokenSchema = z.string().regex(/^[a-f0-9]{32}$/i);
const uuidSchema = z.string().uuid();
const saveSchema = z.object({
  action: z.literal('save'),
  token: tokenSchema,
  questionId: uuidSchema,
  field: z.enum(['resposta', 'pontuacao', 'evidencia', 'justificativa', 'arquivo_url']),
  value: z.union([z.string().max(20_000), z.number().finite()]).nullable(),
});
const requestSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('load'), token: tokenSchema }),
  saveSchema,
  z.object({
    action: z.literal('complete'),
    token: tokenSchema,
    responses: z.record(z.union([z.string().max(20_000), z.number().finite(), z.null()])),
  }),
]);

const respond = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: jsonHeaders });

const sanitizeFileName = (name: string) =>
  name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_').slice(-180);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return respond({ error: 'Método não permitido', code: 'METHOD_NOT_ALLOWED' }, 405);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) return respond({ error: 'Serviço indisponível', code: 'CONFIGURATION_ERROR' }, 503);

    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      const tokenResult = tokenSchema.safeParse(form.get('token'));
      const questionResult = uuidSchema.safeParse(form.get('questionId'));
      const file = form.get('file');
      if (!tokenResult.success || !questionResult.success || !(file instanceof File)) {
        return respond({ error: 'Dados de upload inválidos', code: 'INVALID_REQUEST' }, 400);
      }
      if (file.size === 0 || file.size > 10 * 1024 * 1024) {
        return respond({ error: 'O arquivo deve ter no máximo 10 MB', code: 'INVALID_FILE_SIZE' }, 400);
      }
      const allowedTypes = new Set([
        'application/pdf', 'image/jpeg', 'image/png',
        'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ]);
      if (!allowedTypes.has(file.type)) return respond({ error: 'Tipo de arquivo não permitido', code: 'INVALID_FILE_TYPE' }, 400);

      const assessment = await getAssessment(admin, tokenResult.data);
      if ('error' in assessment) return respond(assessment.error, assessment.status);
      if (assessment.data.status === 'concluido') return respond({ error: 'Questionário já concluído', code: 'COMPLETED' }, 409);

      const { data: question } = await admin.from('due_diligence_questions').select('id')
        .eq('id', questionResult.data).eq('template_id', assessment.data.template_id).maybeSingle();
      if (!question) return respond({ error: 'Pergunta inválida', code: 'INVALID_QUESTION' }, 400);

      const path = `${assessment.data.id}/${question.id}/${crypto.randomUUID()}-${sanitizeFileName(file.name)}`;
      const bytes = new Uint8Array(await file.arrayBuffer());
      const { error: uploadError } = await admin.storage.from('due-diligence-evidencias')
        .upload(path, bytes, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;

      const { error: responseError } = await admin.from('due_diligence_responses').upsert({
        assessment_id: assessment.data.id,
        question_id: question.id,
        arquivo_url: path,
        resposta_arquivo_nome: file.name.slice(0, 255),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'assessment_id,question_id' });
      if (responseError) {
        await admin.storage.from('due-diligence-evidencias').remove([path]);
        throw responseError;
      }

      const { data: signed } = await admin.storage.from('due-diligence-evidencias').createSignedUrl(path, 3600);
      return respond({ path, fileName: file.name, signedUrl: signed?.signedUrl || null });
    }

    const parsed = requestSchema.safeParse(await req.json());
    if (!parsed.success) return respond({ error: 'Requisição inválida', code: 'INVALID_REQUEST' }, 400);
    const input = parsed.data;
    const assessment = await getAssessment(admin, input.token);
    if ('error' in assessment) return respond(assessment.error, assessment.status);

    if (input.action === 'load') {
      const current = assessment.data;
      if (current.status === 'enviado') {
        await admin.from('due_diligence_assessments').update({
          status: 'em_andamento', data_inicio: new Date().toISOString(), updated_at: new Date().toISOString(),
        }).eq('id', current.id).eq('status', 'enviado');
        current.status = 'em_andamento';
      }

      const [{ data: company }, { data: template }, { data: questions, error: questionsError }, { data: responses, error: responsesError }] = await Promise.all([
        admin.from('empresas').select('nome,logo_url').eq('id', current.empresa_id).single(),
        admin.from('due_diligence_templates').select('nome,descricao').eq('id', current.template_id).single(),
        admin.from('due_diligence_questions').select('id,titulo,descricao,tipo,opcoes,obrigatoria,peso,ordem,secao,configuracoes').eq('template_id', current.template_id).order('ordem'),
        admin.from('due_diligence_responses').select('question_id,resposta,pontuacao,evidencia,justificativa,arquivo_url,resposta_arquivo_nome').eq('assessment_id', current.id),
      ]);
      if (questionsError || responsesError) throw questionsError || responsesError;

      const enrichedResponses = await Promise.all((responses || []).map(async (response) => {
        if (!response.arquivo_url) return { ...response, arquivo_signed_url: null };
        const storagePath = normalizeStoragePath(response.arquivo_url);
        const { data: signed } = await admin.storage.from('due-diligence-evidencias').createSignedUrl(storagePath, 3600);
        return { ...response, arquivo_url: storagePath, arquivo_signed_url: signed?.signedUrl || null };
      }));

      return respond({
        assessment: {
          id: current.id,
          fornecedor_nome: current.fornecedor_nome,
          status: current.status,
          data_envio: current.data_envio,
          data_limite: current.data_expiracao,
          data_conclusao: current.data_conclusao,
          empresa: { nome: company?.nome || 'Empresa', logo_url: company?.logo_url || null },
          template: { nome: template?.nome || 'Assessment', descricao: template?.descricao || null },
        },
        questions: questions || [],
        responses: enrichedResponses,
      });
    }

    if (assessment.data.status === 'concluido') return respond({ error: 'Questionário já concluído', code: 'COMPLETED' }, 409);

    if (input.action === 'save') {
      const { data: question } = await admin.from('due_diligence_questions').select('id,tipo')
        .eq('id', input.questionId).eq('template_id', assessment.data.template_id).maybeSingle();
      if (!question) return respond({ error: 'Pergunta inválida', code: 'INVALID_QUESTION' }, 400);
      if (input.field === 'pontuacao' && typeof input.value !== 'number') return respond({ error: 'Pontuação inválida', code: 'INVALID_VALUE' }, 400);

      const { error } = await admin.from('due_diligence_responses').upsert({
        assessment_id: assessment.data.id,
        question_id: question.id,
        [input.field]: input.value,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'assessment_id,question_id' });
      if (error) throw error;
      return respond({ success: true, savedAt: new Date().toISOString() });
    }

    const { data: questions, error: questionsError } = await admin.from('due_diligence_questions')
      .select('id,tipo,obrigatoria').eq('template_id', assessment.data.template_id);
    if (questionsError) throw questionsError;
    const questionMap = new Map((questions || []).map((question) => [question.id, question]));
    const grouped = new Map<string, Record<string, string | number | null>>();
    for (const [key, value] of Object.entries(input.responses)) {
      const match = key.match(/^([0-9a-f-]{36})(?:_(evidencia|justificativa|arquivo))?$/i);
      if (!match || !questionMap.has(match[1])) continue;
      const field = match[2] === 'evidencia' ? 'evidencia' : match[2] === 'justificativa' ? 'justificativa' : match[2] === 'arquivo' ? 'arquivo_url' : questionMap.get(match[1])?.tipo === 'numerico' ? 'pontuacao' : 'resposta';
      grouped.set(match[1], { ...(grouped.get(match[1]) || {}), [field]: value });
    }
    const missing = (questions || []).filter((q) => q.obrigatoria && !isAnswered(grouped.get(q.id), q.tipo));
    if (missing.length > 0) return respond({ error: `Existem ${missing.length} pergunta(s) obrigatória(s) sem resposta`, code: 'MISSING_REQUIRED' }, 400);

    for (const [questionId, values] of grouped) {
      const { error } = await admin.from('due_diligence_responses').upsert({
        assessment_id: assessment.data.id, question_id: questionId, ...values, updated_at: new Date().toISOString(),
      }, { onConflict: 'assessment_id,question_id' });
      if (error) throw error;
    }
    const completedAt = new Date().toISOString();
    const { error: completeError } = await admin.from('due_diligence_assessments').update({
      status: 'concluido', data_conclusao: completedAt, updated_at: completedAt,
    }).eq('id', assessment.data.id).in('status', ['enviado', 'em_andamento']);
    if (completeError) throw completeError;

    const { error: scoreError } = await admin.rpc('calculate_due_diligence_score', { assessment_id_param: assessment.data.id });
    if (scoreError) console.warn('[public-assessment] score calculation deferred', scoreError.message);

    /*
      Terminado o questionário, o Akuris lê-o.

      Antes ficava só o número. Agora pede-se o parecer à IA aqui, no momento em
      que o material está completo -- assim quem abre a avaliação já a encontra
      lida, em vez de ter de mandar avaliar.

      A falha NÃO derruba a submissão: o fornecedor já cumpriu a sua parte, e
      seria absurdo devolver-lhe um erro porque a nossa análise não correu. Fica
      registada, e o ecrã interno mostra um botão para reavaliar.
    */
    const { error: erroParecer } = await admin.functions.invoke('avaliar-fornecedor-ia', {
      body: { assessment_id: assessment.data.id },
      headers: { Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}` },
    });
    if (erroParecer) {
      console.warn('[public-assessment] parecer da IA adiado', erroParecer.message ?? String(erroParecer));
    }

    return respond({
      success: true,
      completedAt,
      scoreCalculated: !scoreError,
      parecerGerado: !erroParecer,
    });
  } catch (error) {
    console.error('[public-assessment] request failed', error instanceof Error ? error.message : String(error));
    return respond({ error: 'Não foi possível processar o questionário', code: 'INTERNAL_ERROR' }, 500);
  }
});

async function getAssessment(admin: ReturnType<typeof createClient>, token: string) {
  const { data, error } = await admin.from('due_diligence_assessments')
    .select('id,empresa_id,template_id,fornecedor_nome,status,data_envio,data_inicio,data_conclusao,data_expiracao')
    .eq('link_token', token).maybeSingle();
  if (error) throw error;
  if (!data) return { error: { error: 'Link inválido', code: 'NOT_FOUND' }, status: 404 } as const;
  if (data.data_expiracao && new Date(data.data_expiracao).getTime() < Date.now() && data.status !== 'concluido') {
    return { error: { error: 'Este link expirou', code: 'EXPIRED' }, status: 410 } as const;
  }
  if (!['enviado', 'em_andamento', 'concluido'].includes(data.status)) {
    return { error: { error: 'Questionário indisponível', code: 'UNAVAILABLE' }, status: 403 } as const;
  }
  return { data } as const;
}

function normalizeStoragePath(value: string) {
  const marker = '/due-diligence-evidencias/';
  const markerIndex = value.indexOf(marker);
  return markerIndex >= 0 ? decodeURIComponent(value.slice(markerIndex + marker.length).split('?')[0]) : value;
}

function isAnswered(values: Record<string, string | number | null> | undefined, type: string) {
  if (!values) return false;
  const value = type === 'numerico' ? values.pontuacao : values.resposta;
  return value !== undefined && value !== null && String(value).trim() !== '';
}