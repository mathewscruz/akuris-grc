import { Link, Section, Text } from 'npm:@react-email/components@0.0.22';
import * as React from 'npm:react@18.3.1';
import { BaseEmailTemplate, emailStyles } from '../../_shared/email-templates/BaseEmailTemplate.tsx';

interface TestEmailProps {
  email: string;
  dateTime: string;
}

export const TestEmail = ({
  email,
  dateTime,
}: TestEmailProps) => (
  <BaseEmailTemplate
    previewText="Teste de e-mail — Akuris"
    title="E-mail de Teste ✓"
  >
    <Text style={emailStyles.text}>
      Este é um e-mail de teste enviado pelo sistema <strong>Akuris</strong>.
    </Text>

    <Text style={emailStyles.text}>
      Se você está recebendo este e-mail, significa que o serviço de envio está funcionando corretamente.
    </Text>

    <Section style={emailStyles.infoBox}>
      <Text style={{ ...emailStyles.textSmall, margin: '0 0 8px' }}>
        <strong>Destinatário:</strong> {email}
      </Text>
      <Text style={{ ...emailStyles.textSmall, margin: '0 0 8px' }}>
        <strong>Data/Hora:</strong> {dateTime}
      </Text>
      <Text style={{ ...emailStyles.textSmall, margin: '0' }}>
        <strong>Status:</strong>{' '}
        <span style={{ color: '#38a169', fontWeight: '600' }}>Entregue com sucesso</span>
      </Text>
    </Section>

    <Section style={emailStyles.buttonSection}>
      <Link href="https://akuris.pt" style={emailStyles.button}>
        Acessar Plataforma
      </Link>
    </Section>
  </BaseEmailTemplate>
);

export default TestEmail;
