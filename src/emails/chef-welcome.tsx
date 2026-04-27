import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import { APP_URL } from "@/lib/constants";

interface ChefWelcomeProps {
  chefName: string;
  restaurantName: string;
  loginUrl?: string;
}

/**
 * chef-welcome.tsx — Sent to a chef when admin invites them or
 * triggers "Send Welcome" from user management.
 */
export default function ChefWelcome({
  chefName,
  restaurantName,
  loginUrl,
}: ChefWelcomeProps) {
  const signInUrl = loginUrl ?? `${APP_URL}/login`;

  return (
    <Html>
      <Head />
      <Preview>Welcome to Press Farm — your kitchen, our farm</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={header}>
            <Heading style={h1}>Welcome to Press Farm 🌿</Heading>
          </Section>

          <Section style={content}>
            <Text style={greeting}>Hi {chefName},</Text>

            <Text style={paragraph}>
              You&apos;ve been added to the Press Farm ordering system for{" "}
              <strong>{restaurantName}</strong>. From now on, you&apos;ll order produce
              directly through our app — no more Excel sheets or back-and-forth texts.
            </Text>

            <Section style={cta}>
              <Button style={button} href={signInUrl}>
                Sign In
              </Button>
            </Section>

            <Heading style={h2}>How it works</Heading>

            <Section style={steps}>
              <Section style={step}>
                <Text style={stepNum}>1</Text>
                <div>
                  <Text style={stepTitle}>Get availability emails</Text>
                  <Text style={stepBody}>
                    Each cycle, Micheal sends what&apos;s available. You&apos;ll get
                    an email a day or two before delivery.
                  </Text>
                </div>
              </Section>

              <Section style={step}>
                <Text style={stepNum}>2</Text>
                <div>
                  <Text style={stepTitle}>Place your order</Text>
                  <Text style={stepBody}>
                    Tap the link, browse items, set quantities, add a note if needed.
                    Submit by the night before delivery.
                  </Text>
                </div>
              </Section>

              <Section style={step}>
                <Text style={stepNum}>3</Text>
                <div>
                  <Text style={stepTitle}>Get your delivery</Text>
                  <Text style={stepBody}>
                    Items arrive Thursday, Saturday, or Monday. If anything was short,
                    you&apos;ll see it in your order history with the reason.
                  </Text>
                </div>
              </Section>
            </Section>

            <Heading style={h2}>Quick tips</Heading>
            <Text style={paragraph}>
              📱 <strong>Add to home screen.</strong> On iPhone, tap the share button →
              &ldquo;Add to Home Screen&rdquo; for a one-tap app.
            </Text>
            <Text style={paragraph}>
              🔔 <strong>Watch for emails from <code>availability@pressfarm.io</code>.</strong>
              {" "}They&apos;re your cue to order.
            </Text>
            <Text style={paragraph}>
              📝 <strong>Use the notes field</strong> when you need something specific —
              size preferences, prep style, anything.
            </Text>

            <Text style={footer}>
              Questions? Just reply to this email or text Micheal directly.
              <br />
              <em>— The Press Farm team</em>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const body = { backgroundColor: "#faf7f0", fontFamily: "system-ui, -apple-system, sans-serif" };
const container = { margin: "0 auto", padding: "20px 0", maxWidth: "560px" };
const header = { backgroundColor: "#00774A", padding: "32px 24px", borderRadius: "12px 12px 0 0" };
const h1 = { color: "#ffffff", fontSize: "24px", fontWeight: 600, margin: 0 };
const content = { backgroundColor: "#ffffff", padding: "24px", borderRadius: "0 0 12px 12px", border: "1px solid #f0ebe0" };
const greeting = { fontSize: "16px", color: "#1a1a1a", marginTop: 0 };
const paragraph = { fontSize: "14px", color: "#444", lineHeight: "1.6", margin: "12px 0" };
const cta = { textAlign: "center" as const, margin: "24px 0" };
const button = {
  backgroundColor: "#00774A",
  color: "#ffffff",
  padding: "14px 32px",
  borderRadius: "12px",
  textDecoration: "none",
  fontSize: "15px",
  fontWeight: 600,
  display: "inline-block",
};
const h2 = { fontSize: "16px", fontWeight: 600, color: "#1a1a1a", marginTop: "24px", marginBottom: "12px" };
const steps = { margin: "12px 0" };
const step = { display: "flex" as const, alignItems: "flex-start", gap: "12px", marginBottom: "16px" };
const stepNum = {
  display: "inline-block",
  width: "28px",
  height: "28px",
  lineHeight: "28px",
  borderRadius: "50%",
  backgroundColor: "#00774A",
  color: "#ffffff",
  textAlign: "center" as const,
  fontWeight: 600,
  fontSize: "14px",
  flexShrink: 0,
  margin: 0,
};
const stepTitle = { fontSize: "14px", fontWeight: 600, color: "#1a1a1a", margin: 0 };
const stepBody = { fontSize: "13px", color: "#666", lineHeight: "1.5", margin: "2px 0 0 0" };
const footer = { fontSize: "13px", color: "#888", marginTop: "24px", paddingTop: "16px", borderTop: "1px solid #f0ebe0" };
