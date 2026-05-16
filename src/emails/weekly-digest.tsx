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

interface WeeklyDigestProps {
  startLabel: string;
  endLabel: string;
  aiIntro?: string;
  totalRevenue: string;
  totalExpenses: string;
  totalLaborHours: string;
  totalLaborCost: string;
  netLabel: string;
  deliveryCount: number;
  deliveries: { dateLabel: string; restaurantName: string; value: string }[];
  expenses: { category: string; amount: string; description?: string | null }[];
  workers: { name: string; hours: string }[];
}

/**
 * weekly-digest.tsx — Admin-facing weekly summary email.
 *
 * Subject: "Press Farm Weekly — {startLabel} to {endLabel}"
 * From: digest@pressfarm.app
 * To: ADMIN_EMAIL (Micheal)
 *
 * Triggered by Mondays 9am UTC Vercel cron + admin manual button.
 */
export default function WeeklyDigest({
  startLabel,
  endLabel,
  aiIntro,
  totalRevenue,
  totalExpenses,
  totalLaborHours,
  totalLaborCost,
  netLabel,
  deliveryCount,
  deliveries,
  expenses,
  workers,
}: WeeklyDigestProps) {
  return (
    <Html>
      <Head />
      <Preview>Press Farm weekly digest — {startLabel} to {endLabel}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <div style={styles.card}>
            <Section style={styles.hero}>
              <Img src={MANDALA_URL} alt="Press Farm mandala" width="120" height="120" style={{ display: "block", margin: "0 auto", width: "120px", height: "auto" }} />
              <Img src={WORDMARK_URL} alt="PRESS FARM" width="240" height="auto" style={{ display: "block", margin: "20px auto 6px", maxWidth: "240px", height: "auto" }} />
              <Text style={styles.tagline}>Weekly Digest</Text>
            </Section>

            <hr style={styles.goldRule} />

            <Section style={styles.body_section}>
              <Text style={styles.eyebrow}>Week of</Text>
              <Text style={styles.h1}>{startLabel} — {endLabel}</Text>

              {aiIntro && (
                <Text style={{ ...styles.paragraph, fontStyle: "italic", color: colors.textMuted }}>
                  {aiIntro}
                </Text>
              )}

              <table cellPadding="0" cellSpacing="0" border={0} style={{ width: "100%", marginTop: "12px" }}>
                <tbody>
                  <tr>
                    <td style={{ width: "50%", paddingRight: "8px" }}>
                      <div style={styles.highlightBox}>
                        <Text style={styles.highlightLabel}>Revenue</Text>
                        <Text style={styles.highlightValue}>{totalRevenue}</Text>
                        <Text style={{ ...styles.highlightLabel, marginTop: "4px" }}>
                          {deliveryCount} {deliveryCount === 1 ? "delivery" : "deliveries"}
                        </Text>
                      </div>
                    </td>
                    <td style={{ width: "50%", paddingLeft: "8px" }}>
                      <div style={styles.highlightBox}>
                        <Text style={styles.highlightLabel}>Net</Text>
                        <Text style={styles.highlightValue}>{netLabel}</Text>
                        <Text style={{ ...styles.highlightLabel, marginTop: "4px" }}>after labor + expenses</Text>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td style={{ width: "50%", paddingRight: "8px" }}>
                      <div style={styles.highlightBox}>
                        <Text style={styles.highlightLabel}>Expenses</Text>
                        <Text style={styles.highlightValue}>{totalExpenses}</Text>
                      </div>
                    </td>
                    <td style={{ width: "50%", paddingLeft: "8px" }}>
                      <div style={styles.highlightBox}>
                        <Text style={styles.highlightLabel}>Labor</Text>
                        <Text style={styles.highlightValue}>{totalLaborCost}</Text>
                        <Text style={{ ...styles.highlightLabel, marginTop: "4px" }}>{totalLaborHours}</Text>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>

              {deliveries.length > 0 && (
                <>
                  <Text style={styles.h2}>Deliveries</Text>
                  <table cellPadding="0" cellSpacing="0" border={0} style={{ width: "100%" }}>
                    <tbody>
                      {deliveries.map((d, i) => (
                        <tr key={i} style={i === deliveries.length - 1 ? styles.itemRowLast as any : styles.itemRow as any}>
                          <td style={{ paddingRight: "12px" }}>
                            <Text style={styles.itemName}>
                              {d.dateLabel} <span style={{ color: colors.textMuted }}>· {d.restaurantName}</span>
                            </Text>
                          </td>
                          <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                            <Text style={styles.itemQty}>{d.value}</Text>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}

              {expenses.length > 0 && (
                <>
                  <Text style={styles.h2}>Expenses</Text>
                  <table cellPadding="0" cellSpacing="0" border={0} style={{ width: "100%" }}>
                    <tbody>
                      {expenses.map((e, i) => (
                        <tr key={i} style={i === expenses.length - 1 ? styles.itemRowLast as any : styles.itemRow as any}>
                          <td style={{ paddingRight: "12px" }}>
                            <Text style={styles.itemName}>
                              {e.category}
                              {e.description && (
                                <span style={{ color: colors.textMuted }}> · {e.description}</span>
                              )}
                            </Text>
                          </td>
                          <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                            <Text style={styles.itemQty}>{e.amount}</Text>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}

              {workers.length > 0 && (
                <>
                  <Text style={styles.h2}>Labor</Text>
                  <table cellPadding="0" cellSpacing="0" border={0} style={{ width: "100%" }}>
                    <tbody>
                      {workers.map((w, i) => (
                        <tr key={i} style={i === workers.length - 1 ? styles.itemRowLast as any : styles.itemRow as any}>
                          <td style={{ paddingRight: "12px" }}>
                            <Text style={styles.itemName}>{w.name}</Text>
                          </td>
                          <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                            <Text style={styles.itemQty}>{w.hours}</Text>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}

              {deliveries.length === 0 && expenses.length === 0 && workers.length === 0 && (
                <Text style={styles.paragraphMuted}>No activity recorded this week.</Text>
              )}
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
