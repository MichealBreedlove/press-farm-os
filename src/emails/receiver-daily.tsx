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
import { styles, MANDALA_URL, WORDMARK_URL, colors, restaurantLogoUrl, restaurantBadgeStyles } from "./_shared";

interface ReceiverLine {
  itemName: string;
  quantity: number;
  unit: string;
  isEvent?: boolean;
}

interface ReceiverRestaurantBlock {
  restaurantName: string;
  freeformNotes?: string;
  lines: ReceiverLine[];
}

interface ReceiverDailyProps {
  receiverName: string;
  deliveryDate: string;
  restaurants: ReceiverRestaurantBlock[];
}

/**
 * receiver-daily.tsx — Sent to a receiver the morning of (or evening before)
 * a delivery date. Summarizes what's coming in across all restaurants so
 * they know what to expect at the loading dock.
 *
 * No co-brand block in the hero — receivers handle multiple restaurants,
 * so we co-brand inline (one logo per section block) instead.
 */
export default function ReceiverDaily({
  receiverName,
  deliveryDate,
  restaurants,
}: ReceiverDailyProps) {
  const totalItems = restaurants.reduce((sum, r) => sum + r.lines.length, 0);
  const totalEvents = restaurants.reduce(
    (sum, r) => sum + r.lines.filter((l) => l.isEvent).length,
    0,
  );

  return (
    <Html>
      <Head />
      <Preview>
        Today&apos;s incoming for {deliveryDate} — {totalItems} items across{" "}
        {restaurants.length} restaurant{restaurants.length === 1 ? "" : "s"}
      </Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <div style={styles.card}>
            {/* Brand hero (no restaurant co-brand — receivers see multiple) */}
            <Section style={styles.hero}>
              <Img src={MANDALA_URL} alt="Press Farm mandala" width="120" height="120" style={{ display: "block", margin: "0 auto", width: "120px", height: "auto" }} />
              <Img src={WORDMARK_URL} alt="PRESS FARM" width="240" height="auto" style={{ display: "block", margin: "20px auto 6px", maxWidth: "240px", height: "auto" }} />
              <Text style={styles.tagline}>Cultivated with Chefs</Text>
            </Section>

            <hr style={styles.goldRule} />

            <Section style={styles.body_section}>
              <Text style={styles.eyebrow}>Today&apos;s Receiving</Text>
              <Text style={styles.h1}>{deliveryDate}</Text>

              <Text style={styles.paragraph}>
                Hi {receiverName}, here&apos;s what&apos;s coming to the dock today.
              </Text>

              {/* Summary highlight */}
              <div style={styles.highlightBox}>
                <Text style={styles.highlightLabel}>Incoming today</Text>
                <Text style={styles.highlightValue}>
                  {totalItems} item{totalItems === 1 ? "" : "s"}
                </Text>
                <Text style={{ ...styles.highlightLabel, marginTop: "8px" }}>
                  {restaurants.length} restaurant{restaurants.length === 1 ? "" : "s"}
                  {totalEvents > 0 ? ` · ${totalEvents} for events` : ""}
                </Text>
              </div>

              {/* Per-restaurant blocks */}
              {restaurants.map((block) => {
                const restLogo = restaurantLogoUrl(block.restaurantName);
                const regularLines = block.lines.filter((l) => !l.isEvent);
                const eventLines = block.lines.filter((l) => l.isEvent);

                return (
                  <div key={block.restaurantName} style={{ marginTop: "28px" }}>
                    {/* Restaurant header with co-brand logo */}
                    <hr style={restaurantBadgeStyles.divider} />
                    <Text style={restaurantBadgeStyles.forLabel}>For</Text>
                    {restLogo ? (
                      <Img src={restLogo} alt={block.restaurantName} style={restaurantBadgeStyles.logo} />
                    ) : (
                      <Text style={restaurantBadgeStyles.fallbackText}>{block.restaurantName}</Text>
                    )}

                    {/* Chef freeform notes pulled to the top of the block */}
                    {block.freeformNotes && (
                      <Text style={{
                        ...styles.paragraphMuted,
                        fontStyle: "italic",
                        borderLeft: `2px solid ${colors.gold}`,
                        paddingLeft: "12px",
                        marginTop: "16px",
                        marginBottom: "12px",
                      }}>
                        <strong style={{ color: colors.greenDark, fontStyle: "normal" }}>Chef note:</strong>{" "}
                        &ldquo;{block.freeformNotes}&rdquo;
                      </Text>
                    )}

                    {/* Regular menu items */}
                    {regularLines.length > 0 && (
                      <table cellPadding="0" cellSpacing="0" border={0} style={{ width: "100%", marginTop: "12px" }}>
                        <tbody>
                          {regularLines.map((line, i) => (
                            <tr key={i} style={i === regularLines.length - 1 && eventLines.length === 0 ? styles.itemRowLast as any : styles.itemRow as any}>
                              <td style={{ paddingRight: "12px" }}>
                                <Text style={styles.itemName}>{line.itemName}</Text>
                              </td>
                              <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                                <Text style={styles.itemQty}>
                                  {line.quantity} {line.unit?.toUpperCase()}
                                </Text>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}

                    {/* Events sub-section, visually offset */}
                    {eventLines.length > 0 && (
                      <>
                        <Text style={{
                          fontFamily: styles.eyebrow.fontFamily,
                          fontSize: "10px",
                          letterSpacing: "0.22em",
                          textTransform: "uppercase" as const,
                          color: "#5E2B7A",
                          margin: "16px 0 8px",
                          fontWeight: 600,
                        }}>
                          For Events
                        </Text>
                        <table cellPadding="0" cellSpacing="0" border={0} style={{ width: "100%" }}>
                          <tbody>
                            {eventLines.map((line, i) => (
                              <tr key={i} style={i === eventLines.length - 1 ? styles.itemRowLast as any : styles.itemRow as any}>
                                <td style={{ paddingRight: "12px" }}>
                                  <Text style={styles.itemName}>{line.itemName}</Text>
                                </td>
                                <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                                  <Text style={styles.itemQty}>
                                    {line.quantity} {line.unit?.toUpperCase()}
                                  </Text>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </>
                    )}
                  </div>
                );
              })}

              {/* CTA */}
              <Section style={styles.ctaWrap}>
                <a href={`${APP_URL}/receiver`} style={styles.button}>
                  View Live Dashboard
                </a>
              </Section>

              <Text style={{ ...styles.paragraphMuted, textAlign: "center" as const }}>
                Status (ready / short / extra) updates as the harvest is logged.
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
