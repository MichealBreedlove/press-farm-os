import { resend } from "@/lib/resend/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { render } from "@react-email/components";
import OrderReceived from "@/emails/order-received";
import OrderConfirmation from "@/emails/order-confirmation";
import { ADMIN_EMAIL, FROM_EMAIL } from "@/lib/constants";
import { formatDate } from "@/lib/utils";

/**
 * Send "order received" notification to admin when chef submits.
 */
export async function sendOrderReceivedEmail({
  orderId,
  restaurantId,
  deliveryDate,
}: {
  orderId: string;
  restaurantId: string;
  deliveryDate: string;
}) {
  const admin = createAdminClient();

  const { data: order } = await admin
    .from("orders")
    .select(`
      id, freeform_notes, submitted_at,
      chef:profiles!orders_chef_id_fkey(full_name),
      order_items(
        quantity_requested,
        availability_items(
          items(name, unit_type)
        )
      )
    `)
    .eq("id", orderId)
    .single();

  const { data: restaurant } = await admin
    .from("restaurants")
    .select("name")
    .eq("id", restaurantId)
    .single();

  if (!order || !restaurant) return;

  const chef = (order as { chef?: { full_name: string | null } | null }).chef;
  const orderItems = (order as { order_items?: { quantity_requested: number; availability_items?: { items?: { name: string; unit_type: string } | null } | null }[] }).order_items ?? [];
  const items = orderItems.map((oi) => ({
    itemName: oi.availability_items?.items?.name ?? "Unknown",
    quantity: oi.quantity_requested,
    unit: oi.availability_items?.items?.unit_type ?? "",
  }));

  const orderData = order as { freeform_notes?: string | null; submitted_at?: string | null };
  const restaurantData = restaurant as { name: string };

  const html = await render(
    OrderReceived({
      restaurantName: restaurantData.name,
      chefName: chef?.full_name ?? "Chef",
      deliveryDate: formatDate(deliveryDate),
      items,
      freeformNotes: orderData.freeform_notes ?? undefined,
      submittedAt: orderData.submitted_at
        ? new Date(orderData.submitted_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        : "",
    })
  );

  await resend.emails.send({
    from: FROM_EMAIL,
    to: ADMIN_EMAIL,
    subject: `${restaurantData.name} submitted order for ${formatDate(deliveryDate)}`,
    html,
  });

  // Log notification (best-effort)
  await admin.from("notifications").insert({
    type: "order_submitted",
    recipient_id: "00000000-0000-0000-0000-000000000000",
    order_id: orderId,
    channel: "email",
    subject: `${restaurantData.name} submitted order for ${formatDate(deliveryDate)}`,
    sent_at: new Date().toISOString(),
  });
}

/**
 * Send order confirmation to chef.
 */
export async function sendOrderConfirmationEmail({
  userId,
  orderId,
  deliveryDate,
}: {
  userId: string;
  orderId: string;
  deliveryDate: string;
}) {
  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("full_name")
    .eq("id", userId)
    .single();

  const { data: userAuth } = await admin.auth.admin.getUserById(userId);
  const chefEmail = userAuth?.user?.email;
  if (!chefEmail) return;

  const { data: order } = await admin
    .from("orders")
    .select(`
      id, freeform_notes,
      restaurants(name),
      order_items(
        quantity_requested,
        availability_items(
          items(name, unit_type)
        )
      )
    `)
    .eq("id", orderId)
    .single();

  if (!order) return;

  const orderData = order as {
    freeform_notes?: string | null;
    restaurants?: { name: string } | null;
    order_items?: { quantity_requested: number; availability_items?: { items?: { name: string; unit_type: string } | null } | null }[];
  };

  const profileData = profile as { full_name?: string | null } | null;
  const items = (orderData.order_items ?? []).map((oi) => ({
    itemName: oi.availability_items?.items?.name ?? "Unknown",
    quantity: oi.quantity_requested,
    unit: oi.availability_items?.items?.unit_type ?? "",
  }));

  const html = await render(
    OrderConfirmation({
      chefName: profileData?.full_name ?? "Chef",
      restaurantName: orderData.restaurants?.name ?? "Restaurant",
      deliveryDate: formatDate(deliveryDate),
      items,
      freeformNotes: orderData.freeform_notes ?? undefined,
    })
  );

  await resend.emails.send({
    from: FROM_EMAIL,
    to: chefEmail,
    subject: `Order Confirmed — ${formatDate(deliveryDate)}`,
    html,
  });
}
