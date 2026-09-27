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
import type { MonthBar } from "@/lib/partner-report";

export interface PartnerReportLine {
  label: string;
  value: string;
  /** Optional sub-label, e.g. unit or count. */
  sub?: string | null;
}

export type PartnerReportPeriod = "monthly" | "quarterly" | "annual";

/** Extra sections only the annual (year-end) report carries. */
export interface PartnerReportAnnual {
  /** e.g. "+17.7% vs. 2025 ($72,158)" — null when there's no prior-year baseline */
  comparison: string | null;
  /** distinct items delivered over the year */
  itemCount: number;
  /** twelve month bars (future months blank on a year-to-date preview) */
  months: MonthBar[];
  /** delivered value by catalog category, pre-formatted */
  byCategory: PartnerReportLine[];
  /** self-harvest (planter boxes + microgreens) — null when there's none */
  selfHarvest: { boxes: string; microgreens: string; total: string; grandTotal: string } | null;
  /** e.g. "Sep 27" when the year isn't finished yet, else null */
  throughLabel: string | null;
}

interface PartnerReportProps {
  /** Partner first name, e.g. "Phil". */
  partnerName: string;
  period: PartnerReportPeriod;
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
  /** Annual-only sections; ignored for monthly/quarterly. */
  annual?: PartnerReportAnnual | null;
}

const PERIOD_WORD: Record<PartnerReportPeriod, string> = { monthly: "Month", quarterly: "Quarter", annual: "Year" };
const PERIOD_TAGLINE: Record<PartnerReportPeriod, string> = {
  monthly: "Monthly Partner Report",
  quarterly: "Quarterly Partner Report",
  annual: "Year-End Partner Report",
};

const barTrack = { backgroundColor: colors.borderSoft, borderRadius: "6px", height: "10px", lineHeight: "10px", fontSize: "1px" };
const barFill = { backgroundColor: colors.green, borderRadius: "6px", height: "10px", lineHeight: "10px", fontSize: "1px" };
const barLabel = {
  fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
  fontSize: "12px",
  color: colors.text,
  padding: "3px 8px 3px 0",
  whiteSpace: "nowrap" as const,
  width: "34px",
};
const barValue = { ...barLabel, padding: "3px 0 3px 8px", textAlign: "right" as const, fontWeight: 700, width: "70px" };

function LineRows({ rows }: { rows: PartnerReportLine[] }) {
  return (
    <table cellPadding="0" cellSpacing="0" border={0} style={{ width: "100%" }}>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} style={i === rows.length - 1 ? (styles.itemRowLast as any) : (styles.itemRow as any)}>
            <td style={{ paddingRight: "12px" }}>
              <Text style={styles.itemName}>
                {r.label}
                {r.sub && <span style={{ color: colors.textMuted, fontWeight: 400 }}> · {r.sub}</span>}
              </Text>
            </td>
            <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
              <Text style={styles.itemQty}>{r.value}</Text>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
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
 * Monthly, quarterly or annual. Leads with the value of produce delivered, top crops,
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
  annual,
}: PartnerReportProps) {
  const periodWord = PERIOD_WORD[period];
  const yearly = period === "annual" && annual ? annual : null;
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
              <Text style={styles.tagline}>{PERIOD_TAGLINE[period]}</Text>
            </Section>

            <hr style={styles.goldRule} />

            <Section style={styles.body_section}>
              <Text style={styles.eyebrow}>{periodWord} in Review</Text>
              <Text style={styles.h1}>{periodLabel}</Text>

              <Text style={styles.paragraph}>Hello Chef {partnerName},</Text>
              <Text style={styles.paragraph}>
                {yearly
                  ? <>A look back at everything Press Farm grew for your kitchens this year{yearly.throughLabel ? " so far" : ""}: what went out on the truck, what your teams picked straight from the beds and greenhouse, and what&apos;s on its way.</>
                  : <>A look back at everything Press Farm grew for your kitchens this {periodWord.toLowerCase()}, and a preview of what&apos;s on its way.</>}
              </Text>

              <div style={styles.highlightBox}>
                <Text style={styles.highlightLabel}>Produce delivered</Text>
                <Text style={styles.highlightValue}>{totalValue}</Text>
                <Text style={{ ...styles.highlightLabel, marginTop: "4px" }}>
                  across {deliveryCount} {deliveryCount === 1 ? "delivery" : "deliveries"}
                  {yearly && yearly.itemCount > 0 ? ` · ${yearly.itemCount} different items` : ""}
                </Text>
                {yearly?.comparison && (
                  <Text style={{ ...styles.highlightLabel, marginTop: "8px", color: colors.green, fontWeight: 700 }}>
                    {yearly.comparison}
                  </Text>
                )}
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

              {yearly && yearly.months.length > 0 && (
                <>
                  <Text style={styles.h2}>Month by Month</Text>
                  <table cellPadding="0" cellSpacing="0" border={0} style={{ width: "100%" }}>
                    <tbody>
                      {yearly.months.map((m) => (
                        <tr key={m.label}>
                          <td style={{ ...barLabel, color: m.future ? colors.textLight : colors.text }}>{m.label}</td>
                          <td style={{ width: "100%" }}>
                            <div style={barTrack}>
                              {!m.future && m.pct > 0 && (
                                <div style={{ ...barFill, width: `${Math.max(m.pct, 2)}%`, opacity: m.partial ? 0.6 : 1 }}>&nbsp;</div>
                              )}
                            </div>
                          </td>
                          <td style={{ ...barValue, color: m.future ? colors.textLight : colors.text, fontWeight: m.future ? 400 : 700 }}>
                            {m.future ? "—" : `$${Math.round(m.value).toLocaleString("en-US")}`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {yearly.throughLabel && (
                    <Text style={{ ...styles.paragraphMuted, fontSize: "12px", marginTop: "6px" }}>
                      Through {yearly.throughLabel}; the rest of the year fills in on the final report.
                    </Text>
                  )}
                </>
              )}

              {topItems.length > 0 && (
                <>
                  <Text style={styles.h2}>{yearly ? "Top Crops of the Year" : "Top Crops"}</Text>
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

              {yearly && yearly.byCategory.length > 0 && (
                <>
                  <Text style={styles.h2}>What We Grew</Text>
                  <LineRows rows={yearly.byCategory} />
                </>
              )}

              {yearly?.selfHarvest && (
                <>
                  <Text style={styles.h2}>Picked by Your Teams</Text>
                  <Text style={styles.paragraph}>
                    Beyond deliveries, your chefs harvested straight from the restaurant planter beds and the
                    greenhouse. We track that value separately so it never double-counts with deliveries.
                  </Text>
                  <LineRows
                    rows={[
                      { label: "Planter boxes", value: yearly.selfHarvest.boxes },
                      { label: "Greenhouse microgreens", value: yearly.selfHarvest.microgreens },
                      { label: "Self-harvest total", value: yearly.selfHarvest.total },
                    ]}
                  />
                  <Text style={{ ...styles.paragraphMuted, fontSize: "12px", marginTop: "6px" }}>
                    Delivered + self-harvested: {yearly.selfHarvest.grandTotal} from the farm this year.
                  </Text>
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
