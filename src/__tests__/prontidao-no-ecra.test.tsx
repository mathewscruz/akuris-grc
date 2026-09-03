/**
 * «Já posso marcar a auditoria?» — montado e clicado.
 *
 * O módulo respondia a onde estou (o índice), por onde começo (as fases) e o
 * que faço agora (a fila). Não respondia à última pergunta do percurso, e para
 * quem nunca passou por uma auditoria é a mais aflitiva. Quem contrata
 * consultoria tem alguém que diz «ainda não» ou «pode ir»; sem isso, a pessoa
 * marca cedo e reprova, ou não marca nunca.
 *
 * Três coisas que este ficheiro segura, e que nenhuma delas se vê olhando só
 * para a função pura:
 *
 *  · o número que aparece é o dos requisitos APLICÁVEIS, não o total — quem
 *    recortou o escopo não pode ler que lhe faltam requisitos que ele excluiu;
 *  · cada bloqueio leva à tabela filtrada — um problema sem caminho é metade
 *    de um problema;
 *  · a ressalva aparece TAMBÉM no estado «pronto», que é justamente onde a
 *    tentação de a esconder é maior.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CartaoDeProntidao } from '@/components/gap-analysis/v2/CartaoDeProntidao';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { persistExplicitLocale } from '@/lib/i18n-locale';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
    from: () => ({ select: () => ({ eq: async () => ({ data: [], error: null }) }) }),
  },
}));

/** Uma categoria, como o mapa de calor a entrega. */
const cat = (p: Partial<Record<string, number>>) => ({
  conforme: 0, parcial: 0, nao_conforme: 0, nao_aplicavel: 0, nao_avaliado: 0, total: 0, ...p,
}) as any;

function montar(categorias: any[], nome = 'ISO/IEC 27001', onVerEstado = () => {}) {
  persistExplicitLocale('pt-BR');
  return render(
    <LanguageProvider>
      <CartaoDeProntidao frameworkName={nome} categorias={categorias} onVerEstado={onVerEstado} />
    </LanguageProvider>,
  );
}

beforeEach(() => localStorage.clear());

describe('quando ainda falta', () => {
  it('diz quanto falta, e conta só o que é aplicável', () => {
    /* 10 requisitos, 3 fora do escopo pelo SoA: os aplicáveis são 7. */
    montar([cat({ total: 10, nao_aplicavel: 3, conforme: 4, nao_conforme: 2, nao_avaliado: 1 })]);
    expect(screen.getByText(/4 de 7 requisitos aplicáveis/), 'contou os excluídos').toBeTruthy();
  });

  it('lista os bloqueios do mais grave para o menos', () => {
    montar([cat({ total: 9, conforme: 1, nao_avaliado: 3, nao_conforme: 2, parcial: 3 })]);
    const itens = screen.getAllByRole('button').map((b) => b.textContent ?? '');
    expect(itens).toHaveLength(3);
    // Primeiro o que não se sabe; sem isso não se marca nada.
    expect(itens[0]).toMatch(/não foram avaliados/);
    expect(itens[1]).toMatch(/não conformes/);
    expect(itens[2]).toMatch(/parcialmente conformes/);
  });

  it('não inventa bloqueio que não existe', () => {
    montar([cat({ total: 5, conforme: 3, nao_conforme: 2 })]);
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.queryByText(/avaliados/)).toBeNull();
  });

  it('cada bloqueio leva à tabela filtrada por aquele estado', () => {
    const vistos: string[] = [];
    montar([cat({ total: 6, conforme: 2, nao_avaliado: 2, nao_conforme: 2 })], 'ISO/IEC 27001',
      (e: string) => vistos.push(e));
    for (const b of screen.getAllByRole('button')) fireEvent.click(b);
    expect(vistos).toEqual(['nao_avaliado', 'nao_conforme']);
  });

  it('nunca diz que se pode marcar', () => {
    montar([cat({ total: 4, conforme: 3, parcial: 1 })]);
    expect(screen.queryByText(/Pode contratar/)).toBeNull();
  });
});

describe('quando está pronto, diz o desfecho da família certa', () => {
  const tudoConforme = [cat({ total: 8, conforme: 8 })];

  it('ISO manda contratar organismo certificador', () => {
    montar(tudoConforme, 'ISO/IEC 27001');
    expect(screen.getByText(/organismo certificador acreditado/)).toBeTruthy();
  });

  it('LGPD diz que não existe certificado', () => {
    /* O produto já dizia a toda a gente «contrate um organismo certificador».
       Quem trabalha a LGPD ia procurar uma coisa que não existe. */
    montar(tudoConforme, 'LGPD');
    expect(screen.getByText(/não existe certificado para esta legislação/)).toBeTruthy();
    expect(screen.queryByText(/organismo certificador/)).toBeNull();
  });

  it('SOC 2 fala de relatório de auditor, não de certificado', () => {
    montar(tudoConforme, 'SOC 2 Type II');
    expect(screen.getByText(/auditor independente que emite o relatório/)).toBeTruthy();
  });

  it('NIST CSF diz que não há auditoria externa formal', () => {
    montar(tudoConforme, 'NIST CSF');
    expect(screen.getByText(/não tem auditoria externa formal/)).toBeTruthy();
  });

  it('a ressalva continua visível — sobretudo aqui', () => {
    montar(tudoConforme, 'ISO/IEC 27001');
    expect(
      screen.getByText(/A suficiência de cada prova é juízo do auditor/),
      'o «pronto» virou garantia de aprovação',
    ).toBeTruthy();
  });

  it('sem bloqueios não há nada para clicar', () => {
    montar(tudoConforme);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});

describe('os casos em que não se pronuncia', () => {
  it('framework a carregar não diz nada', () => {
    const { container } = montar([]);
    expect(container.textContent).toBe('');
  });

  it('escopo que excluiu tudo não vira «pronto»', () => {
    /* Sem esta regra, quem excluísse todos os requisitos no assistente de
       escopo lia «pode marcar a auditoria» com zero requisitos cumpridos. */
    const { container } = montar([cat({ total: 12, nao_aplicavel: 12 })]);
    expect(container.textContent).not.toMatch(/Pode contratar/);
  });
});

describe('em inglês', () => {
  it('o desfecho e a ressalva também', () => {
    persistExplicitLocale('en');
    render(
      <LanguageProvider>
        <CartaoDeProntidao
          frameworkName="ISO/IEC 27001"
          categorias={[cat({ total: 8, conforme: 8 })]}
          onVerEstado={() => {}}
        />
      </LanguageProvider>,
    );
    expect(screen.getByText(/accredited certification body/)).toBeTruthy();
    expect(screen.getByText(/is the auditor/)).toBeTruthy();
  });
});
