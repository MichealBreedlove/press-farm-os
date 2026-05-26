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
import {
  styles,
  colors,
  MANDALA_URL,
  WORDMARK_URL,
} from "./_shared";
import type { ForecastEmailEntry } from "./availability-forecast";

export interface PartnerReportLine {
  label: string;
  value: string;
  /** Optional sub-label, e.g. unit or count. */
  sub?: string | null;
}

interface PartnerReportProps {
  /** Partner first name, e.g. "Phil". */
  partnerName: string;
  period: "monthly" | "quarterly";
  /** Already-formatted period label, e.g. "April 2026" or "Q2 2026". */
  periodLabel: string;
  /** Formatted total value of produce delivered in the period. */
  totalValue: string;
  /** Number of deliveries in the period. */
  deliveryCount: number;
  /** Top items/crops by value, pre-formatted. */
  topItems: PartnerReportLine[];
  /** By-restaurant breakdown, pre-formatted. */
  byRestaurant: PartnerReportLine[];
  /** Forward-looking teaser entries (next 2–4 weeks). */
  comingSoon: ForecastEmailEntry[];
}

const microBadge = {
  display: "inline-block",
  fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
  fontSize: "9px",
  letterSpacing: "0.14em",
  textTransform: "uppercase" as const,
  color: colors.gold,
  border: `1px solid ${colors.goldLight}`,
  borderRadius: "8px",
  padding: "1px 6px",
  marginLeft: "8px",
  verticalAlign: "middle" as const,
};

/**
 * partner-report.tsx — Partner-facing summary for Chef Phil.
 *
 * Monthly or quarterly. Leads with the value of produce delivered, top crops,
 * and a by-restaurant breakdown, then a short "Coming soon from the farm"
 * teaser built from the availability forecast. Framed for a chef/partner, not
 * internal finance jargon — no expense/margin lines.
 */
export default function PartnerReport({
  partnerName,
  period,
  periodLabel,
  totalValue,
  deliveryCount,
  topItems,
  byRestaurant,
  comingSoon,
}: PartnerReportProps) {
  const periodWord = period === "quarterly" ? "Quarter" : "Month";
  return (
    <Html>
      <Head />
      <Preview>{`Press Farm — your ${periodWord.toLowerCase()} from the farm, ${periodLabel}`}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <div style={styles.card}>
            <Section style={styles.hero}>
              <Img src={MANDALA_URL} alt="Press Farm mandala" width="120" height="120" style={{ display: "block", margin: "0 auto", width: "120px", height: "auto" }} />
              <Img src={WORDMARK_URL} alt="PRESS FARM" width="240" height="auto" style={{ display: "block", margin: "20px auto 6px", maxWidth: "240px", height: "auto" }} />
              <Text style={styles.tagline}>{period === "quarterly" ? "Quarterly Partner Report" : "Monthly Partner Report"}</Text>
            </Section>

            <hr style={styles.goldRule} />

            <Section style={styles.body_section}>
              <Text style={styles.eyebrow}>{periodWord} in Review</Text>
              <Text style={styles.h1}>{periodLabel}</Text>

              <Text style={styles.paragraph}>Hello Chef {partnerName},</Text>
              <Text style={styles.paragraph}>
                A look back at everything Press Farm grew for your kitchens this {periodWord.toLowerCase()},
                and a preview of what&apos;s on its way.
              </Text>

              <div style={styles.highlightBox}>
                <Text style={styles.highlightLabel}>Produce delivered</Text>
                <Text style={styles.highlightValue}>{totalValue}</Text>
                <Text style={{ ...styles.highlightLabel, marginTop: "4px" }}>
                  across {deliveryCount} {deliveryCount === 1 ? "delivery" : "deliveries"}
                </Text>
              </div>

              {byRestaurant.length > 0 && (
                <>
                  <Text style={styles.h2}>By Kitchen</Text>
                  <table cellPadding="0" cellSpacing="0" border={0} style={{ width: "100%" }}>
                    <tbody>
                      {byRestaurant.map((r, i) => (
                        <tr key={i} style={i === byRestaurant.length - 1 ? (styles.itemRowLast as any) : (styles.itemRow as any)}>
                          <td style={{ paddingRight: "12px" }}>
                            <Text style={styles.itemName}>{r.label}</Text>
                          </td>
                          <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                            <Text style={styles.itemQty}>{r.value}</Text>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}

              {topItems.length > 0 && (
                <>
                  <Text style={styles.h2}>Top Crops</Text>
                  <table cellPadding="0" cellSpacing="0" border={0} style={{ width: "100%" }}>
                    <tbody>
                      {topItems.map((t, i) => (
                        <tr key={i} style={i === topItems.length - 1 ? (styles.itemRowLast as any) : (styles.itemRow as any)}>
                          <td style={{ paddingRight: "12px" }}>
                            <Text style={styles.itemName}>
                              {t.label}
                              {t.sub && <span style={{ color: colors.textMuted, fontWeight: 400 }}> · {t.sub}</span>}
                            </Text>
                          </td>
                          <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                            <Text style={styles.itemQty}>{t.value}</Text>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}

              <Text style={styles.h2}>Coming Soon From the Farm</Text>
              {comingSoon.length === 0 ? (
                <Text style={styles.paragraphMuted}>
                  We&apos;ll have a fresh forecast for you soon as the next plantings mature.
                </Text>
              ) : (
                <table cellPadding="0" cellSpacing="0" border={0} style={{ width: "100%" }}>
                  <tbody>
                    {comingSoon.map((e, i) => (
                      <tr key={i} style={i === comingSoon.length - 1 ? (styles.itemRowLast as any) : (styles.itemRow as any)}>
                        <td style={{ paddingRight: "12px" }}>
                          <Text style={styles.itemName}>
                            {e.name}
                            {e.isMicrogreen && <span style={microBadge}>Microgreen</span>}
                            {e.window && (
                              <span style={{ color: colors.textMuted, fontWeight: 400 }}> · {e.window}</span>
                            )}
                          </Text>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              <Text style={{ ...styles.paragraphMuted, marginTop: "20px" }}>
                Thank you for cooking with what we grow. Reply anytime to plan ahead or request a
                crop for an upcoming menu.
              </Text>
            </Section>
          </div>

          <Section style={styles.footerSection}>
            <Text style={styles.footerSignature}>Press Farm · Yountville, California</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
