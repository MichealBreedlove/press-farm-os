"use client";

import { useCallback, useMemo, useState } from "react";
import type { PickerMaps } from "@/lib/order/lines";

interface Initial {
  quantities?: Record<string, number>;
  itemNotes?: Record<string, string>;
  itemColors?: Record<string, string[]>;
  itemVarieties?: Record<string, string[]>;
}

/**
 * Selection state for an item picker — the four keyed maps CategorySection
 * and ItemRow read and write — plus the handler bundle to spread onto a
 * CategorySection. Shared by the chef order form and the Events order form
 * so both keep quantities, notes, colors and varieties the same way.
 */
export function useItemPicker(initial: Initial = {}) {
  const [quantities, setQuantities] = useState<Record<string, number>>(initial.quantities ?? {});
  const [itemNotes, setItemNotes] = useState<Record<string, string>>(initial.itemNotes ?? {});
  const [itemColors, setItemColors] = useState<Record<string, string[]>>(initial.itemColors ?? {});
  const [itemVarieties, setItemVarieties] = useState<Record<string, string[]>>(initial.itemVarieties ?? {});

  const sectionHandlers = useMemo(
    () => ({
      onQuantityChange: (key: string, qty: number) => setQuantities((prev) => ({ ...prev, [key]: qty })),
      onNoteChange: (id: string, note: string) => setItemNotes((prev) => ({ ...prev, [id]: note })),
      onColorChange: (key: string, colors: string[]) => setItemColors((prev) => ({ ...prev, [key]: colors })),
      onVarietyChange: (key: string, varieties: string[]) =>
        setItemVarieties((prev) => ({ ...prev, [key]: varieties })),
    }),
    [],
  );

  /** Drop every entry whose key starts with `prefix` from all four maps
   *  (used when an event-portion split is closed). */
  const dropKeysWithPrefix = useCallback((prefix: string) => {
    const drop = <T,>(map: Record<string, T>): Record<string, T> =>
      Object.fromEntries(Object.entries(map).filter(([k]) => !k.startsWith(prefix)));
    setQuantities(drop);
    setItemColors(drop);
    setItemVarieties(drop);
    setItemNotes(drop);
  }, []);

  const reset = useCallback(() => {
    setQuantities({});
    setItemNotes({});
    setItemColors({});
    setItemVarieties({});
  }, []);

  const maps: PickerMaps = { quantities, itemNotes, itemColors, itemVarieties };

  return {
    ...maps,
    maps,
    setQuantities,
    setItemNotes,
    setItemColors,
    setItemVarieties,
    sectionHandlers,
    dropKeysWithPrefix,
    reset,
  };
}
