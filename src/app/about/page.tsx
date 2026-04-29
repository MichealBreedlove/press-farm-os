import Link from "next/link";
import { PressFarmLogo } from "@/components/shared/PressFarmLogo";

const FEATURED_FLOWERS = [
  { src: "/assets/pressfarm/flowers/squash-blossom.png", name: "Squash Blossom", latin: "Cucurbita pepo", note: "Signature crop" },
  { src: "/assets/pressfarm/flowers/nasturtium.png", name: "Nasturtium", latin: "Tropaeolum majus", note: "Edible petal · peppery" },
  { src: "/assets/pressfarm/flowers/borage.png", name: "Borage", latin: "Borago officinalis", note: "Cucumber · garnish" },
  { src: "/assets/pressfarm/flowers/calendula.png", name: "Calendula", latin: "Calendula officinalis", note: "Tasting menu petal" },
];

const SUPPORTING_FLOWERS = [
  { src: "/assets/pressfarm/flowers/viola.png", name: "Viola" },
  { src: "/assets/pressfarm/flowers/pansy.png", name: "Pansy" },
  { src: "/assets/pressfarm/flowers/marigold.png", name: "Marigold" },
  { src: "/assets/pressfarm/flowers/gem-marigold.png", name: "Gem Marigold" },
  { src: "/assets/pressfarm/flowers/bachelor-button.png", name: "Bachelor Button" },
  { src: "/assets/pressfarm/flowers/chive-blossom.png", name: "Chive Blossom" },
  { src: "/assets/pressfarm/flowers/pea-flower.png", name: "Pea Flower" },
  { src: "/assets/pressfarm/flowers/fava-flower.png", name: "Fava Flower" },
  { src: "/assets/pressfarm/flowers/mustard-flower.png", name: "Mustard Flower" },
  { src: "/assets/pressfarm/flowers/alyssum.png", name: "Alyssum" },
  { src: "/assets/pressfarm/flowers/fairy-vetch.png", name: "Fairy Vetch" },
  { src: "/assets/pressfarm/flowers/chamomile.png", name: "Chamomile" },
  { src: "/assets/pressfarm/flowers/lavender.png", name: "Lavender" },
  { src: "/assets/pressfarm/flowers/anise-hyssop.png", name: "Anise Hyssop" },
  { src: "/assets/pressfarm/flowers/buttercup.png", name: "Buttercup" },
  { src: "/assets/pressfarm/flowers/california-poppy.png", name: "California Poppy" },
];

const RESTAURANTS = [
  { name: "Press", note: "Yountville · seasonal tasting" },
  { name: "Under-Study", note: "Yountville · chef's bar" },
  { name: "Events", note: "Tasting series · private dinners" },
];

/** Gold dot rule — small horizontal divider with a gold dot in the middle. */
function GoldRule({ width = "max-w-xs" }: { width?: string }) {
  return (
    <div className={`flex items-center gap-2 mx-auto ${width}`}>
      <div className="flex-1 h-px bg-pf-master-gold/30" />
      <div className="w-1.5 h-1.5 rounded-full bg-pf-master-gold" />
      <div className="flex-1 h-px bg-pf-master-gold/30" />
    </div>
  );
}

const eyebrowFont = {
  fontFamily: "'Bank Gothic LT', 'BankGothic Lt BT', 'Bank Gothic', sans-serif",
};

/**
 * /about — Public brand page. Editorial farm landing.
 */
export default function AboutPage() {
  return (
    <main className="min-h-screen bg-farm-cream">

      {/* ============================================================
           HERO — masthead with floating flower accents
           ============================================================ */}
      <section className="relative px-6 py-20 sm:py-28 text-center overflow-hidden bg-farm-cream/60">
        {/* Floating flower accents around the hero — soft, watercolor */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <img src="/assets/pressfarm/flowers/borage.png" className="absolute top-[10%] left-[8%] w-20 sm:w-28 opacity-50" alt="" style={{ transform: "rotate(-18deg)" }} />
          <img src="/assets/pressfarm/flowers/marigold.png" className="absolute top-[14%] right-[10%] w-24 sm:w-32 opacity-50" alt="" style={{ transform: "rotate(15deg)" }} />
          <img src="/assets/pressfarm/flowers/viola.png" className="absolute bottom-[15%] left-[12%] w-20 sm:w-24 opacity-45" alt="" style={{ transform: "rotate(8deg)" }} />
          <img src="/assets/pressfarm/flowers/chamomile.png" className="absolute bottom-[18%] right-[14%] w-16 sm:w-20 opacity-50" alt="" style={{ transform: "rotate(-12deg)" }} />
        </div>

        <div className="relative max-w-2xl mx-auto space-y-6">
          <PressFarmLogo size="lg" />

          <p
            className="text-[11px] tracking-[0.28em] uppercase text-pf-master-gold pt-4"
            style={eyebrowFont}
          >
            Yountville · California · Est. 2024
          </p>

          <h1 className="font-display text-4xl sm:text-6xl text-farm-dark leading-[1.05]">
            Half an acre,<br />
            <span className="italic">grown for chefs.</span>
          </h1>

          <GoldRule />

          <p className="text-base sm:text-lg text-farm-muted leading-relaxed max-w-xl mx-auto">
            A small specialty farm in Yountville, California, growing
            edible flowers, micro-greens, and seasonal produce in close
            partnership with the kitchens we feed.
          </p>
        </div>
      </section>

      {/* ============================================================
           OUR STORY — short personal narrative + pull quote
           ============================================================ */}
      <section className="px-6 py-20 sm:py-24 bg-white border-y border-pf-master-gold/15">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <p
              className="text-[11px] tracking-[0.28em] uppercase text-pf-master-gold mb-3"
              style={eyebrowFont}
            >
              Our Story
            </p>
            <h2 className="font-display text-3xl sm:text-4xl text-farm-dark leading-tight">
              Cultivated with chefs.
            </h2>
          </div>

          <div className="space-y-5 text-base sm:text-lg text-farm-dark/80 leading-[1.8] max-w-2xl mx-auto">
            <p>
              Press Farm sits on half an acre at the edge of Yountville — too
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
            <p
              className="font-display text-xl sm:text-2xl italic text-farm-dark leading-relaxed"
              style={{ fontFamily: "var(--font-cormorant), 'Cormorant Garamond', Georgia, serif" }}
            >
              &ldquo;The best way to eat a flower is to walk down the hill
              and pick one yourself. The next best way is to pick up the
              phone and order it the night before.&rdquo;
            </p>
            <footer
              className="text-[10px] tracking-[0.28em] uppercase text-pf-master-gold mt-4"
              style={eyebrowFont}
            >
              — Press Farm · Cultivated with Chefs
            </footer>
          </blockquote>
        </div>
      </section>

      {/* ============================================================
           WHAT WE GROW — herbarium-style flower index
           ============================================================ */}
      <section className="px-6 py-20 sm:py-24">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p
              className="text-[11px] tracking-[0.28em] uppercase text-pf-master-gold mb-3"
              style={eyebrowFont}
            >
              What We Grow
            </p>
            <h2 className="font-display text-3xl sm:text-4xl text-farm-dark leading-tight">
              An edible flower index
            </h2>
            <p className="text-sm text-farm-muted mt-3 max-w-md mx-auto">
              Twenty-plus species across the season — featured plates below,
              the supporting cast follows.
            </p>
          </div>

          {/* Featured flowers — larger cards with botanical detail */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-16">
            {FEATURED_FLOWERS.map((f) => (
              <figure
                key={f.name}
                className="bg-white rounded-2xl border border-pf-master-gold/15 p-6 text-center transition-all hover:border-pf-master-gold/40 hover:shadow-md"
              >
                <div className="aspect-square flex items-center justify-center mb-4">
                  <img src={f.src} alt={f.name} className="max-w-full max-h-full object-contain" loading="lazy" />
                </div>
                <figcaption>
                  <p className="font-display text-base text-farm-dark">{f.name}</p>
                  <p className="text-[11px] italic text-farm-muted/80 mt-0.5">{f.latin}</p>
                  <div className="flex items-center justify-center gap-1.5 mt-2">
                    <div className="w-3 h-px bg-pf-master-gold/50" />
                    <div className="w-1 h-1 rounded-full bg-pf-master-gold" />
                    <div className="w-3 h-px bg-pf-master-gold/50" />
                  </div>
                  <p className="text-[10px] tracking-[0.18em] uppercase text-farm-muted mt-2" style={eyebrowFont}>
                    {f.note}
                  </p>
                </figcaption>
              </figure>
            ))}
          </div>

          {/* Supporting cast — denser grid */}
          <p
            className="text-[10px] tracking-[0.28em] uppercase text-pf-master-gold mb-4 text-center"
            style={eyebrowFont}
          >
            The supporting cast
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {SUPPORTING_FLOWERS.map((f) => (
              <div key={f.name} className="text-center group">
                <div className="aspect-square bg-farm-cream rounded-xl p-3 flex items-center justify-center transition-transform group-hover:scale-105 border border-farm-dark/5">
                  <img src={f.src} alt={f.name} className="max-w-full max-h-full object-contain" loading="lazy" />
                </div>
                <p className="mt-2 text-[11px] text-farm-muted">{f.name}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
           HOW IT WORKS — botanical step markers
           ============================================================ */}
      <section className="px-6 py-20 sm:py-24 bg-white border-y border-pf-master-gold/15">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <p
              className="text-[11px] tracking-[0.28em] uppercase text-pf-master-gold mb-3"
              style={eyebrowFont}
            >
              How It Works
            </p>
            <h2 className="font-display text-3xl sm:text-4xl text-farm-dark leading-tight">
              A quiet handshake<br className="sm:hidden" /> between farm &amp; kitchen.
            </h2>
          </div>

          <div className="grid sm:grid-cols-3 gap-12 sm:gap-8">
            <div className="text-center">
              <div className="mx-auto w-24 h-24 mb-4 flex items-center justify-center">
                <img src="/assets/pressfarm/flowers/squash-bud.png" alt="" aria-hidden="true" className="w-full h-full object-contain" />
              </div>
              <p
                className="text-[10px] tracking-[0.28em] uppercase text-pf-master-gold mb-2"
                style={eyebrowFont}
              >
                Step One
              </p>
              <h3 className="font-display text-xl text-farm-dark mb-3">Cultivated</h3>
              <p className="text-sm text-farm-muted leading-[1.7] max-w-[18rem] mx-auto">
                We grow what chefs ask for, planting in cycles tuned to the
                menus they&apos;re writing.
              </p>
            </div>
            <div className="text-center">
              <div className="mx-auto w-24 h-24 mb-4 flex items-center justify-center">
                <img src="/assets/pressfarm/flowers/squash-blossom.png" alt="" aria-hidden="true" className="w-full h-full object-contain" />
              </div>
              <p
                className="text-[10px] tracking-[0.28em] uppercase text-pf-master-gold mb-2"
                style={eyebrowFont}
              >
                Step Two
              </p>
              <h3 className="font-display text-xl text-farm-dark mb-3">Harvested</h3>
              <p className="text-sm text-farm-muted leading-[1.7] max-w-[18rem] mx-auto">
                Picked the morning of delivery. Chefs see what&apos;s ready
                and order the night before.
              </p>
            </div>
            <div className="text-center">
              <div className="mx-auto w-24 h-24 mb-4 flex items-center justify-center">
                <img src="/assets/pressfarm/flowers/marigold.png" alt="" aria-hidden="true" className="w-full h-full object-contain" />
              </div>
              <p
                className="text-[10px] tracking-[0.28em] uppercase text-pf-master-gold mb-2"
                style={eyebrowFont}
              >
                Step Three
              </p>
              <h3 className="font-display text-xl text-farm-dark mb-3">Delivered</h3>
              <p className="text-sm text-farm-muted leading-[1.7] max-w-[18rem] mx-auto">
                Thursday, Saturday, Monday. From bed to plate in hours,
                not days.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
           OUR CHEFS — partner restaurants
           ============================================================ */}
      <section className="px-6 py-20 sm:py-24">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <p
              className="text-[11px] tracking-[0.28em] uppercase text-pf-master-gold mb-3"
              style={eyebrowFont}
            >
              Our Chefs
            </p>
            <h2 className="font-display text-3xl sm:text-4xl text-farm-dark leading-tight">
              The kitchens we feed.
            </h2>
            <p className="text-sm text-farm-muted mt-3 max-w-md mx-auto">
              A small handful of restaurants, all within walking distance
              of where we plant.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-5">
            {RESTAURANTS.map((r) => (
              <div
                key={r.name}
                className="bg-white rounded-2xl border border-pf-master-gold/15 p-7 text-center"
              >
                <p
                  className="text-[10px] tracking-[0.28em] uppercase text-pf-master-gold mb-3"
                  style={eyebrowFont}
                >
                  Restaurant
                </p>
                <h3 className="font-display text-2xl text-farm-dark">{r.name}</h3>
                <div className="mt-3 flex items-center justify-center gap-1.5">
                  <div className="w-4 h-px bg-pf-master-gold/40" />
                  <div className="w-1 h-1 rounded-full bg-pf-master-gold" />
                  <div className="w-4 h-px bg-pf-master-gold/40" />
                </div>
                <p className="text-xs text-farm-muted mt-3">{r.note}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
           CTA — calling card on dark green
           ============================================================ */}
      <section className="px-6 py-20 sm:py-28 bg-farm-dark text-farm-cream text-center relative overflow-hidden">
        {/* Subtle background flowers on the dark panel */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[0.06]">
          <img src="/assets/pressfarm/flowers/calendula.png" className="absolute top-8 left-8 w-32" alt="" />
          <img src="/assets/pressfarm/flowers/borage.png" className="absolute bottom-8 right-8 w-32" alt="" />
        </div>

        <div className="relative max-w-2xl mx-auto space-y-6">
          <p
            className="text-[11px] tracking-[0.28em] uppercase text-pf-master-gold"
            style={eyebrowFont}
          >
            Chefs &amp; Restaurants
          </p>
          <h2 className="font-display text-3xl sm:text-4xl">
            Want produce<br className="sm:hidden" /> from Press Farm?
          </h2>

          <div className="flex items-center justify-center gap-2 max-w-xs mx-auto py-2">
            <div className="flex-1 h-px bg-pf-master-gold/40" />
            <div className="w-1.5 h-1.5 rounded-full bg-pf-master-gold" />
            <div className="flex-1 h-px bg-pf-master-gold/40" />
          </div>

          <p className="text-farm-cream/80 leading-[1.8] max-w-md mx-auto">
            We work with a small handful of restaurants in the Yountville
            area. If you&apos;re a chef interested in our produce, get in
            touch.
          </p>

          {/* Calling card details */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-xl mx-auto pt-4 text-left sm:text-center">
            <div>
              <p className="text-[10px] tracking-[0.22em] uppercase text-pf-master-gold mb-1" style={eyebrowFont}>Email</p>
              <a href="mailto:hello@pressfarm.io" className="text-sm text-farm-cream hover:underline">hello@pressfarm.io</a>
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

          <div className="pt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href="mailto:hello@pressfarm.io"
              className="login-cta inline-flex items-center"
              style={{ background: "#faf7f0", color: "#0D2A1E" }}
            >
              Send us a note
            </a>
            <Link href="/login" className="text-sm text-farm-cream/80 hover:text-farm-cream tracking-wide">
              Chef sign in →
            </Link>
          </div>
        </div>
      </section>

      {/* ============================================================
           FOOTER — masthead signature
           ============================================================ */}
      <footer className="px-6 py-12 text-center bg-farm-cream">
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-center gap-2">
            <div className="flex-1 h-px bg-pf-master-gold/30" />
            <div className="w-1.5 h-1.5 rounded-full bg-pf-master-gold" />
            <div className="flex-1 h-px bg-pf-master-gold/30" />
          </div>
          <p
            className="text-[10px] tracking-[0.32em] uppercase text-farm-muted mt-4"
            style={eyebrowFont}
          >
            Press Farm · Yountville · California · Est. 2024
          </p>
          <p className="text-[10px] text-farm-muted/60 mt-2 italic">
            Cultivated with chefs.
          </p>
        </div>
      </footer>
    </main>
  );
}
