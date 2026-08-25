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
    /*
      `CREATE`, e não a última ocorrência do nome.

      A primeira versão desta busca usava `lastIndexOf('FUNCTION public.…(')`,
      que casa com a linha do `GRANT EXECUTE ON FUNCTION` no fim do ficheiro —
      e devolvia essa linha como «corpo». Depois procurava o fim em
      `$function$;`, que não existe quando a migration delimita com `$$;`.

      As duas coisas juntas fizeram esta guarda apanhar uma regressão a sério
      pelo motivo errado: falhou em «não contém observacoes» quando o problema
      era outro. Uma guarda que acerta por acidente é uma guarda que da próxima
      vez erra por acidente.
    */
    const assinatura = new RegExp(
      String.raw`CREATE\s+(OR\s+REPLACE\s+)?FUNCTION\s+public\.` + funcao + String.raw`\s*\(`,
      'i',
    );
    const i = texto.search(assinatura);
    if (i === -1) continue;
    /* O corpo acaba no delimitador em dólares que o abriu — `$$` ou `$function$`. */
    const abre = texto.slice(i).match(/AS\s+(\$[a-z_]*\$)/i);
    const marca = abre ? abre[1] : '$function$';
    const fim = texto.indexOf(`${marca};`, i + (abre?.index ?? 0) + marca.length);
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

  it('a acta da reunião só sai depois de partilhada', () => {
    /*
      A acta tem o seu proprio controlo: so e devolvida depois de
      `ata_partilhada_em`. E o que permite a quem esteve na reuniao verificar,
      rectificar e aceitar o registo -- artigo 18.o/2 da Diretiva.

      Uma reescrita da funcao deixou-a cair inteira da resposta, e com ela o
      passo de confirmacao ficou sem o texto a confirmar.
    */
    const { ficheiro, corpo } = ultimaDefinicao('consult_denuncia_publica');
    expect(
      /'ata',\s*CASE\s+WHEN\s+r\.ata_partilhada_em\s+IS\s+NOT\s+NULL/i.test(corpo),
      `${ficheiro}: a acta deixou de sair condicionada a ata_partilhada_em -- ` +
        'ou desapareceu da resposta, ou passou a sair antes de ser partilhada.',
    ).toBe(true);
  });

  it('a consulta pública só lê colunas que existem em denuncias_reunioes', () => {
    /*
      `CREATE OR REPLACE FUNCTION` em plpgsql nao valida nomes de coluna. Uma
      reescrita pediu `r.status`, `r.data_hora` e `r.link_ou_local` -- tres
      colunas que nao existem -- e a migration aplicou-se sem se queixar. A
      funcao passou a rebentar em TODA a chamada, e a consulta publica da
      denuncia deixou de responder, em producao, sem um unico erro no deploy.
    */
    const { ficheiro, corpo } = ultimaDefinicao('consult_denuncia_publica');
    /*
      Sem os comentários.

      A migration que repôs isto EXPLICA o erro citando os três nomes errados —
      e a primeira versão desta guarda apanhou o próprio texto que a documenta.
      Uma guarda que não distingue código de comentário sobre o código dá
      alarme onde não há nada.
    */
    const codigo = corpo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--[^\n]*/g, '');
    const inexistentes = ['r.status', 'r.data_hora', 'r.link_ou_local'].filter((c) =>
      codigo.includes(c),
    );
    expect(
      inexistentes,
      `${ficheiro}: a funcao le colunas que nao existem em denuncias_reunioes. ` +
        'A tabela tem `estado`, `agendada_para` e `local`.',
    ).toEqual([]);
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
      /* Entrou depois: lia a VIEW `denuncias_configuracoes_publicas` direto, e
         uma view herda a RLS de quem a consulta tal como uma tabela. Trocado
         pelo RPC `get_canal_config_publica`. A guarda não o via porque só
         olhava para telas — e o hook é que faz o pedido pelas três. */
      'src/hooks/useCanalDenuncia.ts',
    ];

    const infractoras = publicas.filter((f) =>
      /\.from\(\s*'denuncias(_[a-z_]+)?'\s*\)/.test(readFileSync(f, 'utf8')),
    );

    expect(
      infractoras,
      'Tela pública a ler tabela do canal directamente. Use os RPC públicos ' +
        '(`get_denuncias_categorias_publicas`, `consult_denuncia_publica`) ou a ' +
        'função de borda: sem sessão, a RLS devolve vazio sem erro.',
    ).toEqual([]);
  });

  it('o impedimento continua a ganhar, inclusive à consultoria', () => {
    /*
      `pode_ver_denuncia` ganhou um ramo novo — a consultoria que gere o canal
      de empresas clientes. O ramo é um OR, e um OR mal fechado é a forma mais
      fácil de o conflito de interesse deixar de valer para quem vem de fora.
      A cláusula de impedimento tem de ficar FORA do OR, a valer sobre tudo.
    */
    const { ficheiro, corpo } = ultimaDefinicao('pode_ver_denuncia');

    expect(corpo).toContain('denuncias_impedimentos');
    /* O impedimento vem depois do parêntese que fecha o OR dos acessos. */
    const fimDoOr = corpo.lastIndexOf('denuncias_consultoria');
    const impedimento = corpo.indexOf('denuncias_impedimentos');
    expect(
      impedimento > fimDoOr,
      `${ficheiro}: a cláusula de impedimento deixou de vir depois dos ramos ` +
        'de acesso — verifique se ainda se aplica a todos, incluindo a consultoria.',
    ).toBe(true);

    expect(
      /AND NOT EXISTS/.test(corpo),
      `${ficheiro}: pode_ver_denuncia deixou de excluir quem se declarou impedido.`,
    ).toBe(true);
  });
});
