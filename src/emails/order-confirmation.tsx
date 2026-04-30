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

interface OrderConfirmationProps {
  chefName: string;
  restaurantName: string;
  deliveryDate: string;
  items: {
    itemName: string;
    quantity: number;
    unit: string;
  }[];
  freeformNotes?: string;
}

/**
 * order-confirmation.tsx — Sent to a chef when they submit an order.
 *
 * Subject: "Order Confirmed — [Date]"
 * From: orders@pressfarm.app
 * To: Chef
 */
export default function OrderConfirmation({
  chefName,
  restaurantName,
  deliveryDate,
  items,
  freeformNotes,
}: OrderConfirmationProps) {
  const totalCount = items.reduce((sum, i) => sum + (i.quantity ?? 0), 0);
  const restLogo = restaurantLogoUrl(restaurantName);

  return (
    <Html>
      <Head />
      <Preview>Order confirmed for {deliveryDate}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <div style={styles.card}>
            {/* Brand hero */}
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
              <Text style={styles.eyebrow}>Order Confirmed</Text>
              <Text style={styles.h1}>{deliveryDate}</Text>

              <Text style={styles.paragraph}>
                Hi {chefName}, your order for <strong>{restaurantName}</strong> has been received.
                We&apos;ll harvest the morning of delivery and bring it to your kitchen.
              </Text>

              <div style={styles.highlightBox}>
                <Text style={styles.highlightLabel}>Items requested</Text>
                <Text style={styles.highlightValue}>{items.length}</Text>
                <Text style={{ ...styles.highlightLabel, marginTop: "8px" }}>
                  {totalCount} total {totalCount === 1 ? "unit" : "units"}
                </Text>
              </div>

              <Text style={styles.eyebrow}>Order summary</Text>
              <table cellPadding="0" cellSpacing="0" border={0} style={{ width: "100%" }}>
                <tbody>
                  {items.map((item, i) => (
                    <tr key={i} style={i === items.length - 1 ? styles.itemRowLast as any : styles.itemRow as any}>
                      <td style={{ paddingRight: "12px" }}>
                        <Text style={styles.itemName}>{item.itemName}</Text>
                      </td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        <Text style={styles.itemQty}>
                          {item.quantity} {item.unit?.toUpperCase()}
                        </Text>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {freeformNotes && (
                <>
                  <Text style={styles.eyebrow}>Your note</Text>
                  <Text style={{ ...styles.paragraphMuted, fontStyle: "italic", borderLeft: `2px solid ${colors.gold}`, paddingLeft: "12px" }}>
                    &ldquo;{freeformNotes}&rdquo;
                  </Text>
                </>
              )}

              <Text style={{ ...styles.paragraphMuted, marginTop: "24px" }}>
                If you need to change something, log in and edit your order any time before
                ordering closes the night before delivery.
              </Text>
            </Section>
          </div>

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
