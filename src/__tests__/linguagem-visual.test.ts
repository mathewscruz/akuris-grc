/**
 * Linguagem visual: os padrões que reaparecem sozinhos em código novo.
 *
 * Cada regra aqui existe porque foi medida na base e corrigida em massa — e
 * porque volta na próxima tela escrita se ninguém estiver a contar. O teste
 * falha nomeando o arquivo e o que trocar, não só dizendo que falhou.
 *
 * Duas páginas ficam de fora de propósito: `Assessment` e `MFAVerification`
 * são superfícies públicas com identidade própria, fora do tema da aplicação.
 */
import { describe, it, expect } from 'vitest';
import { fontes, linhas } from './_fontes';

const FORA_DO_TEMA = ['pages/Assessment.tsx', 'MFAVerification'];

// O índice do git ainda lista arquivos apagados e por confirmar. Ler só o que
// existe em disco, senão o teste rebenta com ENOENT em vez de acusar a regra.
const arquivos = fontes();

const semCatalogo = arquivos.filter((f) => !f.includes('components/icons/'));
const noTema = semCatalogo.filter((f) => !FORA_DO_TEMA.some((x) => f.includes(x)));

/** Arquivos onde o padrão aparece, com o número da primeira linha. */
function ocorrencias(lista: string[], re: RegExp): string[] {
  const achados: string[] = [];
  for (const f of lista) {
    const i = linhas(f).findIndex((l) => re.test(l));
    if (i >= 0) achados.push(`${f}:${i + 1}`);
  }
  return achados;
}

describe('ícones', () => {
  it('um conceito, um glifo', () => {
    // Havia CheckCircle 71 · CheckCircle2 70 · Check 67 para "concluído",
    // Edit 83 · Pencil 26 para "editar". O catálogo em @/components/icons
    // já tinha escolhido; a base é que não seguia.
    const duplicados = /\b(Edit2|Edit3|PencilLine|MoreVertical|Ellipsis|BadgeCheck)\b|\bimport\s*\{[^}]*\b(Edit|Trash|CheckCircle)\b[^}]*\}\s*from\s*['"]lucide-react['"]/;
    expect(
      ocorrencias(semCatalogo, duplicados),
      'Use o glifo canónico: Pencil (editar), Trash2 (excluir), CheckCircle2 (concluído), MoreHorizontal (mais ações).',
    ).toEqual([]);
  });

  it('a marca de IA não decora o produto inteiro', () => {
    /**
     * Esta regra já disse o contrário, e estava errada.
     *
     * A versão anterior proibia `Sparkles` do catálogo e **obrigava** o
     * `AkurisAIIcon` em "qualquer ação assistida por IA" — ou seja, trocava a
     * estrelinha genérica pela nossa própria estrela de 4 pontas e chamava a
     * isso identidade. O resultado eram 108 brilhos em 41 arquivos, que é
     * precisamente o que denuncia interface gerada.
     *
     * A regra agora: nenhuma estrela de catálogo, **e** a nossa marca fica
     * reservada à superfície do assistente (AkurIA). Num botão, o rótulo já
     * diz o que a ação faz; num selo, o que importa é o estado ("Sugerido"),
     * não a autoria de quem produziu.
     */
    const generico = /\b(Sparkles|Wand2|ScanSearch)\b/;
    expect(
      ocorrencias(semCatalogo, generico),
      'Sem estrelinha de catálogo. O rótulo diz o que a ação faz.',
    ).toEqual([]);

    /**
     * Procurar `<AkurisAIIcon` só apanha o uso como TAG. E o ícone circula
     * quase sempre como VALOR: `icon: AkurisAIIcon` numa faixa de indicadores,
     * `icon={AkurisAIIcon}` num diálogo, `free: AkurisAIIcon` num mapa de
     * planos. Foi assim que oito usos passaram por esta guarda — incluindo o
     * ícone do plano Free, que não tem nada de IA — e é o mesmo ponto cego que
     * já tinha feito o codemod remover imports vivos de dez arquivos.
     *
     * A linha de import conta. A primeira versão desta regra abria exceção
     * para ela — "importar sem usar é lixo, não é decoração" — e no mesmo dia
     * um import morto sobreviveu à limpeza por causa dessa exceção. Fora do
     * assistente não há motivo para sequer importar a marca.
     */
    const foraDoAssistente = semCatalogo
      .filter((f) => !/akuria/i.test(f))
      .filter((f) => /\bAkurisAIIcon\b/.test(linhas(f).join('\n')));
    expect(
      foraDoAssistente,
      'AkurisAIIcon é a marca do assistente. Fora dele, use o rótulo ou SeloSugerido.',
    ).toEqual([]);
  });
});

describe('tipografia', () => {
  it('nenhum tamanho de letra fora da escala', () => {
    // Eram 399 tamanhos escritos à mão, de text-[6px] a text-[28px].
    expect(
      ocorrencias(arquivos, /text-\[\d+(\.\d+)?px\]/),
      'Use a escala: text-micro (11) · xs (12) · sm (14) · base (16) · lg (18) · xl (20) · 2xl (24) · 3xl (30).',
    ).toEqual([]);
  });
});

describe('forma', () => {
  it('dois raios e uma pílula', () => {
    // rounded-lg em tudo é a assinatura mais reconhecível de interface gerada.
    // Fica: rounded-md/sm (controlo, 4px), rounded-lg (contentor, 10px), full.
    expect(
      ocorrencias(noTema, /\brounded-(xl|2xl|3xl)\b/),
      'Contentor é rounded-lg; controlo é rounded-md; pílula é rounded-full.',
    ).toEqual([]);
  });

  it('duas sombras', () => {
    expect(
      ocorrencias(noTema, /\bshadow-(md|xl|2xl)\b/),
      'shadow-sm para elevado, shadow-lg para overlay. Mais nenhuma.',
    ).toEqual([]);
  });
});

describe('movimento', () => {
  it('a transição declara o que anima', () => {
    // transition-all animava largura, altura e posição junto com a cor.
    expect(
      ocorrencias(arquivos, /\btransition-all\b/),
      'Use transition-ui (cor, sombra, transform, opacidade) ou a propriedade concreta.',
    ).toEqual([]);
  });
});

describe('cor', () => {
  it('nenhuma cor de catálogo por fora dos tokens', () => {
    // Eram 393 usos que não respondem ao tema escuro nem seguem a paleta.
    const crua =
      /\b(text|bg|border)-(slate|gray|zinc|neutral|stone|green|emerald|teal|red|rose|orange|amber|yellow|blue|sky|cyan|indigo|violet|purple|fuchsia|pink|lime)-\d{2,3}\b/;
    expect(
      ocorrencias(noTema, crua),
      'Use os tokens: foreground/muted-foreground para texto, success/warning/destructive/info para semântica, severity-* para risco.',
    ).toEqual([]);
  });
});

describe('texto', () => {
  it('sem emoji na interface', () => {
    // Restava um: 'Olá, {name} 👋' — o cumprimento com a mãozinha é a marca
    // de origem mais reconhecível que existe.
    const i18n = arquivos.filter((f) => f.includes('src/i18n/'));
    expect(
      ocorrencias(i18n, /[\u{1F300}-\u{1FAFF}\u{2700}-\u{27BF}\u{2600}-\u{26FF}]/u),
      'Emoji não faz parte da linguagem visual do produto.',
    ).toEqual([]);
  });
});

describe('gráficos', () => {
  it('o texto do gráfico segue a mesma escala do resto', () => {
    // `fontSize: 11` vira pixel fixo no SVG: era o único texto de ECRÃ que não
    // acompanhava a resolução. Em `rem` o SVG resolve contra a raiz.
    //
    // O PDF fica de fora de propósito: uma página não tem viewport e o corpo
    // de letra é em pontos, portanto fixo é que está certo lá.
    const naTela = noTema.filter((f) => f.endsWith('.tsx') && !/-pdf|export|docgen/i.test(f));
    const infratores: string[] = [];
    for (const f of naTela) {
      const ls = linhas(f);
      ls.forEach((l, i) => {
        if (/fontSize:\s*\d/.test(l)) infratores.push(`${f}:${i + 1}`);
      });
    }
    expect(
      infratores,
      'Use CHART_FONT.axis ou CHART_FONT.label — número em fontSize não acompanha a resolução.',
    ).toEqual([]);
  });
});
