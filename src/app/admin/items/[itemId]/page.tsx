/**
 * /admin/items/[itemId] — Edit or create an item
 *
 * Form: name, category, unit_type, default_price, chef_notes, internal_notes, source.
 * Archive button.
 * Price history section.
 *
 * TODO: Build item edit form
 */
export default async function AdminItemEditPage({
  params,
}: {
  params: Promise<{ itemId: string }>;
}) {
  const { itemId } = await params;
  const isNew = itemId === "new";

  return (
    <main>
      <header className="bg-white border-b border-gray-100 px-4 py-4">
        <h1 className="text-lg font-semibold">{isNew ? "Add Item" : "Edit Item"}</h1>
      </header>

      <div className="px-4 py-6">
        {/* TODO: Item form */}
        <p className="text-center text-gray-400 text-sm">
          Item editor — coming in Phase 1 build
        </p>
      </div>
    </main>
  );
}
