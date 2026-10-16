import { describe, it, expect } from 'vitest';
import { getModuleGroup } from '@/lib/navigation';

const t = (k: string) => k;

describe('grupo do menu por caminho', () => {
  it('liga cada página ao grupo do menu lateral', () => {
    expect(getModuleGroup('/incidentes', t)).toBe('sidebar.groupRisks');
    expect(getModuleGroup('/contratos/123', t)).toBe('experience.thirdPartiesEthics');
    expect(getModuleGroup('/documentos', t)).toBe('sidebar.groupCompliance');
    expect(getModuleGroup('/governanca/controles', t)).toBe('sidebar.groupCompliance');
    expect(getModuleGroup('/gap-analysis/framework/x', t)).toBe('sidebar.groupCompliance');
    expect(getModuleGroup('/projetos', t)).toBe('sidebar.groupExecution');
    expect(getModuleGroup('/ativos/licencas', t)).toBe('sidebar.assetManagement');
  });
  it('itens de topo não têm grupo', () => {
    expect(getModuleGroup('/dashboard', t)).toBeNull();
    expect(getModuleGroup('/privacidade', t)).toBeNull();
  });
});
