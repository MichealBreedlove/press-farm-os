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
import { styles, FLORAL_URL, colors, FONT_STACK } from "./_shared";

interface OrderReceivedProps {
  restaurantName: string;
  chefName: string;
  deliveryDate: string;
  items: { itemName: string; quantity: number; unit: string }[];
  freeformNotes?: string;
  submittedAt: string;
}

/**
 * order-received.tsx — Sent to Press Farm admin when chef submits order.
 */
export default function OrderReceived({
  restaurantName,
  chefName,
  deliveryDate,
  items,
  freeformNotes,
  submittedAt,
}: OrderReceivedProps) {
  return (
    <Html>
      <Head />
      <Preview>{restaurantName} submitted order for {deliveryDate}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <div style={styles.card}>
            <Section style={styles.hero}>
              <Img src={FLORAL_URL} alt="Press Farm" width="56" height="56" style={{ ...styles.floral, width: "56px" }} />
              <Text style={styles.brand}>PRESS FARM</Text>
              <Text style={styles.tagline}>— Cultivated with Chefs —</Text>
            </Section>

            <hr style={styles.goldRule} />

            <Section style={styles.body_section}>
              <Text style={styles.eyebrow}>New Order</Text>
              <Text style={styles.h1}>{restaurantName}</Text>

              <div style={styles.highlightBox}>
                <Text style={styles.highlightLabel}>Delivery Date</Text>
                <Text style={styles.highlightValue}>{deliveryDate}</Text>
              </div>

              <Text style={styles.paragraphMuted}>
                Submitted by <strong style={{ color: colors.text }}>{chefName}</strong> at {submittedAt}
              </Text>

              <Text style={styles.eyebrow}>Items · {items.length}</Text>
              <table cellPadding="0" cellSpacing="0" border={0} style={{ width: "100%", borderCollapse: "collapse" as const }}>
                <tbody>
                  {items.map((item, i) => (
                    <tr key={i}>
                      <td style={{ padding: "10px 0", borderBottom: i < items.length - 1 ? `1px solid ${colors.borderSoft}` : "none" }}>
                        <Text style={styles.itemName}>{item.itemName}</Text>
                      </td>
                      <td style={{ padding: "10px 0", borderBottom: i < items.length - 1 ? `1px solid ${colors.borderSoft}` : "none", textAlign: "right" as const }}>
                        <Text style={styles.itemQty}>
                          {item.quantity} <span style={{ color: colors.textMuted, fontWeight: 400, fontSize: "12px", textTransform: "uppercase" as const }}>{item.unit}</span>
                        </Text>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {freeformNotes && (
                <div style={{ ...styles.highlightBox, textAlign: "left" as const, marginTop: "20px" }}>
                  <Text style={styles.highlightLabel}>Chef Notes</Text>
                  <Text style={{ ...styles.paragraph, fontStyle: "italic" as const, margin: "4px 0 0" }}>
                    &ldquo;{freeformNotes}&rdquo;
                  </Text>
                </div>
              )}

              <Section style={styles.ctaWrap}>
                <a href={`${APP_URL}/admin/orders/${deliveryDate}`} style={styles.button}>
                  View in Admin
                </a>
              </Section>
            </Section>
          </div>

          <Section style={styles.footerSection}>
            <Text style={styles.footerSignature}>
              Press Farm · Yountville, California
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
