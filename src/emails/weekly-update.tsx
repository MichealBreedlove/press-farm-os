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
import { styles, colors, FONT_STACK, MANDALA_URL, WORDMARK_URL } from "./_shared";

/** One "Available Now" line — Item / Qty / Size / Notes. */
export interface WeeklyUpdateAvailRow {
  name: string;
  qty: string;
  size: string;
  notes: string;
}

/** One Restaurant Planter Beds line — Item / Bed / Planted / Notes. */
export interface WeeklyUpdateBedRow {
  name: string;
  bed: string;
  planted: string;
  notes: string;
}

/** One Gaps or Limited Supply line — Item / Last Wk. Avail / Substitute / Back When. */
export interface WeeklyUpdateGapRow {
  name: string;
  lastWeek: string;
  substitute: string;
  backWhen: string;
}

/** One incoming-timeline group, e.g. "~2 Weeks" → ["Snap Peas", …]. */
export interface WeeklyUpdateIncomingGroup {
  label: string;
  items: string[];
}

interface WeeklyUpdateProps {
  /** e.g. "August 10" — rendered as "Week of August 10". */
  weekOfLabel: string;
  /** Admin-authored note; newline-separated lines render as bullets. */
  generalNote?: string | null;
  availableNow: WeeklyUpdateAvailRow[];
  planterBeds: WeeklyUpdateBedRow[];
  gaps: WeeklyUpdateGapRow[];
  incoming: WeeklyUpdateIncomingGroup[];
  /** Farm tasks finished in the last week, one line each. */
  tasksCompleted?: string[];
  /** Farm tasks due (or overdue) this week, one line each. */
  tasksUpcoming?: string[];
}

const table = {
  width: "100%",
  borderCollapse: "collapse" as const,
  margin: "0 0 8px",
};
const th = {
  fontFamily: FONT_STACK,
  fontSize: "11px",
  fontWeight: 600,
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
  color: colors.white,
  backgroundColor: colors.green,
  padding: "7px 10px",
  textAlign: "left" as const,
};
const td = {
  fontFamily: FONT_STACK,
  fontSize: "13px",
  color: colors.text,
  padding: "8px 10px",
  borderBottom: `1px solid ${colors.borderSoft}`,
  verticalAlign: "top" as const,
};
const tdMuted = { ...td, color: colors.textMuted };
const bullet = {
  fontFamily: FONT_STACK,
  fontSize: "14px",
  color: colors.text,
  lineHeight: 1.6,
  margin: "0 0 6px",
};

/**
 * weekly-update.tsx — Chef-facing "Press Farm – Weekly Update".
 *
 * Mirrors Micheal's Word template: General notes, Available Now table,
 * Restaurant Planter Beds, Gaps or Limited Supply, and the Items Incoming
 * Timeline. Sent weekly to all active chefs plus any extra recipients
 * configured in /admin/settings/emails.
 */
export default function WeeklyUpdate({
  weekOfLabel,
  generalNote,
  availableNow,
  planterBeds,
  gaps,
  incoming,
  tasksCompleted = [],
  tasksUpcoming = [],
}: WeeklyUpdateProps) {
  const noteLines = (generalNote ?? "")
    .split("\n")
    .map((l) => l.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean);

  return (
    <Html>
      <Head />
      <Preview>{`Press Farm Weekly Update — Week of ${weekOfLabel}`}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <div style={styles.card}>
            <Section style={styles.hero}>
              <Img src={MANDALA_URL} alt="Press Farm mandala" width="120" height="120" style={{ display: "block", margin: "0 auto", width: "120px", height: "auto" }} />
              <Img src={WORDMARK_URL} alt="PRESS FARM" width="240" height="auto" style={{ display: "block", margin: "20px auto 6px", maxWidth: "240px", height: "auto" }} />
              <Text style={styles.tagline}>Weekly Update</Text>
            </Section>

            <hr style={styles.goldRule} />

            <Section style={styles.body_section}>
              <Text style={styles.eyebrow}>From the Farm</Text>
              <Text style={styles.h1}>Week of {weekOfLabel}</Text>

              {noteLines.length > 0 && (
                <Section>
                  <Text style={styles.h2}>General</Text>
                  {noteLines.map((line, i) => (
                    <Text key={i} style={bullet}>• {line}</Text>
                  ))}
                </Section>
              )}

              <Text style={styles.h2}>Available Now</Text>
              {availableNow.length === 0 ? (
                <Text style={styles.paragraphMuted}>
                  Availability for this cycle hasn&apos;t been published yet — check the order form.
                </Text>
              ) : (
                <table cellPadding="0" cellSpacing="0" border={0} style={table}>
                  <thead>
                    <tr>
                      <th style={th}>Item</th>
                      <th style={th}>Qty</th>
                      <th style={th}>Size</th>
                      <th style={th}>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {availableNow.map((r, i) => (
                      <tr key={i}>
                        <td style={{ ...td, fontWeight: 600 }}>{r.name}</td>
                        <td style={td}>{r.qty}</td>
                        <td style={td}>{r.size}</td>
                        <td style={tdMuted}>{r.notes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {planterBeds.length > 0 && (
                <Section>
                  <Text style={styles.h2}>Restaurant Planter Beds</Text>
                  <table cellPadding="0" cellSpacing="0" border={0} style={table}>
                    <thead>
                      <tr>
                        <th style={th}>Item</th>
                        <th style={th}>Bed</th>
                        <th style={th}>Planted</th>
                        <th style={th}>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {planterBeds.map((r, i) => (
                        <tr key={i}>
                          <td style={{ ...td, fontWeight: 600 }}>{r.name}</td>
                          <td style={td}>{r.bed}</td>
                          <td style={td}>{r.planted}</td>
                          <td style={tdMuted}>{r.notes}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Section>
              )}

              {gaps.length > 0 && (
                <Section>
                  <Text style={styles.h2}>Gaps or Limited Supply</Text>
                  <table cellPadding="0" cellSpacing="0" border={0} style={table}>
                    <thead>
                      <tr>
                        <th style={th}>Item</th>
                        <th style={th}>Last Wk.</th>
                        <th style={th}>Substitute</th>
                        <th style={th}>Back When</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gaps.map((r, i) => (
                        <tr key={i}>
                          <td style={{ ...td, fontWeight: 600 }}>{r.name}</td>
                          <td style={td}>{r.lastWeek}</td>
                          <td style={td}>{r.substitute}</td>
                          <td style={td}>{r.backWhen}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Section>
              )}

              {(tasksCompleted.length > 0 || tasksUpcoming.length > 0) && (
                <Section>
                  <Text style={styles.h2}>Around the Farm</Text>
                  {tasksCompleted.length > 0 && (
                    <>
                      <Text style={{ ...bullet, fontWeight: 600, color: colors.greenDark, margin: "0 0 4px" }}>
                        Done this week
                      </Text>
                      {tasksCompleted.map((t, i) => (
                        <Text key={i} style={bullet}>✓ {t}</Text>
                      ))}
                    </>
                  )}
                  {tasksUpcoming.length > 0 && (
                    <>
                      <Text style={{ ...bullet, fontWeight: 600, color: colors.greenDark, margin: "10px 0 4px" }}>
                        On the list this week
                      </Text>
                      {tasksUpcoming.map((t, i) => (
                        <Text key={i} style={bullet}>• {t}</Text>
                      ))}
                    </>
                  )}
                </Section>
              )}

              {incoming.some((g) => g.items.length > 0) && (
                <Section>
                  <Text style={styles.h2}>Items Incoming Timeline</Text>
                  {incoming.map((g, i) =>
                    g.items.length === 0 ? null : (
                      <Text key={i} style={bullet}>
                        <span style={{ fontWeight: 600, color: colors.greenDark }}>{g.label}:</span>{" "}
                        {g.items.join(", ")}
                      </Text>
                    ),
                  )}
                </Section>
              )}

              <Section style={styles.ctaWrap}>
                <a href={`${APP_URL}/order`} style={styles.button}>
                  Place Your Order
                </a>
              </Section>

              <Text style={styles.paragraphMuted}>
                Quantities and windows shift with the weather — reply to this email with questions
                or to reserve something ahead.
              </Text>
            </Section>
          </div>

          <Section style={styles.footerSection}>
            <Text style={styles.footerLine}>Press Farm Weekly Update · Week of {weekOfLabel}</Text>
            <Text style={styles.footerSignature}>Press Farm · Yountville, California</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
