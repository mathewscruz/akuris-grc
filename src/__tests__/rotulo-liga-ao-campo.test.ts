/**
 * O rótulo que está por cima do campo tem de estar LIGADO ao campo.
 *
 * Medido no navegador, com a mesma API que um leitor de ecrã usa
 * (`input.labels`): no diálogo «Novo Ativo», OITO dos nove campos não tinham
 * nome nenhum — nem rótulo associado, nem `aria-label`, nem sequer um
 * `placeholder` de onde tirar um. O leitor anuncia «caixa de texto, vazia»
 * oito vezes seguidas, e quem depende dele não consegue preencher o
 * formulário principal do módulo. Em «Novo Plano de Continuidade» eram os
 * três de três.
 *
 * Visualmente estava tudo bem, e é por isso que passou: o `<Label>` fica logo
 * acima do `<Input>` e lê-se como um par. Só que sem `htmlFor` não são um
 * par — são duas caixas vizinhas. Clicar no rótulo também não põe o cursor no
 * campo, o que no telemóvel deita fora um alvo de toque grande por cada campo.
 *
 * Oitenta e oito campos foram ligados de uma vez, com o `id` tirado do estado
 * a que cada um já se ligava (`formData.quantidade` → `id="quantidade"`).
 */
import { describe, expect, it } from 'vitest';
import { fontesTodas, ler, tagsJsx } from './_fontes';

/** Rótulo e campo são vizinhos quando só há espaços entre eles. */
const VIZINHOS = /^\s*$/;

function paresRotuloCampo(fonte: string) {
  const campos = [
    ...tagsJsx(fonte, 'Input'),
    ...tagsJsx(fonte, 'Textarea'),
  ].sort((a, b) => a.posicao - b.posicao);

  const pares: Array<{ lattrs: string; campo: string; posicao: number }> = [];
  for (const { texto, posicao } of campos) {
    // O `</Label>` mais próximo antes deste campo.
    const fim = fonte.lastIndexOf('</Label>', posicao);
    if (fim === -1) continue;
    if (!VIZINHOS.test(fonte.slice(fim + '</Label>'.length, posicao))) continue;
    const inicio = fonte.lastIndexOf('<Label', fim);
    if (inicio === -1) continue;
    const abertura = fonte.slice(inicio, fonte.indexOf('>', inicio) + 1);
    pares.push({ lattrs: abertura, campo: texto, posicao });
  }
  return pares;
}

const semLigacao = (lattrs: string, campo: string) =>
  !/htmlFor/.test(lattrs) &&
  !/\bid=|aria-label|aria-labelledby|placeholder/.test(campo);

describe('rótulo liga ao campo', () => {
  it('nenhum campo fica sem nome acessível', () => {
    const infratores: string[] = [];

    for (const arquivo of fontesTodas()) {
      if (!arquivo.endsWith('.tsx')) continue;
      const fonte = ler(arquivo);
      for (const { lattrs, campo, posicao } of paresRotuloCampo(fonte)) {
        if (!semLigacao(lattrs, campo)) continue;
        infratores.push(`${arquivo}:${fonte.slice(0, posicao).split('\n').length}`);
      }
    }

    expect(
      infratores,
      'Rótulo e campo lado a lado, sem ligação: o leitor de ecrã anuncia o campo sem nome. ' +
        'Use <Label htmlFor="x"> com <Input id="x">.',
    ).toEqual([]);
  });

  it('a guarda enxerga o padrão que proíbe, e lê a tag até ao fim', () => {
    const acha = (s: string) =>
      paresRotuloCampo(s).some((p) => semLigacao(p.lattrs, p.campo));

    expect(acha('<Label>Nome</Label>\n<Input value={f.nome} />'), 'sem ligação').toBe(true);
    expect(acha('<Label htmlFor="n">Nome</Label>\n<Input id="n" value={f.nome} />'), 'ligado').toBe(false);
    expect(acha('<Label>Nome</Label>\n<Input aria-label="Nome" />'), 'nome por aria').toBe(false);

    // Rótulo com ícone e asterisco: uma primeira versão limitava o corpo a 140
    // caracteres e deixava escapar exactamente os dois campos mais visíveis do
    // diálogo de Ativos.
    const comEnfeites =
      '<Label className="flex gap-1">\n  <IconCalendar className="h-3.5 w-3.5" />\n  {t("x")} <span>*</span>\n</Label>\n<Input value={f.data} />';
    expect(acha(comEnfeites), 'rótulo com ícone e asterisco também conta').toBe(true);

    // O `placeholder` DEPOIS de um `onChange` comprido: a tag tem de ser lida
    // até ao fim, ou isto vira um falso positivo.
    const placeholderLonge =
      '<Label>X</Label>\n<Textarea value={r[`${q.id}_ev`] || ""} onChange={(e) => h(`${q.id}_ev`, e.target.value)} placeholder={t("p")} className="min-h-[100px] bg-white border-slate-200" />';
    expect(acha(placeholderLonge), 'placeholder longe do início não é infracção').toBe(false);
  });
});
