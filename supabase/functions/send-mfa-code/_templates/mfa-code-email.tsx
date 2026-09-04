import { Section, Text } from 'npm:@react-email/components@0.0.22';
import * as React from 'npm:react@18.3.1';
import { BaseEmailTemplate, emailStyles } from '../../_shared/email-templates/BaseEmailTemplate.tsx';

interface MFACodeEmailProps {
  userName: string;
  code: string;
}

export const MFACodeEmail = ({
  userName,
  code,
}: MFACodeEmailProps) => (
  <BaseEmailTemplate
    previewText={`${code} — Código de verificação Akuris`}
    title="Código de verificação"
  >
    <Text style={emailStyles.text}>
      Olá <strong>{userName}</strong>,
    </Text>

    <Text style={emailStyles.text}>
      Use o código abaixo para completar seu login:
    </Text>

    <Section style={{ textAlign: 'center' as const, margin: '32px 0' }}>
      <Text style={emailStyles.code}>
        {code}
      </Text>
    </Section>

    <Text style={emailStyles.textSmall}>
      Validade: <strong>5 minutos</strong>. Não compartilhe este código com ninguém.
    </Text>

    <Text style={emailStyles.textSmall}>
      Se você não tentou fazer login, sua conta pode estar comprometida. Altere sua senha imediatamente.
    </Text>
  </BaseEmailTemplate>
);

export default MFACodeEmail;
