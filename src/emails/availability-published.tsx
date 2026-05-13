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
import { styles, MANDALA_URL, WORDMARK_URL, restaurantLogoUrl, restaurantBadgeStyles } from "./_shared";

interface SeasonalItem {
  name: string;
  season_note?: string | null;
}

interface AvailabilityPublishedProps {
  chefName: string;
  restaurantName: string;
  deliveryDate: string;
  itemCount: number;
  /** Optional seasonal items to call out. Omit or pass empty arrays to hide the section. */
  seasonal?: {
    endingSoon?: SeasonalItem[];
    comingSoon?: SeasonalItem[];
  };
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
  seasonal,
}: AvailabilityPublishedProps) {
  const endingSoon = seasonal?.endingSoon ?? [];
  const comingSoon = seasonal?.comingSoon ?? [];
  const hasSeasonal = endingSoon.length > 0 || comingSoon.length > 0;
  const restLogo = restaurantLogoUrl(restaurantName);
  return (
    <Html>
      <Head />
      <Preview>{`New availability for ${deliveryDate} — ${itemCount} items`}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <div style={styles.card}>
            {/* Hero */}
            <Section style={styles.hero}>
              <Img src={MANDALA_URL} alt="Press Farm mandala" width="120" height="120" style={{ display: "block", margin: "0 auto", width: "120px", height: "auto" }} />
              <Img src={WORDMARK_URL} alt="PRESS FARM" width="240" height="auto" style={{ display: "block", margin: "20px auto 6px", maxWidth: "240px", height: "auto" }} />
              <Text style={styles.tagline}>Cultivated with Chefs</Text>

              {/* Restaurant co-brand */}
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

              {hasSeasonal && (
                <Section>
                  {endingSoon.length > 0 && (
                    <>
                      <Text style={styles.eyebrow}>Ending Soon</Text>
                      {endingSoon.map((it, idx) => (
                        <Text key={`es-${idx}`} style={styles.paragraph}>
                          {it.name}
                          {it.season_note ? ` — ${it.season_note}` : ""}
                        </Text>
                      ))}
                    </>
                  )}
                  {comingSoon.length > 0 && (
                    <>
                      <Text style={styles.eyebrow}>Coming Soon</Text>
                      {comingSoon.map((it, idx) => (
                        <Text key={`cs-${idx}`} style={styles.paragraph}>
                          {it.name}
                          {it.season_note ? ` — ${it.season_note}` : ""}
                        </Text>
                      ))}
                    </>
                  )}
                </Section>
              )}

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

