/**
 * daily-brief.tsx — React Email template for ForgeMinds daily intelligence brief.
 *
 * Rendered server-side by Resend (in /api/cron/deliver) into MIME html + plain
 * text. We compose with @react-email primitives so layout works across Gmail,
 * Outlook, Apple Mail, etc., without inline-style hand-tuning.
 *
 * Inputs are sanitized at the source (curate writes structured fields, generate
 * writes server-generated HTML). We trust summary_html only because it came
 * from our own LLM with no user input passing through.
 */

import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

interface DailyBriefEmailProps {
  recipientName: string;
  briefTitle: string;
  briefDate: string;
  summaryHtml: string;
  articleCount: number;
  tickerSymbols: string[];
  categoriesCovered: string[];
  briefUrl: string;
}

export function DailyBriefEmail({
  recipientName,
  briefTitle,
  briefDate,
  summaryHtml,
  articleCount,
  tickerSymbols,
  categoriesCovered,
  briefUrl,
}: DailyBriefEmailProps) {
  const previewText = `${articleCount} stories curated from your sources for ${briefDate}`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section>
            <Heading style={h1}>{briefTitle}</Heading>
            <Text style={meta}>
              {briefDate} · {articleCount} {articleCount === 1 ? "story" : "stories"}
              {categoriesCovered.length > 0 ? ` · ${categoriesCovered.join(", ")}` : ""}
            </Text>
          </Section>

          <Hr style={hr} />

          <Section>
            <Text style={greeting}>Hi {recipientName},</Text>
            {/*
             * The summary_html came from our own LLM (Gemini/Grok) prompted with
             * a hard rule against script/style tags. We trust it; no user content
             * passes through this surface in Phase 1.
             */}
            <div dangerouslySetInnerHTML={{ __html: summaryHtml }} />
          </Section>

          {tickerSymbols.length > 0 ? (
            <>
              <Hr style={hr} />
              <Section>
                <Text style={meta}>Tickers mentioned: {tickerSymbols.map((t) => `$${t}`).join("  ")}</Text>
              </Section>
            </>
          ) : null}

          <Hr style={hr} />

          <Section style={{ textAlign: "center" as const }}>
            <Link href={briefUrl} style={cta}>
              View full brief in ForgeMinds →
            </Link>
          </Section>

          <Hr style={hr} />

          <Section>
            <Text style={footer}>
              You&apos;re receiving this because email delivery is enabled in your ForgeMinds
              preferences. Update or pause delivery in Settings → Notifications.
            </Text>
            <Text style={footer}>ForgeMinds — your personal intelligence OS.</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export default DailyBriefEmail;

// ─── Styles (inline only — many email clients strip <style>) ─────────
const body = {
  backgroundColor: "#0a0a0a",
  color: "#e5e5e5",
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  margin: 0,
  padding: 0,
};

const container = {
  backgroundColor: "#171717",
  margin: "40px auto",
  padding: "32px 24px",
  maxWidth: "600px",
  borderRadius: "10px",
};

const h1 = {
  color: "#f5f5f5",
  fontSize: "24px",
  fontWeight: 600,
  letterSpacing: "-0.02em",
  margin: "0 0 8px 0",
  lineHeight: 1.3,
};

const meta = {
  color: "#a3a3a3",
  fontSize: "13px",
  margin: "0 0 0 0",
};

const greeting = {
  color: "#e5e5e5",
  fontSize: "15px",
  margin: "0 0 16px 0",
};

const hr = {
  borderColor: "#2a2a2a",
  margin: "24px 0",
};

const cta = {
  color: "#a78bfa",
  fontSize: "15px",
  fontWeight: 600,
  textDecoration: "none",
};

const footer = {
  color: "#737373",
  fontSize: "12px",
  lineHeight: 1.5,
  margin: "0 0 8px 0",
};
