/**
 * /admin/settings/import — Excel data import
 *
 * One-time migration from Daily Delivery Tracking Sheet.
 * Tabs: Import Price Catalog (KEY tab), Import Delivery History (DELIVERY TRACKER tab).
 *
 * Source file: Daily Delivery Tracking Sheet (DO NOT MODIFY).xlsx
 * Location: C:\Users\mikej\Downloads\OneDrive_1_3-19-2026 (1)\All Recipes + Kitchen Documents\1.9 - Farm & Preservation\
 *
 * TODO: Build Excel import UI with SheetJS parsing
 */
export default function AdminImportPage() {
  return (
    <main>
      <header className="bg-white border-b border-gray-100 px-4 py-4">
        <h1 className="text-lg font-semibold">Data Import</h1>
        <p className="text-sm text-gray-500">One-time migration from Excel</p>
      </header>

      <div className="px-4 py-6 space-y-6">
        {/* TODO: Import Price Catalog section (KEY tab → 289 items + price_catalog) */}
        {/* TODO: Import Delivery History section (DELIVERY TRACKER tab) */}
        {/* TODO: Import Farm Expenses section */}
        <p className="text-center text-gray-400 text-sm">
          Data import — coming in Phase 1 build
        </p>
      </div>
    </main>
  );
}
