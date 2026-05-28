/**
 * Press Farm OS — Foraging Calendar Data
 *
 * Seasonal wild-food reference for the Napa / North Bay / Bay Area region.
 * Months are 1–12 (Jan = 1). `peak` is the strongest window; `shoulder`
 * extends either side where the item is still findable but past or
 * approaching its window.
 *
 * Sources cross-referenced from ForageSF, Mycological Society of San Francisco,
 * Bay Nature Magazine, and Yerba Buena Chapter CNPS field guides. Treat as a
 * starting reference — always positively identify before consuming, and
 * respect protected areas (foraging is prohibited in most CA state parks
 * and all national parks except for personal mushroom limits in a few).
 */

export type ForageCategory =
  | "greens"
  | "mushrooms"
  | "berries"
  | "flowers"
  | "nuts"
  | "seaweed";

export interface ForageItem {
  slug: string;
  name: string;
  scientificName?: string;
  category: ForageCategory;
  /** Months (1–12) when the item is at peak / ready to harvest. */
  peak: number[];
  /** Months (1–12) where the item is on the way in or fading out. */
  shoulder?: number[];
  habitat: string;
  notes: string;
  /** Optional caution — toxic lookalikes, allergen, or legal restriction. */
  caution?: string;
}

export const CATEGORY_META: Record<
  ForageCategory,
  { label: string; eyebrow: string; flower: string }
> = {
  greens: { label: "Greens & Plants", eyebrow: "Tender & wild", flower: "green-leaf" },
  mushrooms: { label: "Mushrooms", eyebrow: "Forest floor", flower: "buttercup" },
  berries: { label: "Berries & Fruit", eyebrow: "Brambles & branches", flower: "bachelor-button" },
  flowers: { label: "Flowers", eyebrow: "Wild blooms", flower: "california-poppy" },
  nuts: { label: "Nuts & Seeds", eyebrow: "Hard harvest", flower: "fennel" },
  seaweed: { label: "Seaweed", eyebrow: "Coastal harvest", flower: "alyssum" },
};

export const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * North Bay / Bay Area foraging reference. ~50 items spanning the year.
 * Mushroom timing assumes a normal-rain year — slide later by 2–6 weeks
 * during drought, and earlier in wet years.
 */
export const FORAGE_ITEMS: ForageItem[] = [
  // ─────────────────────────── GREENS & PLANTS ───────────────────────────
  {
    slug: "miners-lettuce",
    name: "Miner's Lettuce",
    scientificName: "Claytonia perfoliata",
    category: "greens",
    peak: [2, 3, 4, 5],
    shoulder: [1, 6],
    habitat: "Shaded creek banks, oak woodland, north-facing slopes.",
    notes: "Round disk-leaves clasping the stem with a small white flower in the center. Mild, succulent, the gold standard of California wild salad greens.",
  },
  {
    slug: "wild-mustard",
    name: "Wild Mustard",
    scientificName: "Brassica spp.",
    category: "greens",
    peak: [1, 2, 3, 4],
    shoulder: [5, 12],
    habitat: "Disturbed fields, vineyard rows, roadside.",
    notes: "Bright yellow four-petal flowers; leaves and unopened flower buds are pungent like wasabi. Buds are excellent quick-pickled.",
  },
  {
    slug: "stinging-nettle",
    name: "Stinging Nettle",
    scientificName: "Urtica dioica",
    category: "greens",
    peak: [2, 3, 4],
    shoulder: [1, 5],
    habitat: "Damp creek beds, redwood understory, partial shade.",
    notes: "Harvest top 6 inches with gloves before flowering. Loses sting when cooked, dried, or blanched. Tastes between spinach and seaweed.",
    caution: "Wear gloves — formic acid on hairs causes a 24-hour rash.",
  },
  {
    slug: "wood-sorrel",
    name: "Wood Sorrel",
    scientificName: "Oxalis spp.",
    category: "greens",
    peak: [11, 12, 1, 2, 3, 4, 5],
    shoulder: [6, 10],
    habitat: "Garden edges, redwood duff, lawn shade.",
    notes: "Clover-like trifoliate leaves and yellow or pink flowers. Lemon-bright sour pop. Use as a finish, not a bulk green — oxalic acid.",
    caution: "Avoid daily large servings — high oxalic acid.",
  },
  {
    slug: "wild-fennel",
    name: "Wild Fennel",
    scientificName: "Foeniculum vulgare",
    category: "greens",
    peak: [3, 4, 5, 6, 7, 8, 9, 10],
    shoulder: [11, 2],
    habitat: "Roadside, fallow fields, freeway embankments — invasive everywhere.",
    notes: "Fronds year-round, pollen in summer, green seed in late summer, brown seed by fall. Pollen is the prize — gold dust over fish or cured meat.",
  },
  {
    slug: "wild-radish",
    name: "Wild Radish",
    scientificName: "Raphanus sativus",
    category: "greens",
    peak: [2, 3, 4, 5, 6],
    habitat: "Same disturbed fields as wild mustard — often growing alongside it.",
    notes: "Lavender or white four-petal flowers (mustard is yellow). Pods are the prize — crisp, peppery, like rat-tail radish. Pickle while still green.",
  },
  {
    slug: "chickweed",
    name: "Chickweed",
    scientificName: "Stellaria media",
    category: "greens",
    peak: [12, 1, 2, 3, 4],
    shoulder: [11, 5],
    habitat: "Garden beds, shaded lawn, irrigated edges.",
    notes: "Sprawling mat with tiny white star flowers and a single line of hair down the stem. Eat raw — corn-silk sweet, lightly grassy.",
  },
  {
    slug: "watercress",
    name: "Watercress",
    scientificName: "Nasturtium officinale",
    category: "greens",
    peak: [11, 12, 1, 2, 3, 4, 5],
    habitat: "Cold, clean, fast-moving creeks and springs.",
    notes: "Pinnately compound leaves floating on running water. Bright peppery bite.",
    caution: "Only harvest from water you'd drink — giardia and ag runoff risk. Cook if uncertain of source.",
  },
  {
    slug: "purslane",
    name: "Purslane",
    scientificName: "Portulaca oleracea",
    category: "greens",
    peak: [6, 7, 8, 9],
    habitat: "Garden paths, sidewalk cracks, vegetable rows.",
    notes: "Succulent paddle leaves and red stems. Lemony, slightly mucilaginous. Highest plant source of omega-3.",
  },
  {
    slug: "lambs-quarters",
    name: "Lamb's Quarters",
    scientificName: "Chenopodium album",
    category: "greens",
    peak: [4, 5, 6, 7, 8],
    habitat: "Same disturbed soil that grows pigweed — vegetable beds, vineyard rows.",
    notes: "Diamond leaves with a powdery silver underside on new growth. Cook like spinach — a goosefoot relative of quinoa.",
  },
  {
    slug: "wild-onion",
    name: "Wild Onion",
    scientificName: "Allium triquetrum / A. unifolium",
    category: "greens",
    peak: [3, 4, 5, 6],
    shoulder: [2],
    habitat: "Coastal scrub, oak savanna, road cuts.",
    notes: "If it smells like onion, it's an onion. Three-cornered leek has the most bulb mass. Bulb, leaf, and flower are all usable.",
    caution: "Death camas grows in the same habitat and is fatal — only harvest plants that smell of onion when crushed.",
  },
  {
    slug: "yerba-buena",
    name: "Yerba Buena",
    scientificName: "Clinopodium douglasii",
    category: "greens",
    peak: [5, 6, 7, 8, 9],
    shoulder: [4, 10],
    habitat: "Redwood / Doug-fir understory, well-drained shade.",
    notes: "The 'good herb' that named San Francisco. Trailing mint vine — soft, sweet, restorative tea.",
  },
  {
    slug: "cleavers",
    name: "Cleavers",
    scientificName: "Galium aparine",
    category: "greens",
    peak: [2, 3, 4, 5],
    habitat: "Hedgerows, fence lines, partial shade.",
    notes: "Velcro-sticky whorled leaves. Best as a cold infusion (steep in cool water overnight) — bright cucumber finish.",
  },
  {
    slug: "mallow",
    name: "Common Mallow",
    scientificName: "Malva neglecta",
    category: "greens",
    peak: [3, 4, 5, 6, 7, 8, 9, 10],
    habitat: "Sidewalk strips, neglected lots, garden edges.",
    notes: "Round scalloped leaves and small lavender flowers. Tender leaves cook to a silky, slightly mucilaginous green — thickens soups.",
  },
  {
    slug: "sea-beans",
    name: "Sea Beans / Pickleweed",
    scientificName: "Salicornia pacifica",
    category: "greens",
    peak: [5, 6, 7, 8, 9],
    habitat: "Salt marsh edges — San Pablo Bay, Drakes Estero, Tomales.",
    notes: "Jointed succulent stems. Crisp and pre-salted. Pinch the tender tips only.",
    caution: "Marsh harvest is regulated in many CA preserves — check refuge rules.",
  },

  // ─────────────────────────── MUSHROOMS ─────────────────────────────────
  {
    slug: "golden-chanterelle",
    name: "Golden Chanterelle",
    scientificName: "Cantharellus californicus",
    category: "mushrooms",
    peak: [11, 12, 1, 2],
    shoulder: [10, 3],
    habitat: "Live oak roots — Marin, Mendocino, Sonoma coast.",
    notes: "Vase-shaped golden cap with forked false gills (ridges, not blades). Apricot smell when fresh. The bay's signature mushroom.",
    caution: "Jack-o'-lantern (Omphalotus) has true thin gills and glows green — toxic.",
  },
  {
    slug: "black-trumpet",
    name: "Black Trumpet",
    scientificName: "Craterellus cornucopioides",
    category: "mushrooms",
    peak: [12, 1, 2],
    shoulder: [11, 3],
    habitat: "Tanoak and live oak duff — well-shaded, often mossy.",
    notes: "Hollow charcoal-grey trumpets that hide in plain sight in oak leaf litter. Dries to an intense black-truffle aroma.",
  },
  {
    slug: "hedgehog",
    name: "Hedgehog Mushroom",
    scientificName: "Hydnum repandum / H. umbilicatum",
    category: "mushrooms",
    peak: [12, 1, 2, 3],
    shoulder: [11, 4],
    habitat: "Doug-fir, oak, tanoak — appears alongside chanterelles.",
    notes: "Buff to apricot cap with soft pendulous teeth (not gills, not pores) underneath. Nutty and sweet. No toxic lookalikes — a great beginner ID.",
  },
  {
    slug: "porcini",
    name: "King Bolete / Porcini",
    scientificName: "Boletus edulis",
    category: "mushrooms",
    peak: [10, 11, 12],
    shoulder: [1, 9],
    habitat: "Pine, fir, manzanita — fruits ~10 days after a 2-inch rain.",
    notes: "Brown bun cap, spongy white pore surface, no ring, no staining. Thanksgiving is the traditional peak. Don't dry the worm-tunneled ones — slice and check first.",
    caution: "Several look-alike boletes stain blue or have red pores — when in doubt, skip.",
  },
  {
    slug: "yellowfoot",
    name: "Yellowfoot Chanterelle",
    scientificName: "Craterellus tubaeformis",
    category: "mushrooms",
    peak: [12, 1, 2],
    shoulder: [11, 3],
    habitat: "Mossy redwood / Doug-fir, often in dense colonies.",
    notes: "Slender hollow stem, yellow base, brown funneled cap. Drier and chewier than golden chants but flushes for weeks.",
  },
  {
    slug: "matsutake",
    name: "Matsutake",
    scientificName: "Tricholoma magnivelare",
    category: "mushrooms",
    peak: [11, 12, 1],
    shoulder: [10, 2],
    habitat: "Tanoak / madrone, coastal CA — Mendocino is famous.",
    notes: "White-tan cap with a thick ringed stem. Cinnamon-Red-Hots aroma is the ID — if it doesn't smell, it isn't matsi.",
  },
  {
    slug: "candy-cap",
    name: "Candy Cap",
    scientificName: "Lactarius rubidus",
    category: "mushrooms",
    peak: [12, 1, 2],
    shoulder: [11, 3],
    habitat: "Tanoak, live oak — usually scattered, not patchy.",
    notes: "Small rust-orange cap, watery milk when cut, no obvious aroma fresh. Dried, it smells like maple syrup — used in ice cream, panna cotta, biscotti.",
  },
  {
    slug: "morel",
    name: "Morel",
    scientificName: "Morchella spp.",
    category: "mushrooms",
    peak: [4, 5, 6],
    shoulder: [3, 7],
    habitat: "Burn scars and apple/cottonwood floodplains — Sierra and inland.",
    notes: "Honeycomb cap completely hollow when sliced. Spring-only and burn-following. False morels (Verpa, Gyromitra) are toxic — true morels are 100% hollow.",
    caution: "Always slice top to bottom — false morels have a cottony interior.",
  },
  {
    slug: "oyster",
    name: "Oyster Mushroom",
    scientificName: "Pleurotus ostreatus / P. pulmonarius",
    category: "mushrooms",
    peak: [11, 12, 1, 2, 3, 4],
    shoulder: [10, 5],
    habitat: "Dead or dying alder, oak, cottonwood — usually shelf-stacked on a single trunk.",
    notes: "White-grey shelf with decurrent gills running down a short side stem. Anise scent. The most forgiving cool-season mushroom.",
  },
  {
    slug: "lions-mane",
    name: "Lion's Mane",
    scientificName: "Hericium erinaceus",
    category: "mushrooms",
    peak: [10, 11, 12, 1],
    shoulder: [9, 2],
    habitat: "Live oak wounds — often 10–30 feet up the trunk.",
    notes: "White cascading icicle teeth. Cooks down to a seafood-like texture (lobster, crab). No look-alikes in CA.",
  },
  {
    slug: "lobster",
    name: "Lobster Mushroom",
    scientificName: "Hypomyces lactifluorum",
    category: "mushrooms",
    peak: [9, 10, 11, 12],
    habitat: "Fir/spruce, Doug-fir — coastal mountains.",
    notes: "A parasitic mold (Hypomyces) growing on a Russula host. Firm, dense, with shellfish-like flavor. The orange crust is the giveaway.",
  },
  {
    slug: "witches-butter",
    name: "Witch's Butter",
    scientificName: "Tremella mesenterica",
    category: "mushrooms",
    peak: [11, 12, 1, 2],
    habitat: "Dead hardwood — bay laurel, oak — after rain.",
    notes: "Jelly-fungus globs of bright yellow on a fallen branch. Flavor-neutral, used in clear broths.",
  },
  {
    slug: "coral-mushroom",
    name: "Coral Mushroom",
    scientificName: "Ramaria spp.",
    category: "mushrooms",
    peak: [11, 12, 1, 2],
    habitat: "Mixed conifer / oak duff.",
    notes: "Cauliflower-like cluster of branched tines. Several edible Ramaria species in CA — others are laxative. ID carefully or stick to the named edibles.",
    caution: "Several Ramaria species cause GI upset. Confirm species, not just shape.",
  },

  // ─────────────────────────── BERRIES & FRUIT ───────────────────────────
  {
    slug: "wild-blackberry",
    name: "Himalayan Blackberry",
    scientificName: "Rubus armeniacus",
    category: "berries",
    peak: [7, 8, 9],
    shoulder: [6, 10],
    habitat: "Every creek bank, fence line, and disturbed edge in the Bay Area.",
    notes: "Invasive, abundant, and excellent. Pick when berries pull off the receptacle with no tug. Highest sugar after a hot week.",
  },
  {
    slug: "thimbleberry",
    name: "Thimbleberry",
    scientificName: "Rubus parviflorus",
    category: "berries",
    peak: [6, 7, 8],
    habitat: "Redwood understory, coastal shade.",
    notes: "Maple-shaped fuzzy leaves, no thorns. Soft, fragile red caps that fall apart in the hand — eat trail-side or carry on a flat board.",
  },
  {
    slug: "wild-strawberry",
    name: "Beach Strawberry",
    scientificName: "Fragaria chiloensis",
    category: "berries",
    peak: [5, 6, 7],
    habitat: "Coastal bluffs and dunes.",
    notes: "Tiny berries with concentrated flavor — the parent of the cultivated strawberry. Harvest small or you'll never get a quart.",
  },
  {
    slug: "salmonberry",
    name: "Salmonberry",
    scientificName: "Rubus spectabilis",
    category: "berries",
    peak: [5, 6, 7],
    habitat: "Wet coastal forest, North Bay creeks.",
    notes: "Golden to salmon-orange raspberry shape. Earliest cane berry of the year. Better in pie than eaten plain.",
  },
  {
    slug: "huckleberry",
    name: "Evergreen Huckleberry",
    scientificName: "Vaccinium ovatum",
    category: "berries",
    peak: [8, 9, 10],
    habitat: "Acidic redwood / Doug-fir soil — North Coast.",
    notes: "Small dark berries on glossy evergreen leaves. Sweet-tart, smaller than cultivated blueberry, with a longer shelf life.",
  },
  {
    slug: "blue-elderberry",
    name: "Blue Elderberry",
    scientificName: "Sambucus nigra ssp. caerulea",
    category: "berries",
    peak: [8, 9],
    shoulder: [7],
    habitat: "Stream banks, oak woodland edges.",
    notes: "Powder-blue clusters on umbrella stems. Must cook — raw berries are unpleasantly cyanogenic. Stems and leaves are always toxic.",
    caution: "Red elderberry (S. racemosa) is generally not eaten — only harvest the blue/black species, cooked.",
  },
  {
    slug: "manzanita",
    name: "Manzanita Berry",
    scientificName: "Arctostaphylos spp.",
    category: "berries",
    peak: [8, 9],
    habitat: "Chaparral, granite slopes.",
    notes: "'Little apples' — dry, mealy, intensely apple-flavored. Best cold-water steeped into a cider or pressed for syrup. Don't try to eat raw.",
  },
  {
    slug: "wild-grape",
    name: "California Wild Grape",
    scientificName: "Vitis californica",
    category: "berries",
    peak: [8, 9, 10],
    habitat: "River corridors throughout Napa / Sonoma.",
    notes: "Small intensely tart blue grapes with big seeds. Leaves for dolmas, fruit for verjus and jelly.",
  },
  {
    slug: "prickly-pear",
    name: "Prickly Pear (Tuna)",
    scientificName: "Opuntia ficus-indica",
    category: "berries",
    peak: [8, 9, 10],
    habitat: "Old homesteads, naturalized in dry slopes.",
    notes: "Magenta fruit. Singe glochids off over a flame or scrub under running water before peeling. Watermelon-bubblegum sweetness.",
    caution: "Glochids — tiny barbed hairs — embed in skin and persist. Always use tongs and gloves.",
  },
  {
    slug: "rose-hips",
    name: "Rose Hips",
    scientificName: "Rosa californica",
    category: "berries",
    peak: [9, 10, 11],
    habitat: "Coastal scrub, riparian — California wild rose is everywhere.",
    notes: "Best after the first frost. Split, scrape seeds (irritating fuzz), and use the flesh for syrup, jelly, or vitamin-C tea.",
  },
  {
    slug: "wild-plum",
    name: "Cherry-Plum",
    scientificName: "Prunus cerasifera",
    category: "berries",
    peak: [6, 7, 8],
    habitat: "Roadside escapees from old orchards — common in Napa.",
    notes: "Cherry-sized red or yellow plums on what looks like an ornamental tree. Wide flavor range tree-to-tree — taste before you fill a bag.",
  },

  // ─────────────────────────── FLOWERS ───────────────────────────────────
  {
    slug: "elderflower",
    name: "Elderflower",
    scientificName: "Sambucus nigra ssp. caerulea",
    category: "flowers",
    peak: [5, 6],
    shoulder: [4, 7],
    habitat: "Stream banks, road cuts, oak woodland edges.",
    notes: "Cream-white umbels with a musky-floral aroma. Cordial, fritters, vinegar. Snip only a fraction of each tree's blooms — those become the August berries.",
  },
  {
    slug: "wild-fennel-pollen",
    name: "Wild Fennel Pollen",
    scientificName: "Foeniculum vulgare",
    category: "flowers",
    peak: [6, 7, 8],
    habitat: "Same fennel stalks — flower umbels in mid-summer.",
    notes: "Tap full umbels into a paper bag, sift out the chaff. Pure pollen sells for $40/oz and tastes like fennel × anise × honey.",
  },
  {
    slug: "wild-mustard-flowers",
    name: "Wild Mustard Flowers",
    scientificName: "Brassica spp.",
    category: "flowers",
    peak: [2, 3, 4, 5],
    habitat: "Same plant as wild mustard greens — separate harvest.",
    notes: "Bright yellow four-petal sprays. Sweet-spicy, beautiful as a garnish or quick-pickled.",
  },
  {
    slug: "bay-laurel",
    name: "California Bay Flowers",
    scientificName: "Umbellularia californica",
    category: "flowers",
    peak: [12, 1, 2, 3],
    habitat: "Coastal mixed forest, creek bottoms.",
    notes: "Small chartreuse umbels with a stronger menthol-bay aroma than the leaves. Infuse into oil briefly — they overpower fast.",
    caution: "Bay essential oils are intense — never use in baby food or for tea longer than 60 seconds.",
  },

  // ─────────────────────────── NUTS & SEEDS ─────────────────────────────
  {
    slug: "bay-nuts",
    name: "California Bay Nuts",
    scientificName: "Umbellularia californica",
    category: "nuts",
    peak: [10, 11, 12],
    habitat: "Beneath bay laurel — drop in late fall.",
    notes: "Olive-shaped green-purple fruit; the seed inside is the prize. Roast at 400°F for 15 minutes, peel — tastes like dark chocolate × coffee × bay.",
    caution: "Always roast — raw nuts have psychoactive umbellulone.",
  },
  {
    slug: "black-walnut",
    name: "Black Walnut",
    scientificName: "Juglans hindsii",
    category: "nuts",
    peak: [9, 10, 11],
    habitat: "Old farms, Napa / Sonoma riparian — often planted by homesteaders.",
    notes: "Husk first while still green for pickled walnuts, or wait for the husk to blacken for the nut. Stains everything indelibly — work outside in gloves.",
    caution: "Juglone in husks is irritating and can kill nearby garden plants.",
  },
  {
    slug: "acorn",
    name: "Acorn (Tan Oak / Live Oak)",
    scientificName: "Notholithocarpus / Quercus spp.",
    category: "nuts",
    peak: [10, 11],
    shoulder: [9, 12],
    habitat: "Beneath any local oak — tanoak preferred for size.",
    notes: "Crack, leach in cold running water 1–2 weeks (or 6–8 boil changes) until no astringency. Mill into flour for cakes, pancakes, mush. Indigenous staple here.",
    caution: "Unleached acorns are inedible from tannin content.",
  },
  {
    slug: "pine-nut",
    name: "Gray Pine Nut",
    scientificName: "Pinus sabiniana",
    category: "nuts",
    peak: [8, 9, 10],
    habitat: "Foothill gray (digger) pine.",
    notes: "Massive cones (heavy enough to dent a car). Roast cones to spring them open; large rich seeds inside.",
    caution: "Pine cones can fall from 60 feet — don't stand under bearing trees in wind.",
  },

  // ─────────────────────────── SEAWEED ──────────────────────────────────
  {
    slug: "nori",
    name: "Wild Nori",
    scientificName: "Porphyra perforata / P. nereocystis",
    category: "seaweed",
    peak: [5, 6, 7, 8],
    shoulder: [4, 9],
    habitat: "Mid-intertidal rocks — Sonoma and Mendocino coast.",
    notes: "Dark purple sheets that dry to glossy black. Harvest with scissors above the holdfast so it regrows.",
    caution: "Requires a CA recreational fishing license. Daily limit: 10 lbs wet weight.",
  },
  {
    slug: "wakame",
    name: "Wakame",
    scientificName: "Alaria marginata",
    category: "seaweed",
    peak: [4, 5, 6, 7],
    habitat: "Low-tide rocky reefs.",
    notes: "The lasagna-noodle ribbed brown blade. Blanches to bright green; classic miso-soup texture.",
    caution: "Fishing license required — see Nori notes.",
  },
  {
    slug: "kombu",
    name: "Kombu / Giant Kelp",
    scientificName: "Macrocystis pyrifera / Saccharina spp.",
    category: "seaweed",
    peak: [4, 5, 6, 7, 8, 9],
    habitat: "Subtidal forests — float in beach-wrack at low tide.",
    notes: "Beach-cast fresh blades dry to dashi-grade stock material in two sunny days. Take only what's intact and salty-fresh.",
  },
  {
    slug: "sea-lettuce",
    name: "Sea Lettuce",
    scientificName: "Ulva spp.",
    category: "seaweed",
    peak: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    habitat: "Tide pools, brackish bay edges.",
    notes: "Bright translucent green sheet. Mild grassy flavor; best crisped in oil. Year-round if water is cold and clean.",
    caution: "Avoid harvesting near urban outfalls or marinas.",
  },
  {
    slug: "bull-kelp",
    name: "Bull Kelp",
    scientificName: "Nereocystis luetkeana",
    category: "seaweed",
    peak: [5, 6, 7, 8, 9],
    habitat: "Subtidal kelp forests — Mendocino especially.",
    notes: "The long-stipe bullwhip kelp. Stipe pickles like rings; blade dries for snacks. Populations are stressed by urchin grazing — harvest beach-cast first.",
    caution: "Critical habitat — recreational limit and license required, and consider skipping if local forests are crashing.",
  },
];

/**
 * Item count per category — used by the filter chips.
 */
export function countByCategory(): Record<ForageCategory, number> {
  return FORAGE_ITEMS.reduce(
    (acc, item) => {
      acc[item.category]++;
      return acc;
    },
    {
      greens: 0,
      mushrooms: 0,
      berries: 0,
      flowers: 0,
      nuts: 0,
      seaweed: 0,
    } as Record<ForageCategory, number>,
  );
}

/**
 * Items in peak right now — the "What's wild this month" callout.
 */
export function itemsInPeak(month: number): ForageItem[] {
  return FORAGE_ITEMS.filter((i) => i.peak.includes(month));
}
