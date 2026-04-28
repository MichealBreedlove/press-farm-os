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
import { styles, FLORAL_URL, WORDMARK_URL, colors } from "./_shared";

interface FulfilledItem {
  itemName: string;
  requestedQty: number;
  fulfilledQty: number;
  unit: string;
  isShorted: boolean;
}

interface OrderFulfilledProps {
  chefName: string;
  restaurantName: string;
  deliveryDate: string;
  items: FulfilledItem[];
}

/**
 * order-fulfilled.tsx — Sent to chef when admin marks order as fulfilled.
 */
export default function OrderFulfilled({
  chefName,
  restaurantName,
  deliveryDate,
  items,
}: OrderFulfilledProps) {
  const shortedCount = items.filter(i => i.isShorted).length;

  return (
    <Html>
      <Head />
      <Preview>Order ready for {deliveryDate}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <div style={styles.card}>
            <Section style={styles.hero}>
              <Img src={FLORAL_URL} alt="Press Farm" width="56" height="56" style={{ ...styles.floral, width: "56px" }} />
              <Img src={WORDMARK_URL} alt="PRESS FARM" width="240" height="auto" style={{ display: "block", margin: "16px auto 4px", maxWidth: "240px", height: "auto" }} />
              <Text style={styles.tagline}>— Cultivated with Chefs —</Text>
            </Section>

            <hr style={styles.goldRule} />

            <Section style={styles.body_section}>
              <Text style={styles.eyebrow}>Order Ready</Text>
              <Text style={styles.h1}>Picked & Packed</Text>

              <Text style={styles.paragraph}>
                Hello {chefName}, your <strong>{restaurantName}</strong> order for{" "}
                <strong>{deliveryDate}</strong> is ready for delivery.
              </Text>

              {shortedCount > 0 && (
                <div style={{ ...styles.highlightBox, backgroundColor: "#FEF3C7", borderColor: "#FDE68A" }}>
                  <Text style={{ ...styles.paragraph, fontSize: "13px", color: "#78350F", margin: 0 }}>
                    <strong>{shortedCount} item{shortedCount !== 1 ? "s" : ""} shorted</strong> — see the list below for details.
                  </Text>
                </div>
              )}

              <Text style={styles.eyebrow}>What you&apos;re getting</Text>

              <table cellPadding="0" cellSpacing="0" border={0} style={{ width: "100%", borderCollapse: "collapse" as const }}>
                <tbody>
                  {items.map((item, i) => (
                    <tr key={i}>
                      <td style={{ padding: "10px 0", borderBottom: i < items.length - 1 ? `1px solid ${colors.borderSoft}` : "none" }}>
                        <Text style={styles.itemName}>{item.itemName}</Text>
                        {item.isShorted && (
                          <Text style={{ fontFamily: "inherit", fontSize: "11px", color: "#B45309", margin: "2px 0 0" }}>
                            Shorted from {item.requestedQty} requested
                          </Text>
                        )}
                      </td>
                      <td style={{ padding: "10px 0", borderBottom: i < items.length - 1 ? `1px solid ${colors.borderSoft}` : "none", textAlign: "right" as const }}>
                        <Text style={{ ...styles.itemQty, color: item.isShorted ? "#B45309" : colors.greenDark }}>
                          {item.fulfilledQty} <span style={{ color: colors.textMuted, fontWeight: 400, fontSize: "12px", textTransform: "uppercase" as const }}>{item.unit}</span>
                        </Text>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <Section style={styles.ctaWrap}>
                <a href={`${APP_URL}/history`} style={styles.button}>
                  View Order
                </a>
              </Section>
            </Section>
          </div>

          <Section style={styles.footerSection}>
            <Text style={styles.footerLine}>
              Questions about your delivery? Reply to this email.
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

