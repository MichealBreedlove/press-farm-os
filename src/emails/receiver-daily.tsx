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
import { styles, MANDALA_URL, WORDMARK_URL, colors, FONT_STACK, restaurantLogoUrl, restaurantBadgeStyles } from "./_shared";

const FONT_STACK_INLINE = FONT_STACK;

/**
 * One line in the receiver's daily summary.
 *
 * The four statuses mirror what the receiver sees in /receiver:
 *   READY   — ordered + harvest logged at full quantity
 *   SHORT   — ordered + harvest logged at less than ordered (with reason)
 *   PENDING — ordered + harvest not yet logged (default before delivery day)
 *   EXTRA   — delivered without being on the order (rare, but real)
 */
type ReceiverLineStatus = "ready" | "short" | "pending" | "extra";

interface ReceiverLine {
  itemName: string;
  unit: string;
  /** What the chef ordered. 0 means it wasn't ordered (extra). */
  ordered: number;
  /** What's actually being delivered. May be < ordered (short) or > 0 with ordered=0 (extra). */
  delivered: number;
  status: ReceiverLineStatus;
  /** Why something was short, if applicable. Pulled from order_items.shortage_reason. */
  shortageReason?: string;
  isEvent?: boolean;
}

const STATUS_STYLES: Record<ReceiverLineStatus, { label: string; bg: string; fg: string }> = {
  ready:   { label: "Ready",   bg: "rgba(0, 119, 74, 0.12)",   fg: "#00774A" },
  short:   { label: "Short",   bg: "rgba(235, 108, 50, 0.12)", fg: "#EB6C32" },
  pending: { label: "Pending", bg: "rgba(217, 119, 6, 0.10)",  fg: "#B45309" },
  extra:   { label: "Extra",   bg: "rgba(46, 95, 161, 0.12)",  fg: "#2E5FA1" },
};

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

  // Status counts across all restaurants — drives the summary stat strip
  const statusCounts = restaurants.reduce(
    (acc, r) => {
      for (const line of r.lines) acc[line.status]++;
      return acc;
    },
    { ready: 0, short: 0, pending: 0, extra: 0 } as Record<ReceiverLineStatus, number>,
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

              {/* Status breakdown — only render the buckets that have items so
                  receivers immediately see what's short before reading per-restaurant. */}
              {(statusCounts.ready + statusCounts.short + statusCounts.pending + statusCounts.extra) > 0 && (
                <table cellPadding="0" cellSpacing="0" border={0} style={{ width: "100%", marginTop: "8px", marginBottom: "20px" }}>
                  <tbody>
                    <tr>
                      {(["ready", "short", "pending", "extra"] as ReceiverLineStatus[]).map((s) => {
                        const meta = STATUS_STYLES[s];
                        const count = statusCounts[s];
                        return (
                          <td key={s} style={{ width: "25%", padding: "0 4px", textAlign: "center" }}>
                            <div style={{
                              backgroundColor: count > 0 ? meta.bg : "#f5f1e8",
                              borderRadius: "10px",
                              padding: "10px 4px",
                              border: count > 0 ? `1px solid ${meta.fg}30` : "1px solid rgba(13, 42, 30, 0.05)",
                            }}>
                              <p style={{
                                fontFamily: FONT_STACK_INLINE,
                                fontSize: "20px",
                                fontWeight: 700,
                                color: count > 0 ? meta.fg : "#9ca3af",
                                margin: 0,
                                lineHeight: 1,
                              }}>{count}</p>
                              <p style={{
                                fontFamily: FONT_STACK_INLINE,
                                fontSize: "9px",
                                letterSpacing: "0.18em",
                                textTransform: "uppercase" as const,
                                color: count > 0 ? meta.fg : "#9ca3af",
                                margin: "4px 0 0",
                                fontWeight: 600,
                                lineHeight: 1,
                              }}>{meta.label}</p>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  </tbody>
                </table>
              )}

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
                            <LineRow key={i} line={line} isLast={i === regularLines.length - 1 && eventLines.length === 0} />
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
                              <LineRow key={i} line={line} isLast={i === eventLines.length - 1} />
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

/**
 * One line in the per-restaurant items table.
 * Renders: item name + status pill (top row), qty delta + shortage reason (bottom row).
 */
function LineRow({ line, isLast }: { line: ReceiverLine; isLast: boolean }) {
  const meta = STATUS_STYLES[line.status];
  const unit = (line.unit ?? "").toUpperCase();

  // Quantity caption varies by status so receivers immediately understand what to expect:
  //   ready   →  "5 EA"  (everything as ordered)
  //   short   →  "3 of 5 EA · short by 2"
  //   pending →  "5 EA · awaiting harvest"
  //   extra   →  "3 EA · not on order"
  let qtyCaption: string;
  if (line.status === "ready") {
    qtyCaption = `${line.delivered} ${unit}`;
  } else if (line.status === "short") {
    const diff = line.ordered - line.delivered;
    qtyCaption = `${line.delivered} of ${line.ordered} ${unit} · short by ${diff}`;
  } else if (line.status === "extra") {
    qtyCaption = `${line.delivered} ${unit} · not on order`;
  } else {
    qtyCaption = `${line.ordered} ${unit} · awaiting harvest`;
  }

  return (
    <tr style={isLast ? (styles.itemRowLast as any) : (styles.itemRow as any)}>
      <td style={{ paddingRight: "12px" }}>
        {/* Top row: item name + inline status pill */}
        <table cellPadding="0" cellSpacing="0" border={0} style={{ width: "100%" }}>
          <tbody>
            <tr>
              <td style={{ verticalAlign: "middle", paddingRight: "8px" }}>
                <Text style={styles.itemName}>{line.itemName}</Text>
              </td>
              <td style={{ verticalAlign: "middle", whiteSpace: "nowrap", textAlign: "right" }}>
                <span style={{
                  display: "inline-block",
                  fontFamily: FONT_STACK_INLINE,
                  fontSize: "9px",
                  fontWeight: 700,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  backgroundColor: meta.bg,
                  color: meta.fg,
                  padding: "3px 8px",
                  borderRadius: "999px",
                  lineHeight: 1.4,
                }}>
                  {meta.label}
                </span>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Bottom row: qty caption + (optional) shortage reason */}
        <Text style={{
          fontFamily: FONT_STACK_INLINE,
          fontSize: "12px",
          color: line.status === "short" ? meta.fg : colors.textMuted,
          margin: "2px 0 0",
          fontWeight: line.status === "short" ? 600 : 400,
        }}>
          {qtyCaption}
        </Text>
        {line.shortageReason && (
          <Text style={{
            fontFamily: FONT_STACK_INLINE,
            fontSize: "12px",
            color: colors.textMuted,
            margin: "2px 0 0",
            fontStyle: "italic",
          }}>
            {line.shortageReason}
          </Text>
        )}
      </td>
    </tr>
  );
}
