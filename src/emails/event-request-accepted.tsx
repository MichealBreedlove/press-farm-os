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
import { styles, MANDALA_URL, WORDMARK_URL, colors, restaurantLogoUrl, restaurantBadgeStyles } from "./_shared";

interface EventRequestAcceptedProps {
  chefName: string;
  restaurantName: string;
  deliveryDate: string;
  items: { itemName: string; quantity: number; unit: string }[];
  eventName: string | null;
  adminResponse: string | null;
}

/**
 * event-request-accepted.tsx — Sent to a chef when their advance event
 * request is accepted. Confirms the lines we auto-added to their order
 * for the requested delivery date. Used for both single-item accepts
 * and batched group accepts (multiple items under one event).
 */
export default function EventRequestAccepted({
  chefName,
  restaurantName,
  deliveryDate,
  items,
  eventName,
  adminResponse,
}: EventRequestAcceptedProps) {
  const restLogo = restaurantLogoUrl(restaurantName);
  const lineLabel = items.length === 1 ? "item" : `${items.length} items`;
  return (
    <Html>
      <Head />
      <Preview>Event request accepted for {deliveryDate}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <div style={styles.card}>
            <Section style={styles.hero}>
              <Img src={MANDALA_URL} alt="Press Farm mandala" width="120" height="120" style={{ display: "block", margin: "0 auto", width: "120px", height: "auto" }} />
              <Img src={WORDMARK_URL} alt="PRESS FARM" width="240" height="auto" style={{ display: "block", margin: "20px auto 6px", maxWidth: "240px", height: "auto" }} />
              <Text style={styles.tagline}>Cultivated with Chefs</Text>

              <hr style={restaurantBadgeStyles.divider} />
              <Text style={restaurantBadgeStyles.forLabel}>For</Text>
              {restLogo ? (
                <Img src={restLogo} alt={restaurantName} style={restaurantBadgeStyles.logo} />
              ) : (
                <Text style={restaurantBadgeStyles.fallbackText}>{restaurantName}</Text>
              )}
            </Section>

            <hr style={styles.goldRule} />

            <Section style={styles.body_section}>
              <Text style={styles.eyebrow}>Event Request Accepted</Text>
              <Text style={styles.h1}>{deliveryDate}</Text>

              <Text style={styles.paragraph}>
                Hi {chefName}, we&rsquo;ve confirmed your advance request{eventName ? ` for ${eventName}` : ""}. The {lineLabel} {items.length === 1 ? "has" : "have"} been
                added to your order for {deliveryDate}.
              </Text>

              <div style={styles.highlightBox}>
                <Text style={styles.highlightLabel}>Confirmed</Text>
                {items.map((line, idx) => (
                  <Text key={idx} style={styles.highlightValue}>
                    {line.quantity} {line.unit?.toUpperCase()} {line.itemName}
                  </Text>
                ))}
              </div>

              {adminResponse && (
                <>
                  <Text style={styles.eyebrow}>Note from Press Farm</Text>
                  <Text style={{ ...styles.paragraphMuted, fontStyle: "italic", borderLeft: `2px solid ${colors.gold}`, paddingLeft: "12px" }}>
                    &ldquo;{adminResponse}&rdquo;
                  </Text>
                </>
              )}

              <Text style={{ ...styles.paragraphMuted, marginTop: "24px" }}>
                You&rsquo;ll see {items.length === 1 ? "this line" : "these lines"} in your order history. We&rsquo;ll harvest the morning
                of delivery and bring {items.length === 1 ? "it" : "them"} with your usual drop.
              </Text>
            </Section>
          </div>

          <Section style={styles.footerSection}>
            <Text style={styles.footerLine}>Questions? Just reply to this email.</Text>
            <Text style={styles.footerSignature}>Press Farm · Yountville, California</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
