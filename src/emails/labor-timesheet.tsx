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
import { styles, colors, MANDALA_URL, WORDMARK_URL } from "./_shared";

interface LaborTimesheetProps {
  weekLabel: string;
  days: {
    dateLabel: string;
    workers: { name: string; tail: string; notes?: string | null }[];
  }[];
  signOff?: string;
}

/**
 * labor-timesheet.tsx — Weekly timesheet email to the supervising chef.
 *
 * Subject: "Timesheet for week of {weekLabel}"
 * From: timesheet@pressfarm.app
 * To: farm_settings.email_labor_report
 */
export default function LaborTimesheet({
  weekLabel,
  days,
  signOff = "Micheal Breedlove",
}: LaborTimesheetProps) {
  const hasEntries = days.some((d) => d.workers.length > 0);

  return (
    <Html>
      <Head />
      <Preview>Press Farm timesheet — week of {weekLabel}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <div style={styles.card}>
            <Section style={styles.hero}>
              <Img src={MANDALA_URL} alt="Press Farm mandala" width="120" height="120" style={{ display: "block", margin: "0 auto", width: "120px", height: "auto" }} />
              <Img src={WORDMARK_URL} alt="PRESS FARM" width="240" height="auto" style={{ display: "block", margin: "20px auto 6px", maxWidth: "240px", height: "auto" }} />
              <Text style={styles.tagline}>Weekly Timesheet</Text>
            </Section>

            <hr style={styles.goldRule} />

            <Section style={styles.body_section}>
              <Text style={styles.eyebrow}>Week of</Text>
              <Text style={styles.h1}>{weekLabel}</Text>

              <Text style={styles.paragraph}>Hello Chef,</Text>
              <Text style={styles.paragraph}>
                Here&apos;s the timesheet for week of {weekLabel}.
              </Text>

              {hasEntries ? (
                <table cellPadding="0" cellSpacing="0" border={0} style={{ width: "100%", marginTop: "16px" }}>
                  <tbody>
                    {days.flatMap((day, di) =>
                      day.workers.map((w, wi) => {
                        const isLast =
                          di === days.length - 1 && wi === day.workers.length - 1;
                        return (
                          <tr
                            key={`${di}-${wi}`}
                            style={isLast ? (styles.itemRowLast as any) : (styles.itemRow as any)}
                          >
                            <td style={{ paddingRight: "12px", whiteSpace: "nowrap" }}>
                              <Text style={styles.itemName}>
                                {day.dateLabel}{" "}
                                <span style={{ color: colors.textMuted }}>· {w.name}</span>
                              </Text>
                            </td>
                            <td style={{ textAlign: "right" }}>
                              <Text style={styles.itemQty}>{w.tail}</Text>
                              {w.notes && (
                                <Text style={{ ...styles.paragraphMuted, fontSize: "12px", margin: "2px 0 0" }}>
                                  {w.notes}
                                </Text>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              ) : (
                <Text style={styles.paragraphMuted}>No labor entries this week.</Text>
              )}

              <Text style={{ ...styles.paragraph, marginTop: "24px" }}>Best regards,</Text>
              <Text style={styles.paragraph}>{signOff}</Text>
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
