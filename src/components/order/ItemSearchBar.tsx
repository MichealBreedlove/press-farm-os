"use client";

/**
 * Sticky search input shared by every item picker. Purely controlled;
 * the parent filters its own item list on `value`.
 */
export function ItemSearchBar({
  value,
  onChange,
  placeholder = "Search items...",
  children,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  /** Optional row rendered under the input (filter chips, counts). */
  children?: React.ReactNode;
}) {
  return (
    <div className="sticky top-0 z-30 bg-farm-cream/95 backdrop-blur-sm border-b border-farm-dark/5 px-4 py-3">
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-farm-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="search"
          placeholder={placeholder}
          aria-label="Search items"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full pl-9 pr-9 py-2.5 min-h-[44px] text-base border border-farm-dark/10 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-farm-green focus:border-transparent"
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center text-farm-muted hover:text-farm-dark"
            aria-label="Clear search"
          >
            ✕
          </button>
        )}
      </div>
      {children}
    </div>
  );
}
