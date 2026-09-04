import { Link, Section, Text } from 'npm:@react-email/components@0.0.22';
import * as React from 'npm:react@18.3.1';
import { BaseEmailTemplate, emailStyles } from '../../_shared/email-templates/BaseEmailTemplate.tsx';

interface InvitationReminderEmailProps {
  userName: string;
  userEmail: string;
  companyName: string;
  loginUrl: string;
  reminderNumber: number;
  maxReminders: number;
  companyLogoUrl?: string;
}

export const InvitationReminderEmail = ({
  userName,
  userEmail,
  companyName,
  loginUrl,
  reminderNumber,
  maxReminders,
  companyLogoUrl,
}: InvitationReminderEmailProps) => (
  <BaseEmailTemplate
    previewText={`Lembrete ${reminderNumber}/${maxReminders}: Complete seu cadastro`}
    title="Complete seu cadastro"
    companyName={companyName}
    companyLogoUrl={companyLogoUrl}
  >
    <Text style={emailStyles.text}>
      Olá <strong>{userName}</strong>,
    </Text>

    <Text style={emailStyles.text}>
      Notamos que você ainda não concluiu seu primeiro acesso à plataforma. Este é o lembrete <strong>{reminderNumber} de {maxReminders}</strong>.
    </Text>

    <Section style={emailStyles.infoBox}>
      <Text style={{ ...emailStyles.textSmall, margin: '0 0 6px' }}>
        ✓ Gestão completa de riscos e compliance
      </Text>
      <Text style={{ ...emailStyles.textSmall, margin: '0 0 6px' }}>
        ✓ Controle de documentos e contratos
      </Text>
      <Text style={{ ...emailStyles.textSmall, margin: '0 0 6px' }}>
        ✓ Auditorias e gap analysis
      </Text>
      <Text style={{ ...emailStyles.textSmall, margin: '0' }}>
        ✓ Due diligence de fornecedores
      </Text>
    </Section>

    <Section style={emailStyles.buttonSection}>
      <Link href={loginUrl} style={emailStyles.button}>
        Completar Cadastro
      </Link>
    </Section>

    <Section style={emailStyles.infoBox}>
      <Text style={{ ...emailStyles.textSmall, margin: '0' }}>
        <strong>E-mail:</strong> {userEmail}
      </Text>
    </Section>

    {reminderNumber === maxReminders && (
      <Section style={emailStyles.warningBox}>
        <Text style={{ ...emailStyles.textSmall, margin: '0', color: '#975a16' }}>
          <strong>Último lembrete.</strong> Após este aviso, seu acesso poderá ser desativado.
        </Text>
      </Section>
    )}
  </BaseEmailTemplate>
);

export default InvitationReminderEmail;
