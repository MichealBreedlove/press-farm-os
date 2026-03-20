"use client";

/**
 * ExcelImport — file upload + preview for one-time data migration.
 *
 * Tabs: "Price Catalog (KEY tab)" | "Delivery History (DELIVERY TRACKER)"
 *
 * Flow:
 *   1. Upload .xlsx file
 *   2. POST to /api/import/key-tab?preview=true or /api/import/delivery-history?preview=true
 *   3. Show preview table (item count, sample rows, warnings)
 *   4. "Confirm Import" → POST without preview param → batch insert
 *   5. Show result summary
 *
 * Source file: Daily Delivery Tracking Sheet (DO NOT MODIFY).xlsx
 *
 * TODO: Build full UI in Phase 1
 */

type ImportType = "key-tab" | "delivery-history";

interface ExcelImportProps {
  type: ImportType;
}

export function ExcelImport({ type }: ExcelImportProps) {
  void type;

  return (
    <div className="p-4">
      <p className="text-center text-gray-400 text-sm">
        ExcelImport — TODO: implement with SheetJS in Phase 1
      </p>
    </div>
  );
}
