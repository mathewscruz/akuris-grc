/**
 * O produto oferece os mesmos recursos seja qual for o framework.
 *
 * A empresa escolhe o framework que quiser do catálogo, e o Akuris tinha
 * capacidades atrás de comparações com o **nome**:
 *
 *   - a aba de Aplicabilidade (SoA) só existia se o nome contivesse "27001" ou
 *     "27701" — quem escolhesse LGPD, PCI DSS ou NIST CSF não tinha como
 *     declarar um requisito fora do escopo, e via o score calculado sobre
 *     requisitos que não lhe dizem respeito;
 *   - os segmentos dessa aba eram "Cláusulas" e "Anexo A", que só descrevem a
 *     ISO 27001; noutro framework um botão devolvia tudo e o outro nada;
 *   - a tradução das categorias só acontecia se o nome contivesse "nist";
 *   - o NIST CSF era o único pontuado de 0 a 5 — a lista mostrava **44** e o
 *     detalhe do mesmo framework mostrava **2%**, ao mesmo tempo.
 *
 * Conteúdo pode variar por framework (o texto de boas-vindas, o selo, a ordem
 * recomendada por jurisdição). **Capacidade, não.**
 */
import { describe, it, expect } from 'vitest';
import { fontes, ler, linhas } from './_fontes';

/** Arquivos que decidem o que a interface do módulo oferece. */
const DECISORES = [
  'src/pages/GapAnalysisFrameworkDetail.tsx',
  'src/components/gap-analysis/GenericRequirementsTable.tsx',
  'src/components/gap-analysis/v2/SoATabV2.tsx',
  'src/components/gap-analysis/v2/FrameworkHeader.tsx',
];

/**
 * Comparação com o nome do framework para decidir comportamento.
 *
 * Fica de fora `FrameworkOnboarding` e os selos, que escolhem **texto e ícone**
 * a partir do nome e têm sempre um caso genérico — isso é conteúdo.
 */
const DECIDE_PELO_NOME =
  /\b(nome|frameworkName|framework\.nome)\b[^\n]{0,40}\.(includes|startsWith|match)\s*\(/i;

const ehComentario = (linha: string) => /^\s*(\/\/|\*|\/\*)/.test(linha);

describe('paridade entre frameworks', () => {
  it('nenhuma capacidade do módulo depende do nome do framework', () => {
    const infratores: string[] = [];
    for (const f of DECISORES) {
      linhas(f).forEach((linha, i) => {
        if (ehComentario(linha)) return;
        if (DECIDE_PELO_NOME.test(linha)) infratores.push(`${f}:${i + 1}`);
      });
    }
    expect(infratores, 'recurso escondido atrás do nome do framework').toEqual([]);
  });

  it('a Declaração de Aplicabilidade está disponível para todos', () => {
    const detalhe = ler('src/pages/GapAnalysisFrameworkDetail.tsx');
    // A aba não pode voltar a ficar atrás de um condicional de nome.
    expect(detalhe).not.toMatch(/\{\s*supportsSoA\s*&&/);
    expect(detalhe).toContain('value="soa"');
  });

  it('os segmentos do SoA vêm da configuração, não de códigos da ISO', () => {
    const soa = ler('src/components/gap-analysis/v2/SoATabV2.tsx');
    expect(soa).toContain('sections');
    expect(soa).not.toContain('anexo_a');
    expect(soa).not.toContain('isAnexoA');
  });

  it('existe uma escala de score só, em percentagem', () => {
    const config = ler('src/lib/framework-configs.ts');
    expect(config).not.toContain("'scale_0_5'");
    expect(config).not.toContain('NIST_STATUS_SCORES');

    // E nenhum ecrã volta a bifurcar entre percentagem e escala decimal.
    const bifurcam = fontes()
      .filter((f) => f.includes('gap'))
      .filter((f) => /scoreType\s*===\s*'percentage'\s*\?/.test(ler(f)));
    expect(bifurcam).toEqual([]);
  });
});
