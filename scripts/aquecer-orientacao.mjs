/**
 * Semeia a orientação dos requisitos, framework a framework.
 *
 * O produto gera orientação sob demanda: quem abre um requisito sem texto
 * dispara `populate-requirement-guidance`, o modelo escreve, e o resultado fica
 * gravado globalmente. O desenho está certo — o segundo cliente não paga o que
 * o primeiro pagou. O problema é quem é o primeiro.
 *
 * Hoje é o cliente. Ele abre o requisito, vê o pulso a girar, e às vezes vê a
 * geração falhar. Se os créditos de IA acabarem, vê a falha e mais nada. Num
 * módulo vendido como substituto de consultoria, a orientação é o produto: não
 * pode chegar por acaso, na ordem em que as pessoas clicam.
 *
 * Este script põe-nos à frente. Percorre os requisitos de um framework, chama
 * a função para os que ainda não têm texto, e pára onde mandarem.
 *
 * COMO USAR
 *
 *   node scripts/aquecer-orientacao.mjs --framework "ISO/IEC 27001"
 *   node scripts/aquecer-orientacao.mjs --framework "LGPD" --limite 20
 *   node scripts/aquecer-orientacao.mjs --relatorio
 *
 * Precisa de duas variáveis de ambiente:
 *   SUPABASE_URL              o projecto a semear
 *   SUPABASE_SERVICE_ROLE_KEY a chave de serviço desse projecto
 *
 * Notas de operação, aprendidas à força:
 *
 *  - **Consome créditos de IA.** Um requisito é uma chamada ao modelo. Semear a
 *    ISO 27001 inteira são ~120 chamadas. Use `--limite` para provar primeiro.
 *  - **É retomável.** Só chama para quem não tem texto; correr duas vezes não
 *    duplica gasto.
 *  - **É sequencial de propósito.** O gateway responde 429 com paralelismo, e
 *    uma falha a meio deixaria buracos difíceis de encontrar.
 *  - **Não substitui revisão.** O que sai é bom, mas é texto de conformidade
 *    escrito por um modelo. Leia antes de vender como orientação da casa.
 */

const args = process.argv.slice(2);
const opcao = (nome, omissao = null) => {
  const i = args.indexOf(`--${nome}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : omissao;
};
const tem = (nome) => args.includes(`--${nome}`);

const URL = process.env.SUPABASE_URL;
const CHAVE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !CHAVE) {
  console.error('Faltam SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente.');
  process.exit(1);
}

const rest = (caminho, extra = {}) =>
  fetch(`${URL}/rest/v1/${caminho}`, {
    headers: { apikey: CHAVE, Authorization: `Bearer ${CHAVE}`, ...extra },
  }).then((r) => r.json());

/**
 * Lê a tabela inteira, em páginas.
 *
 * O PostgREST tem tecto de linhas por resposta — no Supabase, mil. A primeira
 * versão deste relatório pedia cinco mil e recebia mil, e apresentava o
 * resultado como se fosse tudo: dizia que o PCI DSS tinha 249 requisitos
 * quando tem 288, e que a LGPD tinha 1 quando tem 56. Um relatório de
 * cobertura que mente sobre o denominador é pior do que não existir.
 */
async function restTudo(caminho, tamanho = 1000) {
  const saida = [];
  for (let inicio = 0; ; inicio += tamanho) {
    const pagina = await rest(caminho, { Range: `${inicio}-${inicio + tamanho - 1}` });
    if (!Array.isArray(pagina) || pagina.length === 0) break;
    saida.push(...pagina);
    if (pagina.length < tamanho) break;
  }
  return saida;
}

async function relatorio() {
  const linhas = await restTudo(
    'gap_analysis_requirements?select=orientacao_implementacao,gap_analysis_frameworks!inner(nome)',
  );
  const porFw = new Map();
  for (const l of linhas) {
    const nome = l.gap_analysis_frameworks?.nome ?? '(sem framework)';
    const atual = porFw.get(nome) ?? { total: 0, comTexto: 0 };
    atual.total += 1;
    if ((l.orientacao_implementacao ?? '').trim()) atual.comTexto += 1;
    porFw.set(nome, atual);
  }

  const ordenado = [...porFw.entries()].sort((a, b) => b[1].total - a[1].total);
  let total = 0, feitos = 0;
  console.log('\n  framework                          feitos / total    cobertura');
  console.log('  ' + '-'.repeat(64));
  for (const [nome, x] of ordenado) {
    total += x.total; feitos += x.comTexto;
    const pct = Math.round((x.comTexto / x.total) * 100);
    console.log(
      `  ${nome.padEnd(32)} ${String(x.comTexto).padStart(5)} / ${String(x.total).padEnd(5)} ${String(pct).padStart(8)}%`,
    );
  }
  console.log('  ' + '-'.repeat(64));
  console.log(`  ${'TOTAL'.padEnd(32)} ${String(feitos).padStart(5)} / ${String(total).padEnd(5)} ${String(Math.round((feitos / total) * 100)).padStart(8)}%\n`);
}

async function aquecer(nomeDoFramework, limite) {
  const frameworks = await rest(
    `gap_analysis_frameworks?select=id,nome&nome=eq.${encodeURIComponent(nomeDoFramework)}`,
  );
  if (!frameworks.length) {
    console.error(`Framework "${nomeDoFramework}" não existe.`);
    process.exit(1);
  }
  const fw = frameworks[0];

  const todos = await restTudo(
    `gap_analysis_requirements?select=id,codigo,orientacao_implementacao&framework_id=eq.${fw.id}&order=codigo`,
  );
  const faltam = todos.filter((r) => !(r.orientacao_implementacao ?? '').trim());
  const alvo = limite ? faltam.slice(0, limite) : faltam;

  console.log(`\n  ${fw.nome}: ${todos.length} requisitos, ${faltam.length} sem orientação.`);
  if (alvo.length === 0) { console.log('  Nada a fazer.\n'); return; }
  console.log(`  Vou gerar ${alvo.length}. Isto consome créditos de IA.\n`);

  let ok = 0, falhou = 0;
  for (const [i, req] of alvo.entries()) {
    const marca = `  [${String(i + 1).padStart(3)}/${alvo.length}] ${(req.codigo ?? req.id).padEnd(12)}`;
    try {
      const r = await fetch(`${URL}/functions/v1/populate-requirement-guidance`, {
        method: 'POST',
        headers: {
          apikey: CHAVE,
          Authorization: `Bearer ${CHAVE}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ requirement_id: req.id, locale: 'pt' }),
      });
      if (r.status === 402) {
        console.log(`${marca} créditos de IA esgotados — a parar aqui.`);
        break;
      }
      if (!r.ok) { falhou += 1; console.log(`${marca} HTTP ${r.status}`); continue; }
      const corpo = await r.json();
      if ((corpo?.orientacao_implementacao ?? '').trim()) {
        ok += 1;
        console.log(`${marca} ok (${corpo.orientacao_implementacao.length} caracteres)`);
      } else {
        falhou += 1;
        console.log(`${marca} devolveu vazio`);
      }
    } catch (e) {
      falhou += 1;
      console.log(`${marca} ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  console.log(`\n  ${ok} geradas, ${falhou} falharam. Corra de novo para retomar.\n`);
}

if (tem('relatorio')) {
  await relatorio();
} else {
  const framework = opcao('framework');
  if (!framework) {
    console.error('Uso: node scripts/aquecer-orientacao.mjs --framework "ISO/IEC 27001" [--limite 20]');
    console.error('     node scripts/aquecer-orientacao.mjs --relatorio');
    process.exit(1);
  }
  await aquecer(framework, Number(opcao('limite')) || null);
}
