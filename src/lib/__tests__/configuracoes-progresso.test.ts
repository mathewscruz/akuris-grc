import { describe, it, expect } from 'vitest';
import { calcularProgressoConfiguracao } from '../configuracoes/progresso';

const base = { usuarios: 3, logo: true, slug: true, integracoes: 1, denunciaAtiva: true, trustPublicado: true };

describe('calcularProgressoConfiguracao', () => {
  it('tudo medido e feito conta 6 de 6', () => {
    expect(calcularProgressoConfiguracao(base)).toMatchObject({ feitos: 6, total: 6, pendentes: [] });
  });
  it('item sem dados não conta como concluído', () => {
    expect(calcularProgressoConfiguracao({ ...base, logo: null }).pendentes).toEqual(['logo']);
  });
  it('só o próprio admin não conta como usuários convidados', () => {
    expect(calcularProgressoConfiguracao({ ...base, usuarios: 1 }).pendentes).toEqual(['usuarios']);
  });
  it('nenhuma integração conectada fica pendente', () => {
    expect(calcularProgressoConfiguracao({ ...base, integracoes: 0 }).pendentes).toEqual(['integracao']);
  });
});
