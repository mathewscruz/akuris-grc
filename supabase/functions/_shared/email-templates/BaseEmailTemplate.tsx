import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22';
import * as React from 'npm:react@18.3.1';

interface BaseEmailTemplateProps {
  previewText: string;
  title: string;
  children: React.ReactNode;
  companyName?: string;
  companyLogoUrl?: string;
  showFooter?: boolean;
}

// Logo em texto — nunca quebra, funciona em todos os clientes de e-mail

const COLORS = {
  primary: '#7552ff',
  primaryDark: '#5a3fd6',
  primaryLight: '#f5f3ff',
  secondary: '#0a1628',
  text: '#2d3748',
  textLight: '#718096',
  textMuted: '#a0aec0',
  background: '#f7f8fa',
  surface: '#ffffff',
  border: '#e2e8f0',
  borderLight: '#edf2f7',
  success: '#38a169',
  warning: '#d69e2e',
  error: '#e53e3e',
  info: '#7552ff',
};

export const BaseEmailTemplate = ({
  previewText,
  title,
  children,
  companyName = 'Akuris',
  companyLogoUrl,
  showFooter = true,
}: BaseEmailTemplateProps) => {
  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Dark Header with logo image */}
          <Section style={headerSection}>
            <Img
              src="https://akuris.com.br/akuris-logo-email.png"
              alt="Akuris"
              width="160"
              height="48"
              style={{ display: 'block', margin: '0 auto', maxWidth: '160px', height: 'auto' }}
            />
          </Section>

          {/* Gradient accent line */}
          <div style={gradientLine} />

          {/* Title */}
          <Section style={titleSection}>
            <Heading style={h1}>{title}</Heading>
          </Section>

          {/* Content */}
          <Section style={content}>
            {children}
          </Section>

          {/* Signature */}
          <Section style={signatureSection}>
            <Text style={signatureText}>
              Atenciosamente,
            </Text>
            <Text style={signatureName}>
              Equipe Akuris
            </Text>
          </Section>

          {/* Footer */}
          {showFooter && (
            <Section style={footer}>
              <Text style={footerCopy}>
                Este é um e-mail automático enviado pela plataforma{' '}
                <Link href="https://akuris.com.br" style={{ color: COLORS.primary, textDecoration: 'none' }}>
                  Akuris
                </Link>
                .
              </Text>
              <Text style={footerCopy}>
                © {new Date().getFullYear()} Akuris · Governança, Risco e Compliance
              </Text>
            </Section>
          )}
        </Container>
      </Body>
    </Html>
  );
};

export default BaseEmailTemplate;

// ─── Styles ──────────────────────────────────────────────

const main = {
  backgroundColor: '#ffffff',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  padding: '40px 0',
};

const container = {
  backgroundColor: COLORS.surface,
  margin: '0 auto',
  maxWidth: '600px',
  borderRadius: '12px',
  overflow: 'hidden' as const,
  border: `1px solid ${COLORS.border}`,
};

const headerSection = {
  backgroundColor: COLORS.secondary,
  padding: '36px 40px',
  textAlign: 'center' as const,
};

const textLogoStyle = {
  fontSize: '28px',
  fontWeight: '800' as const,
  color: '#ffffff',
  letterSpacing: '3px',
  margin: '0',
  textAlign: 'center' as const,
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

const gradientLine = {
  height: '3px',
  background: `linear-gradient(90deg, ${COLORS.primary}, ${COLORS.primaryDark}, ${COLORS.primary})`,
};

const titleSection = {
  padding: '36px 44px 0',
};

const h1 = {
  color: COLORS.secondary,
  fontSize: '26px',
  fontWeight: '700',
  lineHeight: '34px',
  margin: '0',
};

const content = {
  padding: '24px 44px 8px',
};

const signatureSection = {
  padding: '8px 44px 32px',
};

const signatureText = {
  color: COLORS.textLight,
  fontSize: '14px',
  margin: '0 0 4px',
};

const signatureName = {
  color: COLORS.secondary,
  fontSize: '14px',
  fontWeight: '600',
  margin: '0',
};

const footer = {
  backgroundColor: COLORS.borderLight,
  borderTop: `1px solid ${COLORS.border}`,
  padding: '20px 44px',
  textAlign: 'center' as const,
};

const footerCopy = {
  color: COLORS.textMuted,
  fontSize: '12px',
  lineHeight: '20px',
  margin: '0',
};

// ─── Reusable Styles ────────────────────────────────────

export const emailStyles = {
  colors: COLORS,

  text: {
    color: COLORS.text,
    fontSize: '15px',
    lineHeight: '26px',
    margin: '0 0 18px',
  },
  textSmall: {
    color: COLORS.textLight,
    fontSize: '13px',
    lineHeight: '22px',
    margin: '0 0 14px',
  },
  textBold: {
    fontWeight: '600',
  },
  greeting: {
    color: COLORS.text,
    fontSize: '15px',
    lineHeight: '26px',
    margin: '0 0 20px',
  },

  button: {
    backgroundColor: COLORS.primary,
    borderRadius: '50px',
    color: '#ffffff',
    display: 'inline-block',
    fontSize: '15px',
    fontWeight: '600',
    lineHeight: '24px',
    padding: '16px 48px',
    textDecoration: 'none',
    textAlign: 'center' as const,
  },
  buttonSecondary: {
    backgroundColor: 'transparent',
    border: `2px solid ${COLORS.primary}`,
    borderRadius: '50px',
    color: COLORS.primary,
    display: 'inline-block',
    fontSize: '15px',
    fontWeight: '600',
    lineHeight: '24px',
    padding: '14px 46px',
    textDecoration: 'none',
    textAlign: 'center' as const,
  },
  buttonSection: {
    margin: '28px 0',
    textAlign: 'center' as const,
  },

  infoBox: {
    backgroundColor: COLORS.borderLight,
    border: `1px solid ${COLORS.border}`,
    borderRadius: '12px',
    padding: '20px 24px',
    margin: '20px 0',
  },
  warningBox: {
    backgroundColor: '#fffdf5',
    border: '1px solid #f0e4c4',
    borderRadius: '12px',
    padding: '20px 24px',
    margin: '20px 0',
  },
  successBox: {
    backgroundColor: '#f0fff4',
    border: '1px solid #c6f6d5',
    borderRadius: '12px',
    padding: '20px 24px',
    margin: '20px 0',
  },
  errorBox: {
    backgroundColor: '#fff5f5',
    border: '1px solid #fed7d7',
    borderRadius: '12px',
    padding: '20px 24px',
    margin: '20px 0',
  },
  neutralBox: {
    backgroundColor: COLORS.borderLight,
    border: `1px solid ${COLORS.border}`,
    borderRadius: '12px',
    padding: '20px 24px',
    margin: '16px 0',
  },

  field: {
    marginBottom: '12px',
  },
  fieldLabel: {
    fontSize: '13px',
    color: COLORS.textLight,
    fontWeight: '600',
    margin: '0 0 4px',
  },
  fieldValue: {
    fontSize: '15px',
    color: COLORS.secondary,
    margin: '0',
  },

  code: {
    backgroundColor: COLORS.primaryLight,
    border: `1px solid ${COLORS.border}`,
    borderRadius: '12px',
    color: COLORS.secondary,
    fontFamily: 'Monaco, Consolas, "Courier New", monospace',
    fontSize: '28px',
    fontWeight: '700',
    padding: '18px 32px',
    display: 'inline-block',
    letterSpacing: '6px',
    textAlign: 'center' as const,
  },

  badge: {
    display: 'inline-block',
    padding: '4px 12px',
    borderRadius: '50px',
    fontSize: '12px',
    fontWeight: '600',
  },
  badgePrimary: {
    backgroundColor: COLORS.primaryLight,
    color: COLORS.primary,
  },
  badgeSuccess: {
    backgroundColor: '#f0fff4',
    color: '#276749',
  },
  badgeWarning: {
    backgroundColor: '#fffdf5',
    color: '#975a16',
  },
  badgeError: {
    backgroundColor: '#fff5f5',
    color: '#c53030',
  },

  divider: {
    borderTop: `1px solid ${COLORS.border}`,
    margin: '24px 0',
  },

  link: {
    color: COLORS.primary,
    textDecoration: 'underline',
  },
  linkMuted: {
    color: COLORS.textMuted,
    textDecoration: 'underline',
  },

  list: {
    paddingLeft: '20px',
    margin: '16px 0',
  },
  listItem: {
    color: COLORS.text,
    fontSize: '14px',
    lineHeight: '26px',
    margin: '0 0 6px',
  },
};
