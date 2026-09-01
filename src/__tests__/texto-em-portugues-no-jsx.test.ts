/**
 * Nenhum texto de interface está escrito no JSX.
 *
 * Uma palavra portuguesa cravada no componente chega ao ecrã tal e qual quando
 * alguém põe o produto em inglês. Foi assim que o «Anterior» do assistente de
 * riscos ficou por traduzir enquanto o «Next» mesmo ao lado vinha do
 * dicionário — encontrado a percorrer o produto em inglês, não a ler código.
 *
 * A guarda olha para três sítios: o texto entre etiquetas na mesma linha, o
 * texto à solta no fim da linha (a forma exacta do «Anterior», com o
 * `</Button>` só na linha seguinte — a primeira versão deste teste não a via,
 * e por isso não teria apanhado o defeito que a motivou), e os atributos que o
 * utilizador lê.
 *
 * Não substitui a passagem em inglês: vê só o que cabe numa linha, e nada em
 * cadeias montadas por código. Apanha as formas em que este defeito já
 * apareceu.
 *
 * Se um nome PRÓPRIO em português for preciso (uma marca, um termo legal),
 * ponha-o no dicionário nas duas línguas: é lá que o inglês vai buscá-lo.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fontesTsx } from './_fontes';

/** Palavras que só existem em português e aparecem em interface. */
const PORTUGUES =
  /\b(Anterior|Pr[oó]xim[oa]|Salvar|Guardar|Excluir|Editar|Criar|Adicionar|Cancelar|Fechar|Buscar|Pesquisar|Selecione|Nenhum[ao]?|Carregando|Aguarde|Enviar|Voltar|Limpar|Filtrar|Vencimento|Vencidos?|Respons[aá]vel|Observa[cç][oõ]es|Descri[cç][aã]o|A[cç][oõ]es|Configura[cç][oõ]es|Gerenciar|Gerencie|Cadastrar|Obrigat[oó]ri[oa]s?)\b/;

const PADROES = [
  /* `>Anterior<` — as duas etiquetas na mesma linha. */
  />\s*([A-Za-zÀ-ÿ][^<>{}\n]{2,48}?)\s*</g,
  /* `<Icon /> Anterior` — o fecho vem só na linha seguinte.
     O `(?<![=|&])` deixa de fora a seta `=>`: um `import(…)` no fim da linha
     lia-se como conteúdo de etiqueta. */
  /(?<![=|&])\/?>\s*([A-Za-zÀ-ÿ][^<>{}\n]{2,48}?)\s*$/g,
  /* O que se lê sem ser conteúdo. */
  /(?:placeholder|title|aria-label|label)="([^"]{3,60})"/g,
];

describe('o texto que o utilizador lê vem do dicionário', () => {
  it('não há português escrito no JSX', () => {
    const falhas: string[] = [];

    for (const ficheiro of fontesTsx()) {
      if (ficheiro.replace(/\\/g, '/').includes('/i18n/')) continue;
      const fonte = readFileSync(ficheiro, 'utf8');

      fonte.split('\n').forEach((linha, i) => {
        const t = linha.trim();
        // Um comentário a EXPLICAR o defeito não é o defeito.
        if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return;

        for (const padrao of PADROES) {
          for (const m of linha.matchAll(padrao)) {
            const texto = m[1].trim();
            if (texto.includes('{') || texto.includes('}')) continue;
            if (!PORTUGUES.test(texto)) continue;
            falhas.push(`${ficheiro.replace(/\\/g, '/')}:${i + 1} → ${texto}`);
          }
        }
      });
    }

    expect(
      falhas,
      'Em inglês, isto chega ao ecrã em português. Ponha o texto no dicionário, nas duas línguas.',
    ).toEqual([]);
  });
});
