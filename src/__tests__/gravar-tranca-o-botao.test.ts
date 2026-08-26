/**
 * Um clique duplo não pode gravar duas vezes.
 *
 * Medido no navegador, em Privacidade → «Novo Dado»: preenchido o formulário e
 * dados dois cliques em «Salvar» com 80 ms de intervalo — o que um duplo-clique
 * real faz — ficaram DUAS linhas em `dados_pessoais` com o mesmo nome. O botão
 * foi amostrado de 60 em 60 ms durante o gravar: `disabled` esteve `false` do
 * princípio ao fim.
 *
 * A causa era sempre a mesma, e é o que esta guarda apanha: o diálogo declarava
 * o estado de carregamento e nunca o lia.
 *
 *     const [isLoading, setIsLoading] = useState(false);   // declarado
 *     setIsLoading(true);  ...  setIsLoading(false);       // escrito
 *     <DialogShell onSubmit={handleSave}>                  // e nunca entregue
 *
 * O `DialogShell` já sabia travar-se — `isSubmitting` desliga o botão e troca o
 * rótulo por «Salvando...». Faltava passar-lhe o valor. Cinco diálogos assim:
 * Dados Pessoais, Mapeamento, ROPA, Solicitação do Titular e Utilizador de
 * Sistema. Nos dois primeiros o duplicado é ruído; em ROPA e nas solicitações
 * do titular é um registo de conformidade LGPD em duplicado.
 *
 * A regra: quem declara um estado de carregamento tem de o LER algures. Um
 * estado que só se escreve não trava nada — é um comentário caro.
 */
import { describe, expect, it } from 'vitest';
import { fontesTsx, ler } from './_fontes';

/** `const [xLoading, setXLoading] = useState(...)` e variantes. */
const DECLARACAO =
  /const\s*\[\s*(\w*(?:[Ll]oading|[Ss]aving|[Ss]ubmitting|[Ss]ending)\w*)\s*,\s*set\w+\s*\]\s*=\s*useState/g;

describe('gravar tranca o botão', () => {
  it('nenhum estado de carregamento é escrito sem nunca ser lido', () => {
    const infratores: string[] = [];

    for (const arquivo of fontesTsx()) {
      const fonte = ler(arquivo);
      // Só interessa quem grava: um componente que só lê não tem botão a travar.
      if (!/\.(insert|update|upsert)\(/.test(fonte)) continue;

      for (const m of fonte.matchAll(DECLARACAO)) {
        const nome = m[1];
        /*
          Conta as leituras: ocorrências do nome que não sejam `setNome` nem a
          própria declaração. O `(?<![\w.])` exclui `setIsLoading`; o `(?![\w(])`
          exclui `isLoadingOutraCoisa` e chamadas.
        */
        const usos = fonte.match(
          new RegExp(`(?<![\\w.])${nome}(?![\\w(])`, 'g'),
        );
        // 1 = só a declaração. Qualquer leitura verdadeira dá 2 ou mais.
        if ((usos?.length ?? 0) <= 1) {
          const linha = fonte.slice(0, m.index).split('\n').length;
          infratores.push(`${arquivo}:${linha} → «${nome}»`);
        }
      }
    }

    expect(
      infratores,
      'Estado de carregamento escrito e nunca lido: o botão de gravar não se desliga e um duplo-clique grava duas vezes. ' +
        'Passe-o ao rodapé (`isSubmitting={...}` no DialogShell) ou a `disabled` do botão.',
    ).toEqual([]);
  });

  it('a guarda enxerga o padrão que proíbe', () => {
    // Sem isto, um erro na regex transformaria a guarda num teste que passa sempre.
    const mau = `
      const [isLoading, setIsLoading] = useState(false);
      const salvar = async () => { setIsLoading(true); await supabase.from('x').insert({}); setIsLoading(false); };
      return <DialogShell onSubmit={salvar} />;
    `;
    const bom = `
      const [isLoading, setIsLoading] = useState(false);
      const salvar = async () => { setIsLoading(true); await supabase.from('x').insert({}); setIsLoading(false); };
      return <DialogShell onSubmit={salvar} isSubmitting={isLoading} />;
    `;
    const conta = (fonte: string, nome: string) =>
      (fonte.match(new RegExp(`(?<![\\w.])${nome}(?![\\w(])`, 'g')) ?? []).length;

    expect(conta(mau, 'isLoading')).toBe(1); // só a declaração → infrator
    expect(conta(bom, 'isLoading')).toBeGreaterThan(1); // declarado e lido
  });
});
