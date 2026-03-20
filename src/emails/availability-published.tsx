import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from "@react-email/components";
import { APP_URL } from "@/lib/constants";

interface AvailabilityPublishedProps {
  chefName: string;
  restaurantName: string;
  deliveryDate: string;
  itemCount: number;
}

/**
 * availability-published.tsx — Sent to all chefs for a restaurant
 * when admin publishes availability for a delivery date.
 *
 * Subject: "New Availability — [Date]"
 * From: orders@pressfarm.app
 * To: All chefs for restaurant
 */
export default function AvailabilityPublished({
  chefName,
  restaurantName,
  deliveryDate,
  itemCount,
}: AvailabilityPublishedProps) {
  return (
    <Html>
      <Head />
      <Preview>New availability posted for {deliveryDate} — place your order</Preview>
      <Body style={{ backgroundColor: "#faf7f0", fontFamily: "sans-serif" }}>
        <Container style={{ maxWidth: "600px", margin: "0 auto", padding: "24px" }}>
          <Heading style={{ color: "#2d6a4f", fontSize: "20px", marginBottom: "8px" }}>
            New Availability — {deliveryDate}
          </Heading>
          <Text style={{ color: "#666", marginBottom: "8px" }}>
            Hi {chefName},
          </Text>
          <Text style={{ color: "#666", marginBottom: "24px" }}>
            Availability has been posted for {restaurantName} on{" "}
            <strong>{deliveryDate}</strong>. {itemCount} items available.
          </Text>

          <Button
            href={`${APP_URL}/order`}
            style={{
              backgroundColor: "#2d6a4f",
              color: "#fff",
              padding: "12px 24px",
              borderRadius: "8px",
              textDecoration: "none",
              fontWeight: "bold",
              display: "inline-block",
            }}
          >
            Place Your Order →
          </Button>

          <Text style={{ color: "#999", fontSize: "12px", marginTop: "24px" }}>
            — Press Farm OS
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
