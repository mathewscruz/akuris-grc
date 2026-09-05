import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('ajustes solicitados no documento 111', () => {
  it('concentra alertas e pendências no sino, sem duplicar as faixas no dashboard', () => {
    const dashboard = source('src/pages/Dashboard.tsx');
    const center = source('src/components/NotificationCenter.tsx');
    expect(dashboard).not.toMatch(/<MinhasPendencias|<AlertsDetailDialog|<PanelAction/);
    expect(source('src/components/dashboard/GrcHealthBreakdown.tsx')).not.toContain('<details');
    expect(center).toContain('<NotificationTasks');
    expect(center).toContain('<AlertsDetailDialog');
    expect(center).toContain('hasOpenWork');
    expect(center).toContain("tab === 'alerts'");
  });
  it('filtros dos templates estão permanentes e o título fica livre de rótulos', () => {
    const templates = source('src/components/due-diligence/TemplatesManager.tsx');
    expect(templates).not.toContain('showFilters');
    expect(templates).not.toContain("templatesManager.defaultBadge");
    expect(templates).not.toContain('resolveCategoriaTone');
    expect(templates).toContain('value={categoriaFilter}');
    expect(templates).toContain('value={statusFilter}');
  });
  it('o logotipo fornecido é preservado byte a byte e não substitui marcas de clientes', () => {
    const layout = source('src/components/denuncia/CanalLayout.tsx');
    expect(layout).toContain("import akurisLogoLight from '@/assets/akuris-logo-light.png'");
    expect(layout).toContain("empresa.slug === 'akuris'");
    expect(layout).toContain('src={empresa.logo_url}');
    const png = readFileSync(resolve(process.cwd(), 'src/assets/akuris-logo-light.png'));
    expect(createHash('sha256').update(png).digest('hex')).toBe('8af0a89ebf59f23600a465556b8af32bf5d843fe48cb8860c001b0412cfc329e');
    expect(png.subarray(1, 4).toString()).toBe('PNG');
    expect(png.readUInt32BE(16)).toBe(650);
    expect(png.readUInt32BE(20)).toBe(195);
  });
  it('Configurações entrega classes resolvidas ao wrapper do menu', () => {
    const sidebar = source('src/components/AppSidebar.tsx');
    expect(sidebar).toContain("getNavCls({ isActive: isActive('/configuracoes') })");
    expect(sidebar).not.toContain('className={({ isActive })');
    expect(sidebar).toContain('aria-expanded={showLogoutConfirm}');
  });
  it('o fallback de status é legível tanto na tabela quanto nos cartões móveis', () => {
    const table = source('src/components/ui/data-table.tsx');
    expect(table.match(/column.key === 'status' \? formatStatus/g)).toHaveLength(2);
  });
});
