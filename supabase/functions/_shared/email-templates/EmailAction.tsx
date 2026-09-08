import {
  Button,
  Link,
  Section,
  Text,
} from "npm:@react-email/components@0.0.22";
import * as React from "npm:react@18.3.1";
import { EMAIL_COPY, type EmailLocale, safeEmailUrl } from "../email-brand.ts";
import { emailStyles } from "./BaseEmailTemplate.tsx";

export function EmailAction(
  { href, children, locale = "pt" }: {
    href: string;
    children: React.ReactNode;
    locale?: EmailLocale;
  },
) {
  const url = safeEmailUrl(href);
  if (!url) return null;
  return (
    <Section style={emailStyles.buttonSection}>
      <Button href={url} className="email-button" style={emailStyles.button}>
        {children} &rarr;
      </Button>
      <Text
        style={{
          ...emailStyles.textSmall,
          margin: "14px 0 0",
          fontSize: "12px",
          lineHeight: "19px",
        }}
      >
        {EMAIL_COPY[locale].fallback}
        <br />
        <Link
          href={url}
          style={{ ...emailStyles.link, wordBreak: "break-all" }}
        >
          {url}
        </Link>
      </Text>
    </Section>
  );
}
