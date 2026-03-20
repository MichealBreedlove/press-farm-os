import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
  Row,
  Column,
} from "@react-email/components";

interface OrderConfirmationProps {
  chefName: string;
  restaurantName: string;
  deliveryDate: string;
  items: {
    itemName: string;
    quantity: number;
    unit: string;
  }[];
  freeformNotes?: string;
}

/**
 * order-confirmation.tsx — Sent to chef when order is submitted.
 *
 * Subject: "Order Confirmed — [Date]"
 * From: orders@pressfarm.app
 * To: Chef
 *
 * TODO: Polish styling before launch
 */
export default function OrderConfirmation({
  chefName,
  restaurantName,
  deliveryDate,
  items,
  freeformNotes,
}: OrderConfirmationProps) {
  return (
    <Html>
      <Head />
      <Preview>Order Confirmed — {deliveryDate}</Preview>
      <Body style={{ backgroundColor: "#faf7f0", fontFamily: "sans-serif" }}>
        <Container style={{ maxWidth: "600px", margin: "0 auto", padding: "24px" }}>
          <Heading style={{ color: "#2d6a4f", fontSize: "20px", marginBottom: "8px" }}>
            Order Confirmed
          </Heading>
          <Text style={{ color: "#666", marginBottom: "24px" }}>
            Hi {chefName}, your order for {restaurantName} on {deliveryDate} has been received.
          </Text>

          <Section style={{ backgroundColor: "#fff", borderRadius: "8px", padding: "16px" }}>
            <Text style={{ fontWeight: "bold", marginBottom: "12px", color: "#333" }}>
              Order Summary
            </Text>
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

          <Text style={{ color: "#999", fontSize: "12px", marginTop: "24px" }}>
            You&apos;ll be notified if any items are shorted.
            <br />— Press Farm OS
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
