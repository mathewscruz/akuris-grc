import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MFAVerification } from '../MFAVerification';
import { PasswordRecoveryPanel } from './PasswordRecoveryPanel';

const mocks = vi.hoisted(() => ({ invoke: vi.fn(), t: (key: string, params?: Record<string, string>) => key + (params ? ' ' + JSON.stringify(params) : '') }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke: mocks.invoke } } }));
vi.mock('@/contexts/LanguageContext', () => ({ useLanguage: () => ({ t: mocks.t }) }));
vi.mock('@/components/auth/AuthShell', () => ({ AuthShell: ({ children }: any) => <div>{children}</div> }));
vi.mock('@/components/ui/input-otp', () => ({
  InputOTP: React.forwardRef<HTMLInputElement, any>(({ children: _children, onChange, ...props }, ref) => <input {...props} ref={ref} onChange={e => onChange(e.target.value)} />),
  InputOTPGroup: ({ children }: any) => <div>{children}</div>, InputOTPSlot: () => null,
}));
beforeEach(() => { mocks.invoke.mockReset(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('MFA interaction without real authentication requests', () => {
  it('masks the email, focuses the numeric input and verifies only once on success', async () => {
    mocks.invoke.mockResolvedValue({ data: { success: true, expires_at: 'valid-until' }, error: null });
    const onVerified = vi.fn();
    const { container } = render(<MFAVerification email="someone@example.test" onVerified={onVerified} onCancel={vi.fn()} />);
    const input = screen.getByRole('textbox', { name: 'mfaScreen.codeInputLabel' });
    expect(input).toHaveFocus(); expect(input).toHaveAttribute('autocomplete', 'one-time-code');
    expect(container.textContent).not.toContain('someone@example.test');
    fireEvent.change(input, { target: { value: '123456' } });
    await waitFor(() => expect(onVerified).toHaveBeenCalledWith('valid-until'));
    expect(mocks.invoke).toHaveBeenCalledTimes(1);
    expect(input).toHaveValue('');
  });
  it('announces an invalid code and returns focus for correction', async () => {
    mocks.invoke.mockResolvedValue({ data: { success: false, error_code: 'invalid_code', remaining_attempts: 2 }, error: null });
    render(<MFAVerification email="someone@example.test" onVerified={vi.fn()} onCancel={vi.fn()} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '111111' } });
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('mfaScreen.invalidWithAttempts'));
    expect(input).toHaveValue(''); expect(input).toHaveFocus();
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', 'mfa-code-error');
  });
  it('an exhausted code remains disabled on later timer ticks', async () => {
    vi.useFakeTimers();
    mocks.invoke.mockResolvedValue({ data: { success: false, error_code: 'too_many_attempts' }, error: null });
    render(<MFAVerification email="someone@example.test" onVerified={vi.fn()} onCancel={vi.fn()} />);
    await act(async () => { fireEvent.change(screen.getByRole('textbox'), { target: { value: '111111' } }); });
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(screen.getByRole('textbox')).toBeDisabled();
    expect(mocks.invoke).toHaveBeenCalledTimes(1);
  });
  it('the default validity counts down instead of restarting every second; resend honors cooldown', async () => {
    vi.useFakeTimers();
    mocks.invoke.mockResolvedValue({ data: { success: true, resend_after: 60, expires_at: new Date(Date.now() + 10 * 60_000).toISOString() }, error: null });
    render(<MFAVerification email="someone@example.test" onVerified={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole('button', { name: /mfaScreen.resendIn/ })).toBeDisabled();
    await act(async () => { await vi.advanceTimersByTimeAsync(301000); });
    expect(screen.getByRole('textbox')).toBeDisabled();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'mfaScreen.resendCode' })); });
    expect(screen.getByRole('textbox')).not.toBeDisabled();
    expect(screen.getByRole('button', { name: /mfaScreen.resendIn/ })).toBeDisabled();
    expect(mocks.invoke).toHaveBeenCalledWith('send-mfa-code', { body: { force: true, context: 'session_restore' } });
  });
});

describe('password recovery feedback', () => {
  it('associates validation with the field and sends no invalid request', () => {
    render(<PasswordRecoveryPanel onBack={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'forgotPassword.send' }));
    expect(screen.getByRole('textbox')).toHaveFocus();
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-describedby', 'recovery-email-error');
    expect(mocks.invoke).not.toHaveBeenCalled();
  });
  it('normalizes the address and keeps the account-neutral success message', async () => {
    mocks.invoke.mockResolvedValue({ data: { success: true }, error: null });
    render(<PasswordRecoveryPanel initialEmail=" User@Example.test " onBack={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'forgotPassword.send' }));
    await waitFor(() => expect(screen.getByText('forgotPassword.successMessage')).toBeInTheDocument());
    expect(mocks.invoke).toHaveBeenCalledWith('send-password-reset', { body: { email: 'user@example.test' } });
    fireEvent.click(screen.getByRole('button', { name: 'forgotPassword.useAnotherEmail' }));
    expect(screen.getByRole('textbox')).toHaveValue('User@Example.test');
  });
  it('does not claim a message was sent after a service error, or lose the typed address', async () => {
    mocks.invoke.mockResolvedValue({ data: null, error: { context: new Response('', { status: 429 }) } });
    render(<PasswordRecoveryPanel initialEmail="user@example.test" onBack={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'forgotPassword.send' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('forgotPassword.rateLimited'));
    expect(screen.getByRole('textbox')).toHaveValue('user@example.test');
    expect(screen.queryByText('forgotPassword.successMessage')).toBeNull();
  });
});
