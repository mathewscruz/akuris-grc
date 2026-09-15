import { describe, expect, it, vi } from 'vitest';
import { getOrCreateGuidance } from '../../../supabase/functions/populate-requirement-guidance/guidance-service';

const value = { orientacao_implementacao: '## Faça nesta ordem\n- Formalize a devolução dos ativos.', exemplos_evidencias: '- Registro de devolução', perguntas_diagnostico: JSON.stringify([{ pergunta: 'A devolução é registrada?', peso: 2 }]) };
const dependencies = () => ({ cached: null as typeof value | null, force: false,
  claim: vi.fn().mockResolvedValue(true), readCached: vi.fn().mockResolvedValue(null),
  generate: vi.fn().mockResolvedValue(value), save: vi.fn().mockResolvedValue(value) });

describe('orientação custeada pela plataforma', () => {
  it('serve a orientação persistida sem modelo, limites de geração ou créditos', async () => {
    const deps = dependencies(); deps.cached = value;
    expect(await getOrCreateGuidance(deps)).toMatchObject({ ...value, cached: true });
    expect(deps.claim).not.toHaveBeenCalled(); expect(deps.generate).not.toHaveBeenCalled();
    expect(deps.save).not.toHaveBeenCalled();
  });
  it('entrega somente depois de persistir e reutiliza na próxima exibição', async () => {
    const deps = dependencies();
    deps.save.mockImplementation(async (data) => { deps.cached = data; return data; });
    expect(await getOrCreateGuidance(deps)).toMatchObject({ cached: false, pending: false });
    expect(await getOrCreateGuidance(deps)).toMatchObject({ cached: true });
    expect(deps.generate).toHaveBeenCalledTimes(1); expect(deps.save).toHaveBeenCalledTimes(1);
  });
  it('não apresenta sucesso quando a escrita falha', async () => {
    const deps = dependencies(); deps.save.mockRejectedValue(new Error('write failed'));
    await expect(getOrCreateGuidance(deps)).rejects.toThrow('write failed');
  });
  it('não persiste falha do provedor como orientação', async () => {
    const deps = dependencies(); deps.generate.mockResolvedValue(null);
    await expect(getOrCreateGuidance(deps)).rejects.toMatchObject({ code: 'guidance_generation_failed' });
    expect(deps.save).not.toHaveBeenCalled();
  });
  it('completa um cache parcial em vez de tratar qualquer texto como pronto', async () => {
    const deps = dependencies(); deps.cached = { ...value, exemplos_evidencias: '' };
    expect(await getOrCreateGuidance(deps)).toMatchObject({ cached: false });
    expect(deps.generate).toHaveBeenCalledOnce();
  });
  it('não salva geração incompleta nem anuncia sucesso se a releitura vier incompleta', async () => {
    const deps = dependencies(); deps.generate.mockResolvedValue({ ...value, perguntas_diagnostico: null });
    await expect(getOrCreateGuidance(deps)).rejects.toMatchObject({ code: 'guidance_generation_failed' });
    expect(deps.save).not.toHaveBeenCalled();
    deps.generate.mockResolvedValue(value); deps.save.mockResolvedValue({ ...value, exemplos_evidencias: '' });
    await expect(getOrCreateGuidance(deps)).rejects.toMatchObject({ code: 'guidance_save_failed' });
  });
  it('reconsulta o cache quando outro pedido já ocupou a janela de geração', async () => {
    const deps = dependencies(); deps.claim.mockResolvedValue(false); deps.readCached.mockResolvedValue(value);
    expect(await getOrCreateGuidance(deps)).toMatchObject({ cached: true });
    expect(deps.generate).not.toHaveBeenCalled();
  });
  it('sinaliza processamento pendente sem disparar outra chamada ao modelo', async () => {
    const deps = dependencies(); deps.claim.mockResolvedValue(false);
    expect(await getOrCreateGuidance(deps)).toMatchObject({ pending: true, retry_after: 10 });
    expect(deps.generate).not.toHaveBeenCalled();
  });
  it('regeneração explícita substitui o cache somente depois de salvar', async () => {
    const deps = dependencies(); deps.cached = value; deps.force = true;
    expect(await getOrCreateGuidance(deps)).toMatchObject({ cached: false });
    expect(deps.save).toHaveBeenCalledWith(value);
  });
});
