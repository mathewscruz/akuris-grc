/**
 * O ecrã tem de voltar a ler a base depois de alguém lhe escrever.
 *
 * Este teste guarda as três decisões que fazem a regra funcionar sem se
 * morder a si própria: o que conta como escrita, o que fica de fora, e o
 * facto de uma rajada de escritas dar um aviso só.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const REST = 'http://127.0.0.1:54321/rest/v1/';

let respostaOk = true;
const fetchOriginal = vi.fn(async () => new Response('[]', { status: respostaOk ? 200 : 400 }));

// O módulo troca o `fetch` ao ser lido: tem de haver um antes dele.
vi.stubGlobal('fetch', fetchOriginal);

const modulo = await import('../atualizar-apos-escrita');
const { escreveNaBase, seguirEscritas } = modulo;

describe('o que conta como escrita na base', () => {
  it('conta POST, PATCH, PUT e DELETE numa tabela', () => {
    for (const metodo of ['POST', 'PATCH', 'PUT', 'DELETE']) {
      expect(escreveNaBase(`${REST}riscos`, { method: metodo }), metodo).toBe(true);
    }
  });

  it('não conta uma leitura', () => {
    expect(escreveNaBase(`${REST}riscos?select=*`, { method: 'GET' })).toBe(false);
    expect(escreveNaBase(`${REST}riscos?select=*`)).toBe(false);
  });

  it('não conta uma função — há funções que só leem, e chamam-se por POST', () => {
    // Sem esta excepção, uma consulta que chama uma função punha-se a si
    // própria a reler para sempre.
    expect(escreveNaBase(`${REST}rpc/modulos_da_empresa`, { method: 'POST' })).toBe(false);
  });

  it('não conta renovar a sessão nem subir um ficheiro', () => {
    expect(escreveNaBase('http://127.0.0.1:54321/auth/v1/token', { method: 'POST' })).toBe(false);
    expect(escreveNaBase('http://127.0.0.1:54321/storage/v1/object/evidencias/x.pdf', { method: 'POST' })).toBe(false);
  });
});

describe('o aviso', () => {
  let avisos: number;
  let desligar: () => void;

  beforeEach(() => {
    vi.useFakeTimers();
    avisos = 0;
    respostaOk = true;
    fetchOriginal.mockClear();
    desligar = seguirEscritas(() => { avisos += 1; });
  });

  afterEach(() => {
    desligar();
    vi.useRealTimers();
  });

  it('chega depois de uma escrita', async () => {
    await fetch(`${REST}riscos`, { method: 'POST' });
    expect(avisos).toBe(0);          // ainda não: espera para juntar as outras
    await vi.advanceTimersByTimeAsync(300);
    expect(avisos).toBe(1);
  });

  it('é um só para uma rajada — gravar dez linhas não são dez releituras', async () => {
    for (let i = 0; i < 10; i += 1) {
      await fetch(`${REST}riscos_tratamentos`, { method: 'POST' });
    }
    await vi.advanceTimersByTimeAsync(300);
    expect(avisos).toBe(1);
  });

  it('não chega quando a base recusa a escrita', async () => {
    respostaOk = false;
    await fetch(`${REST}riscos`, { method: 'POST' });
    await vi.advanceTimersByTimeAsync(300);
    expect(avisos, 'uma escrita recusada não muda nada — reler seria só ruído').toBe(0);
  });

  it('não chega por causa de uma leitura', async () => {
    await fetch(`${REST}riscos?select=*`);
    await vi.advanceTimersByTimeAsync(300);
    expect(avisos).toBe(0);
  });

  it('deixa a resposta passar intacta', async () => {
    const resposta = await fetch(`${REST}riscos`, { method: 'POST' });
    expect(resposta.status).toBe(200);
    expect(fetchOriginal).toHaveBeenCalled();
  });

  it('orientação incluída não anuncia débito de franquia na interface', async () => {
    const debit = vi.fn();
    window.addEventListener('ai-credit-consumed', debit);
    try {
      await fetch('http://127.0.0.1:54321/functions/v1/populate-requirement-guidance', { method: 'POST' });
      expect(debit).not.toHaveBeenCalled();
    } finally { window.removeEventListener('ai-credit-consumed', debit); }
  });

  it('demais funcionalidades continuam anunciando consumo de IA', async () => {
    const debit = vi.fn();
    window.addEventListener('ai-credit-consumed', debit);
    try {
      await fetch('http://127.0.0.1:54321/functions/v1/suggest-risk-treatment', { method: 'POST' });
      expect(debit).toHaveBeenCalledTimes(1);
    } finally { window.removeEventListener('ai-credit-consumed', debit); }
  });
});
