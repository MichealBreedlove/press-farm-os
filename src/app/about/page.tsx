import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { RestaurantCard } from "@/components/shared/RestaurantCard";
import { ContactForm } from "./ContactForm";

export const metadata: Metadata = {
  title: "About",
  description:
    "Press Farm — half an acre in Yountville, California, growing edible flowers, micro-greens, and seasonal produce in close partnership with the Napa Valley kitchens we feed.",
  alternates: { canonical: "/about" },
  openGraph: {
    title: "About · Press Farm",
    description:
      "Half an acre in Yountville, California. Edible flowers, micro-greens, and seasonal produce — cultivated with chefs.",
    url: "https://pressfarm.io/about",
    type: "website",
  },
};

// Featured specimens — plated, numbered, with full botanical detail.
const FEATURED_FLOWERS = [
  { src: "/assets/pressfarm/flowers/squash-blossom.png", name: "Squash Blossom", latin: "Cucurbita pepo", family: "Cucurbitaceae", note: "Signature crop" },
  { src: "/assets/pressfarm/flowers/nasturtium.png", name: "Nasturtium", latin: "Tropaeolum majus", family: "Tropaeolaceae", note: "Peppery petal" },
  { src: "/assets/pressfarm/flowers/borage.png", name: "Borage", latin: "Borago officinalis", family: "Boraginaceae", note: "Cucumber note" },
  { src: "/assets/pressfarm/flowers/calendula.png", name: "Calendula", latin: "Calendula officinalis", family: "Asteraceae", note: "Tasting-menu petal" },
];

// The index — the supporting cast, kept as a herbarium register with latin binomials.
const SUPPORTING_FLOWERS = [
  { src: "/assets/pressfarm/flowers/pansy.png", name: "Pansy", latin: "Viola tricolor" },
  { src: "/assets/pressfarm/flowers/marigold.png", name: "Marigold", latin: "Tagetes erecta" },
  { src: "/assets/pressfarm/flowers/gem-marigold.png", name: "Gem Marigold", latin: "Tagetes tenuifolia" },
  { src: "/assets/pressfarm/flowers/chive-blossom.png", name: "Chive Blossom", latin: "Allium schoenoprasum" },
  { src: "/assets/pressfarm/flowers/fava-flower.png", name: "Fava Flower", latin: "Vicia faba" },
  { src: "/assets/pressfarm/flowers/alyssum.png", name: "Alyssum", latin: "Lobularia maritima" },
  { src: "/assets/pressfarm/flowers/hairy-vetch.png", name: "Hairy Vetch", latin: "Vicia villosa" },
  { src: "/assets/pressfarm/flowers/chamomile.png", name: "Chamomile", latin: "Matricaria chamomilla" },
  { src: "/assets/pressfarm/flowers/lavender.png", name: "Lavender", latin: "Lavandula angustifolia" },
  { src: "/assets/pressfarm/flowers/anise-hyssop.png", name: "Anise Hyssop", latin: "Agastache foeniculum" },
  { src: "/assets/pressfarm/flowers/buttercup.png", name: "Buttercup", latin: "Ranunculus repens" },
  { src: "/assets/pressfarm/flowers/california-poppy.png", name: "California Poppy", latin: "Eschscholzia californica" },
];

// Partner restaurants — kitchens we feed.
const RESTAURANTS = [
  {
    name: "Press",
    note: "St. Helena · Napa Valley fine dining",
    logo: "/assets/restaurants/press.png",
    website: "https://pressnapavalley.com",
  },
  {
    name: "Under-Study",
    note: "St. Helena · Café · bakery · patisserie",
    logo: "/assets/restaurants/under-study.png",
    website: "https://under-study.com",
  },
];

// Field method — the three movements from bed to plate.
const FIELD_METHOD = [
  { src: "/assets/pressfarm/flowers/squash-bud.png", plate: "Plate I", title: "Cultivated", body: "We grow what chefs ask for, planting in cycles tuned to the menus they're writing." },
  { src: "/assets/pressfarm/flowers/squash-blossom.png", plate: "Plate II", title: "Harvested", body: "Picked the morning of delivery. Chefs see what's ready and order the night before." },
  { src: "/assets/pressfarm/flowers/marigold.png", plate: "Plate III", title: "Delivered", body: "Thursday, Saturday, Monday. From bed to plate in hours, not days." },
];

const eyebrowFont = {
  fontFamily: "'Bank Gothic LT', 'BankGothic Lt BT', 'Bank Gothic', sans-serif",
};

const serifFont = {
  fontFamily: "var(--font-cormorant), 'Cormorant Garamond', Georgia, serif",
};

/** Small all-caps letterpress label. */
function Eyebrow({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <p
      className={`text-[10px] sm:text-[11px] tracking-[0.32em] uppercase text-pf-master-gold ${className}`}
      style={eyebrowFont}
    >
      {children}
    </p>
  );
}

/** Gold dot rule — hairline divider with a center dot. */
function GoldRule({ width = "max-w-xs", onDark = false }: { width?: string; onDark?: boolean }) {
  const line = onDark ? "bg-pf-master-gold/40" : "bg-pf-master-gold/30";
  return (
    <div className={`flex items-center gap-2 mx-auto ${width}`}>
      <div className={`flex-1 h-px ${line}`} />
      <div className="w-1.5 h-1.5 rotate-45 bg-pf-master-gold" />
      <div className={`flex-1 h-px ${line}`} />
    </div>
  );
}

/** L-shaped corner ticks — evokes a mounted specimen sheet. */
function CornerTicks({ className = "" }: { className?: string }) {
  const tick = "absolute w-4 h-4 border-pf-master-gold/50";
  return (
    <div aria-hidden="true" className={`pointer-events-none ${className}`}>
      <span className={`${tick} top-0 left-0 border-t border-l`} />
      <span className={`${tick} top-0 right-0 border-t border-r`} />
      <span className={`${tick} bottom-0 left-0 border-b border-l`} />
      <span className={`${tick} bottom-0 right-0 border-b border-r`} />
    </div>
  );
}

/**
 * /about — Public brand page.
 * Botanical herbarium: a half-acre seed catalog. Numbered specimen plates,
 * a register index, letterpress labels, mounting-sheet framing.
 */
export default function AboutPage() {
  return (
    <main className="min-h-screen bg-farm-cream text-farm-dark">

      {/* ============================================================
           HEADER — minimal sticky masthead for wayfinding
           ============================================================ */}
      <header className="sticky top-0 z-30 bg-farm-cream/90 backdrop-blur border-b border-pf-master-gold/15">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/about" className="flex items-center" aria-label="Press Farm — home">
            <Image
              src="/assets/pressfarm/logo/png/pressfarm-mandala-only.png"
              alt="Press Farm"
              width={36}
              height={36}
              className="object-contain"
              priority
            />
          </Link>
          <Link
            href="/login"
            className="text-[11px] tracking-[0.22em] uppercase text-farm-dark hover:text-pf-master-gold transition-colors"
            style={eyebrowFont}
          >
            Chef sign in →
          </Link>
        </div>
      </header>

      {/* ============================================================
           HERO — mounted specimen sheet
           ============================================================ */}
      <section className="px-5 sm:px-6 pt-12 pb-16 sm:pt-20 sm:pb-24">
        <div className="relative max-w-3xl mx-auto">
          {/* Mounting sheet: double hairline frame + corner ticks */}
          <div className="relative border border-pf-master-gold/25 bg-white/40">
            <div className="absolute inset-[7px] border border-pf-master-gold/15 pointer-events-none" />
            <CornerTicks className="absolute inset-[14px]" />

            <div className="relative px-6 py-14 sm:px-12 sm:py-20 text-center">
              {/* Top register line */}
              <div className="flex items-center justify-between text-[10px] tracking-[0.24em] uppercase text-pf-master-gold mb-10" style={eyebrowFont}>
                <span>Press Farm</span>
                <span>Est. 2024</span>
              </div>

              <div className="relative w-40 h-40 sm:w-56 sm:h-56 mx-auto mb-8">
                <Image
                  src="/assets/pressfarm/logo/png/pressfarm-mandala-only.png"
                  alt="Press Farm botanical mark"
                  fill
                  sizes="(min-width: 640px) 224px, 160px"
                  className="object-contain"
                  priority
                />
              </div>

              <Eyebrow className="mb-5">Yountville · California</Eyebrow>

              <h1 className="font-display text-4xl sm:text-6xl leading-[1.04]">
                Half an acre,
                <br />
                <span className="italic">grown for chefs.</span>
              </h1>

              <div className="my-7">
                <GoldRule />
              </div>

              <p className="text-base sm:text-lg text-farm-muted leading-relaxed max-w-xl mx-auto">
                A small specialty farm growing edible flowers, micro-greens,
                and seasonal produce — pressed, picked, and plated in close
                partnership with the kitchens we feed.
              </p>
            </div>
          </div>

          {/* Sheet caption, hung below the frame like a museum placard */}
          <p className="text-center text-[11px] italic text-farm-muted/70 mt-4" style={serifFont}>
            Cultivated with chefs · a working catalogue of the half-acre
          </p>
        </div>
      </section>

      {/* ============================================================
           OUR STORY — field notes
           ============================================================ */}
      <section className="px-6 py-16 sm:py-24 bg-white border-y border-pf-master-gold/15">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <Eyebrow className="mb-3">No. 00 · Field Notes</Eyebrow>
            <h2 className="font-display text-3xl sm:text-4xl leading-tight">
              Cultivated with chefs.
            </h2>
          </div>

          <div className="space-y-5 text-base sm:text-lg text-farm-dark/80 leading-[1.85] max-w-2xl mx-auto">
            <p>
              <span className="float-left font-display text-6xl leading-[0.7] pr-3 pt-1 text-pf-master-gold">P</span>
              ress Farm sits on half an acre at the edge of Yountville — too
              small to wholesale, just right for the kitchens that know what
              they want and pick up the phone to ask for it.
            </p>
            <p>
              We grow what the menu calls for. Squash blossoms in early summer.
              Borage, nasturtium, viola, calendula. Mustard frills bolting in
              the cold. Pea flowers when the trellises peak. Whatever the
              chefs are writing about that week, we&apos;re probably planting
              it now.
            </p>
          </div>

          {/* Pull quote */}
          <blockquote className="mt-12 max-w-xl mx-auto text-center">
            <p className="font-display text-xl sm:text-2xl italic leading-relaxed" style={serifFont}>
              &ldquo;The best way to eat a flower is to walk down the hill
              and pick one yourself. The next best way is to pick up the
              phone and order it the night before.&rdquo;
            </p>
            <footer className="text-[10px] tracking-[0.28em] uppercase text-pf-master-gold mt-4" style={eyebrowFont}>
              — Press Farm
            </footer>
          </blockquote>
        </div>
      </section>

      {/* ============================================================
           WHAT WE GROW — featured specimen plates
           ============================================================ */}
      <section className="px-6 py-16 sm:py-24">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <Eyebrow className="mb-3">No. 01 · The Specimens</Eyebrow>
            <h2 className="font-display text-3xl sm:text-4xl leading-tight">
              An edible flower index
            </h2>
            <p className="text-sm text-farm-muted mt-3 max-w-md mx-auto">
              Twenty-plus species across the season — four plated below,
              the full register follows.
            </p>
          </div>

          {/* Featured — numbered specimen plates */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mb-16">
            {FEATURED_FLOWERS.map((f, i) => (
              <figure key={f.name} className="group relative bg-white">
                {/* double hairline frame */}
                <div className="absolute inset-0 border border-pf-master-gold/25 transition-colors group-hover:border-pf-master-gold/50" />
                <div className="absolute inset-[5px] border border-pf-master-gold/12 pointer-events-none" />

                <div className="relative p-5 sm:p-6 flex flex-col h-full">
                  {/* specimen register row */}
                  <div className="flex items-center justify-between text-[9px] tracking-[0.2em] uppercase text-pf-master-gold" style={eyebrowFont}>
                    <span>Specimen</span>
                    <span>No. {String(i + 1).padStart(2, "0")}</span>
                  </div>

                  <div className="relative aspect-square my-4 sm:my-5 transition-transform duration-300 group-hover:scale-[1.04]">
                    <Image
                      src={f.src}
                      alt={f.name}
                      fill
                      sizes="(min-width: 1024px) 220px, (min-width: 640px) 40vw, 45vw"
                      className="object-contain"
                    />
                  </div>

                  <figcaption className="text-center">
                    <h3 className="font-display text-lg sm:text-xl leading-tight">{f.name}</h3>
                    <p className="text-[12px] italic text-farm-muted/80 mt-0.5" style={serifFont}>{f.latin}</p>
                  </figcaption>

                  <div className="mt-4 pt-3 border-t border-dashed border-pf-master-gold/25 flex items-center justify-between text-[9px] tracking-[0.14em] uppercase text-farm-muted" style={eyebrowFont}>
                    <span>{f.family}</span>
                    <span className="text-pf-master-gold/90">{f.note}</span>
                  </div>
                </div>
              </figure>
            ))}
          </div>

          {/* The register — index with dotted leaders */}
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="flex-1 h-px bg-pf-master-gold/20" />
              <Eyebrow>The Register</Eyebrow>
              <div className="flex-1 h-px bg-pf-master-gold/20" />
            </div>

            <ul className="grid sm:grid-cols-2 gap-x-10 gap-y-0.5">
              {SUPPORTING_FLOWERS.map((f, i) => (
                <li key={f.name} className="group flex items-center gap-3 py-2.5 border-b border-pf-master-gold/12">
                  <span className="text-[10px] tabular-nums text-pf-master-gold/70 w-6 shrink-0" style={eyebrowFont}>
                    {String(i + 5).padStart(2, "0")}
                  </span>
                  <div className="relative w-8 h-8 shrink-0 transition-transform group-hover:scale-110">
                    <Image src={f.src} alt={f.name} fill sizes="32px" className="object-contain" />
                  </div>
                  <span className="font-display text-base whitespace-nowrap">{f.name}</span>
                  <span className="flex-1 self-end mb-1.5 border-b border-dotted border-pf-master-gold/35 min-w-[1rem]" />
                  <span className="text-[11px] sm:text-[12px] italic text-farm-muted whitespace-nowrap" style={serifFont}>{f.latin}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ============================================================
           FIELD METHOD — three plates, bed to plate
           ============================================================ */}
      <section className="px-6 py-16 sm:py-24 bg-white border-y border-pf-master-gold/15">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12 sm:mb-16">
            <Eyebrow className="mb-3">No. 02 · Field Method</Eyebrow>
            <h2 className="font-display text-3xl sm:text-4xl leading-tight">
              A quiet handshake<br className="sm:hidden" /> between farm &amp; kitchen.
            </h2>
          </div>

          <div className="grid sm:grid-cols-3 gap-12 sm:gap-8">
            {FIELD_METHOD.map((step) => (
              <div key={step.title} className="text-center">
                {/* specimen stamp — flower mounted in a ruled roundel */}
                <div className="relative mx-auto w-28 h-28 mb-5">
                  <div className="absolute inset-0 rounded-full border border-pf-master-gold/30" />
                  <div className="absolute inset-[6px] rounded-full border border-dashed border-pf-master-gold/20" />
                  <div className="absolute inset-[14px]">
                    <Image src={step.src} alt="" aria-hidden="true" fill sizes="100px" className="object-contain" />
                  </div>
                </div>
                <Eyebrow className="mb-2">{step.plate}</Eyebrow>
                <h3 className="font-display text-xl mb-3">{step.title}</h3>
                <p className="text-sm text-farm-muted leading-[1.7] max-w-[18rem] mx-auto">
                  {step.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
           OUR CHEFS — partner restaurants
           ============================================================ */}
      <section className="px-6 py-16 sm:py-24">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <Eyebrow className="mb-3">No. 03 · Plated At</Eyebrow>
            <h2 className="font-display text-3xl sm:text-4xl leading-tight">
              The kitchens we feed.
            </h2>
            <p className="text-sm text-farm-muted mt-3 max-w-md mx-auto">
              A small handful of restaurants, all within walking distance
              of where we plant.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-5 max-w-2xl mx-auto">
            {RESTAURANTS.map((r) => (
              <RestaurantCard key={r.name} {...r} />
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
           CTA — correspondence card on dark green
           ============================================================ */}
      <section className="px-6 py-16 sm:py-24 bg-farm-dark text-farm-cream text-center relative overflow-hidden">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[0.06]">
          <Image src="/assets/pressfarm/flowers/calendula.png" width={128} height={128} className="absolute top-8 left-8 w-32 h-auto" alt="" aria-hidden="true" />
          <Image src="/assets/pressfarm/flowers/borage.png" width={128} height={128} className="absolute bottom-8 right-8 w-32 h-auto" alt="" aria-hidden="true" />
        </div>

        <div className="relative max-w-2xl mx-auto">
          {/* framed correspondence card */}
          <div className="relative border border-pf-master-gold/30 px-6 py-12 sm:px-12 sm:py-14">
            <CornerTicks className="absolute inset-3" />

            <Eyebrow>Correspondence</Eyebrow>
            <h2 className="font-display text-3xl sm:text-4xl mt-4">
              Want produce<br className="sm:hidden" /> from Press Farm?
            </h2>

            <div className="my-6">
              <GoldRule onDark />
            </div>

            <p className="text-farm-cream/80 leading-[1.8] max-w-md mx-auto">
              We work with a small handful of restaurants in the Yountville
              area. If you&apos;re a chef interested in our produce, get in
              touch.
            </p>

            {/* calling-card details */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-xl mx-auto pt-8 text-left sm:text-center">
              <div>
                <p className="text-[10px] tracking-[0.22em] uppercase text-pf-master-gold mb-1" style={eyebrowFont}>Email</p>
                <a href="mailto:PressFarm@PressNapaValley.com" className="text-sm text-farm-cream hover:underline break-words">PressFarm@PressNapaValley.com</a>
              </div>
              <div>
                <p className="text-[10px] tracking-[0.22em] uppercase text-pf-master-gold mb-1" style={eyebrowFont}>Find Us</p>
                <p className="text-sm text-farm-cream">Yountville, CA</p>
              </div>
              <div>
                <p className="text-[10px] tracking-[0.22em] uppercase text-pf-master-gold mb-1" style={eyebrowFont}>Delivery</p>
                <p className="text-sm text-farm-cream">Thu · Sat · Mon</p>
              </div>
            </div>

            <ContactForm />

            <div className="pt-6 text-center">
              <Link href="/login" className="text-sm text-farm-cream/80 hover:text-farm-cream tracking-wide">
                Chef sign in →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
           FOOTER — masthead signature
           ============================================================ */}
      <footer className="px-6 py-12 text-center bg-farm-cream">
        <div className="max-w-md mx-auto">
          <GoldRule />
          <p className="text-[10px] tracking-[0.32em] uppercase text-farm-muted mt-4" style={eyebrowFont}>
            Press Farm · Yountville · California · Est. 2024
          </p>
          <p className="text-[10px] text-farm-muted/60 mt-2 italic" style={serifFont}>
            Cultivated with chefs.
          </p>
        </div>
      </footer>
    </main>
  );
}
