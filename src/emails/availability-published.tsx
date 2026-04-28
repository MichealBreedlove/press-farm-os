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
import { styles, FLORAL_URL, WORDMARK_URL } from "./_shared";

interface AvailabilityPublishedProps {
  chefName: string;
  restaurantName: string;
  deliveryDate: string;
  itemCount: number;
}

/**
 * availability-published.tsx — Sent to all chefs when admin publishes
 * availability for a delivery date.
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
      <Preview>New availability for {deliveryDate} — {itemCount} items</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <div style={styles.card}>
            {/* Hero */}
            <Section style={styles.hero}>
              <Img src={FLORAL_URL} alt="Press Farm" width="72" height="72" style={styles.floral} />
              <Img src={WORDMARK_URL} alt="PRESS FARM" width="240" height="auto" style={{ display: "block", margin: "16px auto 4px", maxWidth: "240px", height: "auto" }} />
              <Text style={styles.tagline}>— Cultivated with Chefs —</Text>
            </Section>

            <hr style={styles.goldRule} />

            <Section style={styles.body_section}>
              <Text style={styles.eyebrow}>Fresh Availability</Text>
              <Text style={styles.h1}>{deliveryDate}</Text>

              <Text style={styles.paragraph}>Hello {chefName},</Text>
              <Text style={styles.paragraph}>
                We&apos;ve posted availability for <strong>{restaurantName}</strong> for delivery on <strong>{deliveryDate}</strong>.
              </Text>

              <div style={styles.highlightBox}>
                <Text style={styles.highlightLabel}>Ready to order</Text>
                <Text style={styles.highlightValue}>{itemCount} {itemCount === 1 ? "item" : "items"}</Text>
              </div>

              <Section style={styles.ctaWrap}>
                <a href={`${APP_URL}/order`} style={styles.button}>
                  Place Your Order
                </a>
              </Section>

              <Text style={styles.paragraphMuted}>
                Order by the night before delivery. We harvest the morning of, so the
                fresher your order, the fresher your produce.
              </Text>
            </Section>
          </div>

          <Section style={styles.footerSection}>
            <Text style={styles.footerLine}>
              Questions or need something specific? Reply to this email.
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

