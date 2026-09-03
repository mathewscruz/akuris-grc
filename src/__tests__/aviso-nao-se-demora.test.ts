/**
 * Um aviso não se demora, e não se empilha sem fim.
 *
 * O Toaster estava em quatro visíveis e 4,5s cada. Uma acção que dispara três
 * avisos seguidos — guardar, recalcular, notificar — tapava o canto do ecrã
 * durante quase cinco segundos, e a pessoa acabava por deixar de os ler. Um
 * aviso de confirmação não é para ler com atenção: é para se ver de canto de
 * olho que a coisa correu bem. O que exige leitura tem de estar no ecrã.
 *
 * A duração agora segue o tom: sucesso 2s, informação 3s, aviso 4,5s e erro
 * 6s. O máximo continua em três empilhados. Esta guarda existe porque a
 * uniformidade não se mantém sozinha.
 *
 * ## As excepções, e porque são excepções
 *
 * Duas coisas justificam passar dos 2s, e as duas estão listadas abaixo:
 *
 *  · **Um aviso com botão.** Dois segundos não chegam para reparar, mover o
 *    rato e clicar — um botão que foge é pior do que não ter botão.
 *  · **Um aviso que é a única instrução.** «Enviámos o link para o seu e-mail»
 *    com o diálogo já fechado atrás: se passar despercebido, a pessoa fica
 *    à espera de nada.
 *
 * O relógio de expiração de sessão não é aviso nenhum — é uma contagem
 * decrescente, e encurtá-la seria encurtar o aviso de que a sessão vai cair.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fontes, ler } from './_fontes';

/** Ficheiro → razão pela qual pode fixar duração acima do fallback. */
const EXCECOES: Record<string, string> = {
  'src/hooks/useInactivityTimeout.tsx': 'contagem decrescente da sessão, não é aviso',
  'src/components/ForgotPasswordDialog.tsx': 'única instrução, com o diálogo já fechado',
  'src/components/documentos/DocGenDialog.tsx': 'aviso com botão de acção',
  'src/pages/PlanosAcao.tsx': 'exclusão com botão Desfazer',
  'src/pages/Relatorios.tsx': 'exclusão com botão Desfazer',
};

const DURACAO_PADRAO = 3000;
const EMPILHAMENTO_MAXIMO = 3;

describe('o aviso não se demora', () => {
  it('o Toaster define fallback de três segundos e três empilhados', () => {
    const sonner = readFileSync('src/components/ui/sonner.tsx', 'utf8');

    const duracao = /duration=\{(\d+)\}/.exec(sonner);
    expect(duracao, 'src/components/ui/sonner.tsx: o Toaster deixou de definir duração').not.toBeNull();
    expect(
      Number(duracao![1]),
      `O padrão de duração dos avisos é ${DURACAO_PADRAO}ms. Mudá-lo aqui muda-o ` +
        'em todo o produto — que é a intenção, mas tem de ser deliberado.',
    ).toBe(DURACAO_PADRAO);

    const visiveis = /visibleToasts=\{(\d+)\}/.exec(sonner);
    expect(visiveis, 'src/components/ui/sonner.tsx: o Toaster deixou de limitar o empilhamento').not.toBeNull();
    expect(
      Number(visiveis![1]),
      `No máximo ${EMPILHAMENTO_MAXIMO} avisos ao mesmo tempo. Acima disso a ` +
        'pilha tapa o conteúdo e deixa de se distinguir um aviso do seguinte.',
    ).toBe(EMPILHAMENTO_MAXIMO);
  });

  it('cada tom tem o tempo adequado à quantidade de atenção exigida', () => {
    const politica = readFileSync('src/lib/toast.ts', 'utf8');
    expect(politica).toMatch(/success:\s*2000/);
    expect(politica).toMatch(/info:\s*3000/);
    expect(politica).toMatch(/warning:\s*4500/);
    expect(politica).toMatch(/error:\s*6000/);
  });

  it('nenhuma chamada nova fixa a sua própria duração', () => {
    /*
      Só interessa `duration` em objectos de opções de aviso. `logger.performance
      (operation, duration)` e as durações de animação não têm nada a ver com
      isto, daí o padrão exigir `duration:` seguido de número.
    */
    const infractoras: string[] = [];

    for (const ficheiro of fontes()) {
      if (EXCECOES[ficheiro]) continue;
      if (ficheiro === 'src/components/ui/sonner.tsx') continue;
      if (ficheiro === 'src/lib/akuris-toast.tsx') continue;
      if (ficheiro === 'src/lib/toast.ts') continue;

      const texto = ler(ficheiro);
      const linhas = texto.split('\n');
      linhas.forEach((linha, i) => {
        const m = /\bduration:\s*(\d+)\b/.exec(linha);
        if (!m) return;
        if (Number(m[1]) <= DURACAO_PADRAO) return;
        infractoras.push(`${ficheiro}:${i + 1} → duration: ${m[1]}`);
      });
    }

    expect(
      infractoras,
      'Aviso com duração própria acima do padrão. Se for mesmo caso de ' +
        'excepção — leva botão de acção, ou é a única instrução que a pessoa ' +
        'recebe — acrescente o ficheiro a EXCECOES neste teste, com a razão. ' +
        'Se não for, tire a duração e deixe herdar a política do tom.',
    ).toEqual([]);
  });

  it('as excepções continuam a existir', () => {
    /* Uma lista de excepções que aponta para ficheiros apagados dá a ideia de
       que se pensou no assunto quando já ninguém pensa. */
    const orfas = Object.keys(EXCECOES).filter((f) => !fontes().includes(f));
    expect(orfas, 'Excepção a apontar para ficheiro que já não existe.').toEqual([]);
  });
});
