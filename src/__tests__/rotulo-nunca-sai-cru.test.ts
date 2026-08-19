/**
 * Um valor de domínio nunca chega ao ecrã como está gravado.
 *
 * A guarda que já existia (`valor-de-dominio-com-rotulo`) procura o padrão no
 * JSX — `<Badge>{valor}</Badge>`. Deixou passar um caso que não é JSX: um
 * resolvedor de rótulo que, no ramo em que NÃO reconhece o valor, devolve a
 * variável crua.
 *
 *   label: estado === 'desconhecida' ? valor : t(`...${valor}`)
 *
 * O efeito foi ver "obrigacao_legal" e "contrato" no catálogo de dados
 * pessoais, em minúscula e com underscore, no meio de uma coluna de rótulos
 * próprios — e com o crachá vermelho de "base fora da lei" ao lado, porque a
 * mesma falta de reconhecimento classificava como ilícita uma hipótese que a
 * LGPD admite.
 *
 * Estes testes olham para o COMPORTAMENTO, não para a forma de escrever.
 */
import { describe, expect, it } from 'vitest';
import { formatStatus } from '@/lib/text-utils';
import { fontes, ler } from './_fontes';

/** Como o produto grava valores de domínio: snake_case, minúsculas. */
const SLUGS = [
  'obrigacao_legal',
  'execucao_contrato',
  'cumprimento_obrigacao',
  'legitimo_interesse',
  'muito_sensivel',
  'em_investigacao',
  'nao_conforme',
  'pendente_aprovacao',
  'planejamento',
  'contrato',
  'servicos',
  'critico',
];

describe('rótulo nunca sai cru', () => {
  it('formatStatus não devolve underscore nem inicial minúscula', () => {
    const maus: string[] = [];
    for (const s of SLUGS) {
      const r = formatStatus(s);
      if (r.includes('_')) maus.push(`${s} → "${r}" (underscore)`);
      else if (r && r[0] === r[0].toLowerCase() && r[0] !== r[0].toUpperCase()) {
        maus.push(`${s} → "${r}" (inicial minúscula)`);
      }
    }
    expect(maus, `valores que sairiam crus:\n${maus.join('\n')}`).toEqual([]);
  });

  it('o resolvedor de base legal formata o que não reconhece', () => {
    // O ramo `desconhecida` tem de passar por um tradutor. Sem isto, um valor
    // legado gravado antes do vocabulário actual sai como está no banco.
    const fonte = ler('src/hooks/useJurisdicao.ts');
    const ramo = /estado === 'desconhecida'\s*\?\s*([^:]+):/.exec(fonte);
    expect(ramo, 'o ramo de base legal desconhecida deixou de existir').not.toBeNull();
    expect(
      /formatStatus|capitalize|rotulo|t\(/.test(ramo![1]),
      `o ramo devolve "${ramo![1].trim()}" sem passar por um tradutor`,
    ).toBe(true);
  });

  it('há um só selo de framework no produto', () => {
    // Havia dois: `FrameworkBadge` (agora com glifo do assunto) e `FwMono`,
    // que desenhava a sigla em duas linhas — "SOC" sobre "2TYPEI". Dois selos
    // para a mesma coisa é a garantia de que um deles fica para trás.
    const selos = fontes().filter((f) => /FwMono|FrameworkLogos?\.tsx$/.test(f) && !f.includes('FrameworkLogos.tsx'));
    expect(selos, `selos de framework a mais: ${selos.join(', ')}`).toEqual([]);
  });
});
