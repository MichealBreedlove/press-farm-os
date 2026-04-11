"use client";

import { useState, useEffect } from "react";
import { Camera, X, Search } from "lucide-react";

interface PhotoPickerProps {
  value: string | null;
  onChange: (url: string | null) => void;
}

export function PhotoPicker({ value, onChange }: PhotoPickerProps) {
  const [open, setOpen] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && photos.length === 0) {
      setLoading(true);
      fetch("/api/photos")
        .then((r) => r.json())
        .then((data) => setPhotos(data.photos ?? []))
        .finally(() => setLoading(false));
    }
  }, [open]);

  const filtered = search
    ? photos.filter((p) => p.toLowerCase().includes(search.toLowerCase()))
    : photos;

  function selectPhoto(url: string) {
    onChange(url);
    setOpen(false);
    setSearch("");
  }

  function clearPhoto() {
    onChange(null);
  }

  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">Photo</label>

      {/* Current photo or placeholder */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-32 h-32 rounded-xl border-2 border-dashed border-gray-200 hover:border-farm-green flex items-center justify-center overflow-hidden transition-colors bg-gray-50 min-h-0 min-w-0 relative group"
      >
        {value ? (
          <>
            <img src={value} alt="Item photo" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <span className="text-white text-xs font-medium">Change</span>
            </div>
          </>
        ) : (
          <div className="text-center">
            <Camera className="w-6 h-6 text-gray-300 mx-auto" />
            <span className="text-[10px] text-gray-400 mt-1 block">Choose</span>
          </div>
        )}
      </button>

      {value && (
        <button
          type="button"
          onClick={clearPhoto}
          className="text-xs text-red-500 hover:text-red-700 mt-1 min-h-0 min-w-0"
        >
          Remove photo
        </button>
      )}

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="px-4 pt-4 pb-2 flex items-center justify-between border-b border-gray-100">
              <h3 className="font-display text-sm text-farm-dark">Choose Photo</h3>
              <button
                type="button"
                onClick={() => { setOpen(false); setSearch(""); }}
                className="p-2 text-gray-400 hover:text-gray-600 min-h-0 min-w-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search */}
            <div className="px-4 py-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search photos..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  autoFocus
                  className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-farm-green"
                />
              </div>
            </div>

            {/* Photo grid */}
            <div className="flex-1 overflow-y-auto px-4 pb-4">
              {loading ? (
                <p className="text-center text-gray-400 text-sm py-8">Loading photos...</p>
              ) : filtered.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-8">No photos found</p>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {filtered.map((photo) => {
                    const isSelected = photo === value;
                    const label = photo
                      .replace("/items/", "")
                      .replace(".jpg", "")
                      .replace(/-/g, " ");
                    return (
                      <button
                        key={photo}
                        type="button"
                        onClick={() => selectPhoto(photo)}
                        className={`aspect-square rounded-lg overflow-hidden border-2 transition-all min-h-0 min-w-0 ${
                          isSelected
                            ? "border-farm-green ring-2 ring-farm-green/30"
                            : "border-transparent hover:border-gray-300"
                        }`}
                        title={label}
                      >
                        <img
                          src={photo}
                          alt={label}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Count */}
            <div className="px-4 py-2 border-t border-gray-100 text-xs text-gray-400 text-center">
              {filtered.length} photos {search && `matching "${search}"`}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
