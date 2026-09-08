import { Body, Container, Head, Heading, Html, Img, Link, Preview, Section, Text } from 'npm:@react-email/components@0.0.22';
import * as React from 'npm:react@18.3.1';
import { EMAIL_BRAND, EMAIL_COPY, EMAIL_CSS, type EmailLocale } from '../email-brand.ts';

interface BaseEmailTemplateProps {
  previewText: string;
  title: string;
  children: React.ReactNode;
  /** Kept for callers; all system emails intentionally use the Akuris brand. */
  companyName?: string;
  companyLogoUrl?: string;
  showFooter?: boolean;
  footerNote?: React.ReactNode;
  locale?: EmailLocale;
  category?: string;
}

export const BaseEmailTemplate = ({ previewText, title, children, showFooter = true, footerNote, locale = 'pt', category }: BaseEmailTemplateProps) => (
  <Html lang={locale === 'pt' ? 'pt-BR' : 'en'}>
    <Head>
      <meta name="viewport" content="width=device-width,initial-scale=1" />
      <meta name="color-scheme" content="light" />
      <meta name="supported-color-schemes" content="light" />
      <style>{EMAIL_CSS}</style>
    </Head>
    <Preview>{previewText}</Preview>
    <Body className="email-outer" style={{ margin: 0, padding: '32px 12px', backgroundColor: EMAIL_BRAND.background, fontFamily: EMAIL_BRAND.font }}>
      <Container style={{ width: '100%', maxWidth: '600px', margin: '0 auto', backgroundColor: '#ffffff', border: `1px solid ${EMAIL_BRAND.border}`, borderRadius: '14px', overflow: 'hidden' }}>
        <Section className="email-pad email-logo-surface" style={{ padding: '28px 36px 22px', backgroundColor: '#ffffff', borderBottom: `1px solid ${EMAIL_BRAND.border}` }}>
          <Img src={EMAIL_BRAND.logoUrl} alt="Akuris" width="156" height="47" style={{ display: 'block', width: '156px', height: 'auto', backgroundColor: '#ffffff', color: EMAIL_BRAND.ink }} />
        </Section>
        <Section className="email-pad" style={{ padding: '30px 36px 16px' }}>
          {category && <Text style={{ margin: '0 0 12px', color: EMAIL_BRAND.primary, fontSize: '13px', lineHeight: '18px', fontWeight: 700 }}>{category}</Text>}
          <Heading className="email-title" style={{ margin: 0, color: EMAIL_BRAND.ink, fontSize: '28px', lineHeight: '36px', letterSpacing: '-.6px', fontWeight: 700 }}>{title}</Heading>
        </Section>
        <Section className="email-pad email-content" style={{ padding: '4px 36px 32px', color: EMAIL_BRAND.muted, fontSize: '15px', lineHeight: '25px', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
          {children}
        </Section>
        {showFooter && <Section className="email-pad" style={{ borderTop: `1px solid ${EMAIL_BRAND.border}`, padding: '22px 36px' }}>
          <Text style={{ margin: 0, fontSize: '12px', lineHeight: '19px', color: EMAIL_BRAND.muted }}>{EMAIL_COPY[locale].footer}<br /><Link href="https://akuris.pt" style={emailStyles.link}>{EMAIL_COPY[locale].platform}</Link></Text>
          {footerNote && <Text style={{ margin: '12px 0 0', fontSize: '12px', lineHeight: '19px', color: EMAIL_BRAND.muted }}>{footerNote}</Text>}
        </Section>}
      </Container>
    </Body>
  </Html>
);

export default BaseEmailTemplate;

const COLORS = {
  primary: EMAIL_BRAND.primary, primaryDark: '#5434cf', primaryLight: '#f5f2ff',
  secondary: EMAIL_BRAND.ink, text: '#394152', textLight: EMAIL_BRAND.muted,
  textMuted: EMAIL_BRAND.muted, background: EMAIL_BRAND.background, surface: '#ffffff',
  border: EMAIL_BRAND.border, borderLight: '#fafafd',
  success: '#17764f', warning: '#9b570d', error: '#bb303d', info: EMAIL_BRAND.primary,
};
const box = { backgroundColor: '#fafafd', border: `1px solid ${EMAIL_BRAND.border}`, borderTop: `3px solid ${EMAIL_BRAND.primary}`, borderRadius: '10px', padding: '20px', margin: '24px 0' };
const text = { color: COLORS.text, fontSize: '15px', lineHeight: '25px', margin: '0 0 18px' };

export const emailStyles = {
  colors: COLORS, text, textSmall: { ...text, fontSize: '13px', lineHeight: '21px', color: COLORS.textLight, margin: '0 0 14px' },
  textBold: { fontWeight: 700 }, greeting: text,
  button: { backgroundColor: COLORS.primary, borderRadius: '8px', color: '#ffffff', display: 'inline-block', fontSize: '15px', fontWeight: 700, lineHeight: '22px', padding: '14px 24px', textDecoration: 'none', textAlign: 'center' as const },
  buttonSecondary: { border: `1px solid ${COLORS.primary}`, borderRadius: '8px', color: COLORS.primary, display: 'inline-block', fontSize: '15px', fontWeight: 700, lineHeight: '22px', padding: '14px 24px', textDecoration: 'none', textAlign: 'center' as const },
  buttonSection: { margin: '24px 0', textAlign: 'left' as const },
  infoBox: box, neutralBox: box,
  warningBox: { ...box, borderTopColor: COLORS.warning, backgroundColor: '#fffaf2' },
  successBox: { ...box, borderTopColor: COLORS.success, backgroundColor: '#f3faf6' },
  errorBox: { ...box, borderTopColor: COLORS.error, backgroundColor: '#fff6f7' },
  field: { marginBottom: '12px' },
  fieldLabel: { fontSize: '13px', color: COLORS.textLight, fontWeight: 600, margin: '0 0 4px' },
  fieldValue: { fontSize: '15px', color: COLORS.secondary, margin: '0' },
  code: { ...box, color: COLORS.secondary, fontFamily: EMAIL_BRAND.font, fontVariantNumeric: 'tabular-nums', fontSize: '34px', lineHeight: '44px', fontWeight: 700, padding: '20px 14px', display: 'block', letterSpacing: '7px', textAlign: 'center' as const },
  badge: { display: 'inline-block', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 600 },
  badgePrimary: { backgroundColor: COLORS.primaryLight, color: COLORS.primary },
  badgeSuccess: { backgroundColor: '#f3faf6', color: COLORS.success },
  badgeWarning: { backgroundColor: '#fffaf2', color: COLORS.warning },
  badgeError: { backgroundColor: '#fff6f7', color: COLORS.error },
  divider: { borderTop: `1px solid ${COLORS.border}`, margin: '24px 0' },
  link: { color: COLORS.primary, textDecoration: 'underline' },
  linkMuted: { color: COLORS.textMuted, textDecoration: 'underline' },
  list: { paddingLeft: '20px', margin: '16px 0' },
  listItem: { ...text, fontSize: '14px', margin: '0 0 6px' },
};
