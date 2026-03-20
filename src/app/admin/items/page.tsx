/**
 * /admin/items — Item catalog management
 *
 * Lists all items grouped by category.
 * Add/edit/archive items.
 * Price catalog management.
 *
 * TODO: Build item catalog UI
 */
export default function AdminItemsPage() {
  return (
    <main>
      <header className="bg-white border-b border-gray-100 px-4 py-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Item Catalog</h1>
        {/* TODO: "Add Item" button */}
      </header>

      <div className="px-4 py-6">
        {/* TODO: Item list by category */}
        <p className="text-center text-gray-400 text-sm">
          Item catalog — coming in Phase 1 build
        </p>
      </div>
    </main>
  );
}
