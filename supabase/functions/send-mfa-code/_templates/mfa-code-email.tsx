import { Section, Text } from 'npm:@react-email/components@0.0.22';
import * as React from 'npm:react@18.3.1';
import { BaseEmailTemplate, emailStyles } from '../../_shared/email-templates/BaseEmailTemplate.tsx';
import type { EmailLocale } from '../../_shared/email-brand.ts';

interface MFACodeEmailProps {
  userName: string;
  code: string;
  locale?: EmailLocale;
}

export const MFACodeEmail = ({
  userName,
  code,
  locale = 'pt',
}: MFACodeEmailProps) => (
  <BaseEmailTemplate
    previewText={locale === 'en' ? 'Your code to sign in to Akuris. Do not share it.' : 'Seu código para concluir o acesso ao Akuris. Não o compartilhe.'}
    title={locale === 'en' ? 'Verification code' : 'Código de verificação'}
    locale={locale}
  >
    <Text style={emailStyles.text}>
      {locale === 'en' ? 'Hello' : 'Olá'} <strong>{userName}</strong>,
    </Text>

    <Text style={emailStyles.text}>
      {locale === 'en' ? 'Use the code below to complete your sign-in:' : 'Use o código abaixo para completar seu login:'}
    </Text>

    <Section style={{ textAlign: 'center' as const, margin: '32px 0' }}>
      <Text style={emailStyles.code}>
        {code}
      </Text>
    </Section>

    <Text style={emailStyles.textSmall}>
      {locale === 'en' ? <>Valid for <strong>5 minutes</strong>. Do not share this code with anyone.</> : <>Validade: <strong>5 minutos</strong>. Não compartilhe este código com ninguém.</>}
    </Text>

    <Text style={emailStyles.textSmall}>
      {locale === 'en' ? 'If you did not try to sign in, your account may be compromised. Change your password immediately.' : 'Se você não tentou fazer login, sua conta pode estar comprometida. Altere sua senha imediatamente.'}
    </Text>
  </BaseEmailTemplate>
);

export default MFACodeEmail;
