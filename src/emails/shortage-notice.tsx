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
import { styles, FLORAL_URL, colors } from "./_shared";

interface ShortageItem {
  itemName: string;
  requestedQty: number;
  fulfilledQty: number;
  unit: string;
  reason: string;
}

interface ShortageNoticeProps {
  chefName: string;
  restaurantName: string;
  deliveryDate: string;
  shortages: ShortageItem[];
}

/**
 * shortage-notice.tsx — Sent to chef when admin marks items as shorted.
 */
export default function ShortageNotice({
  chefName,
  restaurantName,
  deliveryDate,
  shortages,
}: ShortageNoticeProps) {
  return (
    <Html>
      <Head />
      <Preview>Shortage notice for {deliveryDate}</Preview>
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
              <Text style={{ ...styles.eyebrow, color: "#B45309" }}>Heads Up</Text>
              <Text style={styles.h1}>Shortage on {deliveryDate}</Text>

              <Text style={styles.paragraph}>
                Hello {chefName}, a few items on your <strong>{restaurantName}</strong> order
                couldn&apos;t be fulfilled in full. Details below — all other items will arrive
                as requested.
              </Text>

              <table cellPadding="0" cellSpacing="0" border={0} style={{ width: "100%", borderCollapse: "collapse" as const, margin: "20px 0" }}>
                <tbody>
                  {shortages.map((s, i) => (
                    <tr key={i}>
                      <td style={{ padding: "14px 0", borderBottom: i < shortages.length - 1 ? `1px solid ${colors.borderSoft}` : "none" }}>
                        <Text style={styles.itemName}>{s.itemName}</Text>
                        <Text style={{ fontFamily: "inherit", fontSize: "12px", color: colors.textMuted, margin: "4px 0 0" }}>
                          {s.reason}
                        </Text>
                      </td>
                      <td style={{ padding: "14px 0", borderBottom: i < shortages.length - 1 ? `1px solid ${colors.borderSoft}` : "none", textAlign: "right" as const, whiteSpace: "nowrap" as const }}>
                        <Text style={{ ...styles.itemQty, color: "#B45309" }}>
                          {s.fulfilledQty}
                        </Text>
                        <Text style={{ fontFamily: "inherit", fontSize: "11px", color: colors.textLight, margin: "2px 0 0", textDecoration: "line-through" as const }}>
                          {s.requestedQty} {s.unit.toUpperCase()}
                        </Text>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <Text style={styles.paragraphMuted}>
                We do our best to fulfill every order. When the field doesn&apos;t cooperate
                — pests, weather, timing — we&apos;d rather give you accurate info than
                substitute without asking. Reply to this email if you&apos;d like a
                substitute or have questions.
              </Text>
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
