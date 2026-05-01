import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CATEGORY_ORDER, CATEGORY_LABELS, UNIT_LABELS } from "@/lib/constants";
import { getItemImageUrl, PLACEHOLDER_WREATH } from "@/lib/flower-images";
import { formatDeliveryDate } from "@/lib/utils";
import { priceForUnit } from "@/lib/utils";
import { OfferSheetActions } from "./OfferSheetActions";
import type { ItemCategory } from "@/types";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ date: string }>;
  searchParams: Promise<{ restaurant?: string }>;
}

/**
 * /admin/availability/[date]/offer-sheet — Printable offer sheet.
 *
 * Editorial-magazine layout of everything available for a delivery date,
 * grouped by category with item photos (or auto-matched flower illustrations),
 * sizes, and per-unit pricing. Designed to print cleanly on letter paper or
 * be shared digitally as a PDF.
 *
 * ?restaurant=<id> scopes the sheet to one restaurant's availability;
 * otherwise it shows union of all restaurants (good for marketing /
 * prospective customers).
 */
export default async function OfferSheetPage({ params, searchParams }: Props) {
  const { date } = await params;
  const { restaurant: restaurantId } = await searchParams;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await (supabase as any)
    .from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/");

  const admin = createAdminClient();

  // Pull availability for the date — optionally scoped to one restaurant.
  // Use a fresh query (not the lib helper) so we get the full join shape we want.
  let query = (admin as any)
    .from("availability_items")
    .select(`
      id, item_id, status, available_sizes, available_units, available_colors,
      restaurant_id,
      restaurants ( name ),
      items (
        id, name, category, unit_type, default_price, unit_prices,
        chef_notes, image_url, size, color, is_event_item, is_archived
      )
    `)
    .eq("delivery_date", date)
    .neq("status", "unavailable");

  if (restaurantId) query = query.eq("restaurant_id", restaurantId);

  const { data: rows } = await query;

  // De-dupe by item_id — when no restaurant filter, the same item appears
  // once per restaurant; we want one entry per unique item for the sheet.
  type Row = {
    item: any;
    statusByRestaurant: { name: string; status: string }[];
    availableUnits: string[] | null;
    availableSizes: string[] | null;
  };
  const byItem = new Map<string, Row>();
  for (const r of (rows ?? []) as any[]) {
    if (!r.items || r.items.is_archived) continue;
    const existing = byItem.get(r.items.id);
    const restName = r.restaurants?.name ?? "Unknown";
    const isEventsRestaurant = /event/i.test(restName);
    if (isEventsRestaurant) continue; // events are now an item tag, skip the legacy row
    if (existing) {
      existing.statusByRestaurant.push({ name: restName, status: r.status });
    } else {
      byItem.set(r.items.id, {
        item: r.items,
        statusByRestaurant: [{ name: restName, status: r.status }],
        availableUnits: r.available_units ? r.available_units.split(",").map((u: string) => u.trim()) : null,
        availableSizes: r.available_sizes ? r.available_sizes.split(",").map((s: string) => s.trim()) : null,
      });
    }
  }

  const items = Array.from(byItem.values());
  const itemsByCategory = CATEGORY_ORDER.reduce<Record<ItemCategory, Row[]>>(
    (acc, cat) => {
      acc[cat] = items.filter((r) => r.item.category === cat).sort((a, b) => a.item.name.localeCompare(b.item.name));
      return acc;
    },
    {} as Record<ItemCategory, Row[]>,
  );

  // Restaurants for the scope toggle
  const { data: restaurants } = await (admin as any)
    .from("restaurants")
    .select("id, name")
    .not("name", "ilike", "%event%")
    .order("name");

  const totalCount = items.length;
  const eventCount = items.filter((r) => r.item.is_event_item).length;

  return (
    <main className="min-h-screen bg-farm-cream print:bg-white">
      {/* Screen-only chrome (header + filter + actions). Hidden in print. */}
      <header className="page-header print:hidden">
        <div className="flex items-center gap-3">
          <Link
            href={`/admin/availability/${date}`}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center -ml-2 text-white/70 hover:text-white"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="page-title">Offer Sheet</h1>
        </div>
      </header>

      <OfferSheetActions
        date={date}
        currentRestaurant={restaurantId ?? null}
        restaurants={(restaurants ?? []) as any[]}
      />

      {/* The printable sheet itself. Uses a constrained max-width so it
          looks editorial on screen and prints cleanly on letter paper. */}
      <article className="max-w-3xl mx-auto px-6 sm:px-10 py-10 sm:py-12 bg-white print:bg-white print:px-0 print:py-0 print:max-w-full">
        {/* Magazine-cover hero */}
        <div className="text-center pb-8 border-b border-pf-master-gold/40 print:border-pf-master-gold">
          <img
            src="/assets/pressfarm/logo/png/pressfarm-mandala-only.png"
            alt="Press Farm mandala"
            className="w-28 h-28 mx-auto mb-4 print:w-20 print:h-20"
          />
          <p className="text-[11px] tracking-[0.32em] uppercase text-farm-green font-semibold">
            Press Farm
          </p>
          <p className="text-[10px] tracking-[0.4em] uppercase text-pf-master-gold mt-1">
            Cultivated with Chefs
          </p>
          <p className="font-display text-4xl text-farm-dark mt-6 leading-tight print:text-3xl">
            Available for {formatDeliveryDate(date)}
          </p>
          <p className="text-sm text-farm-muted mt-3">
            {totalCount} item{totalCount === 1 ? "" : "s"}
            {eventCount > 0 && ` · ${eventCount} for events`}
            {restaurantId && restaurants?.find((r: any) => r.id === restaurantId) &&
              ` · ${(restaurants as any[]).find((r: any) => r.id === restaurantId)?.name}`}
          </p>
        </div>

        {/* Categories */}
        <div className="pt-8 space-y-10">
          {CATEGORY_ORDER.map((category) => {
            const catItems = itemsByCategory[category];
            if (!catItems || catItems.length === 0) return null;

            return (
              <section key={category} className="break-inside-avoid">
                <p className="text-[10px] tracking-[0.32em] uppercase text-farm-muted font-semibold mb-4 pb-2 border-b border-farm-dark/10">
                  {CATEGORY_LABELS[category]}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
                  {catItems.map((row) => <OfferRow key={row.item.id} row={row} />)}
                </div>
              </section>
            );
          })}
        </div>

        {/* Footer signature */}
        <footer className="mt-16 pt-8 border-t border-pf-master-gold/40 text-center">
          <p className="text-[10px] tracking-[0.32em] uppercase text-farm-muted">
            Press Farm · Yountville, California
          </p>
          <p className="text-xs text-farm-muted mt-2">
            Order via your chef portal · Questions? Reply to your availability email.
          </p>
        </footer>
      </article>
    </main>
  );
}

function OfferRow({ row }: { row: any }) {
  const item = row.item;
  const itemUnits: string[] = String(item.unit_type ?? "").split(",").map((u: string) => u.trim()).filter(Boolean);
  const exposedUnits: string[] = row.availableUnits ?? itemUnits;
  const sizes: string[] | null = row.availableSizes ?? (item.size ? String(item.size).split(", ").filter(Boolean) : null);

  const imgUrl = getItemImageUrl({ name: item.name, image_url: item.image_url });
  const isFlower = imgUrl?.startsWith("/assets/pressfarm/flowers/");

  const isLimited = row.statusByRestaurant.some((s: any) => s.status === "limited");

  return (
    <div className="flex items-start gap-3 break-inside-avoid">
      {/* Photo or flower illustration */}
      <div className={`w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center ${
        imgUrl
          ? (isFlower ? "bg-farm-cream" : "bg-farm-cream/60")
          : "bg-farm-cream/60 border border-farm-dark/5"
      }`}>
        <img
          src={imgUrl ?? PLACEHOLDER_WREATH}
          alt=""
          aria-hidden="true"
          className={`${imgUrl ? (isFlower ? "w-14 h-14 object-contain" : "w-full h-full object-cover") : "w-10 h-10 opacity-25"}`}
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <p className="font-display text-base text-farm-dark">{item.name}</p>
          {item.is_event_item && (
            <span className="text-[8px] tracking-wider uppercase bg-pf-master-violet/10 text-pf-master-violet px-1.5 py-0.5 rounded font-semibold flex-shrink-0">
              Event
            </span>
          )}
          {isLimited && (
            <span className="text-[8px] tracking-wider uppercase bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded font-semibold flex-shrink-0">
              Limited
            </span>
          )}
        </div>
        {/* Per-unit pricing */}
        <div className="text-xs text-farm-muted mt-1 space-y-0.5">
          {exposedUnits.map((u) => {
            const price = priceForUnit(item, u);
            const label = (UNIT_LABELS as any)[u] ?? u.toUpperCase();
            return (
              <div key={u} className="flex items-baseline justify-between">
                <span>{label}</span>
                <span className="font-semibold text-farm-dark">
                  {price != null ? `$${price.toFixed(2)}` : "—"}
                </span>
              </div>
            );
          })}
        </div>
        {sizes && sizes.length > 0 && (
          <p className="text-[10px] text-farm-muted/80 mt-1 italic">{sizes.join(" · ")}</p>
        )}
        {item.chef_notes && (
          <p className="text-[10px] text-farm-muted mt-1 leading-snug italic">{item.chef_notes}</p>
        )}
      </div>
    </div>
  );
}
