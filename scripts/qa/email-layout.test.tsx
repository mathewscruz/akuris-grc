import { strict as assert } from "node:assert";
import * as React from "npm:react@18.3.1";
import { renderAsync } from "npm:@react-email/components@0.0.22";
import {
  emailDocument,
  htmlToText,
  sanitizeEmailDocument,
} from "../../supabase/functions/_shared/email.ts";
import {
  EMAIL_BRAND,
  emailAction,
} from "../../supabase/functions/_shared/email-brand.ts";
import {
  operationalEmail,
  type OperationalEmailKind,
} from "../../supabase/functions/_shared/operational-email.ts";
import { MFACodeEmail } from "../../supabase/functions/send-mfa-code/_templates/mfa-code-email.tsx";
import { PasswordResetEmail } from "../../supabase/functions/send-password-reset/_templates/password-reset-email.tsx";
import { WelcomeEmail } from "../../supabase/functions/send-welcome-email/_templates/welcome-email.tsx";
import { InvitationReminderEmail } from "../../supabase/functions/process-invitation-reminders/_templates/invitation-reminder-email.tsx";
import { TestEmail } from "../../supabase/functions/send-test-email/_templates/test-email.tsx";
import { BaseEmailTemplate } from "../../supabase/functions/_shared/email-templates/BaseEmailTemplate.tsx";

Deno.test("sanitizer preserves the responsive document and button styles without allowing active content", () => {
  const html = sanitizeEmailDocument(
    emailDocument(
      "Example",
      emailAction("Open", "https://akuris.pt/?a=1&b=2"),
    ) +
      '<script>alert(1)</script><img src=x onerror=alert(1)><meta http-equiv="refresh" content="0;url=javascript:alert(1)">',
  );
  assert.match(html, /name="viewport"/);
  assert.match(html, /@media only screen and \(max-width:620px\)/);
  assert.match(html, /class="email-button"[^>]+background:#6542e8/);
  assert.match(html, /lang="pt-BR"/);
  assert.match(html, /bgcolor="#ffffff"/);
  assert.doesNotMatch(html, /<script|onerror=|http-equiv=/);
});

Deno.test("every operational template survives delivery sanitization and produces readable text", () => {
  const kinds: OperationalEmailKind[] = [
    "audit",
    "control",
    "controlMention",
    "risk",
    "acceptance",
    "review",
    "approval",
    "incident",
    "contract",
    "key",
    "license",
    "report",
    "dueDiligence",
  ];
  for (const kind of kinds) {
    const input = {
      name: "Example <name>",
      item: "Demo item",
      audit: "Demo audit",
      deadline: "15/09/2026",
      code: "TEST-1",
      heading: "Decision",
      action: "Open",
      url: "https://akuris.pt/?test=1&check=2",
    };
    const html = sanitizeEmailDocument(operationalEmail(kind, input));
    assert.ok(html.includes(EMAIL_BRAND.logoUrl), kind);
    assert.ok(html.includes("Example &lt;name&gt;"), kind);
    assert.doesNotMatch(html, /<name>/);
    assert.match(html, /class="email-button"/);
    assert.ok(new TextEncoder().encode(html).length < 30000, kind);
    const text = htmlToText(html);
    assert.ok(text.includes("Demo item"));
    assert.ok(text.includes("https://akuris.pt/?test=1&check=2"));
    assert.doesNotMatch(text, /@media|font-size|<table|\|\s*\|/);
  }
});

Deno.test("real account templates render with the same logo, exact actions and original expiry information", async () => {
  const href = "https://akuris.pt/definir-senha?token=demo&mode=recovery";
  const templates = [
    <MFACodeEmail userName="Test <user>" code="123456" />,
    <PasswordResetEmail userName="Test" resetUrl={href} />,
    <WelcomeEmail
      userName="Test"
      userEmail="test@example.test"
      setupPasswordUrl={href}
      companyLogoUrl="https://example.test/custom-logo.png"
    />,
    <InvitationReminderEmail
      userName="Test"
      userEmail="test@example.test"
      companyName="Example"
      loginUrl={href}
      reminderNumber={1}
      maxReminders={3}
    />,
    <TestEmail email="test@example.test" dateTime="08/09/2026" />,
    <BaseEmailTemplate
      title="Campaign"
      previewText="Preview"
      footerNote={
        <a href="https://akuris.pt/preferences?token=demo">Unsubscribe</a>
      }
    >
      <p>Editorial content</p>
    </BaseEmailTemplate>,
  ];
  for (const [index, template] of templates.entries()) {
    const html = await renderAsync(template);
    assert.ok(html.includes(EMAIL_BRAND.logoUrl));
    assert.doesNotMatch(html, /custom-logo|akuris-logo-email\.png/);
    assert.match(html, /email-logo-surface/);
    if (index >= 1 && index <= 3) {
      assert.ok(html.includes("token=demo&amp;mode=recovery"));
      assert.ok(html.includes("Se o botão não abrir"));
    }
    if (index === 0) {
      assert.ok(html.includes("123456"));
      assert.ok(html.includes("5 minutos"));
      assert.doesNotMatch(
        html.match(/<body[\s\S]*?<table/)?.[0] || "",
        /123456/,
      );
    }
    if (index === 1) assert.ok(html.includes("1 hora"));
    if (index === 2) assert.ok(html.includes("24 horas"));
    if (index === 5) assert.ok(html.includes("preferences?token=demo"));
  }
});
