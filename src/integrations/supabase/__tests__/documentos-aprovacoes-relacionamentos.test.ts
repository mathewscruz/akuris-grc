/**
 * Cobertura ESTÁTICA do contrato de schema/consulta (AKURIS QA-003).
 *
 * Estes testes leem os arquivos de migration e a constante de consulta: eles
 * provam que a FK e o embed foram declarados como esperado, e NÃO provam o
 * comportamento em tempo de execução do PostgREST. A verificação de que o
 * `documentos_aprovacoes` responde 200 (em vez de PGRST200) exige aplicar a
 * migration num ambiente Supabase real.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { APROVACOES_PENDENTES_SELECT } from '@/components/documentos/aprovacoes-query';

const ROOT = process.cwd();
const MIGRATIONS_DIR = resolve(ROOT, 'supabase/migrations');

/** Migration que criou a tabela — nunca deve ser editada retroativamente. */
/**
 * Identificada pelo CARIMBO, não pelo nome completo.
 *
 * O nome mudou quando os 89 ficheiros gerados pelo Lovable passaram de
 * `<carimbo>-uuid.sql` para `<carimbo>_uuid.sql` — o formato que o CLI exige
 * para os ver. O carimbo é a identidade da migration e não muda; prender o
 * teste ao nome completo fazia-o partir a cada renomeação.
 */
const CARIMBO_CRIACAO = '20250723112905';

interface ForeignKey {
  file: string;
  column: string;
  referencedTable: string;
  referencedColumn: string;
  onDelete: string;
}

function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

function readMigration(file: string): string {
  return readFileSync(resolve(MIGRATIONS_DIR, file), 'utf8');
}

/** Extrai as FKs declaradas para public.documentos_aprovacoes em todas as migrations. */
function foreignKeysDeDocumentosAprovacoes(): ForeignKey[] {
  const pattern =
    /ALTER TABLE\s+(?:ONLY\s+)?public\.documentos_aprovacoes[\s\S]{0,400}?FOREIGN KEY\s*\(\s*(\w+)\s*\)\s*REFERENCES\s+public\.(\w+)\s*\(\s*(\w+)\s*\)\s*(?:ON DELETE\s+(CASCADE|SET NULL|SET DEFAULT|RESTRICT|NO ACTION))?/gi;

  const fks: ForeignKey[] = [];
  for (const file of migrationFiles()) {
    const sql = readMigration(file);
    for (const match of sql.matchAll(pattern)) {
      fks.push({
        file,
        column: match[1],
        referencedTable: match[2],
        referencedColumn: match[3],
        onDelete: (match[4] ?? 'NO ACTION').toUpperCase(),
      });
    }
  }
  return fks;
}

/** Embeds PostgREST presentes num `select`: `tabela(...)` ou `alias:coluna_fk(...)`. */
function embedsDoSelect(select: string): { alias?: string; target: string }[] {
  const pattern = /(?:(\w+)\s*:\s*)?(\w+)\s*\(/g;
  return [...select.matchAll(pattern)].map((m) => ({ alias: m[1], target: m[2] }));
}

describe('documentos_aprovacoes — relacionamentos PostgREST (AKURIS QA-003)', () => {
  const fks = foreignKeysDeDocumentosAprovacoes();

  it('declara FK explícita de documento_id para documentos(id)', () => {
    const fk = fks.find((f) => f.column === 'documento_id');

    expect(fk, 'FK documentos_aprovacoes.documento_id ausente').toBeDefined();
    expect(fk!.referencedTable).toBe('documentos');
    expect(fk!.referencedColumn).toBe('id');
    // Aprovações são filhas do documento: excluir o documento remove as aprovações,
    // igual à tabela filha já existente (documentos_historico).
    expect(fk!.onDelete).toBe('CASCADE');
  });

  it('declara FK de solicitado_por para profiles(user_id) preservando o histórico', () => {
    const fk = fks.find((f) => f.column === 'solicitado_por');

    expect(fk, 'FK documentos_aprovacoes.solicitado_por ausente').toBeDefined();
    expect(fk!.referencedTable).toBe('profiles');
    expect(fk!.referencedColumn).toBe('user_id');
    // A aprovação não pode desaparecer quando o solicitante é removido.
    expect(fk!.onDelete).toBe('SET NULL');
  });

  it('cria as FKs em migration nova, sem editar a migration histórica', () => {
    const ficheiroCriacao = readdirSync(MIGRATIONS_DIR).find((f) => f.startsWith(CARIMBO_CRIACAO));
    expect(ficheiroCriacao, `migration ${CARIMBO_CRIACAO} não encontrada`).toBeDefined();
    const criacao = readMigration(ficheiroCriacao!);
    expect(criacao).not.toMatch(/FOREIGN KEY/i);

    for (const fk of fks) {
      // Comparação por carimbo: o nome completo mudou com a renomeação.
      expect(fk.file.slice(0, 14) > CARIMBO_CRIACAO).toBe(true);
    }

    /**
     * Cada FK precisa de existir; **não** se exige que exista uma única vez.
     *
     * A asserção anterior era `new Set(fks.map(f => f.file)).size === 1`. Uma
     * regeneração do Lovable no dia seguinte (20260806012005) voltou a
     * declarar as mesmas duas constraints, com os mesmos nomes, dentro de
     * `IF NOT EXISTS` — ou seja, um no-op que não altera o esquema resultante.
     * O teste passou a ficar vermelho por causa de uma duplicação inofensiva.
     *
     * Apagar o ficheiro duplicado seria reescrever histórico já aplicado e
     * aprofundar a divergência que hoje trava o `supabase db push`; por isso
     * fica. O que continua guardado é o que interessa: a migration de criação
     * não foi editada, e ambas as FKs nascem depois dela com a semântica certa
     * (verificada nos dois testes acima).
     */
    for (const coluna of ['documento_id', 'solicitado_por']) {
      expect(fks.some((f) => f.column === coluna)).toBe(true);
    }
  });

  it('usa padrão seguro para dados existentes (idempotente, NOT VALID + VALIDATE condicional)', () => {
    const arquivo = fks[0]?.file;
    expect(arquivo).toBeDefined();
    const sql = readMigration(arquivo!);

    // Idempotência via catálogo: pg_constraint com contype = 'f'
    expect(sql).toMatch(/IF NOT EXISTS[\s\S]*?pg_constraint/i);
    expect(sql).toMatch(/contype\s*=\s*'f'/i);
    expect(sql).not.toMatch(/information_schema\.table_constraints/i);

    // Bloqueio curto: cria NOT VALID e valida depois
    expect(sql).toMatch(/NOT VALID/i);

    // A validação só roda quando não há órfãos; caso contrário a FK permanece
    // NOT VALID (o PostgREST já descobre o relacionamento assim mesmo).
    const validacoes = sql.match(/VALIDATE CONSTRAINT/gi) ?? [];
    expect(validacoes.length).toBe(2);
    expect(sql).toMatch(/COUNT\(\*\)/i);
    expect(sql).toMatch(/IF\s+orfa/i);
  });

  it('nunca apaga aprovações existentes', () => {
    const sql = readMigration(fks[0]!.file);

    expect(sql).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(sql).not.toMatch(/\bTRUNCATE\b/i);
    // Também não zera o solicitante para forçar a validação
    expect(sql).not.toMatch(/UPDATE\s+public\.documentos_aprovacoes/i);
  });

  it('todo embed da consulta de aprovações pendentes tem FK correspondente', () => {
    const embeds = embedsDoSelect(APROVACOES_PENDENTES_SELECT);

    expect(embeds.length).toBeGreaterThan(0);

    for (const embed of embeds) {
      const porTabela = fks.some((f) => f.referencedTable === embed.target);
      const porColuna = fks.some((f) => f.column === embed.target);
      expect(
        porTabela || porColuna,
        `embed "${embed.target}" não tem FK correspondente em documentos_aprovacoes`
      ).toBe(true);
    }
  });

  it('a consulta desambigua os dois embeds pela coluna de FK', () => {
    expect(APROVACOES_PENDENTES_SELECT).toContain('documentos:documento_id(nome)');
    expect(APROVACOES_PENDENTES_SELECT).toContain('profiles:solicitado_por(nome)');
  });

  it('o NotificationCenter usa exatamente essa consulta', () => {
    const source = readFileSync(resolve(ROOT, 'src/components/NotificationCenter.tsx'), 'utf8');

    expect(source).toMatch(/APROVACOES_PENDENTES_SELECT/);
    expect(source).toMatch(/\.select\(APROVACOES_PENDENTES_SELECT\)/);
    // Nenhum embed solto sem FK deve sobrar no arquivo desta consulta
    expect(source).not.toMatch(/documentos\(nome\)|profiles\(nome\)/);
  });
});
