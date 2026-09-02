/**
 * Quem denunciou e deixou contacto é avisado — e o aviso não leva o caso.
 *
 * ## O que estava
 *
 * O canal só falava para dentro. O comité respondia na conversa, acusava o
 * recebimento, mudava o estado, marcava a reunião — e do outro lado não
 * acontecia nada. A pessoa só descobria se voltasse ao portal por vontade
 * própria e reescrevesse protocolo e código. Num processo de três meses, é a
 * forma mais certa de o retorno ser dado e nunca ser recebido.
 *
 * ## As duas coisas que este ficheiro segura
 *
 * **Que o aviso sai de todos os pontos.** São quatro, e hão-de ser cinco. Um
 * aviso escrito quatro vezes é um aviso que falta no quinto — por isso a
 * chamada é uma só (`avisarDenunciante`) e a guarda verifica que cada ecrã que
 * mexe na denúncia a faz.
 *
 * **Que o e-mail não leva nada do caso.** Sai do perímetro, e a caixa de
 * correio pode ser a da empresa que está a ser denunciada: muita gente
 * denuncia a partir do e-mail do trabalho. Não vai o título, não vai o texto
 * da mensagem do comité, não vai o estado — e não vai o código de
 * acompanhamento, que é a credencial. Vai que há novidade e onde a ver.
 *
 * Quem PODE ser avisado é decidido no banco
 * (`destinatario_do_aviso_ao_denunciante`), e não aqui: anónima nunca, sem
 * e-mail nunca, canal com o aviso desligado nunca. Medido nos quatro casos.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const FUNCAO = 'supabase/functions/avisar-denunciante/index.ts';
const MIGRATION = 'supabase/migrations/20260902060000_avisar_quem_denunciou_por_email.sql';

/** Cada ecrã que altera a denúncia, e o motivo que anuncia. */
const PONTOS: Array<[string, string]> = [
  ['src/components/denuncia/DenunciaConversa.tsx', 'mensagem'],
  ['src/components/denuncia/DenunciaRelogio.tsx', 'recebimento'],
  ['src/components/denuncia/DenunciaDialog.tsx', 'estado'],
  ['src/components/denuncia/DenunciaReunioes.tsx', 'reuniao'],
];

describe('o aviso sai de todos os pontos', () => {
  it.each(PONTOS)('%s avisa por «%s»', (ficheiro, motivo) => {
    const s = readFileSync(ficheiro, 'utf8');
    expect(s, 'não importa o aviso').toContain("from '@/lib/avisar-denunciante'");
    expect(s, 'importa e não chama').toContain(`avisarDenunciante(`);
    expect(s, `motivo «${motivo}» em falta`).toContain(`'${motivo}')`);
  });

  it('cada motivo tem texto na função de borda', () => {
    const s = readFileSync(FUNCAO, 'utf8');
    for (const [, motivo] of PONTOS) {
      expect(s, `sem frase para «${motivo}»`).toMatch(new RegExp(`^\\s*${motivo}:`, 'm'));
    }
  });

  it('a falha do aviso não desfaz o trabalho do comité', () => {
    /*
       Se o e-mail derrubasse a acção, uma chave de e-mail em falta impedia o
       comité de responder. Duas coisas garantem que não: o helper apanha tudo
       (o `throw` que ele tem é dentro do seu próprio `try`), e cada chamador
       dispara-e-esquece — `void`, sem `await`, sem entrar no `try` de quem o
       chama.
    */
    const helper = readFileSync('src/lib/avisar-denunciante.ts', 'utf8');
    expect(helper, 'o helper tem de apanhar a falha').toMatch(/catch\s*\(/);
    expect(helper, 'e nunca a deixar sair').not.toMatch(/^\s*throw/m);

    for (const [ficheiro] of PONTOS) {
      const s = readFileSync(ficheiro, 'utf8');
      expect(s, `${ficheiro} espera pelo aviso`).not.toMatch(/await\s+avisarDenunciante/);
      expect(s, `${ficheiro} não dispara-e-esquece`).toMatch(/void\s+avisarDenunciante/);
    }
  });
});

describe('o e-mail não leva o caso', () => {
  const fonte = readFileSync(FUNCAO, 'utf8');

  it('o corpo só interpola o que é seguro', () => {
    /*
       Procurar palavras no ficheiro apanhava a prosa dos comentários e a chave
       `mensagem:` do mapa de motivos — uma guarda que reprova texto explicativo
       é uma guarda que se contorna apagando o comentário. O que interessa é o
       que o HTML INTERPOLA: cada `${...}` dentro do corpo do e-mail.
    */
    const corpo = fonte.slice(fonte.indexOf('const html = `'), fonte.indexOf('const resend'));
    const interpolados = [...corpo.matchAll(/\$\{([^}]+)\}/g)].map((m) => m[1].trim());
    expect(interpolados.length).toBeGreaterThan(0);

    const PERMITIDO = /^(linha|url|en\s*\?|destino\.(protocolo|empresa_nome))/;
    const proibidos = interpolados.filter((x) => !PERMITIDO.test(x));
    expect(
      proibidos,
      'só podem entrar no e-mail: a frase do motivo, o link, o protocolo e o nome da empresa',
    ).toEqual([]);
  });

  it('só pede à base o que precisa', () => {
    /* `select('id, empresa_id')` — o resto viria por engano e sairia por
       descuido no dia em que alguém acrescentasse uma linha ao HTML. */
    expect(fonte).toContain("select('id, empresa_id')");
    expect(fonte).not.toContain("select('*')");
  });

  it('não leva o código de acompanhamento', () => {
    /* O e-mail FALA do código — «consulte com o código que recebeu» — e é
       suposto falar. O que não pode é lê-lo da base para o escrever lá. */
    for (const coluna of ['codigo_acompanhamento', 'token_acompanhamento', 'tracking_hash']) {
      expect(fonte, `${coluna} é credencial, não conteúdo de e-mail`).not.toContain(coluna);
    }
  });

  it('o que a base devolve já é só o mínimo', () => {
    const sql = readFileSync(MIGRATION, 'utf8');
    const retorno = sql.slice(sql.indexOf('RETURN jsonb_build_object'), sql.indexOf('END;\n$function$'));
    for (const campo of ["'titulo'", "'descricao'", "'status'", "'gravidade'"]) {
      expect(retorno, `${campo} não devia chegar à função de borda`).not.toContain(campo);
    }
    for (const campo of ["'email'", "'protocolo'", "'empresa_slug'"]) {
      expect(retorno).toContain(campo);
    }
  });
});

describe('quem não pode ser avisado, não é', () => {
  const sql = readFileSync(MIGRATION, 'utf8');

  it('anónima devolve nada, e está escrito porquê', () => {
    expect(sql).toMatch(/=\s*'anonima'\s*THEN\s*\n\s*RETURN NULL/);
  });

  it('sem e-mail devolve nada', () => {
    expect(sql).toContain("nullif(btrim(COALESCE(v.email_denunciante, '')), '') IS NULL");
  });

  it('o canal pode desligar o aviso', () => {
    expect(sql).toContain('avisar_denunciante_por_email IS FALSE');
    /* Ligado por omissão: o silêncio era o defeito. */
    expect(sql).toContain('avisar_denunciante_por_email boolean NOT NULL DEFAULT true');
  });

  it('a decisão vive na base, não no ecrã', () => {
    /* Se o ecrã decidisse, cada chamador voltaria a poder decidir ao contrário. */
    const helper = readFileSync('src/lib/avisar-denunciante.ts', 'utf8');
    expect(helper).not.toContain('anonima');
    expect(helper).not.toContain('email');
  });
});
