import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { filterUuids, splitResponsavel } from '@/lib/uuid';
import { mensagemErroComentarios } from '../RiscoComentarios';
import { pt } from '@/i18n/pt';
import { modulesPt } from '@/i18n/modules';

const dictPt: Record<string, any> = { ...pt, ...modulesPt };
const tPt = (key: string) => {
  let r: any = dictPt;
  for (const k of key.split('.')) { r = r?.[k]; if (r === undefined) return key; }
  return typeof r === 'string' ? r : key;
};

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
const normalize = (value: string) => value.replace(/\s+/g, ' ').trim();

function createPolicy(sql: string, name: string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = sql.match(new RegExp(`CREATE POLICY "${escaped}"[\\s\\S]*?;(?:\\n|$)`, 'i'));
  if (!match) throw new Error(`policy não encontrada: ${name}`);
  return normalize(match[0]);
}

describe('regressões do módulo de riscos', () => {
  /**
   * A regra é "quem esconde o rótulo tem de dizer o nome de outra forma" — e
   * não "estes três botões têm aria-label".
   *
   * A versão anterior exigia `aria-label` em exportar e em categorias. Essas
   * duas ações passaram a viver em `PageHeader.secondaryActions`, um menu onde
   * cada item mostra o rótulo em texto: o nome acessível já vem do próprio
   * rótulo e um `aria-label` ali seria redundante. O teste ficou a guardar um
   * desenho que já não existe, e ficou vermelho por ter razão sobre o passado.
   *
   * Guardamos agora a invariante que continua a valer: o botão que encolhe
   * para só-ícone (`hidden sm:inline` à volta do texto) precisa de nome.
   */
  it('todo botão que esconde o rótulo no mobile mantém nome acessível', () => {
    const riscosPage = source('src/pages/Riscos.tsx');

    const botoes = riscosPage.match(/<Button\b[\s\S]*?<\/Button>/g) ?? [];
    const soIcone = botoes.filter((b) => /hidden sm:inline/.test(b));

    expect(soIcone.length, 'Riscos deixou de ter botões que encolhem para ícone — reveja esta guarda.').toBeGreaterThan(0);

    const semNome = soIcone.filter((b) => !/aria-label=/.test(b));
    expect(semNome, 'No mobile este botão fica só com o ícone: sem aria-label, o leitor de ecrã anuncia "botão".').toEqual([]);
  });

  it('as ações secundárias trazem rótulo de texto do dicionário', () => {
    const riscosPage = source('src/pages/Riscos.tsx');
    const bloco = riscosPage.slice(riscosPage.indexOf('secondaryActions={['));

    // Sem rótulo visível, o item do menu fica sem nome nenhum — nem texto, nem aria.
    const semRotulo = (bloco.match(/\{\s*label:[^}]*\}/g) ?? []).filter((item) => !/label:\s*t\(/.test(item));
    expect(semRotulo, 'Cada ação secundária tem de tirar o rótulo do dicionário via t().').toEqual([]);

    const dict = source('src/i18n/modules/riscos.ts');
    expect(dict).toContain('Novo risco');
  });


  it('filtra valores legados antes de consultas UUID', () => {
    expect(filterUuids(['DPO', '550e8400-e29b-41d4-a716-446655440000', '', null])).toEqual(['550e8400-e29b-41d4-a716-446655440000']);
    expect(splitResponsavel('Mathews Cruz - CISO')).toEqual({ userId: null, label: 'Mathews Cruz - CISO' });
  });

  it('traduz falhas conhecidas de comentários em ações úteis', () => {
    expect(mensagemErroComentarios({ code: 'PGRST205' }, tPt)).toMatch(/aplique a migração/i);
    expect(mensagemErroComentarios({ message: 'permission denied' }, tPt)).toMatch(/verifique sua sessão/i);
  });

  it('mantém as abas do perfil legíveis, sem compressão ou abreviações', () => {
    const drawer = source('src/components/riscos/RiscoDetailDrawer.tsx');
    expect(drawer).not.toMatch(/<TabsTrigger[^>]+className="[^"]*flex-1/i);
    expect(drawer).toContain("t('riscosDetalhe.drawer.comentarios')");
    expect(tPt('riscosDetalhe.drawer.comentarios')).toBe('Comentários');
  });

  it('leva a reavaliação sem motivo à aba que contém o campo exigido', () => {
    const wizard = source('src/components/riscos/RiscoFormWizard.tsx');
    const validationStart = wizard.indexOf(
      "if (finalizar && risco?.id && reavaliacaoInvalidaAceite(data) && !data.ultima_observacao_avaliacao?.trim())",
    );
    const validation = wizard.slice(validationStart, validationStart + 420);

    expect(validationStart).toBeGreaterThanOrEqual(0);
    expect(validation).toContain("setActiveTab('acompanhamento')");
    expect(validation).not.toContain("setActiveTab('avaliacao')");
    expect(wizard).toMatch(
      /<TabsContent value="acompanhamento"[\s\S]*?name="ultima_observacao_avaliacao"/,
    );
  });
});

describe('invariantes estruturais da migração QA-061 (sem Postgres/Supabase local disponível)', () => {
  const sql = source('supabase/migrations/20260806131000_riscos_comentarios_align.sql');
  const normalized = normalize(sql);

  it('define e reconcilia tipos/defaults obrigatórios e PK exatamente em id', () => {
    const create = normalized.match(/CREATE TABLE IF NOT EXISTS public\.riscos_comentarios \((.*?)\);/i)?.[1];
    expect(create).toBeTruthy();
    expect(create).toMatch(/id uuid PRIMARY KEY DEFAULT gen_random_uuid\(\)/i);
    expect(create).toMatch(/risco_id uuid NOT NULL/i);
    expect(create).toMatch(/user_id uuid NOT NULL/i);
    expect(create).toMatch(/comentario text NOT NULL/i);
    expect(create).toMatch(/mencoes text\[\]/i);
    expect(create).toMatch(/created_at timestamptz NOT NULL DEFAULT now\(\)/i);
    expect(normalized.match(/ALTER TABLE public\.riscos_comentarios ALTER COLUMN id SET DEFAULT gen_random_uuid\(\)/gi)).toHaveLength(1);
    expect(normalized.match(/ALTER TABLE public\.riscos_comentarios ALTER COLUMN created_at SET DEFAULT now\(\)/gi)).toHaveLength(1);
    expect(normalized).toMatch(/v_pk\.definition <> 'PRIMARY KEY \(id\)'/i);
    expect(normalized).toMatch(/ADD CONSTRAINT riscos_comentarios_pkey PRIMARY KEY \(id\)/i);
    expect(normalized).toMatch(/v_id_type <> 'uuid'/i);
    expect(normalized).toMatch(/v_risco_type <> 'uuid'/i);
    expect(normalized).toMatch(/v_user_type <> 'uuid'/i);
    expect(normalized).toMatch(/v_comentario_type <> 'text'/i);
    expect(normalized).toMatch(/v_mencoes_type <> 'text\[\]'/i);
    expect(normalized).toMatch(/v_created_type <> 'timestamp with time zone'/i);
  });

  it('reconcilia a definição completa da FK e recusa órfãos com diagnóstico', () => {
    const fkDefinition = 'FOREIGN KEY (risco_id) REFERENCES riscos(id) ON DELETE CASCADE';
    expect(normalized).toContain(`v_fk.definition <> '${fkDefinition}'`);
    expect(normalized).toContain(`pg_get_constraintdef(oid)='${fkDefinition}'`);
    expect(normalized).toMatch(/FOREIGN KEY \(risco_id\) REFERENCES public\.riscos\(id\) ON DELETE CASCADE/i);
    expect(normalized).toMatch(/comentários com risco_id órfão/i);
  });

  it('define DELETE como owner-only e tenant-scoped pela expressão da policy', () => {
    const policy = createPolicy(sql, 'Usuarios podem deletar proprios comentarios de risco');
    expect(policy).toMatch(/FOR DELETE USING \(auth\.uid\(\)=user_id AND EXISTS/i);
    expect(policy).toMatch(/r\.id=risco_id AND r\.empresa_id=public\.get_user_empresa_id\(\)/i);
  });
});
