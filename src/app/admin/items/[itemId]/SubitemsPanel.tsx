import Link from "next/link";
import { CATEGORY_LABELS } from "@/lib/constants";
import { getItemImageUrl } from "@/lib/flower-images";
import type { ItemCategory } from "@/types";

interface ChildItem {
  id: string;
  name: string;
  category: ItemCategory;
  image_url: string | null;
  is_archived: boolean;
}

interface Props {
  parentId: string;
  parentName: string;
  children: ChildItem[];
}

/**
 * Subitems panel — shown on a parent item's detail page below the form.
 * Lists all children (e.g. Squash → Blossoms / Tendrils / Leaves / Fruit)
 * and offers a quick-add button that takes you to /admin/items/new with
 * parent_item_id pre-filled so you can crank out a full crop fast.
 *
 * Children render as standalone items on the chef order form — this panel
 * only exists for admin organization.
 */
export function SubitemsPanel({ parentId, parentName, children }: Props) {
  return (
    <section className="border-t border-farm-dark/5 pt-6">
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <p className="section-eyebrow text-farm-muted">Subitems</p>
          <p className="text-[11px] text-farm-muted/70 mt-0.5 leading-snug max-w-md">
            Parts of {parentName} (e.g. blossoms, tendrils, leaves). Each subitem is its own catalog entry with independent photos, prices, and availability — chefs see them as separate items.
          </p>
        </div>
        <Link
          href={`/admin/items/new?parent=${parentId}`}
          className="text-xs px-3 py-2 rounded-lg bg-farm-green text-white font-medium hover:bg-farm-green-dark transition-colors min-h-0 flex items-center gap-1 whitespace-nowrap flex-shrink-0"
        >
          <span className="text-base leading-none">+</span>
          <span>Add subitem</span>
        </Link>
      </div>

      {children.length === 0 ? (
        <div className="text-center py-6 px-4 rounded-xl border border-dashed border-farm-dark/10 bg-farm-cream/30">
          <p className="text-sm text-farm-muted">No subitems yet.</p>
          <p className="text-[11px] text-farm-muted/70 mt-1">
            Add one to group parts of this crop.
          </p>
        </div>
      ) : (
        <ul className="space-y-1">
          {children.map((child) => {
            const imgUrl = getItemImageUrl(child as any);
            const isFlower = imgUrl?.startsWith("/assets/pressfarm/flowers/");
            return (
              <li key={child.id}>
                <Link
                  href={`/admin/items/${child.id}`}
                  className={`bg-white rounded-xl border border-farm-dark/5 flex items-center gap-3 px-3 py-2.5 hover:bg-farm-cream/40 transition-colors ${
                    child.is_archived ? "opacity-50" : ""
                  }`}
                >
                  {imgUrl ? (
                    <div className={`w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 ${isFlower ? "bg-farm-cream" : "bg-farm-cream/60"}`}>
                      <img
                        src={imgUrl}
                        alt={child.name}
                        className={`w-full h-full ${isFlower ? "object-contain p-1" : "object-cover"}`}
                        loading="lazy"
                      />
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-farm-cream/60 border border-farm-dark/5 flex items-center justify-center flex-shrink-0">
                      <span className="text-farm-muted/40 text-xs">—</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-farm-dark truncate">{child.name}</p>
                    <p className="text-[11px] text-farm-muted">
                      {CATEGORY_LABELS[child.category] ?? child.category}
                      {child.is_archived && " · Archived"}
                    </p>
                  </div>
                  <svg className="w-4 h-4 text-farm-muted/60 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
