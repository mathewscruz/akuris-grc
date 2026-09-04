import { describe, expect, it } from 'vitest';
import { ler } from './_fontes';

const tabela = ler('src/components/ui/table.tsx');
const dataTable = ler('src/components/ui/data-table.tsx');
const abas = ler('src/components/ui/tabs.tsx');
const avatar = ler('src/components/ui/avatar.tsx');
const estilos = ler('src/index.css');
const riscos = ler('src/pages/Riscos.tsx');
const riscosTabs = ler('src/components/riscos/RiscosTabs.tsx');
const controles = ler('src/components/governanca/ControlesContent.tsx');
const navegacao = ler('src/components/icons/modules/NavigationIcons.tsx');
const governanca = ler('src/pages/Governanca.tsx');
const controleIcone = ler('src/components/icons/modules/ControlesIcon.tsx');
const auditoriaIcone = ler('src/components/icons/modules/AuditoriasIcon.tsx');
const governancaIcone = ler('src/components/icons/modules/GovernancaIcon.tsx');
const riscosIcone = ler('src/components/icons/modules/RiscosIcon.tsx');
const catalogoModulos = ler('src/lib/module-icons.ts');
const tailwind = ler('tailwind.config.ts');
const html = ler('index.html');

describe('padrão visual das tabelas', () => {
  it('leva o degradê de Atividades Recentes para a tabela compartilhada', () => {
    expect(tabela).toContain('akuris-table');
    expect(tabela).toContain('realce-linha-tabela');
    expect(estilos).toContain('.akuris-table tbody');
    expect(estilos).toContain('hsl(var(--accent) / 0) 0');
    expect(estilos).toContain('.realce-linha:focus-visible,');
    expect(estilos).toContain('.akuris-table tbody > tr:not([data-table-static]):hover');
    expect(estilos).toContain('@media (prefers-reduced-motion: reduce)');
  });

  it('faz o cabeçalho tonal dissolver-se na superfície da tabela', () => {
    expect(tabela).toContain('akuris-table-header');
    expect(dataTable).toContain('<TableHeader className="sticky top-0 z-20">');
    expect(estilos).toContain('.akuris-table > thead th');
    expect(estilos).toContain('linear-gradient(');
    expect(estilos).toContain('hsl(var(--card)) 100%');
  });

  it('não sugere interação no estado vazio', () => {
    expect(dataTable).toContain('<TableRow data-table-static="">');
    expect(estilos).toContain('tr:not([data-table-static])');
  });
});

describe('tipografia do produto', () => {
  it('usa DM Sans como única família de interface', () => {
    expect(tailwind).toContain("sans: ['DM Sans', 'system-ui', 'sans-serif']");
    expect(tailwind).toContain("display: ['DM Sans', 'system-ui', 'sans-serif']");
    expect(tailwind).toContain("mono: ['DM Sans', 'system-ui', 'sans-serif']");
    expect(html).toContain('family=DM+Sans:ital,opsz,wght@0,9..40,300');
    expect(estilos).toContain('@apply bg-background font-sans text-foreground antialiased');
    expect(estilos).toContain(':where(h1, h2, h3)');
    expect(estilos).toContain('letter-spacing: -0.018em');
    expect(estilos).toContain(':where(code, kbd, samp, pre, .font-mono)');
    expect(estilos).toContain('font-variant-numeric: tabular-nums slashed-zero');
    expect(estilos).toContain('letter-spacing: 0.035em');
    expect(`${tailwind}\n${html}\n${estilos}`).not.toContain('JetBrains Mono');
    expect(`${tailwind}\n${html}\n${estilos}`).not.toContain("'Inter'");
    expect(`${tailwind}\n${html}\n${estilos}`).not.toContain('IBM Plex Sans');
  });
});

describe('navegação visual', () => {
  it('dá estado consistente aos ícones de todas as abas', () => {
    expect(abas).toContain('[&_svg]:text-muted-foreground/80');
    expect(abas).toContain('data-[state=active]:[&_svg]:scale-105');
    expect(abas).toContain('data-[state=active]:[&_svg]:text-primary');
  });

  it('faz Riscos ser a primeira aba e o destino principal', () => {
    expect(riscosTabs.indexOf('value="table"')).toBeLessThan(riscosTabs.indexOf('value="matrix"'));
    expect(riscosTabs).toContain('<RiscosIcon />');
    expect(riscosTabs).toContain('<IconGrid />');
    expect(riscosTabs).toContain("return 'table';");
    expect(riscos.indexOf('<SeverityKpiRow counts={sevCounts} />')).toBeGreaterThan(riscos.indexOf('const tableNode'));
  });
});

describe('identidade em pessoas e ações', () => {
  it('o avatar tem fotografia enquadrada e fallback de marca', () => {
    expect(avatar).toContain('object-cover');
    expect(avatar).toContain('ring-1 ring-border/80');
    expect(avatar).toContain('bg-gradient-to-br from-primary/20');
    expect(controles).toContain("controle.responsavel_nome.split(/\\s+/)[0]");
  });

  it('Categorias não é a única ação sem glifo', () => {
    const inicio = controles.indexOf('<ActionsMenuItem onClick={() => setCategoriasDialogOpen(true)}>');
    const fim = controles.indexOf('</ActionsMenuItem>', inicio);
    expect(controles.slice(inicio, fim)).toContain('<IconTag');
  });

  it('relatórios, configurações e saída têm silhuetas próprias', () => {
    expect(navegacao).toContain('folha analítica com três séries');
    expect(navegacao).toContain('Configurações — engrenagem');
    expect(navegacao).toContain('vão aberto e percurso para fora');
  });

  it('riscos usa um sinal de atenção inequívoco', () => {
    expect(riscosIcone).toContain('sinal de atenção com exclamação');
    expect(riscosIcone).toContain('M12 3 21 20H3L12 3Z');
    expect(riscosIcone).toContain('M12 9v5');
  });

  it('planos e projetos não são trajetos abstratos no menu', () => {
    expect(navegacao).toContain('prancheta com duas entregas verificáveis');
    expect(navegacao).toContain('pasta de trabalho com uma linha de três marcos');
    expect(navegacao).not.toContain('M4 19h4v-4h4v-4h4V7h4');
  });

  it('controles e auditorias usam metáforas próprias em todas as rotas', () => {
    expect(governanca).toContain('<ControlesIcon className="h-5 w-5" />');
    expect(governanca).toContain('<AuditoriasIcon className="h-5 w-5" />');
    expect(governanca).not.toContain('<IconShield');
    expect(governanca).not.toContain('<IconFile');
    expect(controleIcone).toContain('consola operacional com três parâmetros regulados');
    expect(auditoriaIcone).toContain('evidência documental observada por uma lente');
    expect(governancaIcone).toContain('decisão central que orienta duas frentes de execução');
    expect(catalogoModulos).toContain("'/governanca': GovernancaIcon");
    expect(catalogoModulos).toContain("'/governanca/controles': ControlesIcon");
    expect(catalogoModulos).toContain("'/governanca/auditorias': AuditoriasIcon");
  });
});
