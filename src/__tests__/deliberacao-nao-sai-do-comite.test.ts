/**
 * A deliberação da apuração não sai do comité.
 *
 * ## O que aconteceu
 *
 * `denuncias_movimentacoes.observacoes` é o campo onde o investigador escreve
 * o que pensa do caso — «falei com o RH», «a versão do acusado não bate». O
 * rótulo do campo é «Observações da Movimentação» e nada, em ecrã nenhum,
 * dizia que aquilo saía do comité.
 *
 * Saía. `consult_denuncia_publica` devolvia `m.observacoes` de TODAS as
 * movimentações e a tela de consulta por protocolo imprimia-as. Quem
 * denunciou lia a deliberação interna, incluindo o que ali se dissesse sobre
 * terceiros. Esteve assim desde que o módulo existe.
 *
 * ## Porque é uma guarda e não um comentário
 *
 * A correcção é uma linha de SQL dentro de uma função de 60 — `CASE WHEN
 * m.visibilidade = 'publica' THEN m.observacoes END`. Qualquer reescrita
 * futura da função que copie a versão antiga reabre o vazamento sem que
 * ninguém dê por isso, porque o sintoma só aparece do lado de quem denunciou,
 * numa tela que a equipa não visita.
 *
 * A guarda lê a ÚLTIMA definição da função nas migrations — que é a que vale —
 * e exige que o texto continue fechado à chave.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const PASTA = 'supabase/migrations';

/** O conteúdo da migration mais recente que redefine a função dada. */
function ultimaDefinicao(funcao: string): { ficheiro: string; corpo: string } {
  const ficheiros = readdirSync(PASTA)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const nome of [...ficheiros].reverse()) {
    const texto = readFileSync(join(PASTA, nome), 'utf8');
    const i = texto.lastIndexOf(`FUNCTION public.${funcao}(`);
    if (i === -1) continue;
    // Da assinatura até ao fim do corpo em dólares.
    const fim = texto.indexOf('$function$;', i);
    return { ficheiro: nome, corpo: texto.slice(i, fim === -1 ? undefined : fim) };
  }
  throw new Error(`Nenhuma migration define public.${funcao}`);
}

describe('a deliberação da apuração não chega a quem denunciou', () => {
  it('a consulta pública só devolve observações marcadas como públicas', () => {
    const { ficheiro, corpo } = ultimaDefinicao('consult_denuncia_publica');

    /* Que devolve observações, devolve. O que não pode é devolvê-las cruas. */
    expect(corpo).toContain('observacoes');
    expect(
      /visibilidade\s*=\s*'publica'\s*THEN\s*m\.observacoes/i.test(corpo),
      `${ficheiro}: consult_denuncia_publica voltou a devolver o texto das ` +
        'movimentações sem filtrar por `visibilidade`. Esse campo é a nota ' +
        "interna do comité — o retorno a quem denunciou vive em `denuncias_mensagens`.",
    ).toBe(true);
  });

  it('a trilha nasce assinada por quem a escreve', () => {
    const ficheiros = readdirSync(PASTA).filter((f) => f.endsWith('.sql')).sort();
    const assinada = ficheiros.some((nome) => {
      const texto = readFileSync(join(PASTA, nome), 'utf8');
      return /denuncias_movimentacoes[\s\S]{0,120}ALTER COLUMN usuario_id SET DEFAULT auth\.uid\(\)/.test(
        texto,
      );
    });

    expect(
      assinada,
      'Nenhuma migration põe `DEFAULT auth.uid()` em ' +
        'denuncias_movimentacoes.usuario_id. Sem isso a trilha volta a dizer ' +
        'o quê e quando e a calar quem — que é o que uma apuração a várias ' +
        'mãos precisa de provar.',
    ).toBe(true);
  });

  it('o canal público nunca lê tabelas do canal directamente', () => {
    /*
      As telas públicas não têm sessão: qualquer `.from('denuncias…')` nelas é
      barrado pela RLS e desaparece em silêncio. Foi o que aconteceu ao bloco
      «o que pode ser relatado» — aparecia a quem estivesse autenticado (a
      quem testava) e nunca a quem o canal serve. Só valem os RPC públicos.
    */
    const publicas = [
      'src/pages/DenunciaMenu.tsx',
      'src/pages/DenunciaFormulario.tsx',
      'src/pages/DenunciaConsulta.tsx',
      'src/components/denuncia/CanalLayout.tsx',
      'src/components/denuncia/SolicitarReuniao.tsx',
    ];

    const infractoras = publicas.filter((f) =>
      /\.from\(\s*'denuncias(_[a-z]+)?'\s*\)/.test(readFileSync(f, 'utf8')),
    );

    expect(
      infractoras,
      'Tela pública a ler tabela do canal directamente. Use os RPC públicos ' +
        '(`get_denuncias_categorias_publicas`, `consult_denuncia_publica`) ou a ' +
        'função de borda: sem sessão, a RLS devolve vazio sem erro.',
    ).toEqual([]);
  });
});
