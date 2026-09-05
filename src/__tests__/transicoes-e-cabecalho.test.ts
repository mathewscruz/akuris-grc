import { describe, expect, it } from 'vitest';
import { ler } from './_fontes';

describe('continuidade visual da navegação', () => {
  it('anima toda mudança de módulo e respeita redução de movimento', () => {
    const transicao = ler('src/components/PageTransition.tsx');
    const layout = ler('src/components/Layout.tsx');

    expect(layout).toContain('<PageTransition routeKey={location.pathname}>');
    expect(transicao).toContain('animate-page-enter');
    expect(transicao).toContain('motion-reduce:animate-none');
    expect(layout).toContain('useRouteScroll(mainRef');
    const scroll = ler('src/hooks/useRouteScroll.ts');
    expect(scroll).toContain("navigation === 'POP'");
    expect(scroll).toContain("scrollTo({ top: target, behavior: 'auto' })");
  });

  it('usa o mesmo ritmo nos overlays e menus partilhados', () => {
    const primitives = [
      'dialog.tsx',
      'sheet.tsx',
      'alert-dialog.tsx',
      'popover.tsx',
      'dropdown-menu.tsx',
      'select.tsx',
      'tooltip.tsx',
    ];

    for (const file of primitives) {
      const source = ler(`src/components/ui/${file}`);
      expect(source, file).toContain('ease-out');
      expect(source, file).toContain('motion-reduce:animate-none');
    }
  });

  it('abre conteúdo expansível sem salto de altura', () => {
    const collapsible = ler('src/components/ui/collapsible.tsx');
    const config = ler('tailwind.config.ts');

    expect(collapsible).toContain('animate-collapsible-down');
    expect(collapsible).toContain('animate-collapsible-up');
    expect(config).toContain("'collapsible-down'");
    expect(config).toContain("'collapsible-up'");
  });
});

describe('ordem das ações globais', () => {
  it('põe idioma imediatamente à esquerda do perfil', () => {
    const layout = ler('src/components/Layout.tsx');
    expect(layout).toMatch(
      /!isMobile[\s\S]*?<ThemeToggle\s*\/>[\s\S]*?<LanguageSelector variant="app"\s*\/>[\s\S]*?<UserProfile\s*\/>/,
    );
  });

  it('usa o símbolo proprietário na saída', () => {
    const sidebar = ler('src/components/AppSidebar.tsx');
    expect(sidebar).toContain('<SaidaIcon');
    expect(sidebar).not.toContain('<IconLogout');
  });
});
