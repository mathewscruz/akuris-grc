import { EmailAction } from "../../_shared/email-templates/EmailAction.tsx";
import { Section, Text } from 'npm:@react-email/components@0.0.22';
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
    previewText="Bem-vindo ao Akuris — Defina sua senha"
    title={`Bem-vindo, ${userName}!`}
    companyLogoUrl={companyLogoUrl}
  >
    <Text style={emailStyles.text}>
      Sua conta foi criada com sucesso. Estamos felizes em tê-lo(a) conosco!
    </Text>

    <Text style={emailStyles.text}>
      Para começar, defina sua senha de acesso clicando no botão abaixo:
    </Text>

    <Section style={emailStyles.infoBox}>
      <Text style={{ ...emailStyles.textSmall, margin: '0' }}>
        <strong>Seu e-mail de acesso:</strong> {userEmail}
      </Text>
    </Section>

    <EmailAction href={setupPasswordUrl}>Definir Minha Senha</EmailAction>

    <Text style={emailStyles.textSmall}>
      Este link expira em <strong>24 horas</strong>. Caso expire, peça ao administrador para reenviar o convite.
    </Text>

    <Text style={emailStyles.textSmall}>
      Se você não solicitou este cadastro, por favor desconsidere este e-mail.
    </Text>
  </BaseEmailTemplate>
);

export default WelcomeEmail;
