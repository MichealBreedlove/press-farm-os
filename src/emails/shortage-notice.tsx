import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
  Row,
  Column,
} from "@react-email/components";

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
 *
 * Subject: "Shortage Notice — [Date]"
 * From: orders@pressfarm.app
 * To: Chef
 *
 * Example from chef workflow doc:
 *   Fava Leaves | 3 SM | 1 SM | Low yield
 *   Nasturtium  | 20 EA | 12 EA | Pest damage
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
      <Preview>Shortage Notice — {deliveryDate}</Preview>
      <Body style={{ backgroundColor: "#faf7f0", fontFamily: "sans-serif" }}>
        <Container style={{ maxWidth: "600px", margin: "0 auto", padding: "24px" }}>
          <Heading style={{ color: "#b45309", fontSize: "20px", marginBottom: "8px" }}>
            Shortage Notice
          </Heading>
          <Text style={{ color: "#666", marginBottom: "24px" }}>
            Hi {chefName}, some items on your {restaurantName} order for{" "}
            <strong>{deliveryDate}</strong> have been adjusted:
          </Text>

          <Section style={{ backgroundColor: "#fff", borderRadius: "8px", padding: "16px" }}>
            {/* Header row */}
            <Row style={{ marginBottom: "8px", fontWeight: "bold", color: "#333", fontSize: "12px" }}>
              <Column>Item</Column>
              <Column style={{ textAlign: "center" }}>Requested</Column>
              <Column style={{ textAlign: "center" }}>Fulfilled</Column>
              <Column>Reason</Column>
            </Row>
            {shortages.map((s, i) => (
              <Row key={i} style={{ marginBottom: "8px", color: "#333", fontSize: "14px" }}>
                <Column>{s.itemName}</Column>
                <Column style={{ textAlign: "center" }}>
                  {s.requestedQty} {s.unit.toUpperCase()}
                </Column>
                <Column style={{ textAlign: "center", color: "#b45309" }}>
                  {s.fulfilledQty} {s.unit.toUpperCase()}
                </Column>
                <Column style={{ color: "#666" }}>{s.reason}</Column>
              </Row>
            ))}
          </Section>

          <Text style={{ color: "#666", marginTop: "16px" }}>
            All other items fulfilled as requested.
          </Text>
          <Text style={{ color: "#999", fontSize: "12px", marginTop: "16px" }}>
            — Press Farm OS
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
