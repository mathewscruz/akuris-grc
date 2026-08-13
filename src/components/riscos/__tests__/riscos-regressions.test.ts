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
  it('mantém nomes acessíveis nas ações que viram apenas ícones no mobile', () => {
    const riscosPage = source('src/pages/Riscos.tsx');
    // Após a internacionalização, os rótulos vêm do dicionário via t().
    expect(riscosPage).toContain("aria-label={t('riscos.page.export.aria')}");
    expect(riscosPage).toContain("aria-label={t('riscos.page.categoriesAria')}");
    expect(riscosPage).toContain("aria-label={t('riscos.page.newRiskAria')}");

    const dict = source('src/i18n/modules/riscos.ts');
    expect(dict).toContain('Exportar riscos');
    expect(dict).toContain('Categorias de riscos');
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
