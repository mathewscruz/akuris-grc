/**
 * Botão faz o que o rótulo diz — e não existe botão permanentemente morto.
 *
 * Três casos, todos do Gap Analysis, todos encontrados na mesma passagem:
 *
 *   1. Na aba "Análise de Documentos", "Anexar arquivos", "Adicionar link /
 *      URL" e "Gerar com IA" chamavam os três exactamente
 *      `setDocUploadSignal(s => s + 1)`. Três promessas, um comportamento: o
 *      seletor de ficheiros. "Gerar com IA" prometia gerar um documento e
 *      abria um upload.
 *
 *   2. Na Remediação, "Criar plano" era `navigate('/planos-acao')` — largava a
 *      pessoa na lista geral, sem o requisito, sem o framework, sem nada por
 *      onde continuar. Não criava plano nenhum.
 *
 *   3. Ainda na Remediação, dois dos três botões de vista estavam `disabled`
 *      fixo, a 50% de opacidade, com tooltip "em breve" — permanentemente à
 *      vista, permanentemente inúteis.
 *
 * A regra que fica: num handler de clique, `disabled` constante é proibido, e
 * dois botões diferentes na mesma tela não partilham o mesmo handler literal.
 * A funcionalidade que não existe não se anuncia; anuncia-se quando existir.
 */
import { describe, it, expect } from 'vitest';
import { fontes, ler } from './_fontes';

function fontesDoGap(): string[] {
  return fontes().filter(
    (f) => f.includes('gap-analysis') || f.includes('GapAnalysis'),
  );
}

/** `disabled` sem expressão: literalmente sempre desligado. */
const DESLIGADO_PARA_SEMPRE = [
  /\sdisabled(\s*\/?>|\s+[a-zA-Z])/, // <Btn ... disabled> ou <Btn disabled foo=...>
  /\sdisabled=\{true\}/,
];

/**
 * Só elementos de AÇÃO.
 *
 * Um `<SelectItem disabled>` a dizer "a carregar..." ou "nenhum framework" é
 * um item de lista a explicar o estado, não uma funcionalidade prometida —
 * é justamente o contrário do defeito que esta guarda persegue.
 */
const ACIONAVEL = /<(button|Button|ViewBtn|IconButton)/;

/**
 * Texto sem comentários.
 *
 * Estas guardas citam, no próprio comentário, o padrão que proíbem — é assim
 * que documentam o defeito. Sem apagar os comentários primeiro, cada guarda
 * acusa-se a si própria. Um bloco `/* ... *\/` cujas linhas do meio não
 * começam por `*` escapa a qualquer teste linha-a-linha.
 */
function semComentarios(texto: string): string[] {
  const saida: string[] = [];
  let dentroDeBloco = false;
  for (const linha of texto.split('\n')) {
    let atual = linha;
    if (dentroDeBloco) {
      const fim = atual.indexOf('*/');
      if (fim === -1) { saida.push(''); continue; }
      atual = atual.slice(fim + 2);
      dentroDeBloco = false;
    }
    const abre = atual.indexOf('/*');
    if (abre !== -1) {
      const fim = atual.indexOf('*/', abre + 2);
      if (fim === -1) { dentroDeBloco = true; atual = atual.slice(0, abre); }
      else atual = atual.slice(0, abre) + atual.slice(fim + 2);
    }
    const linha2 = atual.indexOf('//');
    if (linha2 !== -1) atual = atual.slice(0, linha2);
    saida.push(atual);
  }
  return saida;
}

describe('botão faz o que diz', () => {
  it('nenhum botão do Gap Analysis está desligado para sempre', () => {
    const mortos: string[] = [];
    for (const f of fontesDoGap()) {
      const codigo = semComentarios(ler(f));
      codigo.forEach((linha, i) => {
        // `disabled={saving}`, `disabled={!empresaId}` e afins são estado real.
        if (!DESLIGADO_PARA_SEMPRE.some((re) => re.test(linha))) return;
        // A abertura da tag pode estar algumas linhas acima do `disabled`.
        const abertura = codigo.slice(Math.max(0, i - 6), i + 1).join(' ');
        if (!ACIONAVEL.test(abertura)) return;
        mortos.push(`${f}:${i + 1} ${linha.trim().slice(0, 80)}`);
      });
    }
    expect(
      mortos,
      `Botão permanentemente desligado — anuncia o que não existe:\n${mortos.join('\n')}`,
    ).toEqual([]);
  });

  it('as ações da aba Documentos não partilham o mesmo handler', () => {
    const f = 'src/pages/GapAnalysisFrameworkDetail.tsx';
    const texto = ler(f);
    const bloco = texto.match(/<DocumentsHero[\s\S]{0,600}?\/>/)?.[0] ?? '';
    expect(bloco, `${f}: não encontrei a montagem do DocumentsHero`).not.toBe('');

    const handlers = [...bloco.matchAll(/on[A-Z]\w+=\{([^}]*)\}/g)].map((m) =>
      m[1].replace(/\s+/g, ' ').trim(),
    );
    const repetidos = handlers.filter((h, i) => handlers.indexOf(h) !== i);

    expect(
      repetidos,
      `${f}: duas ações diferentes do DocumentsHero fazem exactamente o mesmo:\n${repetidos.join('\n')}`,
    ).toEqual([]);
  });

  it('"Criar plano" da Remediação não é apenas uma navegação sem contexto', () => {
    const f = 'src/components/gap-analysis/v2/RemediationTabV2.tsx';
    const texto = ler(f);

    const navegacoesCegas = semComentarios(texto)
      .map((l, i) => ({ l, i }))
      .filter(({ l }) => /navigate\(\s*['"`]\/planos-acao['"`]\s*\)/.test(l))
      .map(({ l, i }) => `${f}:${i + 1} ${l.trim()}`);

    expect(
      navegacoesCegas,
      `Ir para a lista geral de planos não é "criar plano" nem "abrir este plano":\n${navegacoesCegas.join('\n')}`,
    ).toEqual([]);

    expect(
      /planos_acao['"]\s*\)\s*\.insert\(/.test(texto.replace(/\s+/g, ' ')) ||
        /from\('planos_acao'\)[\s\S]{0,80}\.insert\(/.test(texto),
      `${f}: "Criar plano" tem de criar mesmo um plano`,
    ).toBe(true);
  });
});
