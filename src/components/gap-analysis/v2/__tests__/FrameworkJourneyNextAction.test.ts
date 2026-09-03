import { describe, expect, it } from 'vitest';
import { getFrameworkJourneyAction } from '../FrameworkJourneyNextAction';

describe('próxima ação da jornada do framework', () => {
  it('começa pelo escopo antes de expor a lista inteira', () => {
    expect(getFrameworkJourneyAction({
      scopeDeclared: false,
      unevaluated: 121,
      openGaps: 0,
      missingEvidence: 0,
    })).toBe('scope');
  });

  it('mantém o diagnóstico até todos os requisitos do escopo terem resposta', () => {
    expect(getFrameworkJourneyAction({
      scopeDeclared: true,
      unevaluated: 12,
      openGaps: 4,
      missingEvidence: 2,
    })).toBe('diagnosis');
  });

  it('leva os gaps ao plano antes de pedir evidências', () => {
    expect(getFrameworkJourneyAction({
      scopeDeclared: true,
      unevaluated: 0,
      openGaps: 4,
      missingEvidence: 2,
    })).toBe('adaptation');
  });

  it('pede evidências depois do diagnóstico e da adequação', () => {
    expect(getFrameworkJourneyAction({
      scopeDeclared: true,
      unevaluated: 0,
      openGaps: 0,
      missingEvidence: 2,
    })).toBe('evidence');
  });

  it('chega à revisão quando a jornada está completa', () => {
    expect(getFrameworkJourneyAction({
      scopeDeclared: true,
      unevaluated: 0,
      openGaps: 0,
      missingEvidence: 0,
    })).toBe('review');
  });
});
