import { Link, Section, Text } from 'npm:@react-email/components@0.0.22';
import * as React from 'npm:react@18.3.1';
import { BaseEmailTemplate, emailStyles } from '../../_shared/email-templates/BaseEmailTemplate.tsx';

interface PasswordResetEmailProps {
  userName: string;
  resetUrl: string;
  companyName?: string;
  companyLogoUrl?: string;
}

export const PasswordResetEmail = ({
  userName,
  resetUrl,
  companyName,
  companyLogoUrl,
}: PasswordResetEmailProps) => (
  <BaseEmailTemplate
    previewText="Redefinição de senha — Akuris"
    title="Redefinir senha"
    companyName={companyName}
    companyLogoUrl={companyLogoUrl}
  >
    <Text style={emailStyles.text}>
      Olá <strong>{userName}</strong>,
    </Text>

    <Text style={emailStyles.text}>
      Recebemos uma solicitação para redefinir a senha da sua conta. Clique no botão abaixo para criar uma nova senha:
    </Text>

    <Section style={emailStyles.buttonSection}>
      <Link href={resetUrl} style={emailStyles.button}>
        Redefinir minha senha
      </Link>
    </Section>

    <Text style={emailStyles.textSmall}>
      Validade: <strong>1 hora</strong>. Depois desse prazo, solicite um novo link.
    </Text>

    <Text style={emailStyles.textSmall}>
      Se você não solicitou esta redefinição, ignore este e-mail. Sua senha permanecerá inalterada.
    </Text>
  </BaseEmailTemplate>
);

export default PasswordResetEmail;
