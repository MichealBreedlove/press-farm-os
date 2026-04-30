import {
  Body,
  Container,
  Head,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import { APP_URL } from "@/lib/constants";
import { styles, MANDALA_URL, WORDMARK_URL } from "./_shared";

interface ChefWelcomeProps {
  chefName: string;
  restaurantName: string;
  /** Sign-in URL — defaults to /login (always fresh, never expires) */
  loginUrl?: string;
}

/**
 * chef-welcome.tsx — Sent to a chef when admin invites them
 * or triggers "Send Welcome" from user management.
 */
export default function ChefWelcome({
  chefName,
  restaurantName,
  loginUrl,
}: ChefWelcomeProps) {
  // Default to /login (always fresh, never expires).
  // Magic-link URLs from generateLink expire in 1 hour and are one-shot.
  const signInUrl = loginUrl ?? `${APP_URL}/login`;

  return (
    <Html>
      <Head />
      <Preview>Welcome to Press Farm — order produce from the farm</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <div style={styles.card}>
            {/* Hero */}
            <Section style={styles.hero}>
              <Img src={MANDALA_URL} alt="Press Farm mandala" width="120" height="120" style={{ display: "block", margin: "0 auto", width: "120px", height: "auto" }} />
              <Img src={WORDMARK_URL} alt="PRESS FARM" width="240" height="auto" style={{ display: "block", margin: "20px auto 6px", maxWidth: "240px", height: "auto" }} />
              <Text style={styles.tagline}>Cultivated with Chefs</Text>
            </Section>

            <hr style={styles.goldRule} />

            {/* Welcome message */}
            <Section style={styles.body_section}>
              <Text style={styles.eyebrow}>Welcome</Text>
              <Text style={styles.h1}>Hello, {chefName}</Text>
              <Text style={styles.paragraph}>
                You&apos;ve been added to the Press Farm ordering system for{" "}
                <strong>{restaurantName}</strong>. From now on, you&apos;ll order
                produce directly through our app — no more spreadsheets or
                back-and-forth.
              </Text>

              <Section style={styles.ctaWrap}>
                <a href={signInUrl} style={styles.button}>
                  Sign In
                </a>
              </Section>

              {/* How it works */}
              <Text style={styles.eyebrow}>How it works</Text>

              <table cellPadding="0" cellSpacing="0" border={0} style={{ width: "100%", marginBottom: "24px" }}>
                <tbody>
                  <Step n="1" title="Get availability emails"
                    body="Each cycle, Press Farm sends what's been picked. You'll get an email a day or two before delivery." />
                  <Step n="2" title="Place your order"
                    body="Tap the link, browse items, set quantities, add a note if you need something specific. Submit by the night before delivery." />
                  <Step n="3" title="Receive your delivery"
                    body="Items arrive Thursday, Saturday, or Monday. If anything was short, you'll see it in your order history with the reason." />
                </tbody>
              </table>

              {/* Tips */}
              <Text style={styles.eyebrow}>Quick tips</Text>
              <Text style={styles.paragraphMuted}>
                <strong style={{ color: "#1a1a1a" }}>Add to home screen.</strong>
                {" "}On iPhone, tap the share button → &ldquo;Add to Home Screen&rdquo; for a one-tap app.
              </Text>
              <Text style={styles.paragraphMuted}>
                <strong style={{ color: "#1a1a1a" }}>Watch for emails from <code>availability@pressfarm.io</code>.</strong>
                {" "}They&apos;re your cue to order.
              </Text>
              <Text style={styles.paragraphMuted}>
                <strong style={{ color: "#1a1a1a" }}>Use the notes field</strong>
                {" "}when you need something specific — size preferences, prep style, anything.
              </Text>
            </Section>
          </div>

          {/* Footer */}
          <Section style={styles.footerSection}>
            <Text style={styles.footerLine}>
              Questions? Just reply to this email.
            </Text>
            <Text style={styles.footerSignature}>
              Press Farm · Yountville, California
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <tr>
      <td style={{ width: "44px", verticalAlign: "top", paddingBottom: "20px" }}>
        <div style={styles.stepNumWrap as any}>
          <span style={styles.stepNumText as any}>{n}</span>
        </div>
      </td>
      <td style={{ verticalAlign: "top", paddingBottom: "20px" }}>
        <Text style={styles.stepTitle}>{title}</Text>
        <Text style={styles.stepDesc}>{body}</Text>
      </td>
    </tr>
  );
}

