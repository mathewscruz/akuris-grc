import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthShell } from './AuthShell';

vi.mock('@/contexts/LanguageContext', () => ({ useLanguage: () => ({ t: (key: string) => key }) }));
vi.mock('@/components/LanguageSelector', () => ({ LanguageSelector: () => <button>Idioma</button> }));
vi.mock('@/components/auth/AuthProductPreview', () => ({ AuthProductPreview: () => <div>Preview</div> }));
vi.mock('@/components/identity/AkurisMarkPattern', () => ({ AkurisMarkPattern: () => null }));
afterEach(cleanup);

describe('full-viewport authentication layout', () => {
  it('fills the viewport without capping the shell width, while keeping the form readable', () => {
    render(<AuthShell><form aria-label="Login" /></AuthShell>);
    const main = screen.getByRole('main');
    expect(main).toHaveClass('w-full', 'min-h-dvh');
    expect(main.className).not.toContain('max-w-');
    expect(screen.getByRole('form').parentElement).toHaveClass('w-full', 'max-w-[26rem]');
    expect(screen.getByRole('button', { name: 'Idioma' })).toBeInTheDocument();
  });
  it('also wraps recovery/MFA without requiring an illustration', () => {
    render(<AuthShell showProductPreview={false}><h1>Recuperar acesso</h1></AuthShell>);
    expect(screen.getByRole('heading', { name: 'Recuperar acesso' })).toBeInTheDocument();
    expect(screen.queryByText('Preview')).toBeNull();
  });
});
