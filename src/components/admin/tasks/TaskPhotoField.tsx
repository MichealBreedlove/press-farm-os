"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Camera, ImagePlus, X } from "lucide-react";
import { uploadTaskPhoto } from "@/lib/photo-upload";
import { MAX_TASK_PHOTOS } from "@/lib/tasks/photos";

/**
 * Photo section of the task forms. "Take photo" opens the phone camera
 * straight away (capture="environment"); "Choose" opens the library. Each
 * picture uploads immediately and shows as a thumbnail the farm hands will
 * see on the task ("this needs doing — here's the area").
 */
export function TaskPhotoField({
  urls,
  onChange,
  onBusyChange,
}: {
  urls: string[];
  onChange: (next: string[]) => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const full = urls.length >= MAX_TASK_PHOTOS;

  async function handleFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    setError(null);
    setUploading(true);
    onBusyChange?.(true);
    let next = urls;
    try {
      for (const file of Array.from(list)) {
        if (next.length >= MAX_TASK_PHOTOS) break;
        const url = await uploadTaskPhoto(file);
        next = [...next, url];
        onChange(next);
      }
    } catch (err: any) {
      setError(err?.message ?? "Upload failed");
    } finally {
      setUploading(false);
      onBusyChange?.(false);
      if (cameraRef.current) cameraRef.current.value = "";
      if (libraryRef.current) libraryRef.current.value = "";
    }
  }

  return (
    <div>
      <span className="block text-[10px] tracking-[0.18em] uppercase text-pf-gold-700 font-medium mb-1">
        Photos <span className="normal-case tracking-normal text-farm-muted">· shown to the farm team</span>
      </span>

      {urls.length > 0 && (
        <ul className="grid grid-cols-3 gap-2 mb-2">
          {urls.map((url) => (
            <li key={url} className="relative aspect-square rounded-lg overflow-hidden border border-pf-master-gold/20 bg-farm-cream">
              <Image src={url} alt="Task photo" fill sizes="(max-width: 480px) 33vw, 140px" className="object-cover" />
              <button
                type="button"
                onClick={() => onChange(urls.filter((u) => u !== url))}
                aria-label="Remove photo"
                className="absolute top-0 right-0 min-w-[44px] min-h-[44px] flex items-start justify-end p-1"
              >
                <span className="w-6 h-6 rounded-full bg-farm-dark/75 text-white flex items-center justify-center">
                  <X className="w-3.5 h-3.5" />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <input
        ref={libraryRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {!full && (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={uploading}
            onClick={() => cameraRef.current?.click()}
            className="min-h-[48px] rounded-lg border border-dashed border-farm-green/50 text-sm font-medium text-farm-green bg-white hover:bg-farm-green/[0.04] disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            <Camera className="w-4 h-4" /> {uploading ? "Uploading…" : "Take photo"}
          </button>
          <button
            type="button"
            disabled={uploading}
            onClick={() => libraryRef.current?.click()}
            className="min-h-[48px] rounded-lg border border-pf-master-gold/30 text-sm text-farm-dark bg-white hover:bg-farm-cream disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            <ImagePlus className="w-4 h-4" /> Choose photo
          </button>
        </div>
      )}
      {error && <p className="text-xs text-red-700 mt-1.5">{error}</p>}
    </div>
  );
}
