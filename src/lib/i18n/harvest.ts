import { CATEGORY_LABELS } from "@/lib/constants";

/**
 * English/Spanish strings for the harvester portal (/harvest).
 *
 * Kept as a plain two-locale dictionary (no i18n library) — the portal is a
 * single screen and the rest of the app stays English-only. The Spanish is
 * field-crew Spanish: short, concrete, Latin American usage.
 */
export type HarvestLang = "en" | "es";

export interface HarvestStrings {
  harvestList: string;
  forDate: string;
  itemsToPick: string;
  restaurantsOrdering: string;
  tapToMark: string;
  harvestedCount: string;
  allHarvested: string;
  updateFailed: string;
  noOrders: string;
  noOrdersHint: string;
  containersNeeded: string;
  item: string;
  container: string;
  total: string;
  categoryLabels: Record<string, string>;
  containerLabels: Record<string, string>;
  extrasHeading: string;
  extrasHint: string;
  addExtra: string;
  addingExtra: string;
  restaurant: string;
  searchItems: string;
  noItemsMatch: string;
  adding: string;
  change: string;
  qty: string;
  unit: string;
  cancel: string;
  addToDelivery: string;
  addingBusy: string;
  added: string;
  qtyError: string;
  addFailed: string;
  remove: string;
  removing: string;
  noExtrasYet: string;
  signOut: string;
  signOutHint: string;
  language: string;
}

export const HARVEST_STRINGS: Record<HarvestLang, HarvestStrings> = {
  en: {
    harvestList: "Harvest List",
    forDate: "Delivery for",
    itemsToPick: "items to pick",
    restaurantsOrdering: "restaurants ordering",
    tapToMark: "Tap an item when it's harvested",
    harvestedCount: "harvested",
    allHarvested: "Everything harvested ✓",
    updateFailed: "Couldn't save — try again",
    noOrders: "No orders yet",
    noOrdersHint: "Chefs haven't placed orders for this date yet. Check back later.",
    containersNeeded: "Containers Needed",
    item: "Item",
    container: "Cont.",
    total: "Tot",
    categoryLabels: CATEGORY_LABELS,
    containerLabels: {
      lg: "Large To-Go",
      sm: "Small To-Go",
      lbs: "Green Bin",
      bx: "Box",
      bu: "Bunch",
      qt: "Quart",
      pt: "Pint",
      cs: "Case",
      kit: "Kit",
    },
    extrasHeading: "Extra Items",
    extrasHint: "Harvested more than the list? Add it here so the kitchen knows it's coming.",
    addExtra: "Add Extra Item",
    addingExtra: "Add an extra item",
    restaurant: "Restaurant",
    searchItems: "Search items…",
    noItemsMatch: "No items match.",
    adding: "Adding",
    change: "Change",
    qty: "Qty",
    unit: "Unit",
    cancel: "Cancel",
    addToDelivery: "Add to Delivery",
    addingBusy: "Adding…",
    added: "Added",
    qtyError: "Enter a quantity > 0",
    addFailed: "Failed to add",
    remove: "Remove",
    removing: "Removing…",
    noExtrasYet: "No extras added for this date yet.",
    signOut: "Sign Out",
    signOutHint: "Sign out of Press Farm OS",
    language: "Language",
  },
  es: {
    harvestList: "Lista de Cosecha",
    forDate: "Entrega del",
    itemsToPick: "artículos por cosechar",
    restaurantsOrdering: "restaurantes con pedido",
    tapToMark: "Toque un artículo cuando esté cosechado",
    harvestedCount: "cosechados",
    allHarvested: "Todo cosechado ✓",
    updateFailed: "No se pudo guardar — intente de nuevo",
    noOrders: "Aún no hay pedidos",
    noOrdersHint: "Los chefs todavía no han hecho pedidos para esta fecha. Vuelva a revisar más tarde.",
    containersNeeded: "Envases necesarios",
    item: "Artículo",
    container: "Env.",
    total: "Tot",
    categoryLabels: {
      flowers: "Flores",
      micros_leaves: "Micros y Hojas",
      herbs_leaves: "Hierbas y Hojas",
      fruit_veg: "Frutas y Verduras",
      kits: "Kits",
      family_meal: "Comida Familiar",
    },
    containerLabels: {
      lg: "Envase grande",
      sm: "Envase chico",
      lbs: "Caja verde",
      bx: "Caja",
      bu: "Manojo",
      qt: "Cuarto (qt)",
      pt: "Pinta (pt)",
      cs: "Caja grande",
      kit: "Kit",
    },
    extrasHeading: "Artículos Extra",
    extrasHint: "¿Cosechó más de lo que pide la lista? Agréguelo aquí para avisar a la cocina.",
    addExtra: "Agregar artículo extra",
    addingExtra: "Agregar un artículo extra",
    restaurant: "Restaurante",
    searchItems: "Buscar artículos…",
    noItemsMatch: "No hay artículos con ese nombre.",
    adding: "Agregando",
    change: "Cambiar",
    qty: "Cant.",
    unit: "Unidad",
    cancel: "Cancelar",
    addToDelivery: "Agregar a la entrega",
    addingBusy: "Agregando…",
    added: "Agregado",
    qtyError: "Ponga una cantidad mayor a 0",
    addFailed: "No se pudo agregar",
    remove: "Quitar",
    removing: "Quitando…",
    noExtrasYet: "Todavía no hay extras para esta fecha.",
    signOut: "Cerrar sesión",
    signOutHint: "Salir de Press Farm OS",
    language: "Idioma",
  },
};

/** Localized "Thursday, Mar 19" — Spanish uses es-MX (field-crew usage). */
export function formatHarvestDate(dateStr: string, lang: HarvestLang): string {
  const date = new Date(dateStr + "T12:00:00");
  return date.toLocaleDateString(lang === "es" ? "es-MX" : "en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

/** Short pill label — "Thu 19" / "jue 19". */
export function formatHarvestDateShort(dateStr: string, lang: HarvestLang): string {
  const date = new Date(dateStr + "T12:00:00");
  return date.toLocaleDateString(lang === "es" ? "es-MX" : "en-US", {
    weekday: "short",
    day: "numeric",
  });
}
