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
  incoming: WeeklyUpdateIncomingGroup[];
  /** Farm tasks finished in the last week, one line each. */
  tasksCompleted?: string[];
  /** Farm tasks due (or overdue) this week, one line each. */
  tasksUpcoming?: string[];
}

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
 * Mirrors Micheal's Word template: General notes, farm tasks, and the Items
 * Incoming Timeline. (Available Now and Gaps or Limited Supply were dropped
 * 2026-10-09 — live availability lives on the order form. Restaurant Planter
 * Beds was dropped 2026-10-11 — it moves to the order sheet.) Sent weekly to all active chefs plus any extra recipients
 * configured in /admin/settings/emails.
 */
export default function WeeklyUpdate({
  weekOfLabel,
  generalNote,
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
