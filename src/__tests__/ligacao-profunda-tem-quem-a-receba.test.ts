/**
 * Toda a ligação profunda tem, do outro lado, quem a receba.
 *
 * `ENTITY_DEFS` é o único sítio onde se decide para onde leva um registo — a
 * busca global (⌘K), o `EntidadeSelect` e o sino passam todos por
 * `routeForEntity`. Emitir um endereço é barato; ser lido é que não, e a
 * diferença não se vê: uma página que ignora o parâmetro abre na mesma, só
 * que na LISTA INTEIRA. O clique parece ter funcionado e não funcionou.
 *
 * Foi o que se mediu nesta varredura — nove das vinte e uma entidades
 * apontavam para páginas que nunca liam o parâmetro, e duas apontavam com o
 * nome errado (`/riscos` abre por `?risco=`, o detalhe de framework por
 * `?req=`; ambas recebiam `?focus=`). Nenhum teste falhava, porque não havia
 * teste: o defeito é a AUSÊNCIA de um leitor, e isso não parte nada.
 *
 * Três regras, todas verificáveis sem navegador:
 *   1. o endereço emitido corresponde a uma rota declarada em `App.tsx`;
 *   2. quando o id viaja em parâmetro, o destino declarado lê ESSE parâmetro;
 *   3. o mapa cobre exactamente as entidades que existem — nem a menos (uma
 *      entidade nova sem destino passaria despercebida) nem a mais.
 */
import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { ENTITY_DEFS, type EntityKey } from '@/lib/entity-search';
import { ler, linhas, semComentario } from './_fontes';

/**
 * Quem lê o parâmetro de cada entidade.
 *
 * Não é o ficheiro da rota: é o ficheiro onde o parâmetro é efectivamente
 * consumido — muitas vezes um conteúdo montado pela página (`ControlesContent`
 * dentro de `/governanca/controles`) ou a tabela dentro da aba
 * (`GenericRequirementsTable`). Manter isto à mão é de propósito: seguir os
 * imports até ao fundo faria a guarda encontrar um `searchParams.get('focus')`
 * em qualquer página vizinha e dar-se por satisfeita.
 */
const CONSUMIDORES: Record<EntityKey, string[]> = {
  risco: ['src/pages/Riscos.tsx'],
  controle: ['src/components/governanca/ControlesContent.tsx'],
  gap_requirement: [
    'src/pages/GapAnalysisFrameworkDetail.tsx',
    'src/components/gap-analysis/GenericRequirementsTable.tsx',
  ],
  ativo: ['src/pages/Ativos.tsx'],
  licenca: ['src/pages/AtivosLicencas.tsx'],
  chave: ['src/pages/AtivosChaves.tsx'],
  documento: ['src/pages/Documentos.tsx'],
  contrato: ['src/pages/Contratos.tsx'],
  fornecedor: ['src/pages/Contratos.tsx'],
  incidente: ['src/pages/Incidentes.tsx'],
  auditoria: ['src/components/governanca/AuditoriasContent.tsx'],
  auditoria_item: ['src/components/governanca/AuditoriasContent.tsx'],
  projeto: ['src/pages/ProjetoDetalhe.tsx'],
  tarefa: ['src/pages/ProjetoDetalhe.tsx'],
  plano_acao: ['src/pages/PlanosAcao.tsx'],
  denuncia: ['src/pages/Denuncia.tsx'],
  dados_pessoais: ['src/pages/Privacidade.tsx'],
  ropa: ['src/pages/Privacidade.tsx'],
  conta_privilegiada: ['src/pages/ContasPrivilegiadas.tsx'],
  continuidade: ['src/pages/Continuidade.tsx'],
  due_diligence: ['src/pages/DueDiligence.tsx'],
};

/** Linha falsa com os campos que as rotas usam para se construir. */
const ID = '11111111-2222-3333-4444-555555555555';
const linhaFalsa = {
  id: ID,
  framework_id: 'fw-1',
  projeto_id: 'pj-1',
  auditoria_id: 'au-1',
};

/** Caminhos declarados em `App.tsx`, com `:param` já virado curinga. */
function rotasDeclaradas(): RegExp[] {
  return [...ler('src/App.tsx').matchAll(/path="([^"]+)"/g)]
    .map((m) => m[1])
    .filter((p) => p.startsWith('/'))
    .map((p) => new RegExp(`^${p.replace(/:[^/]+/g, '[^/]+')}$`));
}

/**
 * Um ficheiro lê `nome` se o for buscar aos parâmetros do endereço — ou, no
 * caso de `focus`, se chamar o gancho que o lê por ele.
 *
 * Linha a linha e sem comentários: à primeira tentativa esta guarda leu o
 * ficheiro inteiro como texto e deu-se por satisfeita com um
 * `// useFocusRow();` comentado — exactamente o estado que devia acusar. Uma
 * guarda que aceita a MENÇÃO em vez do uso não guarda nada.
 */
function le(ficheiro: string, nome: string): boolean {
  return linhas(ficheiro).some((l) => {
    const codigo = semComentario(l);
    return (
      codigo.includes(`searchParams.get('${nome}')`) ||
      codigo.includes(`searchParams.get("${nome}")`) ||
      (nome === 'focus' && /useFocusRow\(/.test(codigo))
    );
  });
}

describe('ligação profunda tem quem a receba', () => {
  it('o mapa de destinos cobre exactamente as entidades que existem', () => {
    const doRegisto = ENTITY_DEFS.map((d) => d.key).sort();
    const doMapa = (Object.keys(CONSUMIDORES) as EntityKey[]).sort();
    expect(doMapa, 'entidade sem destino declarado (ou destino a mais)').toEqual(doRegisto);
  });

  it('cada endereço emitido corresponde a uma rota declarada', () => {
    const rotas = rotasDeclaradas();
    expect(rotas.length, 'nenhuma rota lida de App.tsx — a guarda deixou de ver o produto')
      .toBeGreaterThan(20);

    const orfas: string[] = [];
    for (const def of ENTITY_DEFS) {
      const caminho = def.route(linhaFalsa).split('?')[0];
      if (!rotas.some((r) => r.test(caminho))) orfas.push(`${def.key} → ${caminho}`);
    }
    expect(orfas, `endereço sem rota em App.tsx:\n${orfas.join('\n')}`).toEqual([]);
  });

  it('usa o nome que o destino já tinha, em vez de inventar um novo', () => {
    const nomeDe = (chave: EntityKey) => {
      const def = ENTITY_DEFS.find((d) => d.key === chave)!;
      const query = def.route(linhaFalsa).split('?')[1] ?? '';
      return [...new URLSearchParams(query).entries()].find(([, v]) => v === ID)?.[0];
    };

    // Estas duas páginas abriam o registo muito antes de existir busca global,
    // cada uma com o seu nome. Ensinar-lhes `?focus=` seria criar um segundo
    // nome para a mesma coisa em ecrãs que já funcionavam.
    expect(nomeDe('risco'), '/riscos abre a gaveta por ?risco=').toBe('risco');
    expect(nomeDe('gap_requirement'), 'o detalhe de framework abre por ?req=').toBe('req');
    expect(nomeDe('plano_acao'), 'o detalhe abre por ?plano= mesmo quando a lista filtra itens encerrados').toBe('plano');

    // Todo o resto fala a grafia comum, a que o `useFocusRow` entende.
    const excepcoes = new Set<EntityKey>(['risco', 'gap_requirement', 'projeto', 'plano_acao']);
    const foragidos = ENTITY_DEFS.filter((d) => !excepcoes.has(d.key))
      .map((d) => [d.key, nomeDe(d.key)] as const)
      .filter(([, nome]) => nome !== 'focus');
    expect(foragidos, 'parâmetro fora do padrão sem razão declarada').toEqual([]);
  });

  it('o destino declarado lê o parâmetro que lhe é enviado', () => {
    const mudos: string[] = [];
    for (const def of ENTITY_DEFS) {
      const endereco = def.route(linhaFalsa);
      const [caminho, query] = endereco.split('?');
      const params = new URLSearchParams(query ?? '');

      // Entrada com id no próprio caminho (ex.: `/projetos/<id>`): não há
      // parâmetro para ninguém ler — a rota já É o registo.
      const nome = [...params.entries()].find(([, v]) => v === ID)?.[0];
      if (!nome) {
        if (!caminho.includes(ID)) mudos.push(`${def.key}: ${endereco} não leva o id a lado nenhum`);
        continue;
      }

      const ficheiros = CONSUMIDORES[def.key] ?? [];
      const emFalta = ficheiros.filter((f) => !existsSync(f));
      if (emFalta.length) {
        mudos.push(`${def.key}: destino inexistente — ${emFalta.join(', ')}`);
        continue;
      }
      if (!ficheiros.some((f) => le(f, nome))) {
        mudos.push(`${def.key}: ninguém lê "?${nome}=" em ${ficheiros.join(', ')}`);
      }
    }
    expect(
      mudos,
      `ligação profunda que morre em silêncio (a página abre a lista inteira):\n${mudos.join('\n')}`,
    ).toEqual([]);
  });
});
