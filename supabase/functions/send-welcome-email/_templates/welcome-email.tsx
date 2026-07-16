import { Link, Section, Text } from 'npm:@react-email/components@0.0.22';
import * as React from 'npm:react@18.3.1';
import { BaseEmailTemplate, emailStyles } from '../../_shared/email-templates/BaseEmailTemplate.tsx';

interface WelcomeEmailProps {
  userName: string;
  userEmail: string;
  setupPasswordUrl: string;
  companyName?: string;
  companyLogoUrl?: string;
}

export const WelcomeEmail = ({
  userName,
  userEmail,
  setupPasswordUrl,
  companyName,
  companyLogoUrl,
}: WelcomeEmailProps) => (
  <BaseEmailTemplate
    previewText="Akuris — Defina sua senha de acesso"
    title={`Olá, ${userName}!`}
    companyLogoUrl={companyLogoUrl}
  >
    <Text style={emailStyles.text}>
      Sua conta no Akuris está pronta. Para acessar a plataforma, defina sua senha clicando no botão abaixo:
    </Text>

    <Section style={emailStyles.infoBox}>
      <Text style={{ ...emailStyles.textSmall, margin: '0' }}>
        <strong>Seu e-mail de acesso:</strong> {userEmail}
      </Text>
    </Section>

    <Section style={emailStyles.buttonSection}>
      <Link href={setupPasswordUrl} style={emailStyles.button}>
        Definir Minha Senha
      </Link>
    </Section>

    <Text style={emailStyles.textSmall}>
      ⏳ Este link expira em <strong>24 horas</strong>. Se expirar, peça ao administrador para reenviar o convite.
    </Text>

    <Text style={emailStyles.textSmall}>
      Se você não reconhece este e-mail, por favor desconsidere.
    </Text>
  </BaseEmailTemplate>
);

export default WelcomeEmail;
