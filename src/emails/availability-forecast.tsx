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
import {
  styles,
  colors,
  MANDALA_URL,
  WORDMARK_URL,
  restaurantLogoUrl,
  restaurantBadgeStyles,
} from "./_shared";

/** A single crop/microgreen line within a horizon section. */
export interface ForecastEmailEntry {
  name: string;
  category?: string | null;
  isMicrogreen: boolean;
  /** Optional human-readable yield/quantity estimate, e.g. "12 LG / 24 SM". */
  estimate?: string | null;
  /** Optional window label, e.g. "opens Jun 4". */
  window?: string | null;
}

export interface ForecastEmailSection {
  /** Section heading, e.g. "Available Now" or "In ~2 Weeks". */
  title: string;
  /** Short eyebrow caption, e.g. "Harvesting now". */
  caption: string;
  entries: ForecastEmailEntry[];
}

interface AvailabilityForecastProps {
  chefName: string;
  restaurantName: string;
  /** Already-formatted reference date label, e.g. "Monday, May 26". */
  asOfDate: string;
  sections: ForecastEmailSection[];
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
 * availability-forecast.tsx — Forward-looking crop availability sent to chefs.
 *
 * Four horizon sections (Available now / In ~2 weeks / In ~4 weeks / In ~2 months)
 * built from getAvailabilityBuckets. Microgreens are flagged inline. Editorial,
 * mobile-first, on-brand inline styles per _shared.ts.
 */
export default function AvailabilityForecast({
  chefName,
  restaurantName,
  asOfDate,
  sections,
}: AvailabilityForecastProps) {
  const restLogo = restaurantLogoUrl(restaurantName);
  const total = sections.reduce((s, sec) => s + sec.entries.length, 0);
  return (
    <Html>
      <Head />
      <Preview>{`What's coming from the farm — forecast as of ${asOfDate}`}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <div style={styles.card}>
            <Section style={styles.hero}>
              <Img src={MANDALA_URL} alt="Press Farm mandala" width="120" height="120" style={{ display: "block", margin: "0 auto", width: "120px", height: "auto" }} />
              <Img src={WORDMARK_URL} alt="PRESS FARM" width="240" height="auto" style={{ display: "block", margin: "20px auto 6px", maxWidth: "240px", height: "auto" }} />
              <Text style={styles.tagline}>Availability Forecast</Text>

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
              <Text style={styles.eyebrow}>Looking Ahead</Text>
              <Text style={styles.h1}>What&apos;s Coming From the Farm</Text>

              <Text style={styles.paragraph}>Hello {chefName},</Text>
              <Text style={styles.paragraph}>
                Here&apos;s a look at what&apos;s harvestable now and what&apos;s on its way over the
                next couple of months — field crops and microgreens both. Use it to plan menus
                ahead of your usual Thursday / Saturday / Monday orders.
              </Text>

              {total === 0 && (
                <Text style={styles.paragraphMuted}>
                  Nothing is in the forecast window just yet. We&apos;ll send a fresh look as plantings
                  mature.
                </Text>
              )}

              {sections.map((sec, si) => (
                <Section key={si}>
                  <Text style={styles.h2}>{sec.title}</Text>
                  <Text style={{ ...styles.highlightLabel, color: colors.green, margin: "0 0 8px" }}>
                    {sec.caption}
                  </Text>
                  {sec.entries.length === 0 ? (
                    <Text style={styles.paragraphMuted}>Nothing new in this window.</Text>
                  ) : (
                    <table cellPadding="0" cellSpacing="0" border={0} style={{ width: "100%" }}>
                      <tbody>
                        {sec.entries.map((e, ei) => (
                          <tr
                            key={ei}
                            style={ei === sec.entries.length - 1 ? (styles.itemRowLast as any) : (styles.itemRow as any)}
                          >
                            <td style={{ paddingRight: "12px" }}>
                              <Text style={styles.itemName}>
                                {e.name}
                                {e.isMicrogreen && <span style={microBadge}>Microgreen</span>}
                                {e.window && (
                                  <span style={{ color: colors.textMuted, fontWeight: 400 }}> · {e.window}</span>
                                )}
                              </Text>
                            </td>
                            {e.estimate && (
                              <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                                <Text style={styles.itemQty}>{e.estimate}</Text>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </Section>
              ))}

              <Section style={styles.ctaWrap}>
                <a href={`${APP_URL}/order`} style={styles.button}>
                  View Current Availability
                </a>
              </Section>

              <Text style={styles.paragraphMuted}>
                Windows are estimates from our crop plan — weather and the table shift them by a few
                days. Reply if you&apos;d like to reserve something ahead of time.
              </Text>
            </Section>
          </div>

          <Section style={styles.footerSection}>
            <Text style={styles.footerLine}>Forecast as of {asOfDate}.</Text>
            <Text style={styles.footerSignature}>Press Farm · Yountville, California</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
