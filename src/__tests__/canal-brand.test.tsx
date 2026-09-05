import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { CanalBrand } from '@/components/denuncia/CanalBrand';
import blackWordmark from '@/assets/akuris-logo-light.png';
import { readFileSync } from 'node:fs';

afterEach(cleanup);
describe('public reporting portal branding', () => {
  it.each([null, undefined, '', '   '])('uses the supplied dark wordmark when logo is %s', logoUrl => {
    render(<CanalBrand name="Empresa sem marca" logoUrl={logoUrl} />);
    expect(screen.getByRole('img', { name: 'Akuris' })).toHaveAttribute('src', blackWordmark);
  });
  it('preserves a tenant logo and falls back safely when it fails', () => {
    const { rerender } = render(<CanalBrand name="Empresa própria" logoUrl="https://example.test/company.png" />);
    expect(screen.getByRole('img', { name: 'Empresa própria' })).toHaveAttribute('src', 'https://example.test/company.png');
    fireEvent.error(screen.getByRole('img'));
    expect(screen.getByRole('img', { name: 'Akuris' })).toHaveAttribute('src', blackWordmark);
    rerender(<CanalBrand name="Outra marca" logoUrl="https://example.test/new-logo.png" />);
    expect(screen.getByRole('img', { name: 'Outra marca' })).toHaveAttribute('src', 'https://example.test/new-logo.png');
  });
  it('routes every public shell through the same fallback without a slug exception', () => {
    const shell = readFileSync('src/components/denuncia/CanalLayout.tsx', 'utf8');
    expect(shell).toContain('<CanalBrand');
    expect(shell).not.toContain("empresa.slug === 'akuris'");
    expect(shell).toContain('className="canal-platform-logo" src={akurisLogoLight}');
  });
});
