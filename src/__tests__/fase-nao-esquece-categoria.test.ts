/**
 * Nenhuma categoria de requisito fica sem fase.
 *
 * O plano de fases divide os requisitos de um framework por quatro etapas
 * nomeadas. Se uma categoria não aparecer em nenhuma, os seus requisitos ficam
 * fora do painel: o utilizador fecha as quatro fases, lê "tudo concluído" e
 * ainda tem trabalho por fazer — que é a pior coisa que um plano pode dizer.
 *
 * Aconteceu no primeiro desenho: o PCI DSS ficou com sete das dezasseis
 * categorias por atribuir (Logging, Malware Protection, Secure Configurations,
 * Secure Software, Security Program, Security Testing, Transmission Security).
 * Num framework de 288 requisitos, isso são dezenas de linhas invisíveis ao
 * plano, e nada no código acusava.
 *
 * As categorias vivem no banco e o teste não tem banco: compara contra o
 * retrato commitado em `_categorias-por-framework.json`. A razão de não ler as
 * migrations está explicada abaixo.
 */
import { describe, expect, it } from 'vitest';
import { FASES_POR_FRAMEWORK, chaveDoFramework, fasesDe, progressoDasFases } from '@/lib/gap-fases';
import CATEGORIAS from './_categorias-por-framework.json';

/*
  Por que um retrato e não as migrations.

  A primeira versão desta guarda lia as categorias das migrations, partindo do
  princípio de que são a fonte do que existe no banco. Não são: o requisito
  12.1.1 do PCI DSS está no banco e em migration nenhuma, e com ele as
  categorias "Security Program" (37 requisitos) e "Secure Software" (17). Foram
  inseridas directamente, sem versionar — um ambiente novo semeado só pelas
  migrations não as teria.

  Enquanto isso não se resolve, o retrato `_categorias-por-framework.json` é a
  lista verdadeira. Regenerar quando um framework mudar:

    SELECT f.nome, json_agg(DISTINCT r.categoria ORDER BY r.categoria)
      FROM gap_analysis_frameworks f
      JOIN gap_analysis_requirements r ON r.framework_id = f.id
     GROUP BY f.nome;
*/

describe('fase não esquece categoria', () => {
  it('nenhuma categoria do framework fica sem fase', () => {
    const orfas: string[] = [];
    for (const [framework, categorias] of Object.entries(CATEGORIAS as Record<string, string[]>)) {
      const fases = FASES_POR_FRAMEWORK[framework];
      if (!fases) {
        orfas.push(`${framework}: sem plano de fases`);
        continue;
      }
      const cobertas = new Set(fases.flatMap((f) => f.categorias));
      for (const c of categorias) {
        if (!cobertas.has(c)) orfas.push(`${framework}: "${c}" não está em fase nenhuma`);
      }
    }
    expect(
      orfas,
      `o utilizador fecharia as quatro fases e ainda teria requisitos por fazer:\n${orfas.join('\n')}`,
    ).toEqual([]);
  });

  it('nenhuma fase declara categoria que o framework não tem', () => {
    const inventadas: string[] = [];
    for (const [framework, fases] of Object.entries(FASES_POR_FRAMEWORK)) {
      const reais = new Set((CATEGORIAS as Record<string, string[]>)[framework] ?? []);
      for (const fase of fases) {
        for (const c of fase.categorias) {
          if (!reais.has(c)) inventadas.push(`${framework}/${fase.id}: "${c}"`);
        }
      }
    }
    expect(
      inventadas,
      `categoria que não existe: a fase contaria zero para sempre:\n${inventadas.join('\n')}`,
    ).toEqual([]);
  });

  it('nenhuma categoria aparece em duas fases do mesmo framework', () => {
    const repetidas: string[] = [];
    for (const [framework, fases] of Object.entries(FASES_POR_FRAMEWORK)) {
      const vistas = new Map<string, string>();
      for (const fase of fases) {
        for (const c of fase.categorias) {
          const antes = vistas.get(c);
          if (antes) repetidas.push(`${framework}: "${c}" está em ${antes} e em ${fase.id}`);
          else vistas.set(c, fase.id);
        }
      }
    }
    expect(
      repetidas,
      `uma categoria em duas fases conta o mesmo trabalho duas vezes:\n${repetidas.join('\n')}`,
    ).toEqual([]);
  });

  it('cada framework com plano tem quatro fases e nenhuma vazia', () => {
    const maus: string[] = [];
    for (const [framework, fases] of Object.entries(FASES_POR_FRAMEWORK)) {
      if (fases.length !== 4) maus.push(`${framework}: ${fases.length} fases (esperava 4)`);
      for (const f of fases) {
        if (f.categorias.length === 0) maus.push(`${framework}/${f.id}: sem categorias`);
      }
    }
    expect(maus, maus.join('\n')).toEqual([]);
  });

  it('a chave do framework resolve pelo nome, não pelo id', () => {
    // Os frameworks são globais e vêm de migrations; o id difere entre
    // ambientes, o nome não.
    expect(chaveDoFramework('ISO/IEC 27001')).toBe('iso27001');
    expect(chaveDoFramework('PCI DSS')).toBe('pciDss');
    expect(chaveDoFramework('SOC 2 Type II')).toBe('soc2');
    expect(chaveDoFramework('NIST CSF')).toBe('nistCsf');
    expect(chaveDoFramework('ISO 9001')).toBeNull();
    expect(fasesDe('ISO 9001')).toBeNull();
  });

  it('a fase actual é a primeira que ainda tem trabalho', () => {
    const fases = FASES_POR_FRAMEWORK.iso27001;
    const total = { Contexto: 4, Liderança: 3, Apoio: 5, Planejamento: 5, Segurança: 37, Pessoas: 8, Físico: 12, Tecnologia: 33, Operação: 3, Avaliação: 6, Melhoria: 2 };

    // Primeira fase fechada, segunda por fechar.
    const p = progressoDasFases(fases, total, { Contexto: 4, Liderança: 3, Apoio: 5, Planejamento: 1 });
    expect(p[0].concluidos).toBe(12);
    expect(p[0].atual).toBe(false);
    expect(p[1].atual).toBe(true);

    // Tudo fechado: fica na última, que é a auditoria, e não no vazio.
    const tudo = progressoDasFases(fases, total, total);
    expect(tudo.filter((f) => f.atual)).toHaveLength(1);
    expect(tudo[3].atual).toBe(true);
  });
});
