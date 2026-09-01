/**
 * Lê o questionário que o fornecedor devolveu e dá um parecer.
 *
 * ## Porque isto existe
 *
 * Ao terminar o questionário, o produto calculava um número — média ponderada
 * das notas — e parava aí. Quem tinha de LER as respostas, abrir as evidências
 * anexadas e decidir se aquilo era aceitável era a pessoa, avaliação a
 * avaliação. O score dizia «72%» e não dizia porquê.
 *
 * Esta função lê o que foi respondido, vê que evidências vieram (e quais
 * faltam), e devolve: nível de risco, resumo, pontos fortes, pontos de atenção
 * e o que pedir a seguir.
 *
 * ## O que ela NÃO faz, de propósito
 *
 * Não mexe no `score_final`. Esse número é aritmética verificável a partir das
 * notas; o parecer é interpretação. Misturá-los faria o cliente exportar uma
 * opinião com aparência de cálculo — e num produto de compliance essa
 * diferença é tudo. Aparecem lado a lado no ecrã, identificados.
 *
 * É chamada por dentro (`public-assessment`, quando o fornecedor submete) e
 * também à mão, pelo botão de reavaliar.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { exigeInternaOuUtilizador, respostaAcessoNegado, AcessoNegado } from '../_shared/interna.ts';
import { MODELOS } from '../_shared/modelos.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const NIVEIS = ['baixo', 'medio', 'alto', 'critico'] as const;

/** Estrutura que exigimos ao modelo. Sem isto vem prosa, e prosa não se filtra. */
const ESQUEMA_DO_PARECER = {
  type: 'json_schema',
  json_schema: {
    name: 'parecer_fornecedor',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['nivelRisco', 'resumo', 'pontosFortes', 'pontosAtencao', 'recomendacoes', 'evidenciasEmFalta', 'confianca', 'secoes'],
      properties: {
        nivelRisco: { type: 'string', enum: NIVEIS },
        resumo: { type: 'string', description: 'Dois a quatro períodos, em português, dirigidos a quem decide.' },
        pontosFortes: { type: 'array', items: { type: 'string' }, description: 'O que o fornecedor demonstrou bem.' },
        pontosAtencao: { type: 'array', items: { type: 'string' }, description: 'Lacunas e respostas frágeis.' },
        recomendacoes: { type: 'array', items: { type: 'string' }, description: 'O que pedir ou fazer a seguir.' },
        evidenciasEmFalta: { type: 'array', items: { type: 'string' }, description: 'Perguntas que pediam comprovativo e vieram sem.' },
        confianca: { type: 'string', enum: ['alta', 'media', 'baixa'], description: 'Quanto o material permite concluir.' },
        /*
          A leitura secção a secção.

          O parecer global diz se o fornecedor serve; não diz ONDE apertar. Um
          questionário de due diligence vem dividido em secções -- Governança,
          Continuidade, Integridade -- e é por secção que se cobra: quem trata
          de continuidade não é quem trata de anticorrupção.

          `oQuePedir` é o par que torna o relatório accionável: o que o
          fornecedor respondeu, e o que se lhe pede a seguir. Sem o segundo, a
          análise fica a descrever o problema a quem já o tem.
        */
        secoes: {
          type: 'array',
          description: 'Uma entrada por secção do questionário, na ordem em que aparecem.',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['secao', 'pontosFortes', 'pontosAtencao', 'oQuePedir'],
            properties: {
              secao: { type: 'string' },
              pontosFortes: { type: 'array', items: { type: 'string' }, description: 'O que esta secção demonstrou bem. Vazio se nada.' },
              pontosAtencao: { type: 'array', items: { type: 'string' }, description: 'Lacunas desta secção, com a resposta que as sustenta.' },
              oQuePedir: {
                type: 'array',
                description: 'Por cada resposta fraca: o que pedir ao fornecedor. Vazio se não houver.',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['pergunta', 'respondeu', 'pedir'],
                  properties: {
                    pergunta: { type: 'string', description: 'O título da pergunta, tal como está no questionário.' },
                    respondeu: { type: 'string', description: 'O que o fornecedor respondeu, resumido.' },
                    pedir: { type: 'string', description: 'O documento, evidência ou compromisso concreto a exigir.' },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const chamador = await exigeInternaOuUtilizador(req);
    const { assessment_id } = await req.json().catch(() => ({}));
    if (!assessment_id) {
      return json({ error: 'assessment_id obrigatório' }, 400);
    }

    const url = Deno.env.get('SUPABASE_URL')!;
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: avaliacao, error: erroAval } = await admin
      .from('due_diligence_assessments')
      .select('id, empresa_id, fornecedor_nome, score_final, status, template_id')
      .eq('id', assessment_id)
      .maybeSingle();
    if (erroAval) throw erroAval;
    if (!avaliacao) return json({ error: 'Avaliação não encontrada' }, 404);

    // Quem tem sessão só avalia o que é da sua empresa. A chamada interna vem
    // do fluxo de submissão, que já sabe de quem é.
    if (!chamador.interna && avaliacao.empresa_id !== chamador.empresaId) {
      return json({ error: 'Avaliação de outra empresa' }, 403);
    }

    const { data: respostas, error: erroResp } = await admin
      .from('due_diligence_responses')
      .select('resposta, justificativa, pontuacao, evidencia, arquivo_url, resposta_arquivo_url, resposta_arquivo_nome, due_diligence_questions!inner(titulo, descricao, tipo, peso, secao, obrigatoria)')
      .eq('assessment_id', assessment_id);
    if (erroResp) throw erroResp;

    if (!respostas?.length) {
      return json({ error: 'Sem respostas para avaliar', code: 'NO_RESPONSES' }, 422);
    }

    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) return json({ error: 'LOVABLE_API_KEY não configurada' }, 500);

    /*
      O material vai para o modelo já organizado por secção e com o peso de cada
      pergunta à vista: uma resposta fraca numa pergunta de peso 5 não é o mesmo
      que numa de peso 1, e o modelo não tem como adivinhar isso do texto.

      Vai também se a pergunta trouxe ficheiro. Não se envia o conteúdo do
      ficheiro — envia-se o facto de existir, e o nome. Pedir comprovativo e
      receber nada é, muitas vezes, o achado mais importante.
    */
    const material = respostas.map((r: any) => {
      const q = r.due_diligence_questions;
      const anexo = r.arquivo_url || r.resposta_arquivo_url;
      return [
        `— Secção: ${q?.secao || 'Geral'} | Peso: ${q?.peso ?? 1}${q?.obrigatoria ? ' | OBRIGATÓRIA' : ''}`,
        `Pergunta: ${q?.titulo ?? '(sem título)'}`,
        q?.descricao ? `Contexto: ${q.descricao}` : null,
        `Resposta: ${r.resposta ?? '(em branco)'}`,
        r.justificativa ? `Justificação: ${r.justificativa}` : null,
        r.evidencia ? `Evidência descrita: ${r.evidencia}` : null,
        anexo ? `Ficheiro anexado: ${r.resposta_arquivo_nome || 'sim'}` : 'Ficheiro anexado: NÃO',
        r.pontuacao !== null && r.pontuacao !== undefined ? `Nota atribuída: ${r.pontuacao}` : null,
      ].filter(Boolean).join('\n');
    }).join('\n\n');

    const prompt = [
      `Fornecedor: ${avaliacao.fornecedor_nome}`,
      avaliacao.score_final !== null ? `Score calculado das respostas: ${Number(avaliacao.score_final).toFixed(0)}%` : null,
      '',
      'Respostas ao questionário de due diligence:',
      '',
      material,
      '',
      'Avalia este fornecedor. Regras:',
      '- Sê concreto: cita a resposta ou a lacuna que sustenta cada ponto. Nada de generalidades.',
      '- Uma pergunta obrigatória que pedia comprovativo e veio SEM ficheiro é sempre ponto de atenção.',
      '- Pesa as respostas pelo peso da pergunta.',
      '- Se o material não chegar para concluir, diz confiança "baixa" em vez de inventar certeza.',
      '- Escreve em português europeu, dirigido a quem tem de decidir se contrata.',
      '- Em `secoes`, uma entrada por secção do questionário, com a MESMA grafia da secção.',
      '- Em `oQuePedir`, só respostas fracas, e o que se pede tem de ser concreto: um documento,',
      '  um certificado, um prazo. "Melhorar a governação" não é um pedido.',
    ].filter(Boolean).join('\n');

    // Sem franquia, nem se chama o modelo: a chamada custa no instante
    // em que sai. Ver `_shared/creditos.ts`.
    if (!(await temCreditoIA(admin, avaliacao.empresa_id))) return semCreditoIA(corsHeaders);

    const aiResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: MODELOS.PADRAO,
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content:
              'És um analista de risco de terceiros, rigoroso e sóbrio. Avalias fornecedores a partir do que ' +
              'eles próprios responderam e das evidências que juntaram. Não inflacionas nem dramatizas: ' +
              'uma resposta boa é boa, uma lacuna é uma lacuna. Respondes APENAS com o JSON pedido.',
          },
          { role: 'user', content: prompt },
        ],
        response_format: ESQUEMA_DO_PARECER,
      }),
    });

    if (!aiResp.ok) {
      const detalhe = await aiResp.text().catch(() => '');
      console.error('[avaliar-fornecedor-ia] gateway recusou', aiResp.status, detalhe.slice(0, 300));
      // 429/402 do gateway são transitórios ou de saldo: quem chama distingue.
      return json({ error: 'Serviço de IA indisponível', code: 'AI_UNAVAILABLE' }, aiResp.status === 429 ? 429 : 502);
    }

    // Só se debita depois do gateway aceitar — não se cobra o que não veio.
    if (avaliacao.empresa_id) {
      const { data: creditoOk } = await admin.rpc('consume_ai_credit', {
        p_empresa_id: avaliacao.empresa_id,
        p_user_id: chamador.userId,
        p_funcionalidade: 'avaliar_fornecedor_ia',
        p_descricao: `Parecer de due diligence · ${avaliacao.fornecedor_nome}`,
      });
      /* Franquia esgotada entre a pergunta e o débito: quem chega
         a seguir não leva a resposta. */
      if (creditoOk === false) return semCreditoIA(corsHeaders);
    }

    const dados = await aiResp.json();
    const bruto: string = dados?.choices?.[0]?.message?.content ?? '';
    let parecer: any;
    try {
      parecer = JSON.parse(bruto.replace(/```json\s*|\s*```/g, '').trim());
    } catch {
      console.error('[avaliar-fornecedor-ia] resposta não era JSON', bruto.slice(0, 200));
      return json({ error: 'Parecer ilegível', code: 'BAD_AI_RESPONSE' }, 502);
    }

    // O modelo pode devolver um nível fora do combinado; a coluna tem CHECK e
    // recusaria a gravação inteira. Melhor cair para 'medio' do que perder o parecer.
    const nivel = NIVEIS.includes(parecer?.nivelRisco) ? parecer.nivelRisco : 'medio';

    const documento = {
      ...parecer,
      nivelRisco: nivel,
      modelo: MODELOS.PADRAO,
      respostasAnalisadas: respostas.length,
    };

    const { error: erroGravar } = await admin
      .from('due_diligence_assessments')
      .update({
        ia_parecer: documento,
        ia_nivel_risco: nivel,
        ia_avaliado_em: new Date().toISOString(),
      })
      .eq('id', assessment_id);
    if (erroGravar) throw erroGravar;

    return json({ success: true, parecer: documento });
  } catch (erro) {
    if (erro instanceof AcessoNegado) return respostaAcessoNegado(erro, corsHeaders);
    console.error('[avaliar-fornecedor-ia] falhou', erro instanceof Error ? erro.message : String(erro));
    return json({ error: 'Não foi possível avaliar', code: 'INTERNAL_ERROR' }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
