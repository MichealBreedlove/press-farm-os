import { describe, it, expect } from "vitest";
import {
  localizeTaskTitle,
  localizeTaskDescription,
  splitInlineSpanish,
  translateGeneratedTitle,
} from "@/lib/tasks/localize";
import { sanitizeTaskPhotoUrls, MAX_TASK_PHOTOS } from "@/lib/tasks/photos";

const base = { title: "Weed the bed", description: null as string | null };

describe("localizeTaskTitle", () => {
  it("returns English untouched", () => {
    expect(localizeTaskTitle({ ...base, title_es: "Desyerbar" }, "en")).toBe("Weed the bed");
  });
  it("prefers the stored Spanish title", () => {
    expect(localizeTaskTitle({ ...base, title_es: " Desyerbar el cantero " }, "es")).toBe("Desyerbar el cantero");
  });
  it("falls back to English when there is no Spanish", () => {
    expect(localizeTaskTitle(base, "es")).toBe("Weed the bed");
    expect(localizeTaskTitle({ ...base, title_es: "  " }, "es")).toBe("Weed the bed");
  });
  it("template-translates cron-generated titles", () => {
    expect(translateGeneratedTitle("Sow 2 trays Mustard")).toBe("Sembrar 2 bandejas de Mustard");
    expect(translateGeneratedTitle("Sow 1 tray Pea Shoots")).toBe("Sembrar 1 bandeja de Pea Shoots");
    expect(translateGeneratedTitle("Harvest Chervil tray CH-1009-02")).toBe("Cosechar bandeja CH-1009-02 de Chervil");
    expect(translateGeneratedTitle("Move Kale Mix tray KM-1 → light")).toBe("Mover bandeja KM-1 de Kale Mix → luz");
    expect(translateGeneratedTitle("Sow Radish (recurring every 14d)")).toBe("Sembrar Radish (cada 14 días)");
    expect(translateGeneratedTitle("Plant the garlic")).toBeNull();
  });
});

describe("localizeTaskDescription", () => {
  const inline = "Where: Quadrant 2, rows 6-16. ES: Sembrar la mostaza en el cuadrante 2.";
  it("splits an inline ES: tail", () => {
    expect(splitInlineSpanish(inline)).toEqual({
      en: "Where: Quadrant 2, rows 6-16.",
      es: "Sembrar la mostaza en el cuadrante 2.",
    });
    expect(splitInlineSpanish("No Spanish here. YES: really")).toEqual({ en: "No Spanish here. YES: really", es: null });
  });
  it("Spanish: stored column, then inline tail, then English", () => {
    expect(localizeTaskDescription({ ...base, description: inline, description_es: "Guardado" }, "es")).toBe("Guardado");
    expect(localizeTaskDescription({ ...base, description: inline }, "es")).toBe("Sembrar la mostaza en el cuadrante 2.");
    expect(localizeTaskDescription({ ...base, description: "Only English" }, "es")).toBe("Only English");
  });
  it("English drops the inline Spanish tail", () => {
    expect(localizeTaskDescription({ ...base, description: inline }, "en")).toBe("Where: Quadrant 2, rows 6-16.");
  });
  it("returns null for empty descriptions", () => {
    expect(localizeTaskDescription(base, "es")).toBeNull();
    expect(localizeTaskDescription({ ...base, description: "  " }, "en")).toBeNull();
  });
});

describe("sanitizeTaskPhotoUrls", () => {
  const ok = (n: number) =>
    `https://rxdfjaseilmjvcwamqyk.supabase.co/storage/v1/object/public/item-photos/tasks/photo-${n}.jpg`;
  it("keeps only this project's task photos", () => {
    expect(
      sanitizeTaskPhotoUrls([
        ok(1),
        "https://evil.example.com/x.jpg",
        "https://rxdfjaseilmjvcwamqyk.supabase.co/storage/v1/object/public/item-photos/tasks/../items/a.jpg",
        42,
        ok(1),
      ]),
    ).toEqual([ok(1)]);
  });
  it("caps the count and tolerates junk", () => {
    expect(sanitizeTaskPhotoUrls([1, 2, 3, 4, 5, 6].map(ok))).toHaveLength(MAX_TASK_PHOTOS);
    expect(sanitizeTaskPhotoUrls("nope")).toEqual([]);
    expect(sanitizeTaskPhotoUrls(undefined)).toEqual([]);
  });
});
