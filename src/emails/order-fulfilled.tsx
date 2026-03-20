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

interface FulfilledItem {
  itemName: string;
  requestedQty: number;
  fulfilledQty: number;
  unit: string;
  isShorted: boolean;
}

interface OrderFulfilledProps {
  chefName: string;
  restaurantName: string;
  deliveryDate: string;
  items: FulfilledItem[];
}

/**
 * order-fulfilled.tsx — Sent to chef when admin marks order as fulfilled.
 *
 * Subject: "Order Fulfilled — [Date]"
 * From: orders@pressfarm.app
 * To: Chef
 */
export default function OrderFulfilled({
  chefName,
  restaurantName,
  deliveryDate,
  items,
}: OrderFulfilledProps) {
  return (
    <Html>
      <Head />
      <Preview>Order Fulfilled — {deliveryDate}</Preview>
      <Body style={{ backgroundColor: "#faf7f0", fontFamily: "sans-serif" }}>
        <Container style={{ maxWidth: "600px", margin: "0 auto", padding: "24px" }}>
          <Heading style={{ color: "#2d6a4f", fontSize: "20px", marginBottom: "8px" }}>
            Order Fulfilled ✓
          </Heading>
          <Text style={{ color: "#666", marginBottom: "24px" }}>
            Hi {chefName}, your {restaurantName} order for{" "}
            <strong>{deliveryDate}</strong> has been fulfilled.
          </Text>

          <Section style={{ backgroundColor: "#fff", borderRadius: "8px", padding: "16px" }}>
            <Row style={{ marginBottom: "8px", fontWeight: "bold", color: "#333", fontSize: "12px" }}>
              <Column>Item</Column>
              <Column style={{ textAlign: "right" }}>Delivered</Column>
            </Row>
            {items.map((item, i) => (
              <Row key={i} style={{ marginBottom: "8px", color: item.isShorted ? "#b45309" : "#333" }}>
                <Column>{item.itemName}</Column>
                <Column style={{ textAlign: "right" }}>
                  {item.fulfilledQty} {item.unit.toUpperCase()}
                  {item.isShorted && (
                    <span style={{ color: "#b45309", fontSize: "12px" }}>
                      {" "}(of {item.requestedQty} req.)
                    </span>
                  )}
                </Column>
              </Row>
            ))}
          </Section>

          <Text style={{ color: "#999", fontSize: "12px", marginTop: "24px" }}>
            — Press Farm OS
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
