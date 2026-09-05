import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ConformitySelect } from '@/components/gap-analysis/ConformitySelect';
import { gapUi } from '@/i18n/modules/gap-ui';
vi.mock('@/contexts/LanguageContext', () => ({ useLanguage: () => ({ t: (key: string) => key.split('.').reduce((value, part) => value?.[part], gapUi.pt as any) || key }) }));
afterEach(cleanup);
describe('conformity menu', () => {
  it('shows a concise value, explains every option and only writes on selection', async () => {
    HTMLElement.prototype.scrollIntoView = vi.fn();
    const onValueChange = vi.fn();
    render(<ConformitySelect value="parcial" onValueChange={onValueChange} />);
    const trigger = screen.getByRole('combobox', { name: 'Estado de conformidade' });
    expect(trigger).toHaveTextContent('Parcial');
    fireEvent.keyDown(trigger, { key: 'Enter' });
    // JSDOM has no placement geometry; Radix keeps its portal visibility hidden.
    // Menu geometry and keyboard focus are covered in the real-browser check.
    const menu = within(screen.getByRole('listbox', { hidden: true }));
    expect(menu.getAllByRole('option', { hidden: true })).toHaveLength(5);
    expect(menu.getByRole('option', { name: /^Parcial Parte/, hidden: true })).toHaveAttribute('data-state', 'checked');
    expect(onValueChange).not.toHaveBeenCalled();
    fireEvent.click(menu.getByRole('option', { name: /^Não Conforme O requisito/, hidden: true }));
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith('nao_conforme');
  });
  it('keeps the menu disabled when editing is unavailable', () => {
    render(<ConformitySelect value="conforme" onValueChange={vi.fn()} disabled />);
    expect(screen.getByRole('combobox')).toBeDisabled();
  });
});
