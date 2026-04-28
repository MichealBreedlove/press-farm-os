import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import { APP_URL } from "@/lib/constants";

interface AvailabilityPublishedProps {
  chefName: string;
  restaurantName: string;
  deliveryDate: string;
  itemCount: number;
}

/**
 * availability-published.tsx — Sent to all chefs for a restaurant
 * when admin publishes availability for a delivery date.
 *
 * Subject: "New Availability — [Date]"
 * From: availability@pressfarm.io
 */
export default function AvailabilityPublished({
  chefName,
  restaurantName,
  deliveryDate,
  itemCount,
}: AvailabilityPublishedProps) {
  return (
    <Html>
      <Head />
      <Preview>New availability posted for {deliveryDate} — place your order</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={hero}>
            <Img
              src={`${APP_URL}/assets/logo/png/logo-floral-only-transparent.png`}
              alt="Press Farm"
              width="80"
              height="80"
              style={{ display: "block", margin: "0 auto" }}
            />
            <Heading style={brand}>PRESS FARM</Heading>
            <Text style={tagline}>— CULTIVATED WITH CHEFS —</Text>
          </Section>

          <Section style={content}>
            <Text style={eyebrow}>Fresh availability</Text>
            <Heading style={h1}>{deliveryDate}</Heading>

            <Text style={paragraph}>Hi {chefName},</Text>
            <Text style={paragraph}>
              We&apos;ve posted availability for <strong>{restaurantName}</strong> for delivery on{" "}
              <strong>{deliveryDate}</strong>.
            </Text>
            <Text style={countLine}>
              <strong>{itemCount}</strong> {itemCount === 1 ? "item" : "items"} ready to order
            </Text>

            <Section style={ctaWrap}>
              <Button href={`${APP_URL}/order`} style={button}>
                Place Your Order
              </Button>
            </Section>

            <Text style={footer}>
              Order by the night before delivery.<br />
              Questions? Reply to this email.
            </Text>
          </Section>

          <Text style={signoff}>Press Farm · Yountville, California</Text>
        </Container>
      </Body>
    </Html>
  );
}

const body = { backgroundColor: "#faf7f0", fontFamily: "system-ui, -apple-system, sans-serif", margin: 0, padding: 0 };
const container = { maxWidth: "560px", margin: "0 auto", padding: "20px" };
const hero = {
  textAlign: "center" as const,
  padding: "32px 24px 24px",
  backgroundColor: "#ffffff",
  borderRadius: "16px 16px 0 0",
};
const brand = {
  fontFamily: "Bank Gothic LT, system-ui, sans-serif",
  fontSize: "20px",
  fontWeight: 700,
  letterSpacing: "0.22em",
  color: "#0D2A1E",
  margin: "12px 0 4px",
};
const tagline = {
  fontFamily: "Bank Gothic LT, system-ui, sans-serif",
  fontSize: "10px",
  letterSpacing: "0.28em",
  color: "#B58B48",
  margin: 0,
};
const content = {
  backgroundColor: "#ffffff",
  padding: "8px 32px 32px",
  borderRadius: "0 0 16px 16px",
};
const eyebrow = {
  fontFamily: "Bank Gothic LT, system-ui, sans-serif",
  fontSize: "11px",
  letterSpacing: "0.22em",
  textTransform: "uppercase" as const,
  color: "#00774A",
  margin: "16px 0 8px",
};
const h1 = {
  fontSize: "26px",
  fontWeight: 600,
  color: "#0D2A1E",
  margin: "0 0 24px",
  lineHeight: 1.2,
};
const paragraph = { fontSize: "14px", color: "#444", lineHeight: 1.6, margin: "0 0 12px" };
const countLine = {
  fontSize: "16px",
  color: "#0D2A1E",
  margin: "20px 0",
  padding: "12px 16px",
  backgroundColor: "#faf7f0",
  borderRadius: "8px",
  textAlign: "center" as const,
};
const ctaWrap = { textAlign: "center" as const, margin: "24px 0" };
const button = {
  backgroundColor: "#0D2A1E",
  color: "#faf7f0",
  padding: "14px 32px",
  borderRadius: "12px",
  textDecoration: "none",
  fontSize: "14px",
  fontWeight: 600,
  letterSpacing: "0.08em",
  display: "inline-block",
};
const footer = {
  fontSize: "12px",
  color: "#888",
  marginTop: "24px",
  paddingTop: "16px",
  borderTop: "1px solid #f0ebe0",
  lineHeight: 1.6,
};
const signoff = {
  fontFamily: "Bank Gothic LT, system-ui, sans-serif",
  fontSize: "10px",
  letterSpacing: "0.28em",
  textTransform: "uppercase" as const,
  color: "#aaa",
  textAlign: "center" as const,
  marginTop: "16px",
};
