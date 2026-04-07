import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
  Row,
  Column,
  Hr,
} from "@react-email/components";

interface OrderReceivedProps {
  restaurantName: string;
  chefName: string;
  deliveryDate: string;
  items: {
    itemName: string;
    quantity: number;
    unit: string;
  }[];
  freeformNotes?: string;
  submittedAt: string;
  appUrl?: string;
}

/**
 * order-received.tsx — Sent to admin (Micheal) when chef submits order.
 *
 * Subject: "[Restaurant] submitted order for [Date]"
 * From: orders@pressfarm.app
 * To: Micheal
 *
 * TODO: Add link to admin order detail page
 */
export default function OrderReceived({
  restaurantName,
  chefName,
  deliveryDate,
  items,
  freeformNotes,
  submittedAt,
  appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://press-farm-fu0whefyn-micheal-breedloves-projects.vercel.app",
}: OrderReceivedProps) {
  return (
    <Html>
      <Head />
      <Preview>
        {restaurantName} submitted order for {deliveryDate}
      </Preview>
      <Body style={{ backgroundColor: "#faf7f0", fontFamily: "sans-serif" }}>
        <Container style={{ maxWidth: "600px", margin: "0 auto", padding: "24px" }}>
          <Heading style={{ color: "#2d6a4f", fontSize: "20px", marginBottom: "8px" }}>
            New Order — {restaurantName}
          </Heading>
          <Text style={{ color: "#666", marginBottom: "4px" }}>
            Delivery: <strong>{deliveryDate}</strong>
          </Text>
          <Text style={{ color: "#666", marginBottom: "24px" }}>
            Submitted by {chefName} at {submittedAt}
          </Text>

          <Section style={{ backgroundColor: "#fff", borderRadius: "8px", padding: "16px" }}>
            {items.map((item, i) => (
              <Row key={i} style={{ marginBottom: "8px" }}>
                <Column style={{ color: "#333" }}>{item.itemName}</Column>
                <Column style={{ textAlign: "right", color: "#666" }}>
                  {item.quantity} {item.unit.toUpperCase()}
                </Column>
              </Row>
            ))}
            {freeformNotes && (
              <>
                <Hr style={{ borderColor: "#eee", margin: "12px 0" }} />
                <Text style={{ color: "#666", fontSize: "14px", fontStyle: "italic" }}>
                  Notes: {freeformNotes}
                </Text>
              </>
            )}
          </Section>

          <Button
            href={`${appUrl}/admin/orders/${deliveryDate}`}
            style={{
              backgroundColor: "#166534",
              color: "#ffffff",
              padding: "12px 24px",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: "600",
              textDecoration: "none",
              display: "inline-block",
              marginTop: "20px",
            }}
          >
            View Order in Admin
          </Button>

          <Text style={{ color: "#999", fontSize: "12px", marginTop: "24px" }}>
            Press Farm OS
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
